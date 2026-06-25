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

// Tempo médio de aprovação (dataEnvio → dataDecisaoGerencia ou dataAprovacao)
const tempoMedioAprovacaoH = computed(() => {
  const decididas = flowState.negotiations.filter(n =>
    n.dataEnvio && (n.dataDecisaoGerencia || n.dataAprovacao) &&
    ['em_pagamento', 'quitado', 'reprovada'].includes(n.status)
  )
  if (!decididas.length) return null
  const totalMs = decididas.reduce((s, n) => {
    const fim = new Date(n.dataDecisaoGerencia ?? n.dataAprovacao)
    const ini = new Date(n.dataEnvio)
    return s + Math.max(0, fim - ini)
  }, 0)
  const mediaH = totalMs / decididas.length / 3600000
  return mediaH < 1 ? '< 1h' : `${Math.round(mediaH)}h`
})

// Cumprimento de SLA (Mesa ≤ 4h, Gerência ≤ 24h)
const SLA_MESA_H   = 4
const SLA_GER_H    = 24
const slaComputing = computed(() => {
  const comDecisaoMesa = flowState.negotiations.filter(n => n.dataEnvio && n.dataDecisaoMesa)
  const dentroMesa = comDecisaoMesa.filter(n => {
    const h = (new Date(n.dataDecisaoMesa) - new Date(n.dataEnvio)) / 3600000
    return h <= SLA_MESA_H
  }).length

  const comDecisaoGer = flowState.negotiations.filter(n => n.dataDecisaoMesa && n.dataDecisaoGerencia)
  const dentroGer = comDecisaoGer.filter(n => {
    const h = (new Date(n.dataDecisaoGerencia) - new Date(n.dataDecisaoMesa)) / 3600000
    return h <= SLA_GER_H
  }).length

  const total = comDecisaoMesa.length + comDecisaoGer.length
  const dentro = dentroMesa + dentroGer
  return total > 0 ? Math.round((dentro / total) * 100) : null
})

// Distribuição de propostas por status
const STATUS_LABELS = {
  em_analise:     { label: 'Em análise',    cor: 'bg-amber-400' },
  contraproposta: { label: 'Contraproposta', cor: 'bg-blue-400' },
  em_pagamento:   { label: 'Em pagamento',  cor: 'bg-green-500' },
  reprovada:      { label: 'Reprovadas',    cor: 'bg-red-400' },
  quitado:        { label: 'Quitados',      cor: 'bg-green-700' },
  cancelada:      { label: 'Canceladas',    cor: 'bg-gray-400' },
}
const distribuicao = computed(() => {
  const total = todasPropostas.value.length || 1
  return Object.entries(STATUS_LABELS).map(([status, meta]) => {
    const count = todasPropostas.value.filter(n => n.status === status).length
    return { status, ...meta, count, pct: Math.round((count / total) * 100) }
  }).filter(d => d.count > 0)
})
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

    <!-- Propostas aguardando decisão da Gerência -->
    <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
      <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 class="font-semibold text-gray-900">Aguardando decisão da Gerência</h2>
          <p class="text-xs text-gray-400 mt-0.5">Propostas analisadas pela Mesa e encaminhadas para aprovação final</p>
        </div>
        <span class="text-xs text-gray-400">SLA: 24h úteis</span>
      </div>

      <div v-if="escaladas.length === 0" class="text-center py-12 text-gray-400">
        <svg class="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p>Nenhuma proposta aguardando aprovação</p>
        <p class="text-xs mt-1">A Mesa ainda não encaminhou nenhum processo</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[700px]">
          <thead class="bg-gray-50">
            <tr class="text-xs text-gray-500">
              <th class="text-left px-6 py-3 font-medium">Protocolo</th>
              <th class="text-left px-4 py-3 font-medium">Contrato</th>
              <th class="text-right px-4 py-3 font-medium">Dívida total</th>
              <th class="text-left px-4 py-3 font-medium">Proposta</th>
              <th class="text-center px-4 py-3 font-medium">Decisão da Mesa</th>
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
              <td class="px-4 py-3 text-center">
                <span v-if="item.decisaoMesa === 'aprovada'"
                  class="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  Mesa aprovou
                </span>
                <span v-else-if="item.decisaoMesa === 'contraproposta'"
                  class="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
                  Contraproposta
                </span>
                <span v-else class="text-xs text-gray-400">—</span>
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

    <!-- KPIs de Operação -->
    <div class="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
      <h2 class="font-semibold text-gray-900 mb-5">KPIs da operação</h2>

      <!-- Linha 1: métricas numéricas -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="text-center bg-gray-50 rounded-xl p-4">
          <div class="text-2xl font-bold text-gray-900">{{ todasPropostas.length }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Propostas totais</div>
        </div>
        <div class="text-center bg-green-50 rounded-xl p-4">
          <div class="text-2xl font-bold text-green-600">{{ txRecuperacao }}%</div>
          <div class="text-xs text-gray-500 mt-0.5">Taxa de recuperação</div>
        </div>
        <div class="text-center bg-blue-50 rounded-xl p-4">
          <div class="text-2xl font-bold text-blue-600">{{ tempoMedioAprovacaoH ?? '—' }}</div>
          <div class="text-xs text-gray-500 mt-0.5">Tempo médio de decisão</div>
        </div>
        <div class="text-center rounded-xl p-4" :class="slaComputing === null ? 'bg-gray-50' : slaComputing >= 80 ? 'bg-green-50' : slaComputing >= 60 ? 'bg-amber-50' : 'bg-red-50'">
          <div class="text-2xl font-bold" :class="slaComputing === null ? 'text-gray-400' : slaComputing >= 80 ? 'text-green-600' : slaComputing >= 60 ? 'text-amber-600' : 'text-red-600'">
            {{ slaComputing !== null ? slaComputing + '%' : '—' }}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">SLA cumprido</div>
          <div class="text-xs text-gray-400">Mesa ≤4h / Ger ≤24h</div>
        </div>
      </div>

      <!-- Meta de recuperação -->
      <div class="mb-6">
        <div class="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>Meta mensal de recuperação</span>
          <span :class="txRecuperacao >= metaPct ? 'text-green-600 font-semibold' : ''">{{ txRecuperacao }}% / {{ metaPct }}%</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2">
          <div
            class="h-2 rounded-full transition-all duration-500"
            :class="txRecuperacao >= metaPct ? 'bg-green-500' : txRecuperacao >= metaPct * 0.7 ? 'bg-blue-500' : 'bg-amber-400'"
            :style="{ width: Math.min(txRecuperacao, 100) + '%' }"
          />
        </div>
        <p v-if="txRecuperacao >= metaPct" class="text-xs text-green-600 font-medium mt-1">Meta atingida</p>
        <p v-else class="text-xs text-gray-400 mt-1">Faltam {{ metaPct - txRecuperacao }}pp para a meta.</p>
      </div>

      <!-- Distribuição por status -->
      <div>
        <p class="text-xs text-gray-500 font-medium uppercase mb-3">Distribuição de propostas por status</p>
        <div class="space-y-2">
          <div v-for="d in distribuicao" :key="d.status" class="flex items-center gap-3">
            <span class="text-xs text-gray-600 w-32 shrink-0">{{ d.label }}</span>
            <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                class="h-2 rounded-full transition-all duration-500"
                :class="d.cor"
                :style="{ width: d.pct + '%' }"
              />
            </div>
            <span class="text-xs font-semibold text-gray-700 w-8 text-right">{{ d.count }}</span>
          </div>
          <div v-if="!distribuicao.length" class="text-xs text-gray-400 text-center py-2">Nenhuma proposta registrada</div>
        </div>
      </div>
    </div>

  </BackofficeLayout>
</template>
