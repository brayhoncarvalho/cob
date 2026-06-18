<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useProposal } from '@/stores/proposal.js'
import { useFlow } from '@/stores/flow.js'

const router = useRouter()
const { formatMoney } = useFormatters()
const { state, clear } = useProposal()
const { acceptCounter, state: flowState } = useFlow()

onMounted(() => {
  if (!state.proposal) router.replace('/contratos')
})

const scenario = computed(() => state.result?.scenario ?? 'auto')
const proposal = computed(() => state.proposal)

const protocolo = computed(() => proposal.value?.id ?? `NEG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`)

const prazoEntrada = computed(() => {
  const d = new Date()
  d.setHours(d.getHours() + 48)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
})

// ── Contraproposta real do flow store ────────────────────────────────────────
const contrapropostaReal = computed(() =>
  flowState.negotiations.find(n => n.id === proposal.value?.id)?.contraproposta ?? null
)

// ── Stepper ──────────────────────────────────────────────────────────────────
// Passos: Enviada → Em Análise → Decisão → Acordo Ativo
const stepperStep = computed(() => {
  switch (scenario.value) {
    case 'auto':         return 4 // Acordo Ativo
    case 'mesa1':        return 2 // Em Análise
    case 'contraproposta': return 3 // Decisão
    case 'reprovada':    return 3
    default:             return 1
  }
})

const stepperSteps = [
  { label: 'Enviada',      icon: 'send' },
  { label: 'Em Análise',   icon: 'clock' },
  { label: 'Decisão',      icon: 'gavel' },
  { label: 'Acordo Ativo', icon: 'check' },
]

function goNovaProposta() {
  clear()
  router.push(`/contratos/${proposal.value?.contratoId}/negociar`)
}

function handleAcceptCounter() {
  if (!proposal.value?.id) return
  acceptCounter(proposal.value.id)
  clear()
  router.push(`/negociacoes/${proposal.value.id}`)
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

        <!-- ── STEPPER ─────────────────────────────────────────────────────── -->
        <div class="card mb-5 py-4">
          <div class="flex items-center justify-between px-2">
            <template v-for="(step, idx) in stepperSteps" :key="step.label">
              <!-- passo -->
              <div class="flex flex-col items-center gap-1 flex-1">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                  :class="stepperStep > idx + 1
                    ? 'bg-green-500 text-white'
                    : stepperStep === idx + 1
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'bg-gray-100 text-gray-400'"
                >
                  <svg v-if="stepperStep > idx + 1" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  <span v-else>{{ idx + 1 }}</span>
                </div>
                <span class="text-xs text-center leading-tight" :class="stepperStep === idx + 1 ? 'text-blue-700 font-semibold' : 'text-gray-400'">{{ step.label }}</span>
              </div>
              <!-- linha conectora -->
              <div v-if="idx < stepperSteps.length - 1" class="h-0.5 flex-1 mx-1 -mt-5" :class="stepperStep > idx + 1 ? 'bg-green-400' : 'bg-gray-200'" />
            </template>
          </div>
        </div>

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
        <template v-else-if="scenario === 'mesa1'">
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
                <span class="font-semibold text-amber-700">Até 24h úteis</span>
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
            <h2 class="text-2xl font-bold mb-2" :class="scenario === 'contraproposta' ? 'text-purple-700' : 'text-red-700'">
              {{ scenario === 'contraproposta' ? 'Temos uma Contraproposta!' : 'Proposta Não Aprovada' }}
            </h2>
            <p class="text-gray-600">
              {{ scenario === 'contraproposta'
                ? 'Não foi possível aprovar nas condições solicitadas, mas temos uma oferta especial:'
                : 'Não foi possível aprovar nas condições solicitadas.' }}
            </p>
          </div>

          <!-- Contraproposta REAL do flow store -->
          <div v-if="scenario === 'contraproposta' && contrapropostaReal" class="card mb-4 border-purple-200 bg-purple-50">
            <h3 class="font-semibold text-purple-800 mb-3">Condição especial oferecida</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-purple-700">Nova entrada</span>
                <span class="font-bold text-purple-900">{{ formatMoney(contrapropostaReal.entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-purple-700">Parcelas</span>
                <span class="font-medium text-purple-900">{{ contrapropostaReal.numParcelas }}x de {{ formatMoney(contrapropostaReal.valorParcela) }}</span>
              </div>
              <div class="border-t border-purple-200 pt-2 flex justify-between">
                <span class="font-semibold text-purple-800">Total</span>
                <span class="font-bold text-purple-900">{{ formatMoney(contrapropostaReal.total) }}</span>
              </div>
            </div>
            <button @click="handleAcceptCounter" class="btn-primary w-full mt-4 text-sm bg-purple-600 hover:bg-purple-700">Aceitar Contraproposta</button>
          </div>

          <!-- Fallback se contraproposta ainda não chegou -->
          <div v-else-if="scenario === 'contraproposta' && !contrapropostaReal" class="card mb-4 border-purple-200 bg-purple-50 text-center py-4">
            <p class="text-purple-700 text-sm">Carregando detalhes da contraproposta…</p>
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
