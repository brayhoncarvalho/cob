<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AttendanceLayout from '@/layouts/AttendanceLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useAuth } from '@/stores/auth.js'
import contractsMock from '@/mocks/contracts.json'

const router = useRouter()
const { formatMoney } = useFormatters()
const { state: flowState } = useFlow()
const { state: authState } = useAuth()

// Lista de clientes mock para atendimento
const CLIENTES = [
  { cpf: '123.456.789-00', nome: 'João da Silva' },
]

// Enriquecer cada cliente com dados de contratos e negociações
const clientes = computed(() =>
  CLIENTES.map(c => {
    const contratos = flowState.contracts.filter(() => true) // todos do flow
    const negociacoesCliente = flowState.negotiations.filter(n =>
      n.clienteCpf === c.cpf || contratos.some(ct => ct.id === n.contratoId)
    )
    const pendingApproval = negociacoesCliente.filter(n => n.status === 'pending_client_approval')
    const emAtraso = flowState.contracts.filter(ct => ct.status === 'em_atraso')

    return {
      ...c,
      totalContratos: flowState.contracts.length,
      emAtraso: emAtraso.length,
      pendingApproval: pendingApproval.length,
      negociacoes: negociacoesCliente,
    }
  })
)

// Negociações aguardando aprovação do cliente (simuladas pelo atendente)
const propostasPendentes = computed(() =>
  flowState.negotiations.filter(n => n.status === 'pending_client_approval')
)

function iniciarAtendimento(clienteId) {
  router.push(`/atendimento/cliente/${clienteId}/negociar`)
}
</script>

<template>
  <AttendanceLayout title="Painel de Atendimento">
    <div class="grid lg:grid-cols-3 gap-6">

      <!-- Métricas rápidas -->
      <div class="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="card text-center py-4">
          <p class="text-2xl font-bold text-teal-700">{{ clientes.length }}</p>
          <p class="text-xs text-gray-500 mt-1">Clientes em atendimento</p>
        </div>
        <div class="card text-center py-4">
          <p class="text-2xl font-bold text-amber-600">{{ flowState.contracts.filter(c => c.status === 'em_atraso').length }}</p>
          <p class="text-xs text-gray-500 mt-1">Contratos em atraso</p>
        </div>
        <div class="card text-center py-4">
          <p class="text-2xl font-bold text-purple-600">{{ propostasPendentes.length }}</p>
          <p class="text-xs text-gray-500 mt-1">Propostas aguardando cliente</p>
        </div>
        <div class="card text-center py-4">
          <p class="text-2xl font-bold text-green-600">{{ flowState.negotiations.filter(n => n.status === 'em_pagamento').length }}</p>
          <p class="text-xs text-gray-500 mt-1">Acordos ativos</p>
        </div>
      </div>

      <!-- Lista de clientes -->
      <div class="lg:col-span-2">
        <h2 class="section-title mb-4">Clientes</h2>

        <div v-if="clientes.length === 0" class="card text-center py-12 text-gray-400">
          Nenhum cliente em atendimento.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="c in clientes"
            :key="c.cpf"
            class="card hover:shadow-md transition-shadow"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg shrink-0">
                {{ c.nome.split(' ').map(p => p[0]).slice(0, 2).join('') }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900">{{ c.nome }}</p>
                <p class="text-xs text-gray-400 font-mono">{{ c.cpf }}</p>
                <div class="flex flex-wrap gap-2 mt-1.5">
                  <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {{ c.totalContratos }} contrato{{ c.totalContratos !== 1 ? 's' : '' }}
                  </span>
                  <span v-if="c.emAtraso > 0" class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {{ c.emAtraso }} em atraso
                  </span>
                  <span v-if="c.pendingApproval > 0" class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                    {{ c.pendingApproval }} aguardando aprovação
                  </span>
                </div>
              </div>
              <button
                @click="iniciarAtendimento(c.cpf)"
                class="btn-primary text-sm shrink-0"
              >
                Atender
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Painel de propostas pendentes -->
      <div>
        <h2 class="section-title mb-4">Aguardando aprovação do cliente</h2>

        <div v-if="propostasPendentes.length === 0" class="card text-center py-8 text-gray-400 text-sm">
          <svg class="w-8 h-8 mx-auto text-gray-200 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Nenhuma proposta pendente.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="n in propostasPendentes"
            :key="n.id"
            class="card border border-purple-200 bg-purple-50"
          >
            <div class="flex items-start justify-between mb-2">
              <span class="font-mono text-sm font-semibold text-purple-900">{{ n.id }}</span>
              <StatusBadge :status="n.status" />
            </div>
            <div class="text-xs space-y-1 text-purple-800">
              <div class="flex justify-between">
                <span>Contrato</span>
                <span class="font-medium">#{{ n.contratoId }}</span>
              </div>
              <div class="flex justify-between">
                <span>Entrada</span>
                <span class="font-medium">{{ formatMoney(n.entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span>Parcelas</span>
                <span class="font-medium">{{ n.numParcelas }}x {{ formatMoney(n.valorParcela) }}</span>
              </div>
            </div>
            <p class="text-xs text-purple-500 mt-2">Prazo: {{ new Date(n.prazoResposta).toLocaleString('pt-BR') }}</p>
          </div>
        </div>
      </div>

    </div>
  </AttendanceLayout>
</template>
