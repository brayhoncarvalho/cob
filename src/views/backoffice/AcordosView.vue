<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BackofficeLayout from '@/layouts/BackofficeLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useAuth } from '@/stores/auth.js'

const router = useRouter()
const { formatMoney, formatDate } = useFormatters()
const { state: flowState } = useFlow()
const { state: authState } = useAuth()

const isManager = computed(() => authState.role === 'manager')

const filtro = ref('todos')

const todosAcordos = computed(() =>
  flowState.negotiations
    .filter(n => n.status === 'em_pagamento' || n.status === 'quitado')
    .map(n => ({
      ...n,
      contrato: flowState.contracts.find(c => c.id === n.contratoId),
      parcelasPagas: n.parcelas?.filter(p => p.status === 'paga').length ?? 0,
      parcelasTotal: n.parcelas?.length ?? 0,
    }))
    .sort((a, b) => (a.status === 'quitado' ? 1 : -1))
)

const acordosFiltrados = computed(() => {
  if (filtro.value === 'todos') return todosAcordos.value
  return todosAcordos.value.filter(n => n.status === filtro.value)
})

const countEmPagamento = computed(() => todosAcordos.value.filter(n => n.status === 'em_pagamento').length)
const countQuitados = computed(() => todosAcordos.value.filter(n => n.status === 'quitado').length)

function goAcordo(id) {
  const base = isManager.value ? '/backoffice/gerente/proposta' : '/backoffice/proposta'
  router.push(`${base}/${id}`)
}
</script>

<template>
  <BackofficeLayout title="Acordos">

    <!-- Métricas -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ countEmPagamento }}</p>
        <p class="text-xs text-gray-500 mt-0.5">Em pagamento</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-green-600">{{ countQuitados }}</p>
        <p class="text-xs text-gray-500 mt-0.5">Quitados</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-gray-900">{{ todosAcordos.length }}</p>
        <p class="text-xs text-gray-500 mt-0.5">Total</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex items-center gap-2 mb-4">
      <button
        v-for="f in [{ key: 'todos', label: 'Todos' }, { key: 'em_pagamento', label: 'Em pagamento' }, { key: 'quitado', label: 'Quitados' }]"
        :key="f.key"
        @click="filtro = f.key"
        :class="[
          'px-4 py-1.5 rounded-full text-xs font-semibold transition-colors',
          filtro === f.key
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        ]"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Tabela -->
    <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div v-if="acordosFiltrados.length === 0" class="text-center py-12 text-gray-400">
        <svg class="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <p>Nenhum acordo encontrado.</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[700px]">
          <thead class="bg-gray-50">
            <tr class="text-xs text-gray-500">
              <th class="text-left px-6 py-3 font-medium">Protocolo</th>
              <th class="text-left px-4 py-3 font-medium">Contrato</th>
              <th class="text-right px-4 py-3 font-medium">Total do acordo</th>
              <th class="text-center px-4 py-3 font-medium">Progresso</th>
              <th class="text-left px-4 py-3 font-medium">Status</th>
              <th class="text-right px-6 py-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr
              v-for="item in acordosFiltrados"
              :key="item.id"
              class="hover:bg-gray-50 cursor-pointer transition-colors"
              @click="goAcordo(item.id)"
            >
              <td class="px-6 py-3 font-mono text-sm text-gray-900">{{ item.id }}</td>
              <td class="px-4 py-3">
                <p class="font-mono text-gray-700">#{{ item.contratoId }}</p>
                <p class="text-xs text-gray-400">{{ item.contrato?.tipo }}</p>
              </td>
              <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(item.totalAcordo) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-gray-100 rounded-full h-2 min-w-[80px]">
                    <div
                      class="h-2 rounded-full transition-all"
                      :class="item.status === 'quitado' ? 'bg-green-500' : 'bg-blue-500'"
                      :style="{ width: item.parcelasTotal > 0 ? Math.round((item.parcelasPagas / item.parcelasTotal) * 100) + '%' : '0%' }"
                    />
                  </div>
                  <span class="text-xs text-gray-500 whitespace-nowrap">{{ item.parcelasPagas }}/{{ item.parcelasTotal }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="item.status === 'quitado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
                  class="text-xs font-semibold px-2 py-0.5 rounded-full"
                >
                  {{ item.status === 'quitado' ? 'Quitado' : 'Em pagamento' }}
                </span>
              </td>
              <td class="px-6 py-3 text-right">
                <button @click.stop="goAcordo(item.id)" class="text-sm font-semibold text-blue-600 hover:text-blue-800">
                  Ver acordo →
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </BackofficeLayout>
</template>
