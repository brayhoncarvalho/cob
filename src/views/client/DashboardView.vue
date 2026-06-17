<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useAuth } from '@/stores/auth.js'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const { state } = useAuth()
const { formatMoney, formatDate } = useFormatters()
const router = useRouter()
const { state: flowState } = useFlow()

const contracts    = flowState.contracts
const negotiations = flowState.negotiations

const totalVencidas     = computed(() => contracts.reduce((s, c) => s + c.parcelasVencidas, 0))
const totalEmAberto     = computed(() => contracts.filter(c => c.status === 'em_atraso').reduce((s, c) => s + c.saldoDevedor, 0))
const contratosAtivos   = computed(() => contracts.filter(c => c.status !== 'cancelado').length)
const saldoTotal        = computed(() => contracts.reduce((s, c) => s + c.saldoDevedor, 0))
const acordosAtivos     = computed(() => negotiations.filter(n => n.status === 'em_pagamento').length)
const negsPendentes     = computed(() => negotiations.filter(n => n.status === 'em_analise').length)
const proximoVencimento = computed(() => {
  const all = contracts.flatMap(c =>
    c.parcelas.filter(p => p.status === 'proxima' || (p.status === 'futura' && !c.parcelasVencidas))
  ).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  return all[0] ?? null
})

const notificacoes = computed(() => {
  const items = []
  if (totalVencidas.value > 0)
    items.push({ type: 'danger', text: `${totalVencidas.value} parcela(s) vencida(s) no total de ${formatMoney(totalEmAberto.value)}`, action: '/contratos' })
  negotiations.filter(n => n.status === 'em_analise').forEach(n =>
    items.push({ type: 'warning', text: `Proposta ${n.id} em análise. Prazo até ${formatDate(n.prazoResposta)}`, action: `/negociacoes/${n.id}` })
  )
  negotiations.filter(n => n.status === 'em_pagamento' && !n.entradaPaga).forEach(n =>
    items.push({ type: 'success', text: `Acordo ${n.id} aprovado! Pague a entrada para ativar.`, action: `/negociacoes/${n.id}` })
  )
  return items.slice(0, 5)
})
</script>

<template>
  <ClientLayout title="">
    <!-- Banner de atraso -->
    <div v-if="totalVencidas > 0" class="alert-danger mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p class="font-semibold flex items-center gap-1.5">
          <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          Atenção: você tem {{ totalVencidas }} parcela(s) vencida(s)
        </p>
        <p class="text-sm mt-0.5">Total em atraso: <strong>{{ formatMoney(totalEmAberto) }}</strong> — juros continuam acumulando.</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <RouterLink to="/contratos" class="btn-danger text-sm py-2 px-4">Pagar Agora</RouterLink>
      </div>
    </div>

    <!-- Saudação -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Olá, {{ state.user?.nome?.split(' ')[0] }}</h1>
      <p class="text-gray-500 text-sm mt-1">Aqui está um resumo da sua situação financeira.</p>
    </div>

    <!-- Cards de métricas -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

      <!-- Parcelas em atraso -->
      <div :class="['card', totalVencidas > 0 ? 'border-red-200 bg-red-50' : '']">
        <p class="section-title text-xs" :class="totalVencidas > 0 ? 'text-red-500' : ''">Em atraso</p>
        <p class="text-2xl font-bold mt-1" :class="totalVencidas > 0 ? 'text-red-700' : 'text-gray-400'">
          {{ totalVencidas }}
        </p>
        <p class="text-xs mt-1" :class="totalVencidas > 0 ? 'text-red-600' : 'text-gray-400'">
          {{ totalVencidas > 0 ? formatMoney(totalEmAberto) : 'Tudo em dia!' }}
        </p>
      </div>

      <!-- Contratos -->
      <div class="card">
        <p class="section-title text-xs">Contratos</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ contratosAtivos }}</p>
        <p class="text-xs text-gray-500 mt-1">Saldo: {{ formatMoney(saldoTotal) }}</p>
      </div>

      <!-- Próximo vencimento -->
      <div class="card">
        <p class="section-title text-xs">Próximo vencimento</p>
        <template v-if="proximoVencimento">
          <p class="text-lg font-bold text-gray-900 mt-1">{{ formatDate(proximoVencimento.vencimento) }}</p>
          <p class="text-xs text-gray-500 mt-1">{{ formatMoney(proximoVencimento.valor) }}</p>
        </template>
        <p v-else class="text-sm text-gray-400 mt-1">—</p>
      </div>

      <!-- Acordos -->
      <div class="card">
        <p class="section-title text-xs">Acordos</p>
        <p class="text-2xl font-bold text-gray-900 mt-1">{{ acordosAtivos }}</p>
        <p class="text-xs mt-1" :class="negsPendentes > 0 ? 'text-amber-600' : 'text-gray-400'">
          {{ negsPendentes > 0 ? `${negsPendentes} em análise` : 'Nenhum pendente' }}
        </p>
      </div>
    </div>

    <!-- CTAs principais -->
    <div class="flex flex-wrap gap-3 mb-8">
      <RouterLink to="/contratos" class="btn-primary">Ver Contratos</RouterLink>
      <RouterLink
        v-if="totalVencidas > 0"
        to="/contratos"
        class="btn-danger"
      >
        Pagar Agora
      </RouterLink>
      <RouterLink
        v-if="totalVencidas > 0"
        :to="`/contratos/${contracts.find(c => c.status === 'em_atraso')?.id}/negociar`"
        class="btn-secondary"
      >
        Negociar Débito
      </RouterLink>
      <RouterLink to="/negociacoes" class="btn-secondary">Minhas Negociações</RouterLink>
    </div>

    <!-- Contratos resumo -->
    <div class="card mb-6">
      <h2 class="font-semibold text-gray-900 mb-4">Seus contratos</h2>
      <div class="space-y-3">
        <div
          v-for="c in contracts"
          :key="c.id"
          class="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer"
          @click="router.push(`/contratos/${c.id}`)"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-900 text-sm">#{{ c.id }}</span>
              <span class="text-xs text-gray-500">{{ c.tipo }}</span>
              <StatusBadge :status="c.status" small />
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              {{ c.parcelasPagas }}/{{ c.totalParcelas }} pagas ·
              Saldo: {{ formatMoney(c.saldoDevedor) }}
            </p>
          </div>
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Notificações -->
    <div v-if="notificacoes.length > 0" class="card">
      <h2 class="font-semibold text-gray-900 mb-4">Notificações</h2>
      <div class="space-y-3">
        <RouterLink
          v-for="(n, i) in notificacoes"
          :key="i"
          :to="n.action"
          class="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <!-- Ícone por tipo -->
          <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="{
            'bg-red-100': n.type === 'danger',
            'bg-amber-100': n.type === 'warning',
            'bg-green-100': n.type === 'success',
          }">
            <!-- danger -->
            <svg v-if="n.type === 'danger'" class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            <!-- warning -->
            <svg v-else-if="n.type === 'warning'" class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <!-- success -->
            <svg v-else class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </span>
          <p class="text-sm text-gray-700 flex-1">{{ n.text }}</p>
          <svg class="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </RouterLink>
      </div>
    </div>
    <div v-else class="card text-center text-gray-400 py-6">
      <svg class="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <p class="font-medium text-gray-600">Tudo certo! Suas parcelas estão em dia.</p>
    </div>

    <!-- Espaço para nav mobile -->
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
