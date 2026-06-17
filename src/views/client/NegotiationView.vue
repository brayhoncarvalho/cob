<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useProposal } from '@/stores/proposal.js'
import contractsData from '@/mocks/contracts.json'
import rules from '@/mocks/rules.json'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate } = useFormatters()
const { setProposal, setResult, setContractSnapshot } = useProposal()

const contract = computed(() => contractsData.find(c => c.id === route.params.id))

// Desconto máximo pela faixa de atraso
const descontoPct = computed(() => {
  const d = contract.value?.diasAtraso ?? 0
  const f = rules.descontoMaxPorFaixa
  if (d <= 30)  return f['0-30']
  if (d <= 60)  return f['31-60']
  if (d <= 90)  return f['61-90']
  if (d <= 120) return f['91-120']
  return f['120+']
})

const totalDue       = computed(() => contract.value?.saldoDevedor ?? 0)
const totalAcordo    = computed(() => totalDue.value * (1 - descontoPct.value))
const desconto       = computed(() => totalDue.value - totalAcordo.value)
const descontoReais  = computed(() => desconto.value)
const minEntrada     = computed(() => totalDue.value * rules.entradaMinimaPct)

// Inputs do usuário
const entrada       = ref(Math.ceil(minEntrada.value))
const numParcelas   = ref(6)
const diaVencimento = ref(5)

// Cálculos em tempo real
const restante       = computed(() => Math.max(0, totalAcordo.value - entrada.value))
const valorParcela   = computed(() => numParcelas.value > 0 ? restante.value / numParcelas.value : 0)
const entradaPct     = computed(() => totalDue.value > 0 ? entrada.value / totalDue.value : 0)

// Próxima data de vencimento do dia selecionado
const primeiroBoleto = computed(() => {
  const hoje = new Date()
  const ano  = hoje.getFullYear()
  const mes  = hoje.getMonth() + (hoje.getDate() >= diaVencimento.value ? 2 : 1)
  return new Date(ano, mes - 1, diaVencimento.value).toLocaleDateString('pt-BR')
})

// Status da proposta
const proposalStatus = computed(() => {
  if (entrada.value <= 0)                       return 'blocked_zero'
  if (valorParcela.value < rules.parcelaMinimaValor) return 'blocked_parcela'
  if (descontoReais.value > totalDue.value * 0.30)   return 'blocked_desconto'
  if (contract.value?.acordoAtivo)               return 'blocked_acordo'

  const autoOk =
    entradaPct.value >= rules.entradaMinimaPct &&
    numParcelas.value <= rules.parcelasMaxAutoAprovacao &&
    (contract.value?.diasAtraso ?? 0) <= rules.atrasoMaxAutoAprovacao &&
    totalDue.value <= rules.valorMaxAutoAprovacao

  if (autoOk) return 'auto'

  const mesa2 =
    entradaPct.value < 0.10 ||
    numParcelas.value > 18 ||
    (contract.value?.diasAtraso ?? 0) > 120 ||
    totalDue.value > 50000

  return mesa2 ? 'mesa2' : 'mesa1'
})

const statusConfig = computed(() => ({
  auto:             { icon: 'success', label: 'Elegível para aprovação imediata!', cls: 'alert-success' },
  mesa1:            { icon: 'warning', label: 'Proposta será analisada pela Mesa de Crédito (1º Nível) — até 4h úteis.', cls: 'alert-warning' },
  mesa2:            { icon: 'warning', label: 'Proposta fora da política padrão. Análise pelo 2º Nível — até 24h úteis.', cls: 'alert-warning' },
  blocked_zero:     { icon: 'blocked', label: 'Entrada obrigatória. Informe um valor maior que zero.', cls: 'alert-danger' },
  blocked_parcela:  { icon: 'blocked', label: `Parcela mínima: ${formatMoney(rules.parcelaMinimaValor)}. Reduza o número de parcelas.`, cls: 'alert-danger' },
  blocked_desconto: { icon: 'blocked', label: 'Desconto excede o máximo permitido para seu atraso. Aumente a entrada.', cls: 'alert-danger' },
  blocked_acordo:   { icon: 'blocked', label: 'Você já possui um acordo ativo neste contrato.', cls: 'alert-danger' },
}[proposalStatus.value] ?? { icon: '', label: '', cls: '' }))

const canSubmit = computed(() => !proposalStatus.value.startsWith('blocked'))

function submit() {
  if (!canSubmit.value) return
  setProposal({
    contratoId: contract.value.id,
    entrada: entrada.value,
    numParcelas: numParcelas.value,
    valorParcela: valorParcela.value,
    diaVencimento: diaVencimento.value,
    totalAcordo: totalAcordo.value,
    totalDivida: totalDue.value,
    desconto: descontoReais.value,
    descontoPct: descontoPct.value,
    primeiroBoleto: primeiroBoleto.value,
  })
  setResult({ scenario: proposalStatus.value })
  setContractSnapshot({ ...contract.value })
  router.push('/proposta/resultado')
}
</script>

<template>
  <ClientLayout
    :title="`Negociar — Contrato #${route.params.id}`"
    :back-to="`/contratos/${route.params.id}`"
    back-label="Contrato"
  >
    <div v-if="!contract" class="card text-center text-gray-500 py-12">Contrato não encontrado.</div>

    <template v-else>
      <div class="grid lg:grid-cols-2 gap-6">

        <!-- Coluna esquerda: situação + formulário -->
        <div class="space-y-6">

          <!-- Situação atual -->
          <div class="card border-red-200 bg-red-50">
            <h3 class="font-semibold text-red-800 mb-3">Sua situação atual</h3>
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between">
                <span class="text-red-700">Valor original em aberto</span>
                <span class="font-medium text-red-800">{{ formatMoney(contract.valorOriginalEmAberto) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-red-700">Juros e multas acumulados</span>
                <span class="font-medium text-red-800">+ {{ formatMoney(contract.jurosAcumulados) }}</span>
              </div>
              <div class="border-t border-red-200 pt-2 mt-1 flex justify-between">
                <span class="font-bold text-red-800">TOTAL DEVIDO HOJE</span>
                <span class="font-bold text-red-800 text-base">{{ formatMoney(totalDue) }}</span>
              </div>
              <div v-if="descontoPct > 0" class="flex justify-between text-green-700 font-medium pt-1">
                <span>Desconto disponível ({{ (descontoPct * 100).toFixed(0) }}%)</span>
                <span>- {{ formatMoney(descontoReais) }}</span>
              </div>
            </div>
          </div>

          <!-- Monte sua proposta -->
          <div class="card">
            <h3 class="font-semibold text-gray-900 mb-4">Monte sua proposta</h3>

            <!-- Entrada -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Valor de entrada <span class="text-red-500">*</span>
                <span class="font-normal text-gray-400 ml-1">(via Pix)</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R$</span>
                <input
                  v-model.number="entrada"
                  type="number"
                  :min="1"
                  :max="totalAcordo"
                  step="50"
                  class="input-field pl-10"
                  placeholder="0,00"
                />
              </div>
              <p class="text-xs mt-1" :class="entradaPct < rules.entradaMinimaPct ? 'text-amber-600' : 'text-gray-400'">
                Mínimo sugerido: {{ formatMoney(minEntrada) }} ({{ (rules.entradaMinimaPct * 100).toFixed(0) }}%)
                · Você está com {{ (entradaPct * 100).toFixed(0) }}%
              </p>
            </div>

            <!-- Número de parcelas -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Parcelas restantes
                <span class="font-normal text-gray-400 ml-1">(boleto ou Pix)</span>
              </label>
              <div class="flex items-center gap-3">
                <input
                  v-model.number="numParcelas"
                  type="range"
                  min="1"
                  max="24"
                  class="flex-1 accent-blue-600"
                />
                <span class="font-bold text-blue-700 text-lg w-10 text-right">{{ numParcelas }}x</span>
              </div>
              <div class="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1x</span>
                <span class="text-amber-600 font-medium" v-if="numParcelas > 12">
                  <svg class="inline w-3.5 h-3.5 -mt-0.5 mr-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                  Acima de 12x requer aprovação da mesa
                </span>
                <span>24x</span>
              </div>
            </div>

            <!-- Dia do vencimento -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Dia de vencimento dos boletos</label>
              <select v-model.number="diaVencimento" class="input-field">
                <option v-for="d in 28" :key="d" :value="d">Dia {{ d }}</option>
              </select>
              <p class="text-xs text-gray-400 mt-1">Primeiro boleto: {{ primeiroBoleto }}</p>
            </div>
          </div>
        </div>

        <!-- Coluna direita: resultado em tempo real -->
        <div class="space-y-4">

          <!-- Card resultado -->
          <div class="card border-2 border-blue-200 bg-blue-50">
            <h3 class="font-semibold text-blue-900 mb-4">Resultado do acordo</h3>

            <div class="space-y-2 text-sm mb-4">
              <div class="flex justify-between">
                <span class="text-blue-700">Entrada (Pix)</span>
                <span class="font-bold text-blue-900">{{ formatMoney(entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-blue-700">{{ numParcelas }}x de</span>
                <span class="font-bold text-blue-900">{{ formatMoney(valorParcela) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-blue-700">Primeiro boleto</span>
                <span class="font-medium text-blue-800">{{ primeiroBoleto }}</span>
              </div>
              <div class="border-t border-blue-200 pt-2 mt-1 flex justify-between">
                <span class="font-bold text-blue-900">Total do acordo</span>
                <span class="font-bold text-blue-900 text-base">{{ formatMoney(totalAcordo) }}</span>
              </div>
            </div>

            <!-- Desconto badge -->
            <div v-if="descontoReais > 0" class="bg-green-100 text-green-800 rounded-xl p-3 text-center font-semibold text-sm flex items-center justify-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
              Desconto: {{ formatMoney(descontoReais) }} ({{ (descontoPct * 100).toFixed(0) }}%)
            </div>
          </div>

          <!-- Comparação (persuasão) -->
          <div class="card">
            <h4 class="font-semibold text-gray-800 mb-3 text-sm">Comparação</h4>
            <div class="space-y-2">
              <div class="flex justify-between items-center p-2 rounded-lg bg-red-50">
                <span class="text-xs text-red-700">Sem acordo (e juros subindo)</span>
                <span class="font-bold text-red-700 text-sm">{{ formatMoney(totalDue) }}</span>
              </div>
              <div class="flex justify-between items-center p-2 rounded-lg bg-green-50">
                <span class="text-xs text-green-700">Com acordo (valor congelado)</span>
                <span class="font-bold text-green-700 text-sm">{{ formatMoney(totalAcordo) }}</span>
              </div>
              <div v-if="descontoReais > 0" class="text-center text-xs font-semibold text-green-700 py-1 flex items-center justify-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                Você economiza {{ formatMoney(descontoReais) }}
              </div>
            </div>
          </div>

          <!-- Status da proposta -->
          <div :class="statusConfig.cls" class="text-sm flex items-start gap-2">
            <svg v-if="statusConfig.icon === 'success'" class="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <svg v-else-if="statusConfig.icon === 'warning'" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            <svg v-else-if="statusConfig.icon === 'blocked'" class="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            <span>{{ statusConfig.label }}</span>
          </div>

          <!-- Submeter -->
          <button
            @click="submit"
            :disabled="!canSubmit"
            class="btn-primary w-full text-base py-4"
          >
            Enviar Proposta
          </button>

          <p class="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
            Entrada via Pix. Parcelas restantes via Pix ou Boleto.
          </p>
        </div>
      </div>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
