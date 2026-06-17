<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import contractsData from '@/mocks/contracts.json'
import negotiationsData from '@/mocks/negotiations.json'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate } = useFormatters()

const contract = computed(() => contractsData.find(c => c.id === route.params.id))
const acordoAtivo = computed(() => {
  if (!contract.value?.acordoAtivo) return null
  return negotiationsData.find(n => n.id === contract.value.acordoAtivo)
})

const showAll = ref(false)
const parcelasExibidas = computed(() => {
  if (!contract.value) return []
  if (showAll.value) return contract.value.parcelas
  // Mostra pagas (últimas 2), vencidas, proxima e futuras (primeiras 3)
  const pagas   = contract.value.parcelas.filter(p => p.status === 'paga').slice(-2)
  const outras  = contract.value.parcelas.filter(p => p.status !== 'paga').slice(0, 8)
  return [...pagas, ...outras]
})

const statusIcon = {
  paga:    'paga',
  vencida: 'vencida',
  proxima: 'proxima',
  futura:  'futura',
}

function parcela_action(p) {
  if (p.status === 'vencida' || p.status === 'proxima') return 'pagar'
  if (p.status === 'futura') return 'antecipar'
  return null
}
</script>

<template>
  <ClientLayout
    :title="`Contrato #${route.params.id}`"
    back-to="/contratos"
    back-label="Contratos"
  >
    <div v-if="!contract" class="card text-center text-gray-500 py-12">
      Contrato não encontrado.
    </div>

    <template v-else>
      <!-- Info do contrato -->
      <div class="card mb-6">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <h2 class="text-lg font-bold text-gray-900">Contrato #{{ contract.id }}</h2>
          <span class="text-sm text-gray-500">{{ contract.tipo }}</span>
          <StatusBadge :status="contract.status" />
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Valor contratado</p>
            <p class="font-semibold">{{ formatMoney(contract.valorContratado) }}</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Saldo devedor</p>
            <p class="font-semibold" :class="contract.parcelasVencidas > 0 ? 'text-red-600' : ''">
              {{ formatMoney(contract.saldoDevedor) }}
            </p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Taxa de juros</p>
            <p class="font-semibold">{{ contract.taxaJuros }}% a.m.</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Contratado em</p>
            <p class="font-semibold">{{ formatDate(contract.dataContratacao) }}</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Parcelas</p>
            <p class="font-semibold">{{ contract.parcelasPagas }} pagas / {{ contract.totalParcelas }} total</p>
          </div>
          <div v-if="contract.parcelasVencidas > 0">
            <p class="text-gray-500 text-xs mb-0.5">Juros acumulados</p>
            <p class="font-semibold text-red-600">{{ formatMoney(contract.jurosAcumulados) }}</p>
          </div>
        </div>

        <!-- Alerta de atraso -->
        <div v-if="contract.parcelasVencidas > 0" class="alert-danger mt-4">
          <p class="font-semibold text-sm">{{ contract.parcelasVencidas }} parcela(s) vencida(s) — {{ contract.diasAtraso }} dias em atraso</p>
          <p class="text-xs mt-0.5">Total atualizado: <strong>{{ formatMoney(contract.saldoDevedor) }}</strong> (incluindo juros e multa)</p>
        </div>

        <!-- Acordo ativo -->
        <div v-if="acordoAtivo" class="alert-info mt-4">
          <p class="font-semibold text-sm">Acordo ativo: {{ acordoAtivo.id }}</p>
          <p class="text-xs mt-0.5">
            {{ acordoAtivo.numParcelas }}x de {{ formatMoney(acordoAtivo.valorParcela) }} via boleto/Pix
          </p>
          <RouterLink :to="`/negociacoes/${acordoAtivo.id}`" class="text-xs text-blue-700 font-medium hover:underline mt-1 block">
            Ver detalhes do acordo →
          </RouterLink>
        </div>
      </div>

      <!-- Parcelas -->
      <div class="card mb-6">
        <h3 class="font-semibold text-gray-900 mb-4">Parcelas</h3>

        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm min-w-[480px]">
            <thead>
              <tr class="text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left py-2 font-medium">#</th>
                <th class="text-left py-2 font-medium">Vencimento</th>
                <th class="text-right py-2 font-medium">Valor</th>
                <th class="text-center py-2 font-medium">Status</th>
                <th class="text-right py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="p in parcelasExibidas"
                :key="p.numero"
                :class="[
                  'transition-colors',
                  p.status === 'vencida' ? 'bg-red-50' : '',
                  p.status === 'proxima' ? 'bg-amber-50' : '',
                ]"
              >
                <td class="py-2.5 text-gray-500 font-mono text-xs pr-2">{{ p.numero }}</td>
                <td class="py-2.5">
                  <span :class="p.status === 'vencida' ? 'text-red-700 font-medium' : ''">
                    {{ formatDate(p.vencimento) }}
                  </span>
                  <span v-if="p.status === 'vencida'" class="inline-flex items-center ml-1 text-xs text-red-500">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                  </span>
                </td>
                <td class="py-2.5 text-right font-semibold">
                  <span :class="p.status === 'vencida' ? 'text-red-700' : 'text-gray-900'">
                    {{ formatMoney(p.valorAtualizado) }}
                  </span>
                  <span v-if="p.valorAtualizado !== p.valor" class="block text-xs text-gray-400 line-through">
                    {{ formatMoney(p.valor) }}
                  </span>
                </td>
                <td class="py-2.5 text-center">
                  <StatusBadge :status="p.status" small />
                </td>
                <td class="py-2.5 text-right">
                  <RouterLink
                    v-if="parcela_action(p) === 'pagar'"
                    :to="`/contratos/${contract.id}/pagar?parcelas=${p.numero}`"
                    class="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Pagar
                  </RouterLink>
                  <RouterLink
                    v-else-if="parcela_action(p) === 'antecipar'"
                    :to="`/contratos/${contract.id}/antecipar?parcelas=${p.numero}`"
                    class="text-xs font-medium text-gray-500 hover:underline"
                  >
                    Antecipar
                  </RouterLink>
                  <span v-else class="text-xs text-gray-300">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          v-if="contract.parcelas.length > parcelasExibidas.length || (showAll && contract.parcelas.length > 4)"
          @click="showAll = !showAll"
          class="mt-3 text-sm text-blue-600 hover:underline"
        >
          {{ showAll ? 'Ver menos' : `Ver todas as ${contract.parcelas.length} parcelas` }}
        </button>
      </div>

      <!-- Botões de ação -->
      <div class="flex flex-wrap gap-3">
        <RouterLink
          v-if="contract.parcelasVencidas > 0"
          :to="`/contratos/${contract.id}/pagar`"
          class="btn-danger"
        >
          Pagar Vencidas
        </RouterLink>
        <RouterLink
          :to="`/contratos/${contract.id}/antecipar`"
          class="btn-secondary"
        >
          Antecipar Parcelas
        </RouterLink>
        <RouterLink
          v-if="contract.parcelasVencidas > 0 && !contract.acordoAtivo"
          :to="`/contratos/${contract.id}/negociar`"
          class="btn-primary"
        >
          Negociar Contrato
        </RouterLink>
      </div>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
