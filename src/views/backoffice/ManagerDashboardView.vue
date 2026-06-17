<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BackofficeLayout from '@/layouts/BackofficeLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import negotiationsData from '@/mocks/negotiations.json'
import contractsData from '@/mocks/contracts.json'

const router = useRouter()
const { formatMoney, formatDateTime } = useFormatters()

// 2º Nível recebe propostas escaladas (nivel=2)
// Para o demo, mostramos NEG-2026-4521 como escalada
const escaladas = computed(() =>
  negotiationsData
    .filter(n => n.status === 'em_analise')
    .map(n => ({
      ...n,
      contrato: contractsData.find(c => c.id === n.contratoId),
      nivel: 2,
    }))
)

// Métricas gerenciais
const totalRecuperado = 13200   // NEG-2026-4300
const totalPendente   = computed(() =>
  escaladas.value.reduce((s, n) => s + (n.contrato?.saldoDevedor ?? 0), 0)
)
const taxaAutoAprovacao = 33 // % mockado
const txRecuperacao     = 67 // % mockado
</script>

<template>
  <BackofficeLayout title="Dashboard Gerencial — 2º Nível">

    <!-- Métricas -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-xs text-gray-400 uppercase font-medium mb-1">Escaladas p/ análise</p>
        <p class="text-3xl font-bold text-amber-600">{{ escaladas.length }}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-xs text-gray-400 uppercase font-medium mb-1">Total pendente</p>
        <p class="text-xl font-bold text-red-600">{{ formatMoney(totalPendente) }}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-xs text-gray-400 uppercase font-medium mb-1">Recuperado (mês)</p>
        <p class="text-xl font-bold text-green-600">{{ formatMoney(totalRecuperado) }}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-xs text-gray-400 uppercase font-medium mb-1">Taxa autosserviço</p>
        <p class="text-3xl font-bold text-blue-600">{{ taxaAutoAprovacao }}%</p>
      </div>
    </div>

    <!-- Fila do 2º Nível -->
    <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 class="font-semibold text-gray-900">Propostas escaladas para análise gerencial</h2>
        <span class="text-xs text-gray-400">SLA: 24h úteis</span>
      </div>

      <div v-if="escaladas.length === 0" class="text-center py-12 text-gray-400">
        <svg class="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p>Nenhuma proposta escalada</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[700px]">
          <thead class="bg-gray-50">
            <tr class="text-xs text-gray-500">
              <th class="text-left px-6 py-3 font-medium">Protocolo</th>
              <th class="text-left px-4 py-3 font-medium">Contrato</th>
              <th class="text-right px-4 py-3 font-medium">Dívida total</th>
              <th class="text-left px-4 py-3 font-medium">Proposta</th>
              <th class="text-left px-4 py-3 font-medium">Enviada</th>
              <th class="text-right px-6 py-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr
              v-for="item in escaladas"
              :key="item.id"
              class="hover:bg-gray-50 cursor-pointer"
              @click="router.push(`/backoffice/gerente/proposta/${item.id}`)"
            >
              <td class="px-6 py-3 font-mono text-sm text-gray-900">{{ item.id }}</td>
              <td class="px-4 py-3 font-mono text-gray-700">#{{ item.contratoId }}</td>
              <td class="px-4 py-3 text-right">
                <p class="font-bold text-red-600">{{ formatMoney(item.contrato?.saldoDevedor ?? 0) }}</p>
                <p class="text-xs text-gray-400">{{ item.contrato?.diasAtraso }}d atraso</p>
              </td>
              <td class="px-4 py-3">
                <p>Ent: {{ formatMoney(item.entrada) }}</p>
                <p class="text-xs text-gray-500">+ {{ item.numParcelas }}x {{ formatMoney(item.valorParcela) }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-gray-500">{{ formatDateTime(item.dataEnvio) }}</td>
              <td class="px-6 py-3 text-right">
                <button
                  @click.stop="router.push(`/backoffice/gerente/proposta/${item.id}`)"
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

    <!-- Performance da mesa -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 class="font-semibold text-gray-900 mb-4">Performance da operação (mês atual)</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900">8</div>
          <div class="text-xs text-gray-500 mt-0.5">Propostas recebidas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">5</div>
          <div class="text-xs text-gray-500 mt-0.5">Aprovadas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-red-500">2</div>
          <div class="text-xs text-gray-500 mt-0.5">Reprovadas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ txRecuperacao }}%</div>
          <div class="text-xs text-gray-500 mt-0.5">Taxa de recuperação</div>
        </div>
      </div>

      <!-- Barra de progresso -->
      <div class="mt-4">
        <div class="flex justify-between text-xs text-gray-500 mb-1">
          <span>Meta mensal de recuperação</span>
          <span>{{ txRecuperacao }}% / 80%</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
          <div class="bg-blue-500 h-2 rounded-full" :style="{ width: txRecuperacao + '%' }" />
        </div>
      </div>
    </div>

  </BackofficeLayout>
</template>
