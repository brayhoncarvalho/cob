<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useProposal } from '@/stores/proposal.js'
import { useFlow } from '@/stores/flow.js'
import { useRules } from '@/stores/rules.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate } = useFormatters()
const { setProposal, setResult, setContractSnapshot } = useProposal()
const { state: flowState, submitProposal: flowSubmit } = useFlow()
const { rules } = useRules()

const contract = computed(() => flowState.contracts.find(c => c.id === route.params.id))

// ── Modo: escopo da negociação ────────────────────────────────────────────────
// 'debito'    = apenas parcelas vencidas
// 'contrato'  = saldo devedor completo (padrão)
const modoEscopo = ref('contrato')

const totalDueDebito = computed(() =>
  contract.value?.parcelas.filter(p => p.status === 'vencida').reduce((s, p) => s + p.valorAtualizado, 0) ?? 0
)

const totalDue = computed(() =>
  modoEscopo.value === 'debito' ? totalDueDebito.value : (contract.value?.saldoDevedor ?? 0)
)

// ── Desconto pré-aprovado por faixa de atraso ─────────────────────────────────
const descontoPct = computed(() => {
  const d = contract.value?.diasAtraso ?? 0
  const f = rules.descontoMaxPorFaixa
  if (d <= 30)  return f['0-30']
  if (d <= 60)  return f['31-60']
  if (d <= 90)  return f['61-90']
  if (d <= 120) return f['91-120']
  return f['120+']
})

const totalAcordo   = computed(() => totalDue.value * (1 - descontoPct.value))
const descontoReais = computed(() => totalDue.value - totalAcordo.value)
const minEntrada    = computed(() => totalDue.value * rules.entradaMinimaPct)

// ── Modo de cálculo ──────────────────────────────────────────────────────────
// 'entrada'  = usuário define entrada → calcula parcela
// 'parcela'  = usuário define parcela → calcula entrada
const modoCalculo = ref('entrada')

// Inputs do usuário
const entrada         = ref(Math.ceil(minEntrada.value))
const numParcelas     = ref(6)
const diaVencimento   = ref(5)
const valorParcelaInput = ref(0) // usado no modo 'parcela'

// Parcela máxima possível: totalAcordo / numParcelas (entrada = 0)
const maxParcelaInput = computed(() =>
  numParcelas.value > 0 ? Math.floor(totalAcordo.value / numParcelas.value) : 0
)

// Cálculos em tempo real
const valorParcela = computed(() => {
  if (modoCalculo.value === 'parcela') return valorParcelaInput.value
  const restante = Math.max(0, totalAcordo.value - entrada.value)
  return numParcelas.value > 0 ? restante / numParcelas.value : 0
})

const entradaCalculada = computed(() => {
  if (modoCalculo.value !== 'parcela') return entrada.value
  const porParcelas = valorParcelaInput.value * numParcelas.value
  return Math.max(0, totalAcordo.value - porParcelas)
})

const entradaEfetiva = computed(() =>
  modoCalculo.value === 'parcela' ? entradaCalculada.value : entrada.value
)

const entradaPct = computed(() =>
  totalDue.value > 0 ? entradaEfetiva.value / totalDue.value : 0
)

// Inicializa valorParcelaInput quando muda de modo
function onModoCalculo(modo) {
  modoCalculo.value = modo
  if (modo === 'parcela') {
    const restante = Math.max(0, totalAcordo.value - entrada.value)
    valorParcelaInput.value = numParcelas.value > 0 ? Math.round((restante / numParcelas.value) * 100) / 100 : 0
  } else {
    // volta entrada para o minimo
    entrada.value = Math.ceil(minEntrada.value)
  }
}

// Reinicia ao trocar escopo
watch(() => modoEscopo.value, () => {
  entrada.value = Math.ceil(minEntrada.value)
  valorParcelaInput.value = 0
  numParcelas.value = 6
})

// ── Bidirecionalidade parcela ↔ numParcelas (modo 'parcela') ─────────────────
let _syncingParcela = false

// Digitar parcela → ajusta slider de parcelas
watch(valorParcelaInput, (val) => {
  if (modoCalculo.value !== 'parcela' || _syncingParcela || val <= 0) return
  const n = Math.min(24, Math.max(1, Math.floor(totalAcordo.value / val)))
  if (n !== numParcelas.value) {
    _syncingParcela = true
    numParcelas.value = n
    _syncingParcela = false
  }
}, { flush: 'sync' })

// Mover slider → atualiza valor da parcela
watch(numParcelas, () => {
  if (modoCalculo.value !== 'parcela' || _syncingParcela) return
  _syncingParcela = true
  valorParcelaInput.value = maxParcelaInput.value
  _syncingParcela = false
}, { flush: 'sync' })

// Próxima data de vencimento do dia selecionado
const primeiroBoleto = computed(() => {
  const hoje = new Date()
  const ano  = hoje.getFullYear()
  const mes  = hoje.getMonth() + (hoje.getDate() >= diaVencimento.value ? 2 : 1)
  return new Date(ano, mes - 1, diaVencimento.value).toLocaleDateString('pt-BR')
})

// Bloqueios de negócio: cooldown e limite de tentativas
const bloqueioNegocio = computed(() => {
  const negs = flowState.negotiations.filter(n => n.contratoId === contract.value?.id)

  // cooldown
  const cancelada = negs
    .filter(n => n.status === 'cancelada' && n.dataCancelamento)
    .sort((a, b) => b.dataCancelamento.localeCompare(a.dataCancelamento))[0]
  if (cancelada) {
    const diasDesde = (Date.now() - new Date(cancelada.dataCancelamento)) / 86400000
    const cooldown  = rules.cooldownCancelamentoDias ?? 30
    if (diasDesde < cooldown) return { tipo: 'cooldown', diasRestantes: Math.ceil(cooldown - diasDesde) }
  }

  // limite de tentativas
  const tentativas = negs.filter(n =>
    ['em_analise','contraproposta','em_pagamento','aprovada','reprovada','cancelada','quitado'].includes(n.status)
  ).length
  const max = rules.maxTentativasNegociacao ?? 3
  if (tentativas >= max) return { tipo: 'tentativas', max }

  return null
})

// Status da proposta
const proposalStatus = computed(() => {
  if (modoCalculo.value === 'parcela' && valorParcelaInput.value > maxParcelaInput.value)
                                                        return 'blocked_max_parcela'
  if (entradaEfetiva.value <= 0)                       return 'blocked_zero'
  if (valorParcela.value < rules.parcelaMinimaValor)    return 'blocked_parcela'
  if (descontoReais.value > totalDue.value * 0.30)      return 'blocked_desconto'
  if (contract.value?.acordoAtivo)                      return 'blocked_acordo'
  if (bloqueioNegocio.value?.tipo === 'cooldown')       return 'blocked_cooldown'
  if (bloqueioNegocio.value?.tipo === 'tentativas')     return 'blocked_tentativas'

  const autoOk =
    entradaPct.value >= rules.entradaMinimaPct &&
    numParcelas.value <= rules.parcelasMaxAutoAprovacao &&
    (contract.value?.diasAtraso ?? 0) <= rules.atrasoMaxAutoAprovacao &&
    totalDue.value <= rules.valorMaxAutoAprovacao

  if (autoOk) return 'auto'
  return 'mesa' // sempre mesa — analista decide se escala internamente
})

const statusConfig = computed(() => ({
  auto:               { icon: 'success', label: 'Elegível para aprovação imediata!', cls: 'alert-success' },
  mesa:               { icon: 'warning', label: 'Proposta será analisada pela Mesa de Crédito — retorno em até 24h úteis.', cls: 'alert-warning' },
  blocked_zero:       { icon: 'blocked', label: 'Entrada obrigatória. Informe um valor maior que zero.', cls: 'alert-danger' },
  blocked_parcela:    { icon: 'blocked', label: `Parcela mínima: ${formatMoney(rules.parcelaMinimaValor)}. Reduza o número de parcelas.`, cls: 'alert-danger' },
  blocked_max_parcela:{ icon: 'blocked', label: `Com ${numParcelas.value}x, a parcela máxima é ${formatMoney(maxParcelaInput.value)}. Reduza o valor ou aumente as parcelas.`, cls: 'alert-danger' },
  blocked_desconto:   { icon: 'blocked', label: 'Desconto excede o máximo permitido para seu atraso. Aumente a entrada.', cls: 'alert-danger' },
  blocked_acordo:     { icon: 'blocked', label: 'Você já possui um acordo ativo neste contrato.', cls: 'alert-danger' },
  blocked_cooldown:   { icon: 'blocked', label: `Nova negociação bloqueada por ${bloqueioNegocio.value?.diasRestantes ?? rules.cooldownCancelamentoDias} dia(s) após cancelamento do acordo anterior.`, cls: 'alert-danger' },
  blocked_tentativas: { icon: 'blocked', label: `Limite de ${bloqueioNegocio.value?.max ?? rules.maxTentativasNegociacao} tentativas de negociação atingido para este contrato.`, cls: 'alert-danger' },
}[proposalStatus.value] ?? { icon: '', label: '', cls: '' }))

const canSubmit = computed(() => !proposalStatus.value.startsWith('blocked'))

function submit() {
  if (!canSubmit.value) return

  const id = `NEG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

  flowSubmit({
    id,
    contratoId:    contract.value.id,
    entrada:       entradaEfetiva.value,
    numParcelas:   numParcelas.value,
    valorParcela:  valorParcela.value,
    totalAcordo:   totalAcordo.value,
    desconto:      descontoReais.value,
    proposalStatus: proposalStatus.value,
  })

  setProposal({
    id,
    contratoId:    contract.value.id,
    entrada:       entradaEfetiva.value,
    numParcelas:   numParcelas.value,
    valorParcela:  valorParcela.value,
    diaVencimento: diaVencimento.value,
    totalAcordo:   totalAcordo.value,
    totalDivida:   totalDue.value,
    desconto:      descontoReais.value,
    descontoPct:   descontoPct.value,
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

            <!-- Toggle: escopo da negociação -->
            <div class="flex rounded-xl border border-gray-200 overflow-hidden mb-5">
              <button
                type="button"
                class="flex-1 py-2 text-sm font-medium transition-colors"
                :class="modoEscopo === 'contrato' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'"
                @click="modoEscopo = 'contrato'"
              >Contrato completo</button>
              <button
                type="button"
                class="flex-1 py-2 text-sm font-medium transition-colors border-l border-gray-200"
                :class="modoEscopo === 'debito' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'"
                @click="modoEscopo = 'debito'"
              >Apenas débito vencido</button>
            </div>

            <!-- Toggle: modo de cálculo -->
            <div class="flex items-center gap-4 mb-5">
              <span class="text-xs font-medium text-gray-500 shrink-0">Quero montar por:</span>
              <label class="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="radio" name="modoCalculo" value="entrada" :checked="modoCalculo === 'entrada'" @change="onModoCalculo('entrada')" class="accent-indigo-600" />
                <span class="text-sm" :class="modoCalculo === 'entrada' ? 'text-indigo-700 font-semibold' : 'text-gray-600'">Entrada</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="radio" name="modoCalculo" value="parcela" :checked="modoCalculo === 'parcela'" @change="onModoCalculo('parcela')" class="accent-indigo-600" />
                <span class="text-sm" :class="modoCalculo === 'parcela' ? 'text-indigo-700 font-semibold' : 'text-gray-600'">Parcela mensal</span>
              </label>
            </div>

            <!-- Entrada (modo entrada-first) -->
            <div v-if="modoCalculo === 'entrada'" class="mb-5">
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

            <!-- Valor da parcela (modo parcela-first) -->
            <div v-if="modoCalculo === 'parcela'" class="mb-5">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Valor da parcela desejada <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R$</span>
                <input
                  v-model.number="valorParcelaInput"
                  type="number"
                  :min="rules.parcelaMinimaValor"
                  :max="maxParcelaInput"
                  step="50"
                  class="input-field pl-10"
                  placeholder="0,00"
                />
              </div>
              <p class="text-xs mt-1 text-gray-400">
                Máximo com {{ numParcelas }}x:
                <span class="font-semibold" :class="valorParcelaInput > maxParcelaInput ? 'text-red-600' : 'text-gray-700'">
                  {{ formatMoney(maxParcelaInput) }}
                </span>
                · Entrada calculada:
                <span class="font-semibold text-gray-700">{{ formatMoney(entradaCalculada) }}</span>
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
              <option v-for="d in [1,5,10,15,20,25]" :key="d" :value="d">Dia {{ d }}</option>
              </select>
              <p class="text-xs text-gray-400 mt-1">Primeiro boleto: {{ primeiroBoleto }}</p>
            </div>
          </div>
        </div>

        <!-- Coluna direita: resultado em tempo real -->
        <div class="space-y-4">

          <!-- Banner desconto pré-aprovado -->
          <div v-if="descontoPct > 0" class="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 shadow">
            <div class="flex items-start gap-3">
              <div class="text-2xl mt-0.5">🎉</div>
              <div>
                <p class="font-bold text-sm">Desconto pré-aprovado de {{ (descontoPct * 100).toFixed(0) }}%!</p>
                <p class="text-xs text-green-100 mt-0.5">
                  Negocie hoje e economize <span class="font-bold text-white">{{ formatMoney(descontoReais) }}</span>.
                  Oferta pode expirar a qualquer momento.
                </p>
              </div>
            </div>
          </div>

          <!-- Card resultado -->
          <div class="card border-2 border-blue-200 bg-blue-50">
            <h3 class="font-semibold text-blue-900 mb-4">Resultado do acordo</h3>

            <div class="space-y-2 text-sm mb-4">
              <div class="flex justify-between">
                <span class="text-blue-700">Entrada (Pix)</span>
                <span class="font-bold text-blue-900">{{ formatMoney(entradaEfetiva) }}</span>
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
