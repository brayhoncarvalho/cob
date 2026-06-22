<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useAuth } from '@/stores/auth.js'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const { state } = useAuth()
const { formatMoney, formatDate } = useFormatters()
const router = useRouter()
const { state: flowState } = useFlow()

const contracts    = flowState.contracts
const negotiations = flowState.negotiations

const contratosAtivos = computed(() => contracts.filter(c => c.status !== 'cancelado').length)
const acordosAtivos   = computed(() => negotiations.filter(n => n.status === 'em_pagamento').length)

// Contratos que têm acordo ativo (em_pagamento) — parcelas suspensas
const contratoComAcordo = computed(() =>
  new Set(negotiations.filter(n => n.status === 'em_pagamento').map(n => n.contratoId))
)

// ── Listas unificadas de pagamentos ──────────────────────────────────────────

// Em atraso: vencidas de contratos sem acordo ativo + vencidas de acordo em andamento
const parcelasEmAtraso = computed(() => {
  const items = []
  contracts.forEach(c => {
    if (contratoComAcordo.value.has(c.id)) return
    c.parcelas.filter(p => p.status === 'vencida').forEach(p => {
      items.push({
        sourceType: 'contrato',
        sourceLabel: `Contrato #${c.id}`,
        parcelaNum: p.numero,
        tipo: 'parcela',
        vencimento: p.vencimento,
        valor: p.valorAtualizado ?? p.valor,
        payRoute: `/contratos/${c.id}/pagar?parcelas=${p.numero}`,
        detailRoute: `/contratos/${c.id}`,
      })
    })
  })
  negotiations.filter(n => n.status === 'em_pagamento' && n.entradaPaga).forEach(n => {
    n.parcelas?.filter(p => p.status === 'vencida').forEach(p => {
      items.push({
        sourceType: 'acordo',
        sourceLabel: `Acordo ${n.id}`,
        parcelaNum: p.numero,
        tipo: p.tipo ?? 'parcela',
        vencimento: p.vencimento,
        valor: p.valor,
        payRoute: `/negociacoes/${n.id}?pagar=1`,
        detailRoute: `/negociacoes/${n.id}`,
      })
    })
  })
  return items.sort((a, b) => a.vencimento.localeCompare(b.vencimento))
})

// Próximos vencimentos: proxima + futura de contratos sem acordo + de acordos ativos (limite 6)
const proximosVencimentos = computed(() => {
  const items = []
  contracts.forEach(c => {
    if (contratoComAcordo.value.has(c.id)) return
    c.parcelas.filter(p => p.status === 'proxima' || p.status === 'futura').forEach(p => {
      items.push({
        sourceType: 'contrato',
        sourceLabel: `Contrato #${c.id}`,
        parcelaNum: p.numero,
        tipo: 'parcela',
        vencimento: p.vencimento,
        valor: p.valor,
        payRoute: `/contratos/${c.id}/pagar?parcelas=${p.numero}`,
        detailRoute: `/contratos/${c.id}`,
      })
    })
  })
  negotiations.filter(n => n.status === 'em_pagamento' && n.entradaPaga).forEach(n => {
    n.parcelas?.filter(p => p.status === 'proxima' || p.status === 'futura').forEach(p => {
      items.push({
        sourceType: 'acordo',
        sourceLabel: `Acordo ${n.id}`,
        parcelaNum: p.numero,
        tipo: p.tipo ?? 'parcela',
        vencimento: p.vencimento,
        valor: p.valor,
        payRoute: `/negociacoes/${n.id}?pagar=1`,
        detailRoute: `/negociacoes/${n.id}`,
      })
    })
  })
  return items.sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6)
})

const totalVencidas = computed(() => parcelasEmAtraso.value.length)
const totalEmAberto = computed(() => parcelasEmAtraso.value.reduce((s, p) => s + p.valor, 0))
const proximoGeral  = computed(() => proximosVencimentos.value[0] ?? null)

// Banners de ação
const propostasAtendente = computed(() =>
  negotiations.filter(n => n.status === 'pending_client_approval')
)
const acordosAguardandoPagamento = computed(() =>
  negotiations.filter(n => n.status === 'em_pagamento' && !n.entradaPaga)
)
const contrapropostasPendentes = computed(() =>
  negotiations.filter(n => n.status === 'contraproposta')
)

function goToAtrasos() {
  if (parcelasEmAtraso.value.length > 0) {
    router.push(parcelasEmAtraso.value[0].detailRoute)
    return
  }
  router.push('/contratos')
}
function goToContratos()  { router.push('/contratos') }
function goToProximoVencimento() {
  if (proximoGeral.value) { router.push(proximoGeral.value.detailRoute); return }
  router.push('/contratos')
}
function goToNegociacoes() { router.push('/negociacoes') }
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
        <RouterLink :to="parcelasEmAtraso[0]?.payRoute ?? '/contratos'" class="btn-danger text-sm py-2 px-4">Pagar Agora</RouterLink>
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
        :aria-label="proximoGeral ? `Ver próximo vencimento em ${formatDate(proximoGeral.vencimento)}` : 'Ver contratos'"
        class="card w-full text-left min-h-[44px] hover:shadow-md hover:border-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all"
        @click="goToProximoVencimento"
      >
        <p class="section-title text-xs">Próximo vencimento</p>
        <template v-if="proximoGeral">
          <p class="text-lg font-bold text-gray-900 mt-1">{{ formatDate(proximoGeral.vencimento) }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ formatMoney(proximoGeral.valor) }}</p>
        </template>
        <p v-else class="text-sm text-gray-400 mt-1">—</p>
        <div class="mt-3 flex items-center justify-between text-xs font-medium text-blue-600">
          <span>{{ proximoGeral ? 'Ver detalhe' : 'Ver contratos' }}</span>
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

    <!-- ── Seção: Pagamentos em atraso ────────────────────────────────── -->
    <div v-if="parcelasEmAtraso.length > 0" class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
            <svg class="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>
          </span>
          Em atraso
          <span class="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{{ parcelasEmAtraso.length }}</span>
        </h2>
        <span class="text-sm font-semibold text-red-700">{{ formatMoney(totalEmAberto) }}</span>
      </div>

      <div class="card divide-y divide-gray-50 p-0 overflow-hidden">
        <div
          v-for="item in parcelasEmAtraso"
          :key="`${item.sourceType}-${item.sourceLabel}-${item.parcelaNum}`"
          class="flex items-center justify-between gap-3 px-5 py-3.5"
        >
          <div class="flex items-center gap-3 min-w-0">
            <!-- Badge de origem -->
            <span
              class="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              :class="item.sourceType === 'acordo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
            >
              {{ item.sourceType === 'acordo' ? 'Acordo' : 'Contrato' }}
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">Parcela {{ item.parcelaNum }} · {{ item.sourceLabel }}</p>
              <p class="text-xs text-red-600 mt-0.5">Venceu em {{ formatDate(item.vencimento) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-sm font-bold text-gray-900">{{ formatMoney(item.valor) }}</span>
            <RouterLink
              :to="item.payRoute"
              class="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Pagar
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Seção: Próximos vencimentos ────────────────────────────────── -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
            <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
          </span>
          Próximos vencimentos
        </h2>
        <RouterLink to="/contratos" class="text-xs text-blue-600 hover:underline font-medium">Ver todos →</RouterLink>
      </div>

      <!-- Lista de próximos -->
      <div v-if="proximosVencimentos.length > 0" class="card divide-y divide-gray-50 p-0 overflow-hidden">
        <div
          v-for="item in proximosVencimentos"
          :key="`${item.sourceType}-${item.sourceLabel}-${item.parcelaNum}`"
          class="flex items-center justify-between gap-3 px-5 py-3.5"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span
              class="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
              :class="item.sourceType === 'acordo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
            >
              {{ item.sourceType === 'acordo' ? 'Acordo' : 'Contrato' }}
            </span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">Parcela {{ item.parcelaNum }} · {{ item.sourceLabel }}</p>
              <p class="text-xs text-gray-400 mt-0.5">Vence em {{ formatDate(item.vencimento) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-sm font-bold text-gray-900">{{ formatMoney(item.valor) }}</span>
            <RouterLink
              :to="item.payRoute"
              class="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Pagar
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Estado vazio -->
      <div v-else class="card text-center py-8">
        <svg class="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="font-medium text-gray-600">Tudo em dia! Sem vencimentos próximos.</p>
      </div>
    </div>

    <!-- Espaço para nav mobile -->
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
