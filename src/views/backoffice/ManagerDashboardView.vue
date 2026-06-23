<script setup>
import { computed } from 'vue'
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

// 2º Nível: propostas escaladas (nivel=2, em_analise)
const escaladas = computed(() =>
  flowState.negotiations
    .filter(n => n.status === 'em_analise' && (n.nivel ?? 1) === 2)
    .map(n => ({
      ...n,
      contrato: flowState.contracts.find(c => c.id === n.contratoId),
    }))
)

// Métricas gerenciais calculadas do flow state
const totalPendente = computed(() =>
  escaladas.value.reduce((s, n) => s + (n.contrato?.saldoDevedor ?? 0), 0)
)
const totalRecuperado = computed(() =>
  flowState.negotiations
    .filter(n => n.status === 'em_pagamento' || n.status === 'quitado')
    .reduce((s, n) => s + (n.totalAcordo ?? 0), 0)
)
const todasPropostas = computed(() =>
  flowState.negotiations.filter(n =>
    ['em_analise', 'em_pagamento', 'aprovada', 'reprovada', 'cancelada', 'contraproposta', 'quitado'].includes(n.status)
  )
)
const propostasAprovadas = computed(() =>
  flowState.negotiations.filter(n =>
    ['em_pagamento', 'aprovada', 'quitado'].includes(n.status)
  )
)
const propostasReprovadas = computed(() =>
  flowState.negotiations.filter(n => n.status === 'reprovada')
)
const propostasAuto = computed(() =>
  propostasAprovadas.value.filter(n =>
    n.dataAprovacao && n.dataEnvio &&
    new Date(n.dataAprovacao).getTime() - new Date(n.dataEnvio).getTime() < 60000
  )
)
const taxaAutoAprovacao = computed(() =>
  todasPropostas.value.length > 0
    ? Math.round((propostasAuto.value.length / todasPropostas.value.length) * 100)
    : 0
)
const txRecuperacao = computed(() =>
  todasPropostas.value.length > 0
    ? Math.round((propostasAprovadas.value.length / todasPropostas.value.length) * 100)
    : 0
)
const metaPct = computed(() => Math.round((rules.metaRecuperacaoPct ?? 0.80) * 100))

// Total de acordos para card-resumo
const totalAcordos = computed(() =>
  flowState.negotiations.filter(n => n.status === 'em_pagamento' || n.status === 'quitado').length
)
const totalAcordosAtivos = computed(() =>
  flowState.negotiations.filter(n => n.status === 'em_pagamento').length
)
</script>

<template>
  <BackofficeLayout title="Gestão de Crédito">

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
        <p class="text-xs text-gray-400 uppercase font-medium mb-1">Recuperado (acumulado)</p>
        <p class="text-xl font-bold text-green-600">{{ formatMoney(totalRecuperado) }}</p>
      </div>
      <div class="bg-white rounded-xl border border-gray-200 p-5">
        <p class="text-xs text-gray-400 uppercase font-medium mb-1">Taxa autosserviço</p>
        <p class="text-3xl font-bold text-blue-600">{{ taxaAutoAprovacao }}%</p>
      </div>
    </div>

    <!-- Propostas para análise gerencial -->
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

    <!-- Acordos — card resumo com link para página dedicada -->
    <div v-if="totalAcordos > 0" class="bg-white rounded-2xl border border-gray-200 p-5 mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <div>
          <p class="font-semibold text-gray-900">{{ totalAcordos }} acordo{{ totalAcordos > 1 ? 's' : '' }}</p>
          <p class="text-xs text-gray-500">{{ totalAcordosAtivos }} em pagamento</p>
        </div>
      </div>
      <RouterLink to="/backoffice/gerente/acordos" class="text-sm font-semibold text-blue-600 hover:text-blue-800">Ver todos →</RouterLink>
    </div>

    <!-- Performance da mesa -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 class="font-semibold text-gray-900 mb-4">Performance da operação (mês atual)</h2>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900">{{ todasPropostas.length }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Propostas recebidas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ propostasAprovadas.length }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Aprovadas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-red-500">{{ propostasReprovadas.length }}</div>
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
          <span :class="txRecuperacao >= metaPct ? 'text-green-600 font-semibold' : ''">
            {{ txRecuperacao }}% / {{ metaPct }}%
          </span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-500"
            :class="txRecuperacao >= metaPct ? 'bg-green-500' : txRecuperacao >= metaPct * 0.7 ? 'bg-blue-500' : 'bg-amber-400'"
            :style="{ width: Math.min(txRecuperacao, 100) + '%' }"
          />
        </div>
        <p v-if="txRecuperacao >= metaPct" class="text-xs text-green-600 font-medium mt-1">Meta atingida ✓</p>
        <p v-else class="text-xs text-gray-400 mt-1">Faltam {{ metaPct - txRecuperacao }} propostas para a meta.</p>
      </div>
    </div>

  </BackofficeLayout>
</template>
