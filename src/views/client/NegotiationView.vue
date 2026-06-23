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

// Bloqueios de negócio: limite de tentativas
const bloqueioNegocio = computed(() => {
  const negs = flowState.negotiations.filter(n => n.contratoId === contract.value?.id)

  // limite de tentativas
  const tentativas = negs.filter(n =>
    ['em_analise','contraproposta','em_pagamento','aprovada','reprovada','cancelada','quitado'].includes(n.status)
  ).length
  const max = rules.maxTentativasNegociacao ?? 3
  if (tentativas >= max) return { tipo: 'tentativas', max }

  return null
})

// Acordo realmente ativo: busca qualquer negociação ativa para este contrato
const acordoVivo = computed(() => {
  if (!contract.value) return null
  return flowState.negotiations.find(n =>
    n.contratoId === contract.value.id &&
    ['em_pagamento', 'em_analise', 'contraproposta'].includes(n.status)
  ) ?? null
})

// Status da proposta
const proposalStatus = computed(() => {
  if (modoCalculo.value === 'parcela' && valorParcelaInput.value > maxParcelaInput.value)
                                                        return 'blocked_max_parcela'
  if (entradaEfetiva.value <= 0)                       return 'blocked_zero'
  if (valorParcela.value < rules.parcelaMinimaValor)    return 'blocked_parcela'
  if (descontoReais.value > totalDue.value * 0.30)      return 'blocked_desconto'
  if (acordoVivo.value)                                 return 'blocked_acordo'
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
  mesa:               { icon: 'warning', label: 'Proposta será analisada pela Mesa de Crédito — retorno em até 24h.', cls: 'alert-warning' },
  blocked_zero:       { icon: 'blocked', label: 'Entrada obrigatória. Informe um valor maior que zero.', cls: 'alert-danger' },
  blocked_parcela:    { icon: 'blocked', label: `Parcela mínima: ${formatMoney(rules.parcelaMinimaValor)}. Reduza o número de parcelas.`, cls: 'alert-danger' },
  blocked_max_parcela:{ icon: 'blocked', label: `Com ${numParcelas.value}x, a parcela máxima é ${formatMoney(maxParcelaInput.value)}. Reduza o valor ou aumente as parcelas.`, cls: 'alert-danger' },
  blocked_desconto:   { icon: 'blocked', label: 'Desconto excede o máximo permitido para seu atraso. Aumente a entrada.', cls: 'alert-danger' },
  blocked_acordo:     { icon: 'blocked', label: 'Você já possui um acordo ativo neste contrato.', cls: 'alert-danger' },
  blocked_tentativas: { icon: 'blocked', label: `Limite de ${bloqueioNegocio.value?.max ?? rules.maxTentativasNegociacao} tentativas de negociação atingido para este contrato. Entre em contato com nosso atendimento para solicitar uma análise manual.`, cls: 'alert-danger', cta: '/negociacoes' },
}[proposalStatus.value] ?? { icon: '', label: '', cls: '' }))

const canSubmit = computed(() => !proposalStatus.value.startsWith('blocked'))

function submit() {
  if (!canSubmit.value) return

  // Capturar o status ANTES de criar a negociação (a reatividade vai mudar proposalStatus)
  const statusAtual = proposalStatus.value

  const id = `NEG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

  flowSubmit({
    id,
    contratoId:    contract.value.id,
    entrada:       entradaEfetiva.value,
    numParcelas:   numParcelas.value,
    valorParcela:  valorParcela.value,
    totalAcordo:   totalAcordo.value,
    desconto:      descontoReais.value,
    proposalStatus: statusAtual,
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
  setResult({ scenario: statusAtual })
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

        <!-- Coluna esquerda: formulário -->
        <div class="space-y-5">
          <div class="card">

            <!-- Escopo da negociação (segmented control) -->
            <div class="flex rounded-lg border border-gray-200 overflow-hidden mb-5">
              <button
                type="button"
                class="flex-1 py-2.5 text-sm font-medium transition-colors"
                :class="modoEscopo === 'contrato' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'"
                @click="modoEscopo = 'contrato'"
              >Negociar dívida total</button>
              <button
                type="button"
                class="flex-1 py-2.5 text-sm font-medium transition-colors border-l border-gray-200"
                :class="modoEscopo === 'debito' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'"
                @click="modoEscopo = 'debito'"
              >Negociar parcelas vencidas</button>
            </div>

            <!-- Entrada ou Parcela (progressive disclosure) -->
            <div v-if="modoCalculo === 'entrada'" class="mb-5">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Entrada</label>
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
              <div class="flex items-center justify-between mt-1">
                <p class="text-xs" :class="entradaPct < rules.entradaMinimaPct ? 'text-amber-600' : 'text-gray-400'">
                  Mínimo: {{ formatMoney(minEntrada) }} ({{ (rules.entradaMinimaPct * 100).toFixed(0) }}%)
                </p>
                <button type="button" @click="onModoCalculo('parcela')" class="text-xs text-blue-600 hover:underline">
                  Definir pela parcela →
                </button>
              </div>
            </div>

            <div v-if="modoCalculo === 'parcela'" class="mb-5">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Parcela</label>
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
              <div class="flex items-center justify-between mt-1">
                <p class="text-xs text-gray-400">
                  Máx: {{ formatMoney(maxParcelaInput) }} · Entrada: {{ formatMoney(entradaCalculada) }}
                </p>
                <button type="button" @click="onModoCalculo('entrada')" class="text-xs text-blue-600 hover:underline">
                  Definir pela entrada →
                </button>
              </div>
            </div>

            <!-- Parcelas -->
            <div class="mb-5">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Parcelas</label>
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
              <p v-if="numParcelas > 12" class="text-xs text-amber-600 mt-0.5">Acima de 12x requer aprovação da mesa</p>
            </div>

            <!-- Vencimento -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Vencimento</label>
              <select v-model.number="diaVencimento" class="input-field">
                <option v-for="d in [1,5,10,15,20,25]" :key="d" :value="d">Dia {{ d }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Coluna direita: resultado -->
        <div class="space-y-4">

          <!-- Card resultado -->
          <div class="card border border-blue-100 bg-blue-50">
            <h3 class="font-semibold text-blue-900 mb-4">Resumo do acordo</h3>

            <div class="flex justify-between text-sm mb-3 pb-3 border-b border-blue-200">
              <span class="text-blue-700">Dívida atual</span>
              <span class="font-bold text-blue-900">{{ formatMoney(totalDue) }}</span>
            </div>

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
                <span class="font-bold text-blue-900">Total</span>
                <span class="font-bold text-blue-900 text-base">{{ formatMoney(totalAcordo) }}</span>
              </div>
            </div>

            <!-- Desconto badge -->
            <div v-if="descontoReais > 0" class="bg-green-50 text-green-700 rounded-lg px-3 py-2 text-center font-semibold text-sm">
              Você economiza {{ formatMoney(descontoReais) }} ({{ (descontoPct * 100).toFixed(0) }}%)
            </div>
          </div>

          <!-- Status (só mostra se bloqueado ou se mudou do default) -->
          <div v-if="proposalStatus.startsWith('blocked')" :class="statusConfig.cls" class="text-sm flex items-start gap-2">
            <svg class="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            <div>
              <span>{{ statusConfig.label }}</span>
              <RouterLink v-if="statusConfig.cta" :to="statusConfig.cta" class="block mt-1 text-xs font-semibold text-red-700 underline hover:text-red-900">
                Falar com atendimento →
              </RouterLink>
            </div>
          </div>

          <!-- CTA -->
          <button
            @click="submit"
            :disabled="!canSubmit"
            class="btn-primary w-full text-base py-4"
          >
            Enviar Proposta
          </button>

          <p v-if="proposalStatus === 'mesa'" class="text-xs text-gray-400 text-center">
            Proposta será analisada — retorno em até 24h.
          </p>
        </div>
      </div>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
