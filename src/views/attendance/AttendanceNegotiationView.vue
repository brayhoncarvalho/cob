<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AttendanceLayout from '@/layouts/AttendanceLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useAuth } from '@/stores/auth.js'
import { useRules } from '@/stores/rules.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney } = useFormatters()
const { state: flowState, submitAttendantProposal } = useFlow()
const { state: authState } = useAuth()
const { rules } = useRules()

const clienteId = computed(() => route.params.clienteId)

// Contratos do cliente (todos, no demo)
const contratos = computed(() => flowState.contracts)
const contratoSelecionado = ref(contratos.value[0]?.id ?? '')

const contract = computed(() => flowState.contracts.find(c => c.id === contratoSelecionado.value))

// Desconto pelo atraso
const descontoPct = computed(() => {
  const d = contract.value?.diasAtraso ?? 0
  const f = rules.descontoMaxPorFaixa
  if (d <= 30)  return f['0-30']
  if (d <= 60)  return f['31-60']
  if (d <= 90)  return f['61-90']
  if (d <= 120) return f['91-120']
  return f['120+']
})

const totalDue     = computed(() => contract.value?.saldoDevedor ?? 0)
const totalAcordo  = computed(() => totalDue.value * (1 - descontoPct.value))
const descontoReais = computed(() => totalDue.value - totalAcordo.value)
const minEntrada   = computed(() => totalDue.value * rules.entradaMinimaPct)

// Inputs
const entrada       = ref(0)
const numParcelas   = ref(6)
const diaVencimento = ref(5)

// Cálculos
const valorParcela = computed(() => {
  const restante = Math.max(0, totalAcordo.value - entrada.value)
  return numParcelas.value > 0 ? restante / numParcelas.value : 0
})
const entradaPct = computed(() => totalDue.value > 0 ? entrada.value / totalDue.value : 0)

// Feedback
const bloqueio = computed(() => {
  if (entrada.value <= 0) return 'Informe o valor de entrada.'
  if (valorParcela.value < rules.parcelaMinimaValor)
    return `Parcela calculada (${formatMoney(valorParcela.value)}) abaixo do mínimo de ${formatMoney(rules.parcelaMinimaValor)}.`
  if (contract.value?.acordoAtivo) return 'Cliente já possui acordo ativo neste contrato.'
  return null
})

const submitted = ref(false)
const submittedId = ref('')

function simular() {
  if (bloqueio.value) return

  const id = `NEG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  submitAttendantProposal({
    id,
    contratoId:   contratoSelecionado.value,
    clienteCpf:   clienteId.value,
    entrada:      entrada.value,
    numParcelas:  numParcelas.value,
    valorParcela: valorParcela.value,
    totalAcordo:  totalAcordo.value,
    desconto:     descontoReais.value,
    atendenteCpf: authState.user?.cpf,
  })
  submittedId.value = id
  submitted.value = true
}
</script>

<template>
  <AttendanceLayout
    title="Simulação em nome do cliente"
    back-to="/atendimento"
    back-label="Painel de Atendimento"
  >
    <!-- Sucesso -->
    <template v-if="submitted">
      <div class="max-w-lg mx-auto">
        <div class="card text-center py-10 mb-6">
          <svg class="w-14 h-14 text-teal-500 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <h2 class="text-xl font-bold text-teal-700 mb-2">Proposta enviada ao cliente!</h2>
          <p class="text-gray-500 text-sm">O cliente receberá uma notificação para aprovar ou rejeitar a proposta.</p>
          <p class="text-xs font-mono font-semibold text-gray-700 mt-3">Protocolo: {{ submittedId }}</p>
        </div>

        <div class="space-y-3">
          <button @click="submitted = false; entrada = 0" class="btn-secondary w-full">Nova simulação</button>
          <RouterLink to="/atendimento" class="btn-primary w-full block text-center">Voltar ao painel</RouterLink>
        </div>
      </div>
    </template>

    <!-- Formulário -->
    <template v-else>
      <div class="max-w-2xl mx-auto">

        <!-- Info do cliente -->
        <div class="card mb-6 bg-teal-50 border border-teal-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm">JD</div>
            <div>
              <p class="font-semibold text-teal-900">João da Silva</p>
              <p class="text-xs text-teal-600 font-mono">{{ clienteId }}</p>
            </div>
          </div>
        </div>

        <!-- Seleção de contrato -->
        <div class="card mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Contrato a negociar</label>
          <select v-model="contratoSelecionado" class="input-field">
            <option v-for="c in contratos" :key="c.id" :value="c.id">
              #{{ c.id }} — {{ c.status === 'em_atraso' ? '⚠ Em atraso' : c.status }} — {{ formatMoney(c.saldoDevedor) }}
            </option>
          </select>

          <!-- Situação resumida -->
          <div v-if="contract" class="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p class="text-xs text-gray-400">Saldo devedor</p>
              <p class="font-semibold text-red-700">{{ formatMoney(totalDue) }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Dias em atraso</p>
              <p class="font-semibold" :class="contract.diasAtraso > 0 ? 'text-red-700' : 'text-green-700'">{{ contract.diasAtraso ?? 0 }} dias</p>
            </div>
            <div>
              <p class="text-xs text-gray-400">Desconto disponível</p>
              <p class="font-semibold text-green-700">{{ (descontoPct * 100).toFixed(0) }}% · {{ formatMoney(descontoReais) }}</p>
            </div>
          </div>
        </div>

        <!-- Monte a proposta -->
        <div v-if="contract && !contract.acordoAtivo" class="card mb-6">
          <h3 class="font-semibold text-gray-900 mb-5">Monte a proposta</h3>

          <!-- Entrada -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              Valor de entrada <span class="text-red-500">*</span>
              <span class="font-normal text-gray-400 ml-1">(via Pix)</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">R$</span>
              <input
                v-model.number="entrada"
                type="number"
                :min="1"
                :max="totalAcordo"
                step="50"
                class="input-field pl-10"
                placeholder="0,00"
              />
            </div>
            <p class="text-xs mt-1" :class="entradaPct < rules.entradaMinimaPct ? 'text-amber-600' : 'text-gray-400'">
              Mínimo: {{ formatMoney(minEntrada) }} ({{ (rules.entradaMinimaPct * 100).toFixed(0) }}%)
              · Atual: {{ (entradaPct * 100).toFixed(0) }}%
            </p>
          </div>

          <!-- Parcelas -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">
              Número de parcelas
            </label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="numParcelas"
                type="range"
                min="1"
                max="24"
                class="flex-1 accent-teal-600"
              />
              <span class="font-bold text-teal-700 text-lg w-10 text-right">{{ numParcelas }}x</span>
            </div>
          </div>

          <!-- Dia do vencimento -->
          <div class="mb-5">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Dia de vencimento</label>
            <select v-model.number="diaVencimento" class="input-field">
              <option v-for="d in [1,5,10,15,20,25]" :key="d" :value="d">Dia {{ d }}</option>
            </select>
          </div>

          <!-- Preview -->
          <div class="rounded-xl bg-teal-50 border border-teal-100 p-4 mb-5">
            <h4 class="text-sm font-semibold text-teal-800 mb-3">Resumo da proposta</h4>
            <div class="space-y-1.5 text-sm">
              <div class="flex justify-between">
                <span class="text-teal-700">Entrada (Pix)</span>
                <span class="font-bold text-teal-900">{{ formatMoney(entrada) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-teal-700">{{ numParcelas }}x de</span>
                <span class="font-bold text-teal-900">{{ formatMoney(valorParcela) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-teal-700">Desconto aplicado</span>
                <span class="font-semibold text-green-700">{{ formatMoney(descontoReais) }}</span>
              </div>
              <div class="border-t border-teal-200 pt-2 flex justify-between">
                <span class="font-bold text-teal-900">Total do acordo</span>
                <span class="font-bold text-teal-900">{{ formatMoney(totalAcordo) }}</span>
              </div>
            </div>
          </div>

          <!-- Bloqueio -->
          <div v-if="bloqueio" class="alert-danger text-sm mb-4">{{ bloqueio }}</div>

          <button
            @click="simular"
            :disabled="!!bloqueio"
            class="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar proposta ao cliente para aprovação
          </button>
          <p class="text-xs text-gray-400 text-center mt-2">O cliente precisará confirmar antes do acordo ser ativado.</p>
        </div>

        <!-- Acordo já ativo -->
        <div v-else-if="contract?.acordoAtivo" class="card text-center py-8">
          <p class="text-gray-500">Este contrato já possui um acordo ativo.</p>
        </div>

      </div>
    </template>
  </AttendanceLayout>
</template>
