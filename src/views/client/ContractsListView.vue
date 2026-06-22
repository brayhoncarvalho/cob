<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const router = useRouter()
const { formatMoney } = useFormatters()
const { state: flowState } = useFlow()

// Ordem: débito > negociação > em dia > quitado
const contracts = computed(() =>
  [...flowState.contracts].sort((a, b) => {
    const order = { em_atraso: 0, renegociado: 1, em_dia: 2, quitado: 3 }
    return (order[a.status] ?? 2) - (order[b.status] ?? 2)
  })
)

// Soma valorAtualizado das parcelas vencidas (fonte da verdade)
function totalVencidoContrato(c) {
  return c.parcelas
    .filter(p => p.status === 'vencida')
    .reduce((s, p) => s + p.valorAtualizado, 0)
}

// Retorna o ID do acordo somente se a negociação ainda está ativa
function acordoVivoDeContrato(c) {
  const neg = flowState.negotiations.find(n =>
    n.contratoId === c.id &&
    ['em_pagamento', 'em_analise'].includes(n.status)
  )
  return neg ? neg.id : null
}
</script>

<template>
  <ClientLayout title="Meus Contratos" back-to="/dashboard" back-label="Início">
    <div class="space-y-4">
      <div
        v-for="c in contracts"
        :key="c.id"
        class="card transition-all cursor-pointer"
        :class="c.status === 'quitado'
          ? 'opacity-60 hover:opacity-90 border-gray-100'
          : 'hover:border-blue-200 hover:shadow-md'"
        @click="router.push(`/contratos/${c.id}`)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="font-bold text-gray-900">Contrato #{{ c.id }}</span>
              <span class="text-sm text-gray-500">{{ c.tipo }}</span>
              <StatusBadge :status="c.status" />
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p class="text-gray-500 text-xs">Saldo devedor</p>
                <p class="font-semibold text-gray-900">{{ formatMoney(c.saldoDevedor) }}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs">Parcelas</p>
                <p class="font-semibold text-gray-900">{{ c.parcelasPagas }}/{{ c.totalParcelas }}</p>
              </div>
              <div v-if="c.parcelasVencidas > 0 && !acordoVivoDeContrato(c)">
                <p class="text-gray-500 text-xs">Vencidas</p>
                <p class="font-semibold text-red-600">{{ c.parcelasVencidas }}x — {{ formatMoney(totalVencidoContrato(c)) }}</p>
              </div>
              <div v-else-if="acordoVivoDeContrato(c)">
                <p class="text-gray-500 text-xs">Acordo</p>
                <p class="font-semibold text-blue-600">Ativo</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs">Taxa</p>
                <p class="font-semibold text-gray-900">{{ c.taxaJuros }}% a.m.</p>
              </div>
            </div>

            <!-- Barra de progresso -->
            <div class="mt-3">
              <div class="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progresso</span>
                <span>{{ Math.round((c.parcelasPagas / c.totalParcelas) * 100) }}%</span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  class="h-1.5 rounded-full transition-all"
                  :class="c.status === 'quitado' ? 'bg-green-500' : (c.status === 'em_atraso' && !acordoVivoDeContrato(c)) ? 'bg-red-400' : 'bg-blue-500'"
                  :style="{ width: `${(c.parcelasPagas / c.totalParcelas) * 100}%` }"
                />
              </div>
            </div>
          </div>

          <svg class="w-5 h-5 text-gray-400 shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>

        <!-- Ações rápidas -->
        <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100" @click.stop>
          <RouterLink
            v-if="c.parcelasVencidas > 0 && !acordoVivoDeContrato(c)"
            :to="`/contratos/${c.id}/pagar`"
            class="btn-danger text-sm py-2 px-4"
          >
            Pagar Agora
          </RouterLink>
          <RouterLink
            v-if="c.parcelasVencidas > 0 && !acordoVivoDeContrato(c)"
            :to="`/contratos/${c.id}/negociar`"
            class="btn-secondary text-sm py-2 px-4"
          >
            Negociar
          </RouterLink>
          <RouterLink
            v-if="acordoVivoDeContrato(c) && c.status !== 'quitado'"
            :to="`/negociacoes/${acordoVivoDeContrato(c)}`"
            class="btn-secondary text-sm py-2 px-4"
          >
            Ver Acordo
          </RouterLink>
          <RouterLink
            :to="`/contratos/${c.id}`"
            class="text-sm text-blue-600 hover:underline px-2 py-2"
          >
            Ver detalhes →
          </RouterLink>
        </div>
      </div>
    </div>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
