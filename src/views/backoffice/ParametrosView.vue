<script setup>
import { ref, computed } from 'vue'
import BackofficeLayout from '@/layouts/BackofficeLayout.vue'
import { useRules } from '@/stores/rules.js'
import { useFormatters } from '@/composables/useFormatters.js'

const { rules, updateRules, resetRules } = useRules()
const { formatMoney } = useFormatters()

// Campos editáveis — cópias locais para formulário
const entradaMinimaPct        = ref(rules.entradaMinimaPct * 100)
const parcelasMaxAutoAprovacao = ref(rules.parcelasMaxAutoAprovacao)
const atrasoMaxAutoAprovacao   = ref(rules.atrasoMaxAutoAprovacao)
const valorMaxAutoAprovacao    = ref(rules.valorMaxAutoAprovacao)
const alcada1NivelMax          = ref(rules.alcada1NivelMax)
const parcelaMinimaValor       = ref(rules.parcelaMinimaValor)
const prazoEntradaHoras        = ref(rules.prazoEntradaHoras)
const cooldownCancelamentoDias = ref(rules.cooldownCancelamentoDias)

// Faixas de desconto
const faixas = ref(
  Object.entries(rules.descontoMaxPorFaixa).map(([faixa, valor]) => ({
    faixa,
    valor: valor * 100,
  }))
)

const saved = ref(false)
const resetted = ref(false)

function salvar() {
  updateRules({
    entradaMinimaPct:         entradaMinimaPct.value / 100,
    parcelasMaxAutoAprovacao:  Number(parcelasMaxAutoAprovacao.value),
    atrasoMaxAutoAprovacao:    Number(atrasoMaxAutoAprovacao.value),
    valorMaxAutoAprovacao:     Number(valorMaxAutoAprovacao.value),
    alcada1NivelMax:           Number(alcada1NivelMax.value),
    parcelaMinimaValor:        Number(parcelaMinimaValor.value),
    prazoEntradaHoras:         Number(prazoEntradaHoras.value),
    cooldownCancelamentoDias:  Number(cooldownCancelamentoDias.value),
    descontoMaxPorFaixa: Object.fromEntries(
      faixas.value.map(f => [f.faixa, f.valor / 100])
    ),
  })
  saved.value = true
  setTimeout(() => saved.value = false, 2500)
}

function restaurar() {
  resetRules()
  // Recarrega campos locais
  entradaMinimaPct.value        = rules.entradaMinimaPct * 100
  parcelasMaxAutoAprovacao.value = rules.parcelasMaxAutoAprovacao
  atrasoMaxAutoAprovacao.value   = rules.atrasoMaxAutoAprovacao
  valorMaxAutoAprovacao.value    = rules.valorMaxAutoAprovacao
  alcada1NivelMax.value          = rules.alcada1NivelMax
  parcelaMinimaValor.value       = rules.parcelaMinimaValor
  prazoEntradaHoras.value        = rules.prazoEntradaHoras
  cooldownCancelamentoDias.value = rules.cooldownCancelamentoDias
  faixas.value = Object.entries(rules.descontoMaxPorFaixa).map(([faixa, valor]) => ({
    faixa,
    valor: valor * 100,
  }))
  resetted.value = true
  setTimeout(() => resetted.value = false, 2500)
}

// Simulação em tempo real
const simEntrada = computed(() => {
  const val = 15000 // dívida fictícia de R$15k
  return formatMoney(val * (entradaMinimaPct.value / 100))
})
</script>

<template>
  <BackofficeLayout
    title="Parâmetros do Sistema"
    back-to="/backoffice/gerente"
    back-label="Dashboard"
  >
    <div class="max-w-3xl mx-auto space-y-6">

      <!-- Toast de salvamento -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="saved" class="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2 text-emerald-700 text-sm font-medium">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Parâmetros salvos! As novas regras já estão ativas para todo o sistema.
        </div>
      </Transition>
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="resetted" class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm font-medium">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
          Parâmetros restaurados para os valores padrão.
        </div>
      </Transition>

      <!-- ===== SEÇÃO: AUTO-APROVAÇÃO ===== -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Critérios de Auto-Aprovação
          </h3>
          <p class="text-xs text-gray-500 mt-1">Propostas que atendem TODOS estes critérios são aprovadas automaticamente, sem passar pela mesa.</p>
        </div>
        <div class="p-5 grid sm:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Entrada mínima (%)</label>
            <div class="flex items-center gap-3">
              <input v-model.number="entradaMinimaPct" type="range" min="5" max="50" step="1" class="flex-1 accent-[#2563eb]" />
              <span class="text-sm font-bold text-[#2563eb] w-12 text-right">{{ entradaMinimaPct }}%</span>
            </div>
            <p class="text-xs text-gray-400 mt-1">Ex: numa dívida de R$15k → entrada mín. de {{ simEntrada }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Parcelas máximas</label>
            <div class="flex items-center gap-3">
              <input v-model.number="parcelasMaxAutoAprovacao" type="range" min="3" max="36" step="1" class="flex-1 accent-[#2563eb]" />
              <span class="text-sm font-bold text-[#2563eb] w-12 text-right">{{ parcelasMaxAutoAprovacao }}x</span>
            </div>
            <p class="text-xs text-gray-400 mt-1">Acima disso, vai para análise da mesa.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Atraso máximo (dias)</label>
            <div class="flex items-center gap-3">
              <input v-model.number="atrasoMaxAutoAprovacao" type="range" min="15" max="180" step="5" class="flex-1 accent-[#2563eb]" />
              <span class="text-sm font-bold text-[#2563eb] w-12 text-right">{{ atrasoMaxAutoAprovacao }}d</span>
            </div>
            <p class="text-xs text-gray-400 mt-1">Contratos com mais dias de atraso precisam de análise.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Valor máximo da dívida</label>
            <input v-model.number="valorMaxAutoAprovacao" type="number" min="1000" step="1000" class="input-field" />
            <p class="text-xs text-gray-400 mt-1">{{ formatMoney(valorMaxAutoAprovacao) }} — acima disso, mesa analisa.</p>
          </div>
        </div>
      </div>

      <!-- ===== SEÇÃO: ALÇADAS ===== -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-3L16.5 18m0 0L12 13.5m4.5 4.5V6"/></svg>
            Alçadas e Limites
          </h3>
          <p class="text-xs text-gray-500 mt-1">Define até onde cada nível de aprovação pode decidir.</p>
        </div>
        <div class="p-5 grid sm:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Limite 1º Nível (analista)</label>
            <input v-model.number="alcada1NivelMax" type="number" min="1000" step="1000" class="input-field" />
            <p class="text-xs text-gray-400 mt-1">{{ formatMoney(alcada1NivelMax) }} — acima disso, escala para gerente.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Valor mínimo da parcela</label>
            <input v-model.number="parcelaMinimaValor" type="number" min="50" step="10" class="input-field" />
            <p class="text-xs text-gray-400 mt-1">{{ formatMoney(parcelaMinimaValor) }} — abaixo disso a proposta é bloqueada.</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Prazo p/ pagar entrada (horas)</label>
            <div class="flex items-center gap-3">
              <input v-model.number="prazoEntradaHoras" type="range" min="12" max="120" step="6" class="flex-1 accent-[#2563eb]" />
              <span class="text-sm font-bold text-[#2563eb] w-12 text-right">{{ prazoEntradaHoras }}h</span>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Cooldown após cancelamento (dias)</label>
            <div class="flex items-center gap-3">
              <input v-model.number="cooldownCancelamentoDias" type="range" min="7" max="90" step="1" class="flex-1 accent-[#2563eb]" />
              <span class="text-sm font-bold text-[#2563eb] w-12 text-right">{{ cooldownCancelamentoDias }}d</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== SEÇÃO: DESCONTOS POR FAIXA ===== -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h3 class="font-semibold text-gray-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/></svg>
            Desconto Máximo por Faixa de Atraso
          </h3>
          <p class="text-xs text-gray-500 mt-1">Desconto máximo permitido sobre o saldo devedor, por faixa de dias de atraso.</p>
        </div>
        <div class="p-5">
          <div class="space-y-3">
            <div v-for="f in faixas" :key="f.faixa" class="flex items-center gap-4">
              <span class="text-sm font-medium text-gray-600 w-24 shrink-0">{{ f.faixa }} dias</span>
              <input v-model.number="f.valor" type="range" min="0" max="50" step="1" class="flex-1 accent-purple-600" />
              <span class="text-sm font-bold text-purple-700 w-12 text-right">{{ f.valor }}%</span>
            </div>
          </div>
          <!-- Barra visual -->
          <div class="mt-4 flex rounded-lg overflow-hidden h-3">
            <div
              v-for="f in faixas"
              :key="f.faixa"
              class="transition-all duration-300"
              :class="{
                'bg-emerald-300': f.valor <= 5,
                'bg-amber-300': f.valor > 5 && f.valor <= 15,
                'bg-orange-400': f.valor > 15 && f.valor <= 25,
                'bg-red-400': f.valor > 25,
              }"
              :style="{ width: (100 / faixas.length) + '%' }"
              :title="`${f.faixa}d → ${f.valor}%`"
            />
          </div>
          <div class="flex justify-between text-[10px] text-gray-400 mt-1">
            <span v-for="f in faixas" :key="f.faixa" class="flex-1 text-center">{{ f.faixa }}d</span>
          </div>
        </div>
      </div>

      <!-- ===== AÇÕES ===== -->
      <div class="flex flex-col sm:flex-row gap-3">
        <button @click="salvar" class="btn-primary flex-1 flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          Salvar Parâmetros
        </button>
        <button @click="restaurar" class="btn-secondary flex-1 flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
          Restaurar Padrão
        </button>
      </div>

      <!-- Info -->
      <div class="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <strong>Como funciona:</strong> Ao salvar, as regras ficam ativas imediatamente para todas as telas (cliente e backoffice).
        Qualquer proposta submetida pelo cliente será avaliada com os novos parâmetros.
        Use "Restaurar Padrão" para voltar à configuração original do sistema.
      </div>

    </div>
  </BackofficeLayout>
</template>
