<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BackofficeLayout from '@/layouts/BackofficeLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useRules } from '@/stores/rules.js'

const router = useRouter()
const { formatMoney, formatDateTime } = useFormatters()
const { state: flowState } = useFlow()
const { rules } = useRules()

const filtroStatus = ref('todos')
const filtroNivel  = ref('1')

// Propostas pendentes para análise — 1º Nível: dívida ≤ R$20k
const pendentes = computed(() => {
  const base = flowState.negotiations.filter(n =>
    n.status === 'em_analise' && (n.nivel ?? 1) === 1
  )
  if (filtroStatus.value === 'todos') return base
  return base.filter(n => n.status === filtroStatus.value)
})

// Enriquece com dados do contrato
const itens = computed(() =>
  pendentes.value.map(n => {
    const c = flowState.contracts.find(c => c.id === n.contratoId)
    const enviada = new Date(n.dataEnvio)
    const agora   = new Date()
    const horasNaFila = Math.floor((agora - enviada) / 3600000)
    const slaAlerta   = horasNaFila >= 3 // alerta se quase no limite de 4h

    return {
      ...n,
      contrato: c,
      horasNaFila,
      slaAlerta,
      precisaEscalar: (c?.saldoDevedor ?? 0) > rules.alcada1NivelMax,
    }
  })
)

// Estatísticas
const totalPendentes   = computed(() => flowState.negotiations.filter(n => n.status === 'em_analise').length)
const totalEmAnalise   = 0
const resolvidasHoje   = 1

function goAnalise(id) {
  router.push(`/backoffice/proposta/${id}`)
}
</script>

<template>
  <BackofficeLayout title="Fila de Aprovação — 1º Nível">

    <!-- Métricas rápidas -->
    <div class="grid grid-cols-3 gap-4 mb-6">
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-amber-600">{{ totalPendentes }}</p>
        <p class="text-xs text-gray-500 mt-0.5">Pendentes</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-blue-600">{{ totalEmAnalise }}</p>
        <p class="text-xs text-gray-500 mt-0.5">Em análise</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-4 text-center">
        <p class="text-2xl font-bold text-green-600">{{ resolvidasHoje }}</p>
        <p class="text-xs text-gray-500 mt-0.5">Resolvidas hoje</p>
      </div>
    </div>

    <!-- Tabela de propostas -->
    <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-900">Propostas para análise</h2>
        <div class="flex items-center gap-3 text-xs text-gray-500">
          <span class="flex items-center gap-1 font-medium text-amber-600">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Próximo do SLA
          </span>
          <span class="flex items-center gap-1 font-medium text-red-600">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5"/></svg>
            Requer escalonamento
          </span>
        </div>
      </div>

      <div v-if="itens.length === 0" class="text-center py-12 text-gray-400">
        <svg class="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p>Nenhuma proposta pendente</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[700px]">
          <thead class="bg-gray-50">
            <tr class="text-xs text-gray-500">
              <th class="text-left px-6 py-3 font-medium">Cliente</th>
              <th class="text-left px-4 py-3 font-medium">Contrato</th>
              <th class="text-right px-4 py-3 font-medium">Dívida</th>
              <th class="text-left px-4 py-3 font-medium">Proposta</th>
              <th class="text-center px-4 py-3 font-medium">Tempo na fila</th>
              <th class="text-center px-4 py-3 font-medium">Nível</th>
              <th class="text-right px-6 py-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr
              v-for="item in itens"
              :key="item.id"
              :class="['hover:bg-gray-50 cursor-pointer transition-colors', item.slaAlerta ? 'bg-amber-50' : '']"
              @click="goAnalise(item.id)"
            >
              <td class="px-6 py-3">
                <p class="font-medium text-gray-900">João da Silva</p>
                <p class="text-xs text-gray-400 font-mono">{{ item.id }}</p>
              </td>
              <td class="px-4 py-3 font-mono text-gray-700">#{{ item.contratoId }}</td>
              <td class="px-4 py-3 text-right">
                <p class="font-semibold" :class="item.precisaEscalar ? 'text-red-600' : 'text-gray-900'">
                  {{ formatMoney(item.contrato?.saldoDevedor ?? 0) }}
                </p>
                <p class="text-xs text-gray-400">{{ item.contrato?.diasAtraso }}d atraso</p>
              </td>
              <td class="px-4 py-3">
                <p class="text-gray-900">Ent: {{ formatMoney(item.entrada) }}</p>
                <p class="text-xs text-gray-500">+ {{ item.numParcelas }}x {{ formatMoney(item.valorParcela) }}</p>
              </td>
              <td class="px-4 py-3 text-center">
                <span :class="item.slaAlerta ? 'text-amber-600 font-semibold' : 'text-gray-600'">
                  {{ item.horasNaFila }}h
                  <svg v-if="item.slaAlerta" class="inline w-3.5 h-3.5 ml-0.5 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </span>
              </td>
              <td class="px-4 py-3 text-center">
                <span v-if="item.precisaEscalar" class="inline-flex items-center gap-0.5 text-xs font-semibold text-red-600">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5"/></svg>
                  2º Nív.
                </span>
                <span v-else class="text-xs text-gray-500">1º Nív.</span>
              </td>
              <td class="px-6 py-3 text-right">
                <button
                  @click.stop="goAnalise(item.id)"
                  class="text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  Analisar →
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Propostas resolvidas (histórico) -->
    <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-6">
      <div class="px-6 py-4 border-b border-gray-100">
        <h2 class="font-semibold text-gray-900">Resolvidas recentemente</h2>
      </div>
      <div class="divide-y divide-gray-50">
        <div class="px-6 py-3 flex items-center justify-between text-sm">
          <div>
            <span class="font-mono text-gray-700">NEG-2026-4300</span>
            <span class="ml-2 text-gray-500">Contrato #9012</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-gray-500">{{ formatMoney(3000) }} + 6x</span>
            <StatusBadge status="aprovada" small />
          </div>
        </div>
      </div>
    </div>

  </BackofficeLayout>
</template>
