<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const route = useRoute()
const { formatMoney, formatDate, formatDateTime } = useFormatters()
const router = useRouter()
const { state: flowState, markParcelaPaid, clientCancelNegotiation, acceptCounter } = useFlow()

function cancelarProposta() {
  clientCancelNegotiation(negotiation.value.id)
  router.push('/negociacoes')
}

function aceitarContraproposta() {
  acceptCounter(negotiation.value.id)
}

const negotiation = computed(() => flowState.negotiations.find(n => n.id === route.params.id))

// ── Stepper ───────────────────────────────────────────────────────────────────────────────
const stepperSteps = [
  { label: 'Enviada',      icon: 'send' },
  { label: 'Em Análise',   icon: 'clock' },
  { label: 'Decisão',      icon: 'gavel' },
  { label: 'Acordo Ativo', icon: 'check' },
]

const stepperStep = computed(() => {
  switch (negotiation.value?.status) {
    case 'em_pagamento': return 4
    case 'aprovada':     return 4
    case 'quitado':      return 4
    case 'contraproposta': return 3
    case 'reprovada':    return 3
    case 'cancelada':    return 1
    case 'em_analise':   return 2
    default:             return 1
  }
})

// Indica se o fluxo terminou sem acordo (reprovada/cancelada)
const stepperFailed = computed(() =>
  ['reprovada', 'cancelada'].includes(negotiation.value?.status)
)

// Confirmação visual pós-pagamento
const pagamentoConfirmado = ref(false)
const pagandoIndex = ref(null)

function pagarParcela(idx) {
  pagandoIndex.value = idx
  setTimeout(() => {
    markParcelaPaid(negotiation.value.id, idx)
    pagandoIndex.value = null
    pagamentoConfirmado.value = true
  }, 1200)
}

// ── Pagamento: modal Pix/Boleto ───────────────────────────────────────────────
const modalPagamento = ref(false)
const modalIdxParcela = ref(null)        // índice da parcela selecionada (null = próxima vencida)
const metodoPagamento = ref(null)        // 'pix' | 'boleto'

// Auto-open payment modal via ?pagar=1 query param
onMounted(() => {
  if (route.query.pagar === '1' && negotiation.value?.status === 'em_pagamento') {
    abrirModalPagamento()
  }
})

function abrirModalPagamento(idx = null) {
  modalIdxParcela.value = idx
  metodoPagamento.value = null
  modalPagamento.value  = true
}

function confirmarPagamento() {
  const idx = modalIdxParcela.value ?? negotiation.value?.parcelas.findIndex(
    p => p.status === 'proxima' || p.status === 'futura'
  )
  if (idx == null || idx < 0) return
  if (metodoPagamento.value === 'pix') {
    pixParcela.value = negotiation.value?.parcelas[idx] ?? null
    _pixPendingIdx.value = idx
    pixAberto.value = true
    modalPagamento.value = false
  } else if (metodoPagamento.value === 'boleto') {
    boletoAberto.value  = true
    pagarParcelaBoleto(idx)
    modalPagamento.value = false
  }
}

// Pix mockado
const pixAberto = ref(false)
const pixCopiado = ref(false)
const pixParcela = ref(null)
const _pixPendingIdx = ref(null)
const PIX_CHAVE = '00020126580014br.gov.bcb.pix0136dock-sa@pagamentos.com.br5204000053039865802BR5913Dock SA6008Sao Paulo62070503***6304ABCD'

function copiarPix() {
  navigator.clipboard?.writeText(PIX_CHAVE).catch(() => {})
  pixCopiado.value = true
  setTimeout(() => pixCopiado.value = false, 2000)
}

function fecharPix() {
  pixAberto.value = false
  _pixPendingIdx.value = null
}

function confirmarPixPagamento() {
  const idx = _pixPendingIdx.value
  pixAberto.value = false
  _pixPendingIdx.value = null
  if (idx !== null) {
    markParcelaPaid(negotiation.value.id, idx)
    pagandoIndex.value = null
    pagamentoConfirmado.value = true
  }
}

// Boleto
const boletoAberto = ref(false)
const boletoParcela = ref(null)
const boletoCopiado = ref(false)
const _boletoPendingIdx = ref(null)
const BOLETO_CODIGO = '23793.38128 60007.827136 98000.063308 3 00000000000000'

function pagarParcelaBoleto(idx) {
  boletoParcela.value = negotiation.value?.parcelas[idx] ?? null
  boletoAberto.value  = true
  pagandoIndex.value  = idx
  _boletoPendingIdx.value = idx
}

function fecharBoleto() {
  boletoAberto.value = false
  _boletoPendingIdx.value = null
}

function confirmarBoletoPagamento() {
  const idx = _boletoPendingIdx.value
  boletoAberto.value = false
  _boletoPendingIdx.value = null
  if (idx !== null) {
    markParcelaPaid(negotiation.value.id, idx)
    pagandoIndex.value = null
    pagamentoConfirmado.value = true
  }
}

function copiarBoleto() {
  navigator.clipboard?.writeText(BOLETO_CODIGO).catch(() => {})
  boletoCopiado.value = true
  setTimeout(() => boletoCopiado.value = false, 2000)
}

function baixarBoleto() {
  const conteudo =
    `BOLETO BANCÁRIO — SIMULAÇÃO\n\n` +
    `Beneficiário: Dock S.A. (00.000.000/0001-00)\n` +
    `Sacado: ${boletoParcela.value?.titular ?? 'Cliente'}\n` +
    `Vencimento: ${formatDate(boletoParcela.value?.vencimento)}\n` +
    `Valor: ${formatMoney(boletoParcela.value?.valor)}\n\n` +
    `Linha Digitável:\n${BOLETO_CODIGO}\n\n` +
    `Instruções: Não receber após o vencimento.`
  const blob = new Blob([conteudo], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `boleto-${route.params.id}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// Pix — definido acima (bloco "Pix mockado")
</script>

<template>
  <ClientLayout
    :title="`Acordo ${route.params.id}`"
    back-to="/negociacoes"
    back-label="Minhas Negociações"
  >
    <div v-if="!negotiation" class="card text-center py-12 text-gray-500">Negociação não encontrada.</div>

    <template v-else>

      <!-- ── STEPPER ──────────────────────────────────────────────────── -->
      <div class="card mb-5 py-4">
        <div class="flex items-center justify-between px-2">
          <template v-for="(step, idx) in stepperSteps" :key="step.label">
            <div class="flex flex-col items-center gap-1 flex-1">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                :class="stepperFailed && idx + 1 === stepperStep
                  ? 'bg-red-500 text-white ring-4 ring-red-500/25'
                  : stepperStep > idx + 1 || (stepperStep === idx + 1 && ['em_pagamento','quitado','aprovada'].includes(negotiation.status))
                    ? 'bg-green-500 text-white'
                    : stepperStep === idx + 1
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-gray-100 text-gray-400'"
              >
                <!-- ícone de falha -->
                <svg v-if="stepperFailed && idx + 1 === stepperStep" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                <!-- ícone de concluído -->
                <svg v-else-if="stepperStep > idx + 1" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                <span v-else>{{ idx + 1 }}</span>
              </div>
              <span
                class="text-xs text-center leading-tight"
                :class="stepperFailed && idx + 1 === stepperStep
                  ? 'text-red-600 font-semibold'
                  : stepperStep === idx + 1
                    ? 'text-blue-700 font-semibold'
                    : 'text-gray-400'"
              >{{ step.label }}</span>
            </div>
            <!-- linha conectora -->
            <div
              v-if="idx < stepperSteps.length - 1"
              class="h-0.5 flex-1 mx-1 -mt-5"
              :class="stepperStep > idx + 1 && !stepperFailed ? 'bg-green-400' : 'bg-gray-200'"
            />
          </template>
        </div>
        <!-- Legenda de status abaixo do stepper -->
        <p class="text-center text-xs mt-3"
          :class="negotiation.status === 'em_pagamento' ? 'text-green-600 font-semibold'
            : negotiation.status === 'em_analise' ? 'text-blue-600'
            : negotiation.status === 'contraproposta' ? 'text-amber-600 font-semibold'
            : negotiation.status === 'reprovada' ? 'text-red-500'
            : negotiation.status === 'cancelada' ? 'text-gray-400'
            : 'text-gray-500'"
        >
          <span v-if="negotiation.status === 'em_analise'">Aguardando análise da Mesa de Crédito</span>
          <span v-else-if="negotiation.status === 'contraproposta'">A Mesa enviou uma contraproposta — avalie antes do prazo expirar</span>
          <span v-else-if="negotiation.status === 'em_pagamento'">Acordo ativo — mantenha os pagamentos em dia</span>
          <span v-else-if="negotiation.status === 'reprovada'">Proposta reprovada</span>
          <span v-else-if="negotiation.status === 'cancelada'">Proposta cancelada</span>
        </p>

      </div>

      <!-- Header do acordo -->
      <div class="card mb-6">

      <!-- Toast de confirmação removido — substituído por modal centralizado -->
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <h2 class="font-mono font-bold text-gray-900">{{ negotiation.id }}</h2>
          <StatusBadge :status="negotiation.status" />
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-xs text-gray-400 mb-0.5">Contrato</p>
            <RouterLink :to="`/contratos/${negotiation.contratoId}`" class="font-semibold text-blue-600 hover:underline">
              #{{ negotiation.contratoId }}
            </RouterLink>
          </div>
          <div v-if="negotiation.dataAprovacao">
            <p class="text-xs text-gray-400 mb-0.5">Aprovado em</p>
            <p class="font-semibold">{{ formatDateTime(negotiation.dataAprovacao) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-0.5">Total do acordo</p>
            <p class="font-semibold">{{ formatMoney(negotiation.totalAcordo) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-0.5">Desconto obtido</p>
            <p class="font-semibold text-green-600">{{ formatMoney(negotiation.desconto) }}</p>
          </div>
        </div>

        <!--
        <div v-if="negotiation.status === 'em_pagamento'" class="alert-warning mt-4 text-xs flex items-start gap-1.5">
          <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          <span>O não pagamento de qualquer parcela por mais de 10 dias cancela o acordo e restaura o débito original.</span>
        </div>-->

        <div v-if="negotiation.status === 'em_analise'" class="alert-info mt-4 text-xs flex items-start justify-between gap-3">
          <div class="flex items-start gap-1.5">
            <svg class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Sua proposta está sendo avaliada pela Mesa de Crédito. Prazo: {{ formatDateTime(negotiation.prazoResposta) }}.</span>
          </div>
          <button
            type="button"
            @click="cancelarProposta"
            class="shrink-0 btn-danger text-xs py-1 px-3"
          >Cancelar proposta</button>
        </div>
        <div v-if="negotiation.status === 'contraproposta'" class="mt-4 rounded-2xl bg-amber-50 border-2 border-amber-400 px-5 py-4">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
            <p class="font-bold text-amber-800 text-sm">Contraproposta recebida!</p>
          </div>
          <p class="text-xs text-amber-700 mb-3">A Mesa de Crédito enviou novas condições. Avalie e decida antes do prazo expirar.</p>
          <div class="bg-white rounded-xl px-4 py-3 space-y-1.5 text-xs mb-4 border border-amber-200">
            <div class="flex justify-between">
              <span class="text-gray-500">Nova entrada</span>
              <span class="font-bold text-amber-700">{{ formatMoney(negotiation.contraproposta?.entrada ?? negotiation.entrada) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Parcelas</span>
              <span class="font-medium">{{ negotiation.contraproposta?.numParcelas ?? negotiation.numParcelas }}x de {{ formatMoney(negotiation.contraproposta?.valorParcela ?? negotiation.valorParcela) }}</span>
            </div>
            <div class="flex justify-between border-t pt-1.5">
              <span class="font-semibold text-gray-700">Total</span>
              <span class="font-bold">{{ formatMoney(negotiation.contraproposta?.total ?? negotiation.totalAcordo) }}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              @click="aceitarContraproposta"
              class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl py-2.5 transition-colors"
            >Aceitar proposta</button>
            <button
              type="button"
              @click="cancelarProposta"
              class="flex-1 border-2 border-red-400 text-red-600 hover:bg-red-50 font-semibold text-sm rounded-xl py-2.5 transition-colors"
            >Recusar</button>
          </div>
        </div>
        <div v-if="negotiation.status === 'reprovada'" class="alert-danger mt-4 text-xs flex items-start gap-1.5">
          <svg class="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>{{ negotiation.motivo }}
          <RouterLink :to="`/contratos/${negotiation.contratoId}/negociar`" class="block mt-1 font-semibold hover:underline">
            Tentar nova simulação →
          </RouterLink></span>
        </div>
        <div v-if="negotiation.status === 'quitado'" class="mt-4 rounded-xl bg-green-50 border border-green-500/25 px-4 py-4 flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <p class="font-semibold text-green-800 text-sm">Parabéns! Acordo totalmente quitado.</p>
            <p class="text-xs text-green-700 mt-0.5">Todas as parcelas foram pagas. Este contrato está encerrado.</p>
            <RouterLink to="/contratos" class="block mt-2 text-xs font-semibold text-green-700 hover:underline">Ver meus contratos →</RouterLink>
          </div>
        </div>
      </div>

      <!-- Parcelas do acordo (se em pagamento) -->
      <div v-if="negotiation.parcelas?.length" class="card mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="font-semibold text-gray-900">Parcelas do acordo</h3>

          <!-- Ações de pagamento -->
          <div v-if="negotiation.status === 'em_pagamento'">
            <button @click="abrirModalPagamento()" class="btn-primary flex items-center gap-2 text-sm py-1.5 px-3">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
              Pagar Próxima
            </button>
          </div>
        </div>

        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm min-w-[480px]">
            <thead>
              <tr class="text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left py-2 font-medium">#</th>
                <th class="text-left py-2 font-medium">Tipo</th>
                <th class="text-left py-2 font-medium">Vencimento</th>
                <th class="text-right py-2 font-medium">Valor</th>
                <th class="text-center py-2 font-medium">Status</th>
                <th class="text-right py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="(p, idx) in negotiation.parcelas"
                :key="p.numero"
                :class="p.status === 'proxima' ? 'bg-blue-100' : ''"
              >
                <td class="py-2.5 text-xs font-mono text-gray-400">{{ p.numero }}</td>
                <td class="py-2.5 text-xs text-gray-500 capitalize">{{ p.tipo }}</td>
                <td class="py-2.5">{{ formatDate(p.vencimento) }}</td>
                <td class="py-2.5 text-right font-semibold">{{ formatMoney(p.valor) }}</td>
                <td class="py-2.5 text-center">
                  <StatusBadge :status="p.status" small />
                </td>
                <td class="py-2.5 text-right">
                  <template v-if="p.status === 'proxima' || p.status === 'futura'">
                    <button
                      @click="abrirModalPagamento(idx)"
                      :disabled="pagandoIndex === idx"
                      class="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {{ pagandoIndex === idx ? '...' : 'Pagar' }}
                    </button>
                  </template>
                  <span v-else class="text-xs text-gray-300">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Modal: escolha de método de pagamento -->
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
          <div v-if="modalPagamento" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="modal-pag-title">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h3 id="modal-pag-title" class="text-base font-semibold text-gray-900 mb-1">Escolha a forma de pagamento</h3>
              <p class="text-sm text-gray-500 mb-4">Como você prefere pagar esta parcela?</p>
              <div class="grid grid-cols-2 gap-3 mb-5">
                <button
                  @click="metodoPagamento = 'pix'"
                  :class="metodoPagamento === 'pix' ? 'ring-2 ring-blue-600 bg-blue-50' : 'bg-gray-50 hover:bg-gray-100'"
                  class="rounded-xl p-4 flex flex-col items-center gap-2 transition-all"
                >
                  <svg class="w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 2.4a1.2 1.2 0 011.4 0l7.2 5.2c.4.3.6.7.6 1.2v6.4c0 .5-.2.9-.6 1.2l-7.2 5.2a1.2 1.2 0 01-1.4 0L4.1 16.4A1.2 1.2 0 013.5 15V8.8c0-.5.2-.9.6-1.2L11.3 2.4z"/></svg>
                  <span class="text-sm font-semibold text-gray-800">Pix</span>
                  <span class="text-xs text-gray-400">Aprovação imediata</span>
                </button>
                <button
                  @click="metodoPagamento = 'boleto'"
                  :class="metodoPagamento === 'boleto' ? 'ring-2 ring-amber-500 bg-amber-50' : 'bg-gray-50 hover:bg-gray-100'"
                  class="rounded-xl p-4 flex flex-col items-center gap-2 transition-all"
                >
                  <svg class="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                  <span class="text-sm font-semibold text-gray-800">Boleto</span>
                  <span class="text-xs text-gray-400">Vence em 1 dia útil</span>
                </button>
              </div>
              <div class="flex gap-3">
                <button @click="modalPagamento = false" class="btn-secondary flex-1">Cancelar</button>
                <button @click="confirmarPagamento" :disabled="!metodoPagamento" class="btn-primary flex-1 disabled:opacity-40">
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Modal: Pix gerado -->
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
          <div v-if="pixAberto && pixParcela" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="modal-pix-title">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 id="modal-pix-title" class="font-semibold text-gray-900 flex items-center gap-2">
                  <svg class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 2.4a1.2 1.2 0 011.4 0l7.2 5.2c.4.3.6.7.6 1.2v6.4c0 .5-.2.9-.6 1.2l-7.2 5.2a1.2 1.2 0 01-1.4 0L4.1 16.4A1.2 1.2 0 013.5 15V8.8c0-.5.2-.9.6-1.2L11.3 2.4z"/></svg>
                  Pagar via Pix
                </h3>
                <button @click="fecharPix" class="text-gray-400 hover:text-gray-600" aria-label="Fechar">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <p class="text-xs text-gray-500 mb-4">Vencimento: {{ formatDate(pixParcela.vencimento) }} &bull; Valor: <strong>{{ formatMoney(pixParcela.valor) }}</strong></p>
              <!-- QR Code mockado -->
              <div class="bg-gray-50 rounded-xl p-4 mb-3 flex justify-center">
                <div class="w-32 h-32 grid grid-cols-8 gap-px" aria-hidden="true">
                  <template v-for="(v, i) in [1,1,1,1,1,1,1,0,1,0,0,0,1,0,0,1,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,0,1,0,0,0,1,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1]" :key="i">
                    <div :class="v ? 'bg-gray-900' : 'bg-white'" class="aspect-square rounded-[1px]" />
                  </template>
                </div>
              </div>
              <p class="text-center text-xs text-gray-400 mb-3">Escaneie o QR code ou copie a chave abaixo</p>
              <!-- Chave Pix -->
              <div class="bg-gray-50 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 break-all mb-4 select-all">
                {{ PIX_CHAVE }}
              </div>
              <div class="flex flex-col gap-2">
                <button @click="confirmarPixPagamento" class="btn-primary w-full text-sm">
                  Confirmar pagamento
                </button>
                <button @click="copiarPix" :class="pixCopiado ? 'btn-success' : 'btn-secondary'" class="w-full flex items-center justify-center gap-2 text-sm">
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
                  {{ pixCopiado ? 'Chave copiada!' : 'Copiar chave Pix' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Modal: boleto gerado -->
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
          <div v-if="boletoAberto && boletoParcela" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="modal-boleto-title">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 id="modal-boleto-title" class="font-semibold text-gray-900 flex items-center gap-2">
                  <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                  Boleto Bancário
                </h3>
                <button @click="fecharBoleto" class="text-gray-400 hover:text-gray-600" aria-label="Fechar boleto">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <p class="text-xs text-gray-500 mb-4">Vencimento: {{ formatDate(boletoParcela.vencimento) }} &bull; Valor: <strong>{{ formatMoney(boletoParcela.valor) }}</strong></p>
              <!-- Código de barras visual (mockado) -->
              <div class="bg-gray-50 rounded-xl p-3 mb-3 flex justify-center">
                <div class="flex items-end gap-px h-12" aria-hidden="true">
                  <template v-for="(w, i) in [3,1,2,1,4,1,2,3,1,1,2,4,1,3,2,1,1,3,4,1,2,1,3,1,2,4,1,1,3,2,1,4,3,1,2,1,3,1,4,2,1,3,1,2]" :key="i">
                    <div class="bg-gray-800" :style="{ width: w + 'px', height: (i % 5 === 0 ? 100 : 80) + '%' }" />
                  </template>
                </div>
              </div>
              <!-- Linha digitável -->
              <div class="bg-gray-50 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 break-all mb-4 select-all">
                {{ BOLETO_CODIGO }}
              </div>
              <div class="flex flex-col gap-2">
                <button @click="confirmarBoletoPagamento" class="btn-primary w-full text-sm">
                  Confirmar pagamento
                </button>
                <div class="flex gap-2">
                  <button @click="copiarBoleto" :class="boletoCopiado ? 'btn-success' : 'btn-secondary'" class="flex-1 flex items-center justify-center gap-2 text-sm">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
                    {{ boletoCopiado ? 'Copiado!' : 'Copiar código' }}
                  </button>
                  <button @click="baixarBoleto" class="btn-secondary flex items-center gap-2 text-sm">
                    <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                    Baixar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Modal: confirmação Pix -->
      <Teleport to="body">
        <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
          <div v-if="pagamentoConfirmado" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
            <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
              <svg class="w-14 h-14 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <h3 class="text-lg font-bold text-gray-900 mb-1">Pagamento registrado!</h3>
              <p class="text-sm text-gray-500 mb-6">Sua parcela foi confirmada com sucesso.</p>
              <button @click="pagamentoConfirmado = false" class="btn-primary w-full">Fechar</button>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Proposta em análise — info -->
      <div v-if="negotiation.status === 'em_analise'" class="card">
        <h3 class="font-semibold text-gray-900 mb-3">Detalhes da proposta enviada</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p class="text-xs text-gray-400">Entrada</p>
            <p class="font-semibold">{{ formatMoney(negotiation.entrada) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">Parcelas</p>
            <p class="font-semibold">{{ negotiation.numParcelas }}x de {{ formatMoney(negotiation.valorParcela) }}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400">Total proposto</p>
            <p class="font-semibold">{{ formatMoney(negotiation.totalAcordo) }}</p>
          </div>
        </div>
      </div>

    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
