<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useProposal } from '@/stores/proposal.js'

const router = useRouter()
const { formatMoney } = useFormatters()
const { state, clear } = useProposal()

// Redireciona se não há proposta (navegação direta)
onMounted(() => {
  if (!state.proposal) router.replace('/contratos')
})

const scenario = computed(() => state.result?.scenario ?? 'auto')
const proposal = computed(() => state.proposal)
const contract = computed(() => state.contractSnapshot)

// Protocolo mockado
const protocolo = computed(() =>
  `NEG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
)

// Prazo para pagar a entrada
const prazoEntrada = computed(() => {
  const d = new Date()
  d.setHours(d.getHours() + 48)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
})

function goNovaProposta() {
  clear()
  router.push(`/contratos/${proposal.value?.contratoId}/negociar`)
}
</script>

<template>
  <ClientLayout
    title="Resultado da Proposta"
    back-to="/contratos"
    back-label="Contratos"
  >
    <div v-if="!proposal" class="card text-center py-12 text-gray-400">Carregando...</div>

    <template v-else>
      <div class="max-w-lg mx-auto">

        <!-- ===== CENÁRIO 1: APROVAÇÃO AUTOMÁTICA ===== -->
        <template v-if="scenario === 'auto'">
          <div class="card text-center py-8 mb-6">
            <div class="flex justify-center mb-4">
              <svg class="w-14 h-14 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h2 class="text-2xl font-bold text-green-700 mb-2">Acordo Aprovado!</h2>
            <p class="text-gray-600">Sua proposta foi aprovada na hora.</p>
          </div>

          <div class="card mb-4">
            <h3 class="font-semibold text-gray-900 mb-3">Resumo do acordo</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Contrato</span>
                <span class="font-medium">#{{ proposal.contratoId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Entrada (Pix)</span>
                <span class="font-bold text-blue-700">{{ formatMoney(proposal.entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Parcelas</span>
                <span class="font-medium">{{ proposal.numParcelas }}x de {{ formatMoney(proposal.valorParcela) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Primeiro boleto</span>
                <span class="font-medium">{{ proposal.primeiroBoleto }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Desconto obtido</span>
                <span class="font-bold text-green-600">{{ formatMoney(proposal.desconto) }}</span>
              </div>
              <div class="border-t pt-2 flex justify-between">
                <span class="font-semibold">Total do acordo</span>
                <span class="font-bold">{{ formatMoney(proposal.totalAcordo) }}</span>
              </div>
            </div>
          </div>

          <div class="alert-warning text-sm mb-6 flex items-start gap-2">
            <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            <span>Pague a entrada até <strong>{{ prazoEntrada }}</strong> para validar o acordo. Após esse prazo, o acordo será cancelado automaticamente.</span>
          </div>

          <div class="space-y-3">
            <RouterLink :to="`/contratos/${proposal.contratoId}/pagar`" class="btn-success w-full block text-center">
              Pagar Entrada via Pix
            </RouterLink>
            <RouterLink to="/negociacoes" class="btn-secondary w-full block text-center">
              Ver Minhas Negociações
            </RouterLink>
          </div>
        </template>

        <!-- ===== CENÁRIO 2: EM ANÁLISE ===== -->
        <template v-else-if="scenario === 'mesa1' || scenario === 'mesa2'">
          <div class="card text-center py-8 mb-6">
            <div class="flex justify-center mb-4">
              <svg class="w-14 h-14 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h2 class="text-2xl font-bold text-amber-700 mb-2">Proposta em Análise</h2>
            <p class="text-gray-600">Sua proposta foi enviada para nossa equipe de crédito.</p>
          </div>

          <div class="card mb-4">
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Protocolo</span>
                <span class="font-mono font-semibold text-gray-900">{{ protocolo }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Enviada em</span>
                <span class="font-medium">{{ new Date().toLocaleString('pt-BR') }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Prazo de resposta</span>
                <span class="font-semibold text-amber-700">
                  {{ scenario === 'mesa2' ? 'Até 24h úteis (2º Nível)' : 'Até 4h úteis' }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Entrada proposta</span>
                <span class="font-medium">{{ formatMoney(proposal.entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Parcelas</span>
                <span class="font-medium">{{ proposal.numParcelas }}x de {{ formatMoney(proposal.valorParcela) }}</span>
              </div>
            </div>
          </div>

          <div class="alert-info text-sm mb-6">
            Você será notificado por <strong>WhatsApp, E-mail e Push</strong> assim que houver uma resposta.
          </div>

          <div class="space-y-3">
            <RouterLink to="/negociacoes" class="btn-primary w-full block text-center">
              Ver Minhas Negociações
            </RouterLink>
            <RouterLink to="/dashboard" class="btn-secondary w-full block text-center">
              Voltar ao Início
            </RouterLink>
          </div>
        </template>

        <!-- ===== CENÁRIO 3: REPROVADA / CONTRAPROPOSTA ===== -->
        <template v-else-if="scenario === 'reprovada' || scenario === 'contraproposta'">
          <div class="card text-center py-8 mb-6">
            <div class="flex justify-center mb-4">
              <svg v-if="scenario === 'contraproposta'" class="w-14 h-14 text-purple-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
              <svg v-else class="w-14 h-14 text-red-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h2 class="text-2xl font-bold text-red-700 mb-2">
              {{ scenario === 'contraproposta' ? 'Temos uma Contraproposta!' : 'Proposta Não Aprovada' }}
            </h2>
            <p class="text-gray-600">
              {{ scenario === 'contraproposta'
                ? 'Não foi possível aprovar nas condições solicitadas, mas temos uma oferta especial:'
                : 'Não foi possível aprovar nas condições solicitadas.' }}
            </p>
          </div>

          <div v-if="scenario === 'contraproposta'" class="card mb-4 border-purple-200 bg-purple-50">
            <h3 class="font-semibold text-purple-800 mb-3">Condição especial</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-purple-700">Nova entrada</span>
                <span class="font-bold text-purple-900">{{ formatMoney((proposal.entrada ?? 0) * 1.4) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-purple-700">Parcelas</span>
                <span class="font-medium text-purple-900">{{ Math.ceil((proposal.numParcelas ?? 6) * 0.7) }}x de {{ formatMoney((proposal.valorParcela ?? 0) * 1.2) }}</span>
              </div>
            </div>
            <button class="btn-primary w-full mt-4 text-sm">Aceitar Contraproposta</button>
          </div>

          <div class="space-y-3">
            <button @click="goNovaProposta" class="btn-primary w-full">Fazer Nova Simulação</button>
            <RouterLink to="/dashboard" class="btn-secondary w-full block text-center">Voltar ao Início</RouterLink>
          </div>
        </template>

        <!-- ===== CENÁRIO 4: BLOQUEADA ===== -->
        <template v-else-if="scenario?.startsWith('blocked')">
          <div class="card text-center py-8 mb-6">
            <div class="flex justify-center mb-4">
              <svg class="w-14 h-14 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
            </div>
            <h2 class="text-2xl font-bold text-gray-700 mb-2">Proposta Inviável</h2>
            <p class="text-gray-500">O valor proposto não atende aos critérios mínimos.</p>
          </div>
          <div class="alert-warning mb-6 text-sm flex items-start gap-2">
            <svg class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"/></svg>
            <span>Dica: Aumente o valor da entrada ou reduza o número de parcelas para melhorar suas chances de aprovação.</span>
          </div>
          <button @click="goNovaProposta" class="btn-primary w-full">Ajustar Proposta</button>
        </template>

      </div>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
