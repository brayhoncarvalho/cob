<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const router = useRouter()
const { formatMoney, formatDate, formatDateTime } = useFormatters()
const { state: flowState, clientCancelNegotiation } = useFlow()

// Ordenar: em análise primeiro, depois por data desc
const negotiations = computed(() =>
  [...flowState.negotiations].sort((a, b) => {
    const order = { em_analise: 0, contraproposta: 1, em_pagamento: 2, aprovada: 3, reprovada: 4, cancelada: 5 }
    const oa = order[a.status] ?? 9
    const ob = order[b.status] ?? 9
    return oa !== ob ? oa - ob : b.dataEnvio.localeCompare(a.dataEnvio)
  })
)

const actionLabel = {
  em_analise:   'Ver detalhes',
  em_pagamento: 'Ver acordo',
  aprovada:     'Ver acordo',
  reprovada:    'Nova simulação',
  contraproposta: 'Avaliar proposta',
  cancelada:    'Ver histórico',
}

function goAction(n) {
  if (n.status === 'reprovada') router.push(`/contratos/${n.contratoId}/negociar`)
  else router.push(`/negociacoes/${n.id}`)
}
</script>

<template>
  <ClientLayout title="Minhas Negociações" back-to="/dashboard" back-label="Início">

    <div v-if="negotiations.length === 0" class="card text-center py-12 text-gray-400">
      <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
      <p>Nenhuma negociação realizada ainda.</p>
      <RouterLink to="/contratos" class="text-blue-600 hover:underline text-sm mt-2 block">
        Ver contratos →
      </RouterLink>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="n in negotiations"
        :key="n.id"
        class="card hover:shadow-md transition-shadow cursor-pointer"
        :class="n.status === 'contraproposta' ? 'border-2 border-purple-300 bg-purple-50' : ''"
        @click="goAction(n)"
      >
        <!-- Banner especial para contraproposta -->
        <div v-if="n.status === 'contraproposta'" class="flex items-center gap-2 -mt-1 mb-3 text-purple-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
          <span class="font-bold text-sm">Nova oferta disponível! Temos uma contraproposta para você.</span>
        </div>

        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="font-mono font-semibold text-gray-900 text-sm">{{ n.id }}</span>
              <StatusBadge :status="n.status" />
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p class="text-xs text-gray-400">Contrato</p>
                <p class="font-medium">#{{ n.contratoId }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Enviada em</p>
                <p class="font-medium">{{ formatDateTime(n.dataEnvio) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Proposta</p>
                <p class="font-medium text-xs">
                  {{ formatMoney(n.entrada) }} + {{ n.numParcelas }}x {{ formatMoney(n.valorParcela) }}
                </p>
              </div>
            </div>

            <!-- Status específico -->
            <div v-if="n.status === 'em_analise'" class="mt-2 text-xs text-amber-700 font-medium flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Prazo de resposta: {{ formatDateTime(n.prazoResposta) }}
            </div>
            <div v-if="n.status === 'em_pagamento'" class="mt-2 text-xs text-teal-700 font-medium flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/></svg>
              Próximo vencimento: {{ formatDate(n.parcelas?.find(p => p.status === 'proxima')?.vencimento) }}
            </div>
            <div v-if="n.status === 'reprovada' && n.motivo" class="mt-2 text-xs text-red-600 flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {{ n.motivo }}
            </div>
            <!-- Detalhes da contraproposta -->
            <div v-if="n.status === 'contraproposta' && n.contraproposta" class="mt-2 bg-white rounded-lg p-2.5 border border-purple-200 text-xs text-purple-900 grid grid-cols-3 gap-2">
              <div><span class="text-purple-500">Entrada</span><br><span class="font-bold">{{ formatMoney(n.contraproposta.entrada) }}</span></div>
              <div><span class="text-purple-500">Parcelas</span><br><span class="font-bold">{{ n.contraproposta.numParcelas }}x {{ formatMoney(n.contraproposta.valorParcela) }}</span></div>
              <div><span class="text-purple-500">Total</span><br><span class="font-bold">{{ formatMoney(n.contraproposta.total) }}</span></div>
            </div>
          </div>

          <div class="shrink-0 flex flex-col items-end gap-2">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span
              class="text-xs font-medium whitespace-nowrap"
              :class="n.status === 'contraproposta' ? 'text-purple-700 font-bold' : 'text-blue-600'"
            >
              {{ actionLabel[n.status] ?? 'Ver' }}
            </span>
            <!-- Cancelar proposta em análise ou contraproposta -->
            <button
              v-if="['em_analise', 'contraproposta'].includes(n.status)"
              type="button"
              class="text-xs text-red-500 hover:text-red-700 font-medium mt-1 flex items-center gap-1"
              @click.stop="clientCancelNegotiation(n.id)"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
