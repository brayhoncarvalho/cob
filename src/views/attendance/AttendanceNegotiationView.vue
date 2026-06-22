<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AttendanceLayout from '@/layouts/AttendanceLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useAuth } from '@/stores/auth.js'
import { useRules } from '@/stores/rules.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney } = useFormatters()
const { state: flowState, submitAttendantProposal, cancelAttendantProposal, markParcelaPaid } = useFlow()
const { state: authState } = useAuth()
const { rules } = useRules()

const clienteId = computed(() => route.params.clienteId)

// ── Proposta com acordo ativo (gerada pelo atendente nesta sessão) ────
const propostaPendente = computed(() =>
  flowState.negotiations.find(n =>
    n.clienteCpf === clienteId.value &&
    ['em_pagamento', 'em_analise'].includes(n.status) &&
    n.simuladoPorAtendente
  ) ?? null
)

const cancelando = ref(false)
function cancelarProposta() {
  if (!propostaPendente.value) return
  cancelAttendantProposal(propostaPendente.value.id)
  cancelando.value = true
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
  if (contract.value?.acordoAtivo)
    return 'Cliente já possui acordo ativo neste contrato.'
  return null
})

const submitted   = ref(false)
const submittedId = ref('')
const showPayment = ref(false)
const paymentConfirmed = ref(false)

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
  const neg = flowState.negotiations.find(n => n.id === submittedId.value)
  if (neg?.parcelas?.length) {
    markParcelaPaid(submittedId.value, 0)
  }
  paymentConfirmed.value = true
  showPayment.value = false
}
</script>

<template>
  <AttendanceLayout
    title="Simulação em nome do cliente"
    back-to="/atendimento"
    back-label="Painel de Atendimento"
  >
    <!-- ── Proposta com acordo ativo: pagamento ── -->
    <template v-if="propostaPendente && !cancelando">
      <div class="max-w-lg mx-auto">

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

        <!-- Acordo ativo (em_pagamento): pagamento confirmado -->
        <template v-else-if="paymentConfirmed">
          <div class="card text-center py-10 mb-5"> fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <h2 class="text-xl font-bold text-green-700 mb-2">Pagamento Confirmado!</h2>
            <p class="text-sm text-gray-500">Acordo ativado e entrada paga com sucesso.</p>
            <p class="text-xs font-mono font-semibold text-gray-700 mt-3">Protocolo: {{ propostaPendente.id }}</p>
          </div>

          <!-- Resumo do acordo -->
          <div class="card mb-5">
            <h3 class="font-semibold text-gray-800 mb-3 text-sm">Detalhes do acordo</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Contrato</span>
                <span class="font-medium">#{{ propostaPendente.contratoId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Entrada (paga)</span>
                <span class="font-bold text-green-700">{{ formatMoney(propostaPendente.entrada) }}</span>
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
                <span class="font-semibold">Total do acordo</span>
                <span class="font-bold">{{ formatMoney(propostaPendente.totalAcordo) }}</span>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <button @click="paymentConfirmed = false; submitted = false; entrada = 0" class="btn-secondary w-full">Nova simulação</button>
            <RouterLink to="/atendimento" class="btn-primary w-full block text-center">Voltar ao painel</RouterLink>
          </div>
        </template>

        <!-- Modal de pagamento Pix -->
        <template v-else-if="showPayment">
          <div class="card text-center py-6 mb-5">
            <div class="w-16 h-16 mx-auto mb-4 bg-blue-50 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/></svg>
            </div>
            <h3 class="text-lg font-bold text-gray-900 mb-1">Pagamento da Entrada via Pix</h3>
            <p class="text-2xl font-bold text-blue-700 mb-4">{{ formatMoney(propostaPendente.entrada) }}</p>
            <div class="bg-gray-50 rounded-xl p-4 mb-4 text-left">
              <p class="text-xs text-gray-400 mb-1">Chave Pix (copia e cola)</p>
              <p class="text-xs font-mono text-gray-700 break-all">00020126580014br.gov.bcb.pix0136portal-cobranca-{{ propostaPendente.id }}</p>
            </div>
          </div>
          <div class="space-y-3">
            <button @click="confirmPayment" class="btn-success w-full">
              Simular Pagamento Confirmado
            </button>
            <button @click="router.push('/atendimento')" class="btn-secondary w-full">
              Pagar depois
            </button>
          </div>
        </template>

        <!-- Acordo ativo (sem pagamento pendente nesta sessão) -->
        <template v-else-if="!submitted">
          <div class="rounded-2xl bg-green-50 border border-green-500/25 px-5 py-4 mb-5 flex items-start gap-3">
            <svg class="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div>
              <p class="font-semibold text-green-900 text-sm">Acordo ativo neste contrato.</p>
              <p class="text-xs text-green-600 mt-0.5">Protocolo: {{ propostaPendente.id }}</p>
            </div>
          </div>

          <!-- Resumo do acordo -->
          <div class="card mb-5">
            <h3 class="font-semibold text-gray-800 mb-3 text-sm">Detalhes do acordo</h3>
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

            <!-- Parcelas do acordo -->
            <div v-if="propostaPendente.parcelas?.length" class="mt-4 border-t pt-3">
              <p class="text-xs font-semibold text-gray-500 mb-2">Parcelas</p>
              <div class="space-y-1.5 max-h-48 overflow-y-auto">
                <div
                  v-for="(p, i) in propostaPendente.parcelas"
                  :key="i"
                  class="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg"
                  :class="p.status === 'paga' ? 'bg-green-50' : 'bg-gray-50'"
                >
                  <span class="text-gray-600">{{ i === 0 ? 'Entrada' : `Parcela ${i}` }}</span>
                  <span class="font-medium" :class="p.status === 'paga' ? 'text-green-700' : 'text-gray-800'">
                    {{ formatMoney(p.valor) }}
                    <span v-if="p.status === 'paga'" class="ml-1 text-green-600">✓</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <button @click="showPayment = true" class="btn-success w-full flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
              Registrar pagamento da entrada
            </button>
            <button @click="cancelarProposta" class="btn-danger w-full">Cancelar acordo</button>
            <RouterLink to="/atendimento" class="btn-secondary w-full block text-center">Voltar ao painel</RouterLink>
          </div>
        </template>
      </div>
    </template>

    <!-- ── Cancelamento confirmado ── -->
    <template v-else-if="cancelando">
      <div class="max-w-lg mx-auto">
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
      <div class="max-w-lg mx-auto">
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
      <div class="max-w-2xl mx-auto">

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
        <div v-if="contract && !contract.acordoAtivo" class="card mb-6">
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
        <div v-else-if="contract?.acordoAtivo" class="card text-center py-8">
          <p class="text-gray-500">Este contrato já possui um acordo ativo.</p>
        </div>

      </div>
    </template>
  </AttendanceLayout>
</template>
