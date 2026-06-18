<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney } = useFormatters()
const { state: flowState, clientApproveProposal, clientRejectProposal } = useFlow()

const negId = computed(() => route.params.id)

const negotiation = computed(() =>
  flowState.negotiations.find(n => n.id === negId.value)
)

const contract = computed(() =>
  flowState.contracts.find(c => c.id === negotiation.value?.contratoId)
)

const decision = ref(null) // 'approved' | 'rejected'

function approve() {
  clientApproveProposal(negId.value)
  decision.value = 'approved'
}

function reject() {
  clientRejectProposal(negId.value)
  decision.value = 'rejected'
}
</script>

<template>
  <ClientLayout
    title="Oferta do Atendente"
    back-to="/negociacoes"
    back-label="Minhas Negociações"
  >
    <div class="max-w-lg mx-auto">

      <!-- Proposta não encontrada -->
      <div v-if="!negotiation" class="card text-center py-12 text-gray-400">
        Proposta não encontrada.
      </div>

      <!-- Resultado final -->
      <template v-else-if="decision">
        <div class="card text-center py-10 mb-6">
          <template v-if="decision === 'approved'">
            <svg class="w-14 h-14 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <h2 class="text-xl font-bold text-green-700 mb-2">Acordo ativado!</h2>
            <p class="text-gray-500 text-sm">Seu acordo está ativo. Pague a entrada para começar.</p>
          </template>
          <template v-else>
            <svg class="w-14 h-14 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <h2 class="text-xl font-bold text-gray-700 mb-2">Proposta recusada</h2>
            <p class="text-gray-500 text-sm">Você pode fazer sua própria simulação quando quiser.</p>
          </template>
        </div>

        <div class="space-y-3">
          <RouterLink to="/negociacoes" class="btn-primary w-full block text-center">
            Ver minhas negociações
          </RouterLink>
          <RouterLink to="/dashboard" class="btn-secondary w-full block text-center">
            Voltar ao início
          </RouterLink>
        </div>
      </template>

      <!-- Proposta para decidir -->
      <template v-else-if="negotiation.status === 'pending_client_approval'">
        <!-- Cabeçalho informativo -->
        <div class="card mb-5 bg-teal-50 border border-teal-100">
          <div class="flex items-start gap-3">
            <svg class="w-6 h-6 text-teal-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <div>
              <p class="font-semibold text-teal-900">Proposta preparada pelo nosso atendente</p>
              <p class="text-xs text-teal-600 mt-0.5">
                Nosso atendente preparou uma proposta especial para você.
                Analise com cuidado e decida se deseja aceitar.
              </p>
            </div>
          </div>
        </div>

        <!-- Detalhes da proposta -->
        <div class="card mb-5">
          <h3 class="font-semibold text-gray-900 mb-4">Detalhes do acordo proposto</h3>

          <div class="space-y-2 text-sm mb-4">
            <div class="flex justify-between">
              <span class="text-gray-500">Contrato</span>
              <span class="font-medium">#{{ negotiation.contratoId }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Protocolo</span>
              <span class="font-mono text-xs text-gray-700">{{ negotiation.id }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Entrada (Pix)</span>
              <span class="font-bold text-blue-700">{{ formatMoney(negotiation.entrada) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Parcelas</span>
              <span class="font-medium">{{ negotiation.numParcelas }}x de {{ formatMoney(negotiation.valorParcela) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Desconto aplicado</span>
              <span class="font-bold text-green-600">{{ formatMoney(negotiation.desconto) }}</span>
            </div>
            <div class="border-t pt-2 flex justify-between">
              <span class="font-semibold">Total do acordo</span>
              <span class="font-bold">{{ formatMoney(negotiation.totalAcordo) }}</span>
            </div>
          </div>

          <!-- Prazo -->
          <div class="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Proposta válida até: {{ new Date(negotiation.prazoResposta).toLocaleString('pt-BR') }}
          </div>
        </div>

        <!-- Ações -->
        <div class="space-y-3">
          <button @click="approve" class="btn-success w-full text-base py-3">
            Aceitar proposta e ativar acordo
          </button>
          <button @click="reject" class="btn-danger w-full">
            Recusar esta proposta
          </button>
        </div>
      </template>

      <!-- Status diferente de pending -->
      <template v-else>
        <div class="card text-center py-10">
          <p class="text-gray-500 text-sm">Esta proposta já foi processada.</p>
          <p class="font-mono text-xs text-gray-400 mt-1">Status: {{ negotiation.status }}</p>
          <RouterLink to="/negociacoes" class="btn-secondary mt-4 inline-block">
            Ver negociações
          </RouterLink>
        </div>
      </template>

    </div>
  </ClientLayout>
</template>
