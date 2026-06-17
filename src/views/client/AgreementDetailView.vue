<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import negotiationsData from '@/mocks/negotiations.json'

const route = useRoute()
const { formatMoney, formatDate, formatDateTime } = useFormatters()

const negotiation = computed(() => negotiationsData.find(n => n.id === route.params.id))

// Pagamento mockado
const pagandoIndex = ref(null)
const pago = ref(new Set())

function pagarParcela(idx) {
  pagandoIndex.value = idx
  setTimeout(() => {
    pago.value.add(idx)
    pagandoIndex.value = null
  }, 1200)
}

// Pix mockado
const pixCopiado = ref(false)
function copiarPix() {
  pixCopiado.value = true
  setTimeout(() => pixCopiado.value = false, 2000)
}
</script>

<template>
  <ClientLayout
    :title="`Acordo ${route.params.id}`"
    back-to="/negociacoes"
    back-label="Minhas Negociações"
  >
    <div v-if="!negotiation" class="card text-center py-12 text-gray-500">Negociação não encontrada.</div>

    <template v-else>

      <!-- Header do acordo -->
      <div class="card mb-6">
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

        <div v-if="negotiation.status === 'em_pagamento'" class="alert-warning mt-4 text-xs flex items-start gap-1.5">
          <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          <span>O não pagamento de qualquer parcela por mais de 10 dias cancela o acordo e restaura o débito original.</span>
        </div>
        <div v-if="negotiation.status === 'em_analise'" class="alert-info mt-4 text-xs flex items-start gap-1.5">
          <svg class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>Sua proposta está sendo avaliada pela Mesa de Crédito. Prazo: {{ formatDateTime(negotiation.prazoResposta) }}.</span>
        </div>
        <div v-if="negotiation.status === 'reprovada'" class="alert-danger mt-4 text-xs flex items-start gap-1.5">
          <svg class="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>{{ negotiation.motivo }}
          <RouterLink :to="`/contratos/${negotiation.contratoId}/negociar`" class="block mt-1 font-semibold hover:underline">
            Tentar nova simulação →
          </RouterLink></span>
        </div>
      </div>

      <!-- Parcelas do acordo (se em pagamento) -->
      <div v-if="negotiation.parcelas?.length" class="card mb-6">
        <h3 class="font-semibold text-gray-900 mb-4">Parcelas do acordo</h3>

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
                :class="p.status === 'proxima' ? 'bg-amber-50' : ''"
              >
                <td class="py-2.5 text-xs font-mono text-gray-400">{{ p.numero }}</td>
                <td class="py-2.5 text-xs text-gray-500 capitalize">{{ p.tipo }}</td>
                <td class="py-2.5">{{ formatDate(p.vencimento) }}</td>
                <td class="py-2.5 text-right font-semibold">{{ formatMoney(p.valor) }}</td>
                <td class="py-2.5 text-center">
                  <StatusBadge :status="pago.has(idx) ? 'paga' : p.status" small />
                </td>
                <td class="py-2.5 text-right">
                  <template v-if="!pago.has(idx) && (p.status === 'proxima' || p.status === 'futura')">
                    <button
                      @click="pagarParcela(idx)"
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

      <!-- Ações de pagamento -->
      <div v-if="negotiation.status === 'em_pagamento'" class="flex flex-wrap gap-3">
        <RouterLink
          :to="`/contratos/${negotiation.contratoId}/pagar`"
          class="btn-primary"
        >
          Pagar Próxima via Pix
        </RouterLink>
        <button class="btn-secondary flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
          Baixar Boleto
        </button>
        <button @click="copiarPix" :class="pixCopiado ? 'btn-success' : 'btn-secondary'">
          {{ pixCopiado ? 'Copiado!' : 'Copiar Código Pix' }}
        </button>
      </div>

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
