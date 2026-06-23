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
const totalEmAnalise   = computed(() => itens.value.filter(n => n.horasNaFila > 0).length)
const hoje = new Date()
const resolvidasHoje   = computed(() =>
  flowState.negotiations.filter(n => {
    const dataRef = n.dataAprovacao || n.dataReprovacao || n.dataCancelamento
    if (!dataRef) return false
    const d = new Date(dataRef)
    return d.getFullYear() === hoje.getFullYear() &&
           d.getMonth() === hoje.getMonth() &&
           d.getDate() === hoje.getDate()
  }).length
)

function goAnalise(id) {
  router.push(`/backoffice/proposta/${id}`)
}

// Acordos em andamento (pagando parcelas)
const acordosAtivos = computed(() =>
  flowState.negotiations
    .filter(n => n.status === 'em_pagamento')
    .map(n => ({
      ...n,
      contrato: flowState.contracts.find(c => c.id === n.contratoId),
      parcelasPagas: n.parcelas?.filter(p => p.status === 'paga').length ?? 0,
      parcelasTotal: n.parcelas?.length ?? 0,
    }))
)

// Acordos já quitados (histórico)
const acordosQuitados = computed(() =>
  flowState.negotiations
    .filter(n => n.status === 'quitado')
    .map(n => ({
      ...n,
      contrato: flowState.contracts.find(c => c.id === n.contratoId),
      parcelasPagas: n.parcelas?.filter(p => p.status === 'paga').length ?? 0,
      parcelasTotal: n.parcelas?.length ?? 0,
    }))
)
</script>

<template>
  <BackofficeLayout title="Mesa de Crédito">

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

    <!-- Acordos em andamento -->
    <div v-if="acordosAtivos.length > 0" class="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-6">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-900">Acordos em andamento</h2>
        <span class="text-xs bg-blue-50 text-blue-600 font-semibold px-2.5 py-1 rounded-full">{{ acordosAtivos.length }} ativos</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[600px]">
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
              v-for="item in acordosAtivos"
              :key="item.id"
              class="hover:bg-gray-50 cursor-pointer"
              @click="goAnalise(item.id)"
            >
              <td class="px-6 py-3 font-mono text-sm text-gray-900">{{ item.id }}</td>
              <td class="px-4 py-3 font-mono text-gray-700">#{{ item.contratoId }}</td>
              <td class="px-4 py-3 text-right font-semibold">{{ formatMoney(item.totalAcordo) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-gray-100 rounded-full h-2 min-w-[80px]">
                    <div
                      class="h-2 rounded-full"
                      :class="item.status === 'quitado' ? 'bg-green-500' : 'bg-blue-500'"
                      :style="{ width: item.parcelasTotal > 0 ? Math.round((item.parcelasPagas / item.parcelasTotal) * 100) + '%' : '0%' }"
                    />
                  </div>
                  <span class="text-xs text-gray-500 whitespace-nowrap">{{ item.parcelasPagas }}/{{ item.parcelasTotal }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Em pagamento</span>
              </td>
              <td class="px-6 py-3 text-right">
                <button @click.stop="goAnalise(item.id)" class="text-sm font-semibold text-blue-600 hover:text-blue-800">Ver acordo →</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Acordos quitados (histórico) -->
    <div v-if="acordosQuitados.length > 0" class="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-6">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-900">Acordos quitados</h2>
        <span class="text-xs bg-green-50 text-green-600 font-semibold px-2.5 py-1 rounded-full">{{ acordosQuitados.length }} concluído{{ acordosQuitados.length > 1 ? 's' : '' }}</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm min-w-[600px]">
          <thead class="bg-gray-50">
            <tr class="text-xs text-gray-500">
              <th class="text-left px-6 py-3 font-medium">Protocolo</th>
              <th class="text-left px-4 py-3 font-medium">Contrato</th>
              <th class="text-right px-4 py-3 font-medium">Total do acordo</th>
              <th class="text-center px-4 py-3 font-medium">Parcelas</th>
              <th class="text-right px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="item in acordosQuitados" :key="item.id" class="hover:bg-gray-50 cursor-pointer" @click="goAnalise(item.id)">
              <td class="px-6 py-3 font-mono text-sm text-gray-900">{{ item.id }}</td>
              <td class="px-4 py-3 font-mono text-gray-700">#{{ item.contratoId }}</td>
              <td class="px-4 py-3 text-right font-semibold text-gray-700">{{ formatMoney(item.totalAcordo) }}</td>
              <td class="px-4 py-3 text-center text-xs text-gray-500">{{ item.parcelasPagas }}/{{ item.parcelasTotal }} pagas</td>
              <td class="px-6 py-3 text-right">
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Quitado</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </BackofficeLayout>
</template>
