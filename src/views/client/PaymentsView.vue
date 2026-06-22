<script setup>
import { computed, ref } from 'vue'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const { formatMoney, formatDate } = useFormatters()
const { state: flowState } = useFlow()

const contracts    = flowState.contracts
const negotiations = flowState.negotiations

// Contratos que têm acordo ativo — parcelas do contrato ficam suspensas
const contratoComAcordo = computed(() =>
  new Set(negotiations.filter(n => n.status === 'em_pagamento').map(n => n.contratoId))
)

// ── Em atraso ────────────────────────────────────────────────────────────────
const parcelasEmAtraso = computed(() => {
  const items = []
  contracts.forEach(c => {
    if (contratoComAcordo.value.has(c.id)) return
    c.parcelas.filter(p => p.status === 'vencida').forEach(p => {
      items.push({
        sourceType: 'contrato',
        sourceLabel: `Contrato #${c.id}`,
        contratoId: c.id,
        parcelaNum: p.numero,
        vencimento: p.vencimento,
        valor: p.valorAtualizado ?? p.valor,
        payRoute: `/contratos/${c.id}/pagar?parcelas=${p.numero}`,
        detailRoute: `/contratos/${c.id}`,
        negociarRoute: `/contratos/${c.id}/negociar`,
      })
    })
  })
  negotiations.filter(n => n.status === 'em_pagamento' && n.entradaPaga).forEach(n => {
    n.parcelas?.filter(p => p.status === 'vencida').forEach(p => {
      items.push({
        sourceType: 'acordo',
        sourceLabel: `Acordo ${n.id}`,
        contratoId: n.contratoId,
        parcelaNum: p.numero,
        vencimento: p.vencimento,
        valor: p.valor,
        payRoute: `/negociacoes/${n.id}?pagar=1`,
        detailRoute: `/negociacoes/${n.id}`,
        negociarRoute: null,
      })
    })
  })
  return items.sort((a, b) => a.vencimento.localeCompare(b.vencimento))
})

// ── Próximos vencimentos ─────────────────────────────────────────────────────
const proximosVencimentos = computed(() => {
  const items = []
  contracts.forEach(c => {
    if (contratoComAcordo.value.has(c.id)) return
    c.parcelas.filter(p => p.status === 'proxima' || p.status === 'futura').forEach(p => {
      items.push({
        sourceType: 'contrato',
        sourceLabel: `Contrato #${c.id}`,
        contratoId: c.id,
        parcelaNum: p.numero,
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
        contratoId: n.contratoId,
        parcelaNum: p.numero,
        vencimento: p.vencimento,
        valor: p.valor,
        payRoute: `/negociacoes/${n.id}?pagar=1`,
        detailRoute: `/negociacoes/${n.id}`,
      })
    })
  })
  return items.sort((a, b) => a.vencimento.localeCompare(b.vencimento))
})

const totalEmAtraso = computed(() => parcelasEmAtraso.value.reduce((s, p) => s + p.valor, 0))
const acordosAtivos = computed(() => negotiations.filter(n => n.status === 'em_pagamento').length)

// Próximo vencimento geral (para card resumo)
const proximoGeral = computed(() => proximosVencimentos.value[0] ?? null)

// ── Seleção múltipla (apenas vencidas) ───────────────────────────────────────
const selecionadas = ref(new Set())

function toggleItem(key) {
  const s = new Set(selecionadas.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  selecionadas.value = s
}

function selecionarTodas() {
  selecionadas.value = new Set(parcelasEmAtraso.value.map(itemKey))
}

function limparSelecao() {
  selecionadas.value = new Set()
}

function itemKey(item) {
  return `${item.sourceType}-${item.contratoId}-${item.parcelaNum}`
}

// Agrupa parcelas selecionadas por contrato para montar a rota de pagamento
const selecaoAgrupada = computed(() => {
  const map = new Map()
  parcelasEmAtraso.value.forEach(item => {
    const key = itemKey(item)
    if (!selecionadas.value.has(key)) return
    if (item.sourceType !== 'contrato') return // acordos pagam via modal próprio
    if (!map.has(item.contratoId)) map.set(item.contratoId, [])
    map.get(item.contratoId).push(item.parcelaNum)
  })
  return map
})

const totalSelecionado = computed(() =>
  parcelasEmAtraso.value
    .filter(item => selecionadas.value.has(itemKey(item)))
    .reduce((s, item) => s + item.valor, 0)
)

const numSelecionadas = computed(() => selecionadas.value.size)

// Rota de pagamento: se todas do mesmo contrato, pagar direto; senão, primeiro contrato
const payRouteSelecao = computed(() => {
  const entries = [...selecaoAgrupada.value.entries()]
  if (entries.length === 1) {
    const [cid, nums] = entries[0]
    return `/contratos/${cid}/pagar?parcelas=${nums.sort((a,b) => a-b).join(',')}`
  }
  if (entries.length > 1) {
    // Pegar o primeiro contrato com seleção
    const [cid, nums] = entries[0]
    return `/contratos/${cid}/pagar?parcelas=${nums.sort((a,b) => a-b).join(',')}`
  }
  return '/pagamentos'
})

// Contrato em atraso distinto (para "Negociar dívida")
const contratosEmAtraso = computed(() => {
  const ids = new Set()
  parcelasEmAtraso.value.forEach(p => {
    if (p.sourceType === 'contrato') ids.add(p.contratoId)
  })
  return [...ids]
})

// ── Carregamento progressivo (próximos) ──────────────────────────────────────
const proximosVisiveis = ref(5)
const proximosExibidos = computed(() => proximosVencimentos.value.slice(0, proximosVisiveis.value))
const temMaisProximos  = computed(() => proximosVisiveis.value < proximosVencimentos.value.length)

function carregarMais() {
  proximosVisiveis.value += 5
}
</script>

<template>
  <ClientLayout title="Pagamentos">

    <!-- ── Card resumo financeiro ─────────────────────────────────────── -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <!-- Total em atraso -->
      <div class="card flex items-start gap-3" :class="parcelasEmAtraso.length > 0 ? 'border-red-500/20 bg-red-50' : ''">
        <span class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" :class="parcelasEmAtraso.length > 0 ? 'bg-red-100' : 'bg-gray-100'">
          <svg class="w-5 h-5" :class="parcelasEmAtraso.length > 0 ? 'text-red-600' : 'text-gray-400'" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        </span>
        <div>
          <p class="text-xs text-gray-500">Em atraso</p>
          <p class="text-lg font-bold" :class="parcelasEmAtraso.length > 0 ? 'text-red-700' : 'text-gray-400'">
            {{ parcelasEmAtraso.length > 0 ? formatMoney(totalEmAtraso) : 'R$ 0,00' }}
          </p>
          <p class="text-xs text-gray-400 mt-0.5">{{ parcelasEmAtraso.length }} parcela(s)</p>
        </div>
      </div>

      <!-- Próximo vencimento -->
      <div class="card flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
        </span>
        <div>
          <p class="text-xs text-gray-500">Próximo vencimento</p>
          <template v-if="proximoGeral">
            <p class="text-lg font-bold text-gray-900">{{ formatDate(proximoGeral.vencimento) }}</p>
            <p class="text-xs text-gray-400 mt-0.5">{{ formatMoney(proximoGeral.valor) }} · {{ proximoGeral.sourceLabel }}</p>
          </template>
          <p v-else class="text-lg font-bold text-gray-400">—</p>
        </div>
      </div>

      <!-- Acordos ativos -->
      <div class="card flex items-start gap-3">
        <span class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </span>
        <div>
          <p class="text-xs text-gray-500">Acordos ativos</p>
          <p class="text-lg font-bold text-gray-900">{{ acordosAtivos }}</p>
          <RouterLink v-if="acordosAtivos > 0" to="/negociacoes" class="text-xs text-green-600 hover:underline font-medium">Ver acordos →</RouterLink>
        </div>
      </div>
    </div>

    <!-- ── Em atraso (com seleção múltipla) ───────────────────────────── -->
    <div v-if="parcelasEmAtraso.length > 0" class="mb-8">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
            <svg class="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
          </span>
          Em atraso
          <span class="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{{ parcelasEmAtraso.length }}</span>
        </h2>
        <div class="flex items-center gap-3">
          <!-- Negociar dívida -->
          <RouterLink
            v-if="contratosEmAtraso.length === 1"
            :to="`/contratos/${contratosEmAtraso[0]}/negociar`"
            class="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Negociar dívida
          </RouterLink>
          <!-- Selecionar todas / Limpar -->
          <div class="flex gap-2 text-xs">
            <button @click="selecionarTodas" class="text-blue-600 hover:underline font-medium">Selecionar todas</button>
            <button v-if="numSelecionadas > 0" @click="limparSelecao" class="text-gray-400 hover:underline">Limpar</button>
          </div>
        </div>
      </div>

      <div class="card divide-y divide-gray-50 p-0 overflow-hidden">
        <button
          v-for="item in parcelasEmAtraso"
          :key="`atraso-${itemKey(item)}`"
          type="button"
          class="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
          :class="selecionadas.has(itemKey(item)) ? 'bg-red-50' : 'hover:bg-gray-50'"
          @click="toggleItem(itemKey(item))"
        >
          <!-- Checkbox -->
          <span
            class="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
            :class="selecionadas.has(itemKey(item)) ? 'bg-red-600 border-red-600' : 'border-gray-300'"
          >
            <svg v-if="selecionadas.has(itemKey(item))" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          </span>

          <!-- Badge + Info -->
          <span
            class="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            :class="item.sourceType === 'acordo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
          >
            {{ item.sourceType === 'acordo' ? 'Acordo' : 'Contrato' }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-800 truncate">Parcela {{ item.parcelaNum }} · {{ item.sourceLabel }}</p>
            <p class="text-xs text-red-600 mt-0.5">Venceu em {{ formatDate(item.vencimento) }}</p>
          </div>

          <!-- Valor + Ações -->
          <span class="text-sm font-bold text-gray-900 shrink-0">{{ formatMoney(item.valor) }}</span>
          <div class="flex items-center gap-1.5 shrink-0" @click.stop>
            <RouterLink
              :to="item.payRoute"
              class="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg transition-colors"
            >Pagar</RouterLink>
            <RouterLink
              v-if="item.negociarRoute"
              :to="item.negociarRoute"
              class="text-xs font-medium text-amber-700 hover:text-amber-800 hover:underline px-1"
            >Negociar</RouterLink>
            <RouterLink
              :to="item.detailRoute"
              class="text-xs text-gray-400 hover:text-blue-600 hover:underline px-1"
            >Ver</RouterLink>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Próximos vencimentos (carregamento progressivo) ────────────── -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
            <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
          </span>
          Próximos vencimentos
          <span v-if="proximosVencimentos.length > 0" class="text-xs font-normal text-gray-400">
            Exibindo {{ proximosExibidos.length }} de {{ proximosVencimentos.length }}
          </span>
        </h2>
      </div>

      <div v-if="proximosExibidos.length > 0" class="card divide-y divide-gray-50 p-0 overflow-hidden">
        <div
          v-for="item in proximosExibidos"
          :key="`proximo-${item.sourceLabel}-${item.parcelaNum}`"
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
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-sm font-bold text-gray-900">{{ formatMoney(item.valor) }}</span>
            <RouterLink
              :to="item.payRoute"
              class="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >Pagar</RouterLink>
            <RouterLink
              :to="item.detailRoute"
              class="text-xs text-gray-400 hover:text-blue-600 hover:underline px-1"
            >Ver</RouterLink>
          </div>
        </div>
      </div>

      <!-- Botão carregar mais -->
      <div v-if="temMaisProximos" class="mt-3 text-center">
        <button
          @click="carregarMais"
          class="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Carregar mais ({{ proximosVencimentos.length - proximosVisiveis }} restantes)
        </button>
      </div>

      <!-- Estado vazio — tudo em dia -->
      <div v-else-if="proximosVencimentos.length === 0 && parcelasEmAtraso.length === 0" class="card text-center py-12">
        <svg class="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="font-semibold text-gray-700">Tudo em dia!</p>
        <p class="text-sm text-gray-400 mt-1">Você não tem parcelas pendentes ou vencimentos próximos.</p>
      </div>
    </div>

    <!-- ── Barra sticky: pagar selecionadas ──────────────────────────── -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="translate-y-full opacity-0"
        leave-active-class="transition-all duration-150"
        leave-to-class="translate-y-full opacity-0"
      >
        <div
          v-if="numSelecionadas > 0"
          class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 py-3 sm:py-2.5"
        >
          <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-gray-900">{{ numSelecionadas }} parcela(s) selecionada(s)</p>
              <p class="text-xs text-gray-500">Total: <strong class="text-red-700">{{ formatMoney(totalSelecionado) }}</strong></p>
            </div>
            <div class="flex items-center gap-2">
              <button @click="limparSelecao" class="btn-secondary text-xs py-2 px-3">Limpar</button>
              <RouterLink
                :to="payRouteSelecao"
                class="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors shadow"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
                Pagar {{ numSelecionadas }} parcela(s)
              </RouterLink>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Espaço extra quando barra sticky visível + mobile nav -->
    <div :class="numSelecionadas > 0 ? 'h-32 sm:h-20' : 'h-16 sm:h-0'" />
  </ClientLayout>
</template>
