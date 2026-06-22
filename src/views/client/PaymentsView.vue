<script setup>
import { computed } from 'vue'
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
        parcelaNum: p.numero,
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
        vencimento: p.vencimento,
        valor: p.valor,
        payRoute: `/negociacoes/${n.id}?pagar=1`,
        detailRoute: `/negociacoes/${n.id}`,
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
</script>

<template>
  <ClientLayout title="Pagamentos">

    <!-- ── Em atraso ──────────────────────────────────────────────────── -->
    <div v-if="parcelasEmAtraso.length > 0" class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
            <svg class="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
          </span>
          Em atraso
          <span class="text-xs font-normal bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{{ parcelasEmAtraso.length }}</span>
        </h2>
        <span class="text-sm font-semibold text-red-700">{{ formatMoney(totalEmAtraso) }}</span>
      </div>

      <div class="card divide-y divide-gray-50 p-0 overflow-hidden">
        <div
          v-for="item in parcelasEmAtraso"
          :key="`atraso-${item.sourceLabel}-${item.parcelaNum}`"
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

    <!-- ── Próximos vencimentos ───────────────────────────────────────── -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold text-gray-900 flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
            <svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
          </span>
          Próximos vencimentos
        </h2>
      </div>

      <div v-if="proximosVencimentos.length > 0" class="card divide-y divide-gray-50 p-0 overflow-hidden">
        <div
          v-for="item in proximosVencimentos"
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

      <!-- Estado vazio — tudo em dia -->
      <div v-else-if="parcelasEmAtraso.length === 0" class="card text-center py-12">
        <svg class="w-12 h-12 text-green-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="font-semibold text-gray-700">Tudo em dia!</p>
        <p class="text-sm text-gray-400 mt-1">Você não tem parcelas pendentes ou vencimentos próximos.</p>
      </div>
    </div>

    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
