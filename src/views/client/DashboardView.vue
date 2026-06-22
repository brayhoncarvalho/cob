<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuth } from '@/stores/auth.js'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const { state } = useAuth()
const { formatMoney, formatDate } = useFormatters()
const router = useRouter()
const { state: flowState } = useFlow()

const contracts    = flowState.contracts
const negotiations = flowState.negotiations

const totalVencidas     = computed(() => contracts.reduce((s, c) => s + c.parcelasVencidas, 0))
// totalEmAberto = soma real das parcelas vencidas (não o saldo devedor total)
const totalEmAberto     = computed(() =>
  contracts.flatMap(c => c.parcelas.filter(p => p.status === 'vencida'))
           .reduce((s, p) => s + p.valorAtualizado, 0)
)
const contratosAtivos   = computed(() => contracts.filter(c => c.status !== 'cancelado').length)
const saldoTotal        = computed(() => contracts.reduce((s, c) => s + c.saldoDevedor, 0))
const acordosAtivos     = computed(() => negotiations.filter(n => n.status === 'em_pagamento').length)
const negsPendentes     = computed(() => negotiations.filter(n => n.status === 'em_analise').length)
const primeiroContratoEmAtraso = computed(() =>
  contracts.find(c => c.parcelasVencidas > 0 || c.status === 'em_atraso') ?? null
)
const proximoVencimento = computed(() => {
  const all = contracts.flatMap(c =>
    c.parcelas
      .filter(p => p.status === 'proxima' || (p.status === 'futura' && !c.parcelasVencidas))
      .map(p => ({ ...p, contratoId: c.id }))
  ).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  return all[0] ?? null
})

const notificacoes = computed(() => {
  const items = []
  // Notif de vencidas suprimida quando totalVencidas > 0 — o banner de atraso vermelho já cobre isso (evita triplicação de alertas)
  const agora = new Date()
  negotiations.filter(n => n.status === 'em_analise').forEach(n => {
    const expirado = n.prazoResposta && new Date(n.prazoResposta) < agora
    items.push({
      type: 'warning',
      text: expirado
        ? `Proposta ${n.id} em análise. Prazo encerrado em ${formatDate(n.prazoResposta)}.`
        : `Proposta ${n.id} em análise. Prazo até ${formatDate(n.prazoResposta)}.`,
      expired: expirado,
      action: `/negociacoes/${n.id}`
    })
  })
  negotiations.filter(n => n.status === 'em_pagamento' && !n.entradaPaga).forEach(n =>
    items.push({ type: 'success', text: `Acordo ${n.id} aprovado! Pague a entrada para ativar.`, action: `/negociacoes/${n.id}` })
  )
  return items.slice(0, 3)
})

// Propostas do atendente aguardando aprovação do cliente
const propostasAtendente = computed(() =>
  negotiations.filter(n => n.status === 'pending_client_approval')
)

// Acordos aprovados pela mesa aguardando pagamento da entrada
const acordosAguardandoPagamento = computed(() =>
  negotiations.filter(n => n.status === 'em_pagamento' && !n.entradaPaga)
)

// Contrapropostas da mesa aguardando resposta do cliente
const contrapropostasPendentes = computed(() =>
  negotiations.filter(n => n.status === 'contraproposta')
)

function goToAtrasos() {
  if (primeiroContratoEmAtraso.value?.id) {
    router.push(`/contratos/${primeiroContratoEmAtraso.value.id}`)
    return
  }
  router.push('/contratos')
}

function goToContratos() {
  router.push('/contratos')
}

function goToProximoVencimento() {
  if (proximoVencimento.value?.contratoId) {
    router.push(`/contratos/${proximoVencimento.value.contratoId}`)
    return
  }
  router.push('/contratos')
}

function goToNegociacoes() {
  router.push('/negociacoes')
}
</script>

<template>
  <ClientLayout title="">
    <!-- Banner: proposta do atendente aguardando aprovação -->
    <div
      v-for="p in propostasAtendente"
      :key="p.id"
      class="mb-4 rounded-xl bg-blue-600 text-white p-4 shadow-lg flex items-center justify-between gap-4"
    >
      <div class="flex items-start gap-3">
        <div class="shrink-0 mt-0.5">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
        </div>
        <div>
          <p class="font-bold text-sm">Oferta especial do atendente!</p>
          <p class="text-xs text-blue-100 mt-0.5">
            Nosso atendente preparou uma proposta de acordo para o contrato #{{ p.contratoId }}.
            Revise e decida se aceita.
          </p>
        </div>
      </div>
      <RouterLink
        :to="`/proposta/aprovar/${p.id}`"
        class="shrink-0 bg-white text-blue-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition whitespace-nowrap"
      >
        Ver oferta
      </RouterLink>
    </div>

    <!-- Banner: acordo aprovado aguardando pagamento da entrada -->
    <div
      v-for="acordo in acordosAguardandoPagamento"
      :key="acordo.id"
      class="mb-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 text-white p-4 shadow-lg"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div>
            <p class="font-bold text-sm">Acordo aprovado! Pague a entrada para ativar.</p>
            <p class="text-xs text-green-100 mt-0.5">
              Contrato #{{ acordo.contratoId }} &middot; Entrada: <strong class="text-white">{{ formatMoney(acordo.entrada) }}</strong> &middot; {{ acordo.numParcelas }}x de {{ formatMoney(acordo.valorParcela) }}
            </p>
            <p class="text-xs text-green-100 mt-0.5">Protocolo: <span class="font-mono">{{ acordo.id }}</span></p>
          </div>
        </div>
        <RouterLink
          :to="`/contratos/${acordo.contratoId}/pagar`"
          class="shrink-0 bg-white text-green-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-green-50 transition whitespace-nowrap shadow"
        >
          Pagar entrada
        </RouterLink>
      </div>
    </div>

    <!-- Banner: contraproposta da mesa aguardando resposta -->
    <div
      v-for="neg in contrapropostasPendentes"
      :key="neg.id"
      class="mb-4 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 text-white p-4 shadow-lg"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/>
            </svg>
          </div>
          <div>
            <p class="font-bold text-sm">Contraproposta recebida!</p>
            <p class="text-xs text-blue-100 mt-0.5">
              Contrato #{{ neg.contratoId }} &middot; Nova entrada: <strong class="text-white">{{ formatMoney(neg.contraproposta?.entrada ?? neg.entrada) }}</strong> &middot; {{ neg.contraproposta?.numParcelas ?? neg.numParcelas }}x de {{ formatMoney(neg.contraproposta?.valorParcela ?? neg.valorParcela) }}
            </p>
            <p class="text-xs text-blue-100 mt-0.5">Protocolo: <span class="font-mono">{{ neg.id }}</span></p>
          </div>
        </div>
        <RouterLink
          :to="`/contratos/${neg.contratoId}`"
          class="shrink-0 bg-white text-blue-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition whitespace-nowrap shadow"
        >
          Ver proposta
        </RouterLink>
      </div>
    </div>

    <!-- Banner de atraso -->
    <div v-if="totalVencidas > 0" class="alert-danger mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p class="font-semibold flex items-center gap-1.5">
          <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          Atenção: você tem {{ totalVencidas }} parcela(s) vencida(s)
        </p>
        <p class="text-sm mt-0.5">Total em atraso: <strong>{{ formatMoney(totalEmAberto) }}</strong> — juros continuam acumulando.</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <RouterLink :to="primeiroContratoEmAtraso ? `/contratos/${primeiroContratoEmAtraso.id}` : '/contratos'" class="btn-danger text-sm py-2 px-4">Pagar Agora</RouterLink>
      </div>
    </div>

    <!-- Saudação -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Olá, {{ state.user?.nome?.split(' ')[0] }}</h1>
    </div>

    <!-- Cards de métricas -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

      <!-- Parcelas em atraso -->
      <button
        type="button"
        :aria-label="totalVencidas > 0 ? `Ver ${totalVencidas} parcela(s) em atraso` : 'Ver contratos'"
        :class="[
          'card w-full text-left min-h-[44px] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all',
          totalVencidas > 0 ? 'border-red-500/20 bg-red-50 hover:border-red-500/40' : 'hover:border-blue-100'
        ]"
        @click="goToAtrasos"
      >
        <p class="section-title text-xs" :class="totalVencidas > 0 ? 'text-red-500' : ''">Em atraso</p>
        <p class="text-2xl font-bold mt-1" :class="totalVencidas > 0 ? 'text-red-700' : 'text-gray-400'">
          {{ totalVencidas }}
        </p>
        <div class="mt-3 flex items-center justify-between text-xs font-medium" :class="totalVencidas > 0 ? 'text-red-700' : 'text-blue-600'">
          <span>Ver detalhes</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </button>

      <!-- Contratos -->
      <button
        type="button"
        aria-label="Ver seus contratos"
        class="card w-full text-left min-h-[44px] hover:shadow-md hover:border-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all"
        @click="goToContratos"
      >
        <p class="section-title text-xs">Contratos</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ contratosAtivos }}</p>
        <div class="mt-3 flex items-center justify-between text-xs font-medium text-blue-600">
          <span>Ver contratos</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </button>

      <!-- Próximo vencimento -->
      <button
        type="button"
        :aria-label="proximoVencimento ? `Ver contrato do próximo vencimento em ${formatDate(proximoVencimento.vencimento)}` : 'Ver contratos'"
        class="card w-full text-left min-h-[44px] hover:shadow-md hover:border-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all"
        @click="goToProximoVencimento"
      >
        <p class="section-title text-xs">Próximo vencimento</p>
        <template v-if="proximoVencimento">
          <p class="text-lg font-bold text-gray-900 mt-1">{{ formatDate(proximoVencimento.vencimento) }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ formatMoney(proximoVencimento.valor) }}</p>
        </template>
        <p v-else class="text-sm text-gray-400 mt-1">—</p>
        <div class="mt-3 flex items-center justify-between text-xs font-medium text-blue-600">
          <span>{{ proximoVencimento ? 'Ver contrato' : 'Ver contratos' }}</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </button>

      <!-- Acordos -->
      <button
        type="button"
        aria-label="Ver suas negociações e acordos"
        class="card w-full text-left min-h-[44px] hover:shadow-md hover:border-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all"
        @click="goToNegociacoes"
      >
        <p class="section-title text-xs">Acordos</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ acordosAtivos }}</p>
        <div class="mt-3 flex items-center justify-between text-xs font-medium text-blue-600">
          <span>Ver negociações</span>
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </button>
    </div>

    <!-- Contratos resumo -->
    <div class="card mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold text-gray-900">Seus contratos</h2>
        <RouterLink to="/contratos" class="text-sm text-blue-600 hover:underline font-medium">Ver todos →</RouterLink>
      </div>
      <div class="space-y-2">
        <div
          v-for="c in contracts"
          :key="c.id"
          class="flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer"
          :class="c.status === 'quitado'
            ? 'border-gray-100 bg-gray-50/60 opacity-60 hover:opacity-90'
            : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50'"
          @click="router.push(`/contratos/${c.id}`)"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm" :class="c.status === 'quitado' ? 'text-gray-500' : 'text-gray-900'">#{{ c.id }}</span>
              <span class="text-xs text-gray-400">{{ c.tipo }}</span>
              <StatusBadge :status="c.status" small />
            </div>
            <p class="text-xs text-gray-400 mt-0.5">
              {{ c.parcelasPagas }}/{{ c.totalParcelas }} pagas
              <template v-if="c.status !== 'quitado'"> · Saldo: {{ formatMoney(c.saldoDevedor) }}</template>
            </p>
          </div>
          <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Notificações -->
    <div v-if="notificacoes.length > 0" class="card">
      <h2 class="font-semibold text-gray-900 mb-4">Notificações</h2>
      <div class="space-y-3">
        <RouterLink
          v-for="(n, i) in notificacoes"
          :key="i"
          :to="n.action"
          class="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <!-- Ícone por tipo -->
          <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="{
            'bg-red-100': n.type === 'danger',
            'bg-amber-100': n.type === 'warning',
            'bg-green-100': n.type === 'success',
          }">
            <!-- danger -->
            <svg v-if="n.type === 'danger'" class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            <!-- warning -->
            <svg v-else-if="n.type === 'warning'" class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <!-- success -->
            <svg v-else class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
          <div class="flex-1">
            <p class="text-sm text-gray-700">{{ n.text }}</p>
            <span
              v-if="n.expired"
              class="inline-block mt-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"
            >Prazo expirado</span>
          </div>
          <svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </RouterLink>
      </div>
    </div>
    <div v-else class="card text-center text-gray-400 py-6">
      <svg class="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="font-medium text-gray-600">Tudo certo! Suas parcelas estão em dia.</p>
    </div>

    <!-- Espaço para nav mobile -->
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
