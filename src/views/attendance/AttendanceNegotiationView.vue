<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AttendanceLayout from '@/layouts/AttendanceLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useAuth } from '@/stores/auth.js'
import { useRules } from '@/stores/rules.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate } = useFormatters()
const { state: flowState, submitAttendantProposal, cancelAttendantProposal, markParcelaPaid, acceptCounter } = useFlow()
const { state: authState } = useAuth()
const { rules } = useRules()

const clienteId = computed(() => route.params.clienteId)

// IDs dos contratos do cliente — necessário para encontrar negociações sem clienteCpf
const contratoIdsDoCliente = computed(() =>
  flowState.contracts.map(c => c.id)
)

// ── Proposta com acordo ativo — busca por clienteCpf OU por contratoId do cliente ────
const propostaPendente = computed(() =>
  flowState.negotiations.find(n =>
    ['em_pagamento', 'em_analise', 'contraproposta'].includes(n.status) &&
    (n.clienteCpf === clienteId.value || contratoIdsDoCliente.value.includes(n.contratoId))
  ) ?? null
)

const cancelando = ref(false)
function cancelarProposta() {
  if (!propostaPendente.value) return
  cancelAttendantProposal(propostaPendente.value.id)
  cancelando.value = true
}

function aceitarContraproposta() {
  if (!propostaPendente.value) return
  acceptCounter(propostaPendente.value.id)
}

// ── Contratos ─────────────────────────────────────────────────────────────────
const contratos = computed(() => flowState.contracts.filter(c => c.status !== 'quitado'))
const contratoSelecionado = ref(contratos.value[0]?.id ?? '')

const contract = computed(() => flowState.contracts.find(c => c.id === contratoSelecionado.value))

// ── Escopo da negociação ─────────────────────────────────────────────────────
// 'total'  = saldo devedor completo (encerra o contrato original)
// 'debito' = apenas parcelas vencidas (contrato original continua rodando)
const modoEscopo = ref('total')

const totalDebitoVencido = computed(() =>
  contract.value?.parcelas?.filter(p => p.status === 'vencida').reduce((s, p) => s + p.valorAtualizado, 0) ?? 0
)

// Desconto pelo atraso
const descontoPct = computed(() => {
  const d = contract.value?.diasAtraso ?? 0
  const f = rules.descontoMaxPorFaixa
  if (d <= 30)  return f['0-30']
  if (d <= 60)  return f['31-60']
  if (d <= 90)  return f['61-90']
  if (d <= 120) return f['91-120']
  return f['120+']
})

const totalDue      = computed(() =>
  modoEscopo.value === 'debito' ? totalDebitoVencido.value : (contract.value?.saldoDevedor ?? 0)
)
const totalAcordo   = computed(() => totalDue.value * (1 - descontoPct.value))
const descontoReais = computed(() => totalDue.value - totalAcordo.value)
const minEntrada    = computed(() => totalDue.value * rules.entradaMinimaPct)

// ── Modo de cálculo ──────────────────────────────────────────────────────────
// 'entrada' = atendente define entrada → calcula parcela
// 'parcela' = atendente define parcela → calcula entrada
const modoCalculo = ref('entrada')

const entrada           = ref(0)
const numParcelas       = ref(6)
const diaVencimento     = ref(5)
const valorParcelaInput = ref(0)

// Parcela máxima possível: se entrada = 0, parcela = totalAcordo / numParcelas
const maxParcelaInput = computed(() =>
  numParcelas.value > 0 ? Math.floor(totalAcordo.value / numParcelas.value) : 0
)

// Cálculos reativos
const valorParcela = computed(() => {
  if (modoCalculo.value === 'parcela') return valorParcelaInput.value
  const restante = Math.max(0, totalAcordo.value - entrada.value)
  return numParcelas.value > 0 ? restante / numParcelas.value : 0
})

const entradaCalculada = computed(() => {
  if (modoCalculo.value !== 'parcela') return entrada.value
  return Math.max(0, totalAcordo.value - valorParcelaInput.value * numParcelas.value)
})

const entradaEfetiva = computed(() =>
  modoCalculo.value === 'parcela' ? entradaCalculada.value : entrada.value
)

const entradaPct = computed(() =>
  totalDue.value > 0 ? entradaEfetiva.value / totalDue.value : 0
)

function onModoCalculo(modo) {
  modoCalculo.value = modo
  if (modo === 'parcela') {
    const restante = Math.max(0, totalAcordo.value - entrada.value)
    valorParcelaInput.value = numParcelas.value > 0 ? Math.round((restante / numParcelas.value) * 100) / 100 : 0
  } else {
    entrada.value = Math.ceil(minEntrada.value)
  }
}

// Reinicia ao trocar contrato ou escopo
watch([contratoSelecionado, modoEscopo], () => {
  entrada.value = 0
  valorParcelaInput.value = 0
  numParcelas.value = 6
})

// ── Bidirecionalidade parcela ↔ numParcelas (modo 'parcela') ─────────────────
// Guard para evitar loop reativo circular entre os dois watchers
let _syncingParcela = false

// Ao digitar no input de parcela → recalcula o número de parcelas no slider
watch(valorParcelaInput, (val) => {
  if (modoCalculo.value !== 'parcela' || _syncingParcela || val <= 0) return
  const n = Math.min(24, Math.max(1, Math.floor(totalAcordo.value / val)))
  if (n !== numParcelas.value) {
    _syncingParcela = true
    numParcelas.value = n
    _syncingParcela = false
  }
}, { flush: 'sync' })

// Ao mover o slider de parcelas → atualiza o valor no input
watch(numParcelas, () => {
  if (modoCalculo.value !== 'parcela' || _syncingParcela) return
  _syncingParcela = true
  valorParcelaInput.value = maxParcelaInput.value
  _syncingParcela = false
}, { flush: 'sync' })

// Bloqueios de negócio: cooldown e limite de tentativas
const bloqueioNegocio = computed(() => {
  const cid  = contratoSelecionado.value
  if (!cid) return null
  const negs = flowState.negotiations.filter(n => n.contratoId === cid)

  // limite de tentativas
  const tentativas = negs.filter(n =>
    ['em_analise','contraproposta','em_pagamento','aprovada','reprovada','cancelada','quitado'].includes(n.status)
  ).length
  const max = rules.maxTentativasNegociacao ?? 3
  if (tentativas >= max) return { tipo: 'tentativas', max }

  return null
})

// Auto-aprovação: mesmas regras do cliente
const proposalStatusAtt = computed(() => {
  const autoOk =
    entradaPct.value >= rules.entradaMinimaPct &&
    numParcelas.value <= rules.parcelasMaxAutoAprovacao &&
    (contract.value?.diasAtraso ?? 0) <= rules.atrasoMaxAutoAprovacao &&
    totalDue.value <= rules.valorMaxAutoAprovacao
  return autoOk ? 'auto' : 'mesa'
})

// Feedback de bloqueio
// Acordo realmente ativo: busca qualquer negociação ativa para este contrato
const acordoVivo = computed(() => {
  if (!contract.value) return null
  return flowState.negotiations.find(n =>
    n.contratoId === contract.value.id &&
    ['em_pagamento', 'em_analise'].includes(n.status)
  ) ?? null
})

const bloqueio = computed(() => {
  if (bloqueioNegocio.value?.tipo === 'tentativas')
    return `Limite de ${bloqueioNegocio.value.max} tentativa(s) de negociação atingido para este contrato.`
  if (modoCalculo.value === 'parcela' && valorParcelaInput.value > maxParcelaInput.value)
    return `Com ${numParcelas.value} parcelas, o máximo por parcela é ${formatMoney(maxParcelaInput.value)} (total do acordo: ${formatMoney(totalAcordo.value)}).`
  if (entradaEfetiva.value <= 0)
    return modoCalculo.value === 'parcela'
      ? `Parcela muito alta — com esse valor as parcelas sozinhas ultrapassam o total do acordo (${formatMoney(totalAcordo.value)}).`
      : 'Informe o valor da entrada.'
  if (valorParcela.value < rules.parcelaMinimaValor)
    return `Parcela de ${formatMoney(valorParcela.value)} abaixo do mínimo de ${formatMoney(rules.parcelaMinimaValor)}.`
  if (acordoVivo.value)
    return 'Cliente já possui acordo ativo neste contrato.'
  return null
})

const submitted   = ref(false)
const submittedId = ref('')
const showPayment = ref(false)
const paymentConfirmed = ref(false)

// ── Pagamento de parcelas do acordo (mesmo fluxo do cliente) ─────────────────
const pagandoIndex    = ref(null)
const pagamentoConfirmadoParcela = ref(false)

// Seleção inline de parcelas
const parcelasSelecionadas = ref(new Set())

const parcelasDisponiveis = computed(() => {
  const neg = propostaPendente.value
  if (!neg?.parcelas) return []
  // Entrada não paga: mostra só a entrada
  if (!neg.entradaPaga) {
    return neg.parcelas
      .map((p, idx) => ({ ...p, idx }))
      .filter(p => p.tipo === 'entrada' && p.status !== 'paga')
  }
  // Entrada paga: proxima + futura (para pagar e adiantar)
  return neg.parcelas
    .map((p, idx) => ({ ...p, idx }))
    .filter(p => p.status === 'proxima' || p.status === 'futura')
})

const totalSelecionado = computed(() =>
  [...parcelasSelecionadas.value].reduce((s, idx) =>
    s + (propostaPendente.value?.parcelas[idx]?.valor ?? 0), 0)
)

watch(propostaPendente, neg => {
  if (!neg) return
  if (!neg.entradaPaga) {
    const entradaIdx = neg.parcelas?.findIndex(p => p.tipo === 'entrada') ?? -1
    parcelasSelecionadas.value = new Set(entradaIdx >= 0 ? [entradaIdx] : [])
  } else {
    const proxIdx = neg.parcelas?.findIndex(p => p.status === 'proxima') ?? -1
    parcelasSelecionadas.value = new Set(proxIdx >= 0 ? [proxIdx] : [])
  }
}, { immediate: true })

function toggleParcela(idx) {
  const s = new Set(parcelasSelecionadas.value)
  s.has(idx) ? s.delete(idx) : s.add(idx)
  parcelasSelecionadas.value = s
}

// Modal escolha método
const modalPagamento  = ref(false)
const metodoPagamento = ref(null)

function abrirModalPagamento() {
  metodoPagamento.value = null
  modalPagamento.value  = true
}

function confirmarPagamentoModal() {
  const neg = propostaPendente.value
  if (!neg) return
  const idxList = [...parcelasSelecionadas.value].sort((a, b) => a - b)
  if (!idxList.length || !metodoPagamento.value) return
  if (metodoPagamento.value === 'pix') {
    pixParcelaAtt.value     = neg.parcelas[idxList[0]]
    _pixPendingIdxAtt.value = idxList
    pixAbertoAtt.value      = true
    modalPagamento.value    = false
  } else if (metodoPagamento.value === 'boleto') {
    boletoParcelaAtt.value     = neg.parcelas[idxList[0]]
    _boletoPendingIdxAtt.value = idxList
    boletoAbertoAtt.value      = true
    modalPagamento.value       = false
  }
}

// Pix
const pixAbertoAtt       = ref(false)
const pixCopiado         = ref(false)
const pixParcelaAtt      = ref(null)
const _pixPendingIdxAtt  = ref(null)
const PIX_CHAVE = '00020126580014br.gov.bcb.pix0136dock-sa@pagamentos.com.br5204000053039865802BR5913Dock SA6008Sao Paulo62070503***6304ABCD'

function copiarPix() {
  navigator.clipboard?.writeText(PIX_CHAVE).catch(() => {})
  pixCopiado.value = true
  setTimeout(() => pixCopiado.value = false, 2000)
}
function fecharPixAtt() {
  pixAbertoAtt.value = false
  _pixPendingIdxAtt.value = null
}
function confirmarPixAtt() {
  const idxList = _pixPendingIdxAtt.value ?? []
  pixAbertoAtt.value = false
  _pixPendingIdxAtt.value = null
  if (idxList.length) {
    idxList.forEach(idx => markParcelaPaid(propostaPendente.value.id, idx))
    pagandoIndex.value = null
    pagamentoConfirmadoParcela.value = true
  }
}

// Fecha o modal de confirmação — se o acordo foi quitado, volta ao painel
function fecharConfirmacaoParcela() {
  pagamentoConfirmadoParcela.value = false
  if (!propostaPendente.value || propostaPendente.value.status === 'quitado') {
    router.push('/atendimento')
  }
}

// Boleto
const boletoAbertoAtt      = ref(false)
const boletoCopiado        = ref(false)
const boletoParcelaAtt     = ref(null)
const _boletoPendingIdxAtt = ref(null)
const BOLETO_CODIGO = '23793.38128 60007.827136 98000.063308 3 00000000000000'

function copiarBoleto() {
  navigator.clipboard?.writeText(BOLETO_CODIGO).catch(() => {})
  boletoCopiado.value = true
  setTimeout(() => boletoCopiado.value = false, 2000)
}
function fecharBoletoAtt() {
  boletoAbertoAtt.value = false
  _boletoPendingIdxAtt.value = null
}
function confirmarBoletoAtt() {
  const idxList = _boletoPendingIdxAtt.value ?? []
  boletoAbertoAtt.value = false
  _boletoPendingIdxAtt.value = null
  if (idxList.length) {
    idxList.forEach(idx => markParcelaPaid(propostaPendente.value.id, idx))
    pagandoIndex.value = null
    pagamentoConfirmadoParcela.value = true
  }
}
function baixarBoleto() {
  const p = boletoParcelaAtt.value
  const conteudo =
    `BOLETO BANCÁRIO — SIMULAÇÃO\n\nBeneficiário: Dock S.A.\nVencimento: ${formatDate(p?.vencimento)}\nValor: ${formatMoney(p?.valor)}\n\nLinha Digitável:\n${BOLETO_CODIGO}\n\nInstruções: Não receber após o vencimento.`
  const blob = new Blob([conteudo], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `boleto-${propostaPendente.value?.id ?? 'acordo'}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function simular() {
  if (bloqueio.value) return
  const id = `NEG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  const result = submitAttendantProposal({
    id,
    contratoId:    contratoSelecionado.value,
    clienteCpf:    clienteId.value,
    entrada:       entradaEfetiva.value,
    numParcelas:   numParcelas.value,
    valorParcela:  valorParcela.value,
    totalAcordo:   totalAcordo.value,
    desconto:      descontoReais.value,
    atendenteCpf:  authState.user?.cpf,
    proposalStatus: proposalStatusAtt.value,
  })
  if (result?.error) return
  submittedId.value = id
  submitted.value = true
  showPayment.value = proposalStatusAtt.value === 'auto'
}

function confirmPayment() {
  // Mark entrada (first parcela, index 0) as paid
  const negId = submittedId.value || propostaPendente.value?.id
  const neg = flowState.negotiations.find(n => n.id === negId)
  if (neg?.parcelas?.length) {
    markParcelaPaid(negId, 0)
  }
  paymentConfirmed.value = true
  showPayment.value = false
}
</script>

<template>
  <AttendanceLayout
    back-to="/atendimento"
    back-label="Painel de Atendimento"
  >
    <!-- ── Proposta com acordo ativo: pagamento ── -->
    <template v-if="propostaPendente && !cancelando">
      <div class="max-w-3xl mx-auto">

        <!-- Contraproposta recebida da mesa — aguardando aceite do cliente -->
        <template v-if="propostaPendente.status === 'contraproposta'">
          <div class="card mb-5">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-6 h-6 text-amber-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
              <h2 class="text-lg font-bold text-amber-700">Contraproposta da Mesa</h2>
            </div>
            <p class="text-xs text-gray-500 mb-1">Protocolo: <span class="font-mono font-semibold text-gray-700">{{ propostaPendente.id }}</span></p>
            <p class="text-sm text-gray-600 mb-4">A mesa enviou novas condições. Apresente ao cliente para aceite ou recusa.</p>
            <div class="space-y-2 text-sm border-t pt-3">
              <div class="flex justify-between">
                <span class="text-gray-500">Contrato</span>
                <span class="font-medium">#{{ propostaPendente.contratoId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Nova entrada</span>
                <span class="font-bold text-amber-700">{{ formatMoney(propostaPendente.contraproposta?.entrada ?? propostaPendente.entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Parcelas</span>
                <span class="font-medium">{{ propostaPendente.contraproposta?.numParcelas ?? propostaPendente.numParcelas }}x de {{ formatMoney(propostaPendente.contraproposta?.valorParcela ?? propostaPendente.valorParcela) }}</span>
              </div>
              <div class="border-t pt-2 flex justify-between">
                <span class="font-semibold">Total</span>
                <span class="font-bold">{{ formatMoney(propostaPendente.contraproposta?.total ?? propostaPendente.totalAcordo) }}</span>
              </div>
            </div>
          </div>
          <div class="space-y-3">
            <button @click="aceitarContraproposta" class="btn-primary w-full">Aceitar contraproposta</button>
            <button @click="cancelarProposta" class="btn-danger w-full">Recusar (cancelar proposta)</button>
            <RouterLink to="/atendimento" class="btn-secondary w-full block text-center">Voltar ao painel</RouterLink>
          </div>
        </template>

        <!-- Proposta enviada para Mesa de Crédito -->
        <template v-else-if="propostaPendente.status === 'em_analise'">
          <div class="card text-center py-10 mb-5">
            <div class="w-14 h-14 mx-auto mb-4 bg-amber-50 rounded-full flex items-center justify-center">
              <svg class="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h2 class="text-xl font-bold text-amber-700 mb-2">Aguardando Mesa de Crédito</h2>
            <p class="text-sm text-gray-500 mb-1">A proposta não atende os critérios de auto-aprovação.</p>
            <p class="text-xs text-gray-400">Protocolo: <span class="font-mono font-semibold text-gray-700">{{ propostaPendente.id }}</span></p>
          </div>

          <div class="card mb-5">
            <h3 class="font-semibold text-gray-800 mb-3 text-sm">Condições enviadas para análise</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Contrato</span>
                <span class="font-medium">#{{ propostaPendente.contratoId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Entrada</span>
                <span class="font-bold text-blue-700">{{ formatMoney(propostaPendente.entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Parcelas</span>
                <span class="font-medium">{{ propostaPendente.numParcelas }}x de {{ formatMoney(propostaPendente.valorParcela) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Desconto</span>
                <span class="font-medium text-green-600">{{ formatMoney(propostaPendente.desconto) }}</span>
              </div>
              <div class="border-t pt-2 flex justify-between">
                <span class="font-semibold">Total</span>
                <span class="font-bold">{{ formatMoney(propostaPendente.totalAcordo) }}</span>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <RouterLink to="/backoffice/fila" class="btn-primary w-full block text-center">Ver fila de aprovação</RouterLink>
            <RouterLink to="/atendimento" class="btn-secondary w-full block text-center">Voltar ao painel</RouterLink>
          </div>
        </template>

        <!-- Acordo ativo (em_pagamento): pagamento de entrada confirmado nesta sessão -->
        <template v-else-if="paymentConfirmed">
          <div class="card text-center py-10 mb-5">
            <svg class="w-14 h-14 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <h2 class="text-xl font-bold text-green-700 mb-2">Pagamento Confirmado!</h2>
            <p class="text-sm text-gray-500">Acordo ativado e entrada paga com sucesso.</p>
            <p class="text-xs font-mono font-semibold text-gray-700 mt-3">Protocolo: {{ propostaPendente.id }}</p>
          </div>
          <div class="space-y-3">
            <button @click="paymentConfirmed = false; submitted = false; entrada = 0" class="btn-secondary w-full">Nova simulação</button>
            <RouterLink to="/atendimento" class="btn-primary w-full block text-center">Voltar ao painel</RouterLink>
          </div>
        </template>

        <!-- Pix entrada (proposta auto-aprovada nesta sessão) -->
        <template v-else-if="showPayment">
          <div class="card text-center py-6 mb-5">
            <div class="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/></svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">Pagamento da Entrada via Pix</h3>
            <p class="text-2xl font-bold text-blue-700 mb-4">{{ formatMoney(propostaPendente.entrada) }}</p>
            <div class="bg-gray-50 rounded-xl p-4 mb-4 text-left">
              <p class="text-xs text-gray-400 mb-1">Chave Pix</p>
              <p class="text-xs font-mono text-gray-700 break-all">00020126580014br.gov.bcb.pix0136portal-cobranca-{{ propostaPendente.id }}</p>
            </div>
          </div>
          <div class="space-y-3">
            <button @click="confirmPayment" class="btn-success w-full">Simular Pagamento Confirmado</button>
            <button @click="router.push('/atendimento')" class="btn-secondary w-full">Pagar depois</button>
          </div>
        </template>

        <!-- Acordo ativo: visão completa com parcelas interativas -->
        <template v-else-if="!submitted">
          <div class="rounded-2xl bg-green-50 border border-green-500/25 px-5 py-4 mb-5 flex items-start gap-3">
            <svg class="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>
              <p class="font-semibold text-green-900 text-sm">Acordo ativo neste contrato.</p>
              <p class="text-xs text-green-600 mt-0.5">Protocolo: {{ propostaPendente.id }}</p>
            </div>
          </div>

          <!-- Resumo + tabela interativa de parcelas -->
          <div class="card mb-5">
            <div class="flex items-center justify-between gap-3 mb-4">
              <h3 class="font-semibold text-gray-800 text-sm">Detalhes do acordo</h3>
            </div>

            <div class="space-y-2 text-sm mb-4">
              <div class="flex justify-between">
                <span class="text-gray-500">Contrato</span>
                <span class="font-medium">#{{ propostaPendente.contratoId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Entrada</span>
                <span class="font-bold" :class="propostaPendente.entradaPaga ? 'text-green-700' : 'text-blue-700'">
                  {{ formatMoney(propostaPendente.entrada) }}
                  <span v-if="propostaPendente.entradaPaga" class="ml-1 text-green-600 text-xs">✓ paga</span>
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Parcelas</span>
                <span class="font-medium">{{ propostaPendente.numParcelas }}x de {{ formatMoney(propostaPendente.valorParcela) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Desconto</span>
                <span class="font-medium text-green-600">{{ formatMoney(propostaPendente.desconto) }}</span>
              </div>
              <div class="border-t pt-2 flex justify-between">
                <span class="font-semibold">Total</span>
                <span class="font-bold">{{ formatMoney(propostaPendente.totalAcordo) }}</span>
              </div>
            </div>

            <!-- Tabela de parcelas interativa -->
            <div v-if="propostaPendente.parcelas?.length" class="border-t pt-3">
              <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-semibold text-gray-500">
                  {{ propostaPendente.entradaPaga ? 'Selecione as parcelas' : 'Pagamento da entrada' }}
                </p>
                <div v-if="parcelasDisponiveis.length > 1" class="flex gap-3 text-xs">
                  <button @click="parcelasSelecionadas = new Set(parcelasDisponiveis.map(p => p.idx))" class="text-blue-600 hover:underline font-medium">Selecionar todas</button>
                  <button @click="parcelasSelecionadas = new Set()" class="text-gray-400 hover:underline">Limpar</button>
                </div>
              </div>

              <!-- Barra de pagamento (topo) -->
              <Transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-150"
                leave-to-class="opacity-0"
              >
                <div v-if="parcelasSelecionadas.size > 0" class="mb-3 bg-blue-600 rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <p class="text-sm text-white font-semibold">
                    {{ parcelasSelecionadas.size }} {{ propostaPendente.entradaPaga ? 'parcela' + (parcelasSelecionadas.size > 1 ? 's' : '') + ' selecionada' + (parcelasSelecionadas.size > 1 ? 's' : '') : 'entrada selecionada' }}
                  </p>
                  <div class="flex items-center gap-3">
                    <span class="text-xl font-bold text-white">{{ formatMoney(totalSelecionado) }}</span>
                    <button
                      @click="abrirModalPagamento()"
                      class="bg-white text-blue-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
                    >
                      {{ propostaPendente.entradaPaga ? 'Pagar Fatura' : 'Pagar Entrada' }}
                    </button>
                  </div>
                </div>
              </Transition>

              <!-- Lista selecionável de parcelas pendentes -->
              <div v-if="parcelasDisponiveis.length" class="divide-y divide-gray-100 -mx-6 overflow-hidden mb-3">
                <button
                  v-for="p in parcelasDisponiveis"
                  :key="p.idx"
                  type="button"
                  @click="toggleParcela(p.idx)"
                  :aria-pressed="parcelasSelecionadas.has(p.idx)"
                  class="w-full flex items-center gap-3 px-6 py-3.5 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                  :class="parcelasSelecionadas.has(p.idx) ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'"
                >
                  <div
                    class="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                    :class="parcelasSelecionadas.has(p.idx) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'"
                  >
                    <svg v-if="parcelasSelecionadas.has(p.idx)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  </div>
                  <span class="text-xs font-mono text-gray-400 w-8 shrink-0">{{ p.tipo === 'entrada' ? 'E' : p.numero }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800">
                      {{ p.tipo === 'entrada' ? 'Entrada —' : p.status === 'proxima' ? 'Próxima —' : 'Antecipada —' }}
                      vence em {{ formatDate(p.vencimento) }}
                    </p>
                    <p v-if="p.status === 'futura'" class="text-xs text-amber-600">Pagamento antecipado</p>
                  </div>
                  <p class="font-semibold shrink-0" :class="parcelasSelecionadas.has(p.idx) ? 'text-blue-800' : 'text-gray-800'">{{ formatMoney(p.valor) }}</p>
                </button>
              </div>
            </div>
          </div>

          <!-- Card: Extrato completo -->
          <div class="card mb-5">
              <h3 class="font-semibold text-gray-800 mb-2">Extrato completo</h3>
              <div class="overflow-x-auto -mx-6 px-6">
                <table class="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr class="text-xs text-gray-500 border-b border-gray-100">
                      <th class="text-left py-2 font-medium">#</th>
                      <th class="text-left py-2 font-medium">Tipo</th>
                      <th class="text-left py-2 font-medium">Vencimento</th>
                      <th class="text-right py-2 font-medium">Valor</th>
                      <th class="text-center py-2 font-medium">Status</th>
                      <th class="text-right py-2 font-medium">Pgto.</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr
                      v-for="(p, idx) in propostaPendente.parcelas"
                      :key="idx"
                      :class="p.status === 'proxima' ? 'bg-blue-50' : ''"
                    >
                      <td class="py-2.5 text-xs font-mono text-gray-400">{{ p.tipo === 'entrada' ? 'E' : p.numero ?? idx }}</td>
                      <td class="py-2.5 text-xs text-gray-500 capitalize">{{ p.tipo }}</td>
                      <td class="py-2.5">{{ formatDate(p.vencimento) }}</td>
                      <td class="py-2.5 text-right font-semibold">{{ formatMoney(p.valor) }}</td>
                      <td class="py-2.5 text-center">
                        <StatusBadge :status="p.status" small />
                      </td>
                      <td class="py-2.5 text-right text-xs text-gray-400">{{ p.dataPagamento ? formatDate(p.dataPagamento) : '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
          </div>

          <div class="space-y-3">
            <button v-if="!propostaPendente.entradaPaga" @click="cancelarProposta" class="btn-danger w-full">Cancelar acordo</button>
            <RouterLink to="/atendimento" class="btn-secondary w-full block text-center">Voltar ao painel</RouterLink>
          </div>
        </template>
      </div>
    </template>

    <!-- ── Cancelamento confirmado ── -->
    <template v-else-if="cancelando">
      <div class="max-w-3xl mx-auto">
        <div class="card text-center py-10 mb-5">
          <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h2 class="text-lg font-bold text-gray-700 mb-1">Proposta cancelada</h2>
          <p class="text-sm text-gray-400">Você pode criar uma nova simulação a qualquer momento.</p>
        </div>
        <div class="space-y-3">
          <button @click="cancelando = false" class="btn-primary w-full">
            Criar nova simulação
          </button>
          <RouterLink to="/atendimento" class="btn-secondary w-full block text-center">
            Voltar ao painel
          </RouterLink>
        </div>
      </div>
    </template>

    <!-- Sucesso (proposta recém enviada — mas showPayment já exibe o pagamento) -->
    <template v-if="submitted && !propostaPendente && !showPayment && !paymentConfirmed">
      <div class="max-w-3xl mx-auto">
        <div class="card text-center py-10 mb-6">
          <svg class="w-14 h-14 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <h2 class="text-xl font-bold text-green-700 mb-2">Acordo ativado!</h2>
          <p class="text-gray-500 text-sm">O acordo foi criado e está ativo.</p>
          <p class="text-xs font-mono font-semibold text-gray-700 mt-3">Protocolo: {{ submittedId }}</p>
        </div>

        <div class="space-y-3">
          <button @click="submitted = false; entrada = 0" class="btn-secondary w-full">Nova simulação</button>
          <RouterLink to="/atendimento" class="btn-primary w-full block text-center">Voltar ao painel</RouterLink>
        </div>
      </div>
    </template>

    <!-- Formulário (só aparece se não há proposta pendente) -->
    <template v-else-if="!propostaPendente && !cancelando">
      <div class="max-w-3xl mx-auto">

        <!-- Info do cliente -->
        <div class="card mb-6 bg-blue-50 border border-blue-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">JD</div>
            <div>
              <p class="font-semibold text-blue-900">João da Silva</p>
              <p class="text-xs text-blue-600 font-mono">{{ clienteId }}</p>
            </div>
          </div>
        </div>

        <!-- Seleção de contrato -->
        <div class="card mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Escolha um contrato</label>
          <select v-model="contratoSelecionado" class="input-field">
            <option v-for="c in contratos" :key="c.id" :value="c.id">
              #{{ c.id }} — {{ c.status === 'em_atraso' ? '⚠ Em atraso' : c.status }} — {{ formatMoney(c.saldoDevedor) }}
            </option>
          </select>

          <!-- Situação resumida -->
          <div v-if="contract" class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p class="text-xs text-gray-400">Débito vencido</p>
              <p class="font-semibold text-red-600">{{ formatMoney(totalDebitoVencido) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Saldo devedor total</p>
              <p class="font-semibold text-red-700">{{ formatMoney(contract.saldoDevedor) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Dias em atraso</p>
              <p class="font-semibold" :class="(contract.diasAtraso ?? 0) > 0 ? 'text-red-700' : 'text-green-700'">{{ contract.diasAtraso ?? 0 }} dias</p>
            </div>
          </div>
        </div>

        <!-- Monte a proposta -->
        <div v-if="contract && !acordoVivo" class="card mb-6">
          <h3 class="font-semibold text-gray-900 mb-4">Monte a proposta</h3>

          <!-- Toggle 1: Escopo da negociação -->
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">O que será negociado?</p>
          <div class="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              @click="modoEscopo = 'total'"
              class="rounded-xl border-2 p-3 text-left transition-all"
              :class="modoEscopo === 'total'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'"
            >
              <p class="text-sm font-semibold" :class="modoEscopo === 'total' ? 'text-blue-800' : 'text-gray-700'">
                Negociar saldo total
              </p>
              <p class="text-xs mt-0.5" :class="modoEscopo === 'total' ? 'text-blue-600' : 'text-gray-400'">
                Encerra o contrato original. Novo plano para o saldo inteiro.
              </p>
              <p class="text-xs font-bold mt-1" :class="modoEscopo === 'total' ? 'text-blue-700' : 'text-gray-500'">
                {{ formatMoney(contract?.saldoDevedor ?? 0) }}
              </p>
            </button>
            <button
              type="button"
              @click="modoEscopo = 'debito'"
              :disabled="totalDebitoVencido <= 0"
              class="rounded-xl border-2 p-3 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              :class="modoEscopo === 'debito'
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:border-gray-300'"
            >
              <p class="text-sm font-semibold" :class="modoEscopo === 'debito' ? 'text-amber-800' : 'text-gray-700'">
                Negociar parcelas vencidas
              </p>
              <p class="text-xs mt-0.5" :class="modoEscopo === 'debito' ? 'text-amber-600' : 'text-gray-400'">
                Regulariza só o débito em atraso. Parcelas futuras continuam normalmente.
              </p>
              <p class="text-xs font-bold mt-1" :class="modoEscopo === 'debito' ? 'text-amber-700' : 'text-gray-500'">
                {{ totalDebitoVencido > 0 ? formatMoney(totalDebitoVencido) : 'Sem parcelas vencidas' }}
              </p>
            </button>
          </div>

          <!-- Info do escopo selecionado 
          <div class="rounded-lg px-3 py-2 mb-5 text-xs flex items-center gap-2"
            :class="modoEscopo === 'debito' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
            <span v-if="modoEscopo === 'total'">
              Desconto de <strong>{{ (descontoPct * 100).toFixed(0) }}%</strong> aplicado.
              Total do acordo: <strong>{{ formatMoney(totalAcordo) }}</strong> (economia de {{ formatMoney(descontoReais) }}).
            </span>
            <span v-else>
              Regulariza <strong>{{ contract?.parcelasVencidas ?? 0 }} parcela(s)</strong> vencida(s).
              Desconto de <strong>{{ (descontoPct * 100).toFixed(0) }}%</strong> sobre os encargos.
              Total: <strong>{{ formatMoney(totalAcordo) }}</strong>.
            </span>
          </div>-->

          <!-- Toggle 2: modo de cálculo -->
          <div class="flex items-center gap-4 mb-5">
            <span class="text-xs font-medium text-gray-500 shrink-0">Montar por:</span>
            <label class="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="radio" name="modoCalculoAtt" value="entrada" :checked="modoCalculo === 'entrada'" @change="onModoCalculo('entrada')" class="accent-blue-600" />
              <span class="text-sm" :class="modoCalculo === 'entrada' ? 'text-blue-700 font-semibold' : 'text-gray-600'">Escolher o valor da entrada</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer select-none">
              <input type="radio" name="modoCalculoAtt" value="parcela" :checked="modoCalculo === 'parcela'" @change="onModoCalculo('parcela')" class="accent-blue-600" />
              <span class="text-sm" :class="modoCalculo === 'parcela' ? 'text-blue-700 font-semibold' : 'text-gray-600'">Escolher o valor da parcela</span>
            </label>
          </div>

          <!-- Modo: Definir entrada -->
          <div v-if="modoCalculo === 'entrada'" class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              Informe o valor da entrada <span class="text-red-500">*</span>
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
              Mínimo: {{ formatMoney(minEntrada) }} ({{ (rules.entradaMinimaPct * 100).toFixed(0) }}%)
              · Atual: {{ (entradaPct * 100).toFixed(0) }}%
            </p>
          </div>

          <!-- Modo: Definir parcela -->
          <div v-if="modoCalculo === 'parcela'" class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              Informe o valor da parcela desejada <span class="text-red-500">*</span>
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

          <!-- Número de parcelas (comum aos dois modos) -->
          <div class="mb-5">
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-sm font-medium text-gray-700">Número de parcelas</label>
              <span class="font-bold text-blue-700">{{ numParcelas }}x</span>
            </div>
            <input
              v-model.number="numParcelas"
              type="range"
              min="1"
              max="24"
              class="w-full accent-blue-600"
            />
            <div class="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>1x</span>
              <span>24x</span>
            </div>
          </div>

          <!-- Dia do vencimento -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Dia de vencimento</label>
            <select v-model.number="diaVencimento" class="input-field">
              <option v-for="d in [1,5,10,15,20,25]" :key="d" :value="d">Dia {{ d }}</option>
            </select>
          </div>

          <!-- Preview -->
          <div class="rounded-xl bg-blue-50 border border-blue-100 p-4 mb-5">
            <h4 class="text-sm font-semibold text-blue-800 mb-3">Resumo da proposta</h4>
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between">
                <span class="text-blue-700">Entrada (Pix)</span>
                <span class="font-bold text-blue-900">{{ formatMoney(entradaEfetiva) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-blue-700">{{ numParcelas }}x de</span>
                <span class="font-bold text-blue-900">{{ formatMoney(valorParcela) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-blue-700">Desconto aplicado</span>
                <span class="font-semibold text-green-700">{{ formatMoney(descontoReais) }}</span>
              </div>
              <div class="border-t border-blue-200 pt-2 flex justify-between">
                <span class="font-bold text-blue-900">Total do acordo</span>
                <span class="font-bold text-blue-900">{{ formatMoney(totalAcordo) }}</span>
              </div>
            </div>
          </div>

          <!-- Bloqueio -->
          <div v-if="bloqueio" class="alert-danger text-sm mb-4">{{ bloqueio }}</div>

          <button
            @click="simular"
            :disabled="!!bloqueio"
            class="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar proposta ao cliente para aprovação
          </button>
          <p class="text-xs text-gray-400 text-center mt-2">O cliente precisará confirmar antes do acordo ser ativado.</p>
        </div>

        <!-- Acordo já ativo -->
        <div v-else-if="acordoVivo" class="card text-center py-8">
          <p class="text-gray-500">Este contrato já possui um acordo ativo.</p>
        </div>

      </div>
    </template>
  </AttendanceLayout>

  <!-- ── Modais de pagamento de parcelas (mesmo fluxo do cliente) ── -->

  <!-- Modal: escolha de método -->
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="modalPagamento" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="att-modal-pag-title">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <h3 id="att-modal-pag-title" class="text-base font-semibold text-gray-900 mb-1">Escolha a forma de pagamento</h3>
          <p class="text-sm text-gray-500 mb-4">Como o cliente prefere pagar esta parcela?</p>
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
            <button @click="confirmarPagamentoModal" :disabled="!metodoPagamento" class="btn-primary flex-1 disabled:opacity-40">Continuar</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Modal: Pix gerado -->
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="pixAbertoAtt && pixParcelaAtt" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="att-modal-pix-title">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 id="att-modal-pix-title" class="font-semibold text-gray-900 flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M11.3 2.4a1.2 1.2 0 011.4 0l7.2 5.2c.4.3.6.7.6 1.2v6.4c0 .5-.2.9-.6 1.2l-7.2 5.2a1.2 1.2 0 01-1.4 0L4.1 16.4A1.2 1.2 0 013.5 15V8.8c0-.5.2-.9.6-1.2L11.3 2.4z"/></svg>
              Pagar via Pix
            </h3>
            <button @click="fecharPixAtt" class="text-gray-400 hover:text-gray-600" aria-label="Fechar">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <p class="text-xs text-gray-500 mb-4">Vencimento: {{ formatDate(pixParcelaAtt.vencimento) }} &bull; Valor: <strong>{{ formatMoney(pixParcelaAtt.valor) }}</strong></p>
          <div class="bg-gray-50 rounded-xl p-4 mb-3 flex justify-center">
            <div class="w-32 h-32 grid grid-cols-8 gap-px" aria-hidden="true">
              <template v-for="(v, i) in [1,1,1,1,1,1,1,0,1,0,0,0,1,0,0,1,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,0,1,0,0,0,1,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1]" :key="i">
                <div :class="v ? 'bg-gray-900' : 'bg-white'" class="aspect-square rounded-[1px]" />
              </template>
            </div>
          </div>
          <p class="text-center text-xs text-gray-400 mb-3">Escaneie o QR code ou copie a chave abaixo</p>
          <div class="bg-gray-50 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 break-all mb-4 select-all">{{ PIX_CHAVE }}</div>
          <div class="flex flex-col gap-2">
            <button @click="confirmarPixAtt" class="btn-primary w-full text-sm">Confirmar pagamento</button>
            <button @click="copiarPix" :class="pixCopiado ? 'btn-success' : 'btn-secondary'" class="w-full flex items-center justify-center gap-2 text-sm">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/></svg>
              {{ pixCopiado ? 'Chave copiada!' : 'Copiar chave Pix' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Modal: Boleto -->
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="boletoAbertoAtt && boletoParcelaAtt" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" role="dialog" aria-modal="true" aria-labelledby="att-modal-boleto-title">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 id="att-modal-boleto-title" class="font-semibold text-gray-900 flex items-center gap-2">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
              Boleto Bancário
            </h3>
            <button @click="fecharBoletoAtt" class="text-gray-400 hover:text-gray-600" aria-label="Fechar boleto">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <p class="text-xs text-gray-500 mb-4">Vencimento: {{ formatDate(boletoParcelaAtt.vencimento) }} &bull; Valor: <strong>{{ formatMoney(boletoParcelaAtt.valor) }}</strong></p>
          <div class="bg-gray-50 rounded-xl p-3 mb-3 flex justify-center">
            <div class="flex items-end gap-px h-12" aria-hidden="true">
              <template v-for="(w, i) in [3,1,2,1,4,1,2,3,1,1,2,4,1,3,2,1,1,3,4,1,2,1,3,1,2,4,1,1,3,2,1,4,3,1,2,1,3,1,4,2,1,3,1,2]" :key="i">
                <div class="bg-gray-800" :style="{ width: w + 'px', height: (i % 5 === 0 ? 100 : 80) + '%' }" />
              </template>
            </div>
          </div>
          <div class="bg-gray-50 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 break-all mb-4 select-all">{{ BOLETO_CODIGO }}</div>
          <div class="flex flex-col gap-2">
            <button @click="confirmarBoletoAtt" class="btn-primary w-full text-sm">Confirmar pagamento</button>
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

  <!-- Modal: confirmação pós-pagamento de parcela -->
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="pagamentoConfirmadoParcela" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">
          <svg class="w-14 h-14 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <h3 class="text-lg font-bold text-gray-900 mb-1">Pagamento registrado!</h3>
          <p class="text-sm text-gray-500 mb-6">Parcela confirmada com sucesso.</p>
          <button @click="fecharConfirmacaoParcela" class="btn-primary w-full">Fechar</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
