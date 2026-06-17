<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate } = useFormatters()
const { state: flowState } = useFlow()

const contract = computed(() => flowState.contracts.find(c => c.id === route.params.id))

// Parcelas a pagar: se query tem ?parcelas=9,10 usa essas; senão pega todas vencidas
const parcelasSelecionadas = computed(() => {
  if (!contract.value) return []
  const q = route.query.parcelas
  if (q) {
    const nums = String(q).split(',').map(Number)
    return contract.value.parcelas.filter(p => nums.includes(p.numero))
  }
  // Sem query: pega parcelas vencidas + próxima
  return contract.value.parcelas.filter(p => p.status === 'vencida' || p.status === 'proxima')
})

const valorOriginal = computed(() => parcelasSelecionadas.value.reduce((s, p) => s + p.valor, 0))
const jurosTotal    = computed(() => parcelasSelecionadas.value.reduce((s, p) => s + (p.juros ?? 0) + (p.multa ?? 0), 0))
const valorTotal    = computed(() => parcelasSelecionadas.value.reduce((s, p) => s + p.valorAtualizado, 0))

// Estado do pagamento: waiting | confirmed | expired
const paymentState = ref('waiting')
const timeLeft     = ref(86400) // 24h em segundos

let timer = null

onMounted(() => {
  timer = setInterval(() => {
    if (timeLeft.value > 0 && paymentState.value === 'waiting') {
      timeLeft.value--
    } else if (timeLeft.value === 0) {
      paymentState.value = 'expired'
    }
  }, 1000)
})

onUnmounted(() => clearInterval(timer))

const timeDisplay = computed(() => {
  const h = Math.floor(timeLeft.value / 3600)
  const m = Math.floor((timeLeft.value % 3600) / 60)
  const s = timeLeft.value % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
})

// Pix mockado
const pixCode = computed(() =>
  `00020126580014br.gov.bcb.pix0136c15b4fc3-f53e-4810-8f6e-eb5ab459${Math.random().toString(36).slice(2,10).toUpperCase()}52040000530398654${String(valorTotal.value.toFixed(2)).replace('.','').padStart(10,'0')}5802BR5920Portal Cobrança LTDA6009SAO PAULO62070503***6304ABCD`
)

const copied = ref(false)
function copyPix() {
  navigator.clipboard.writeText(pixCode.value).catch(() => {})
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

function simulatePayment() {
  paymentState.value = 'confirmed'
}

function generateNew() {
  timeLeft.value = 86400
  paymentState.value = 'waiting'
}
</script>

<template>
  <ClientLayout
    :title="`Pagamento — Contrato #${route.params.id}`"
    :back-to="`/contratos/${route.params.id}`"
    back-label="Contrato"
  >
    <div v-if="!contract" class="card text-center text-gray-500 py-12">Contrato não encontrado.</div>

    <template v-else>

      <!-- Pagamento confirmado -->
      <div v-if="paymentState === 'confirmed'" class="card text-center py-12">
        <div class="flex justify-center mb-4">
          <svg class="w-14 h-14 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 class="text-2xl font-bold text-green-700 mb-2">Pagamento Confirmado!</h2>
        <p class="text-gray-600 mb-1">{{ formatMoney(valorTotal) }} processado com sucesso.</p>
        <p class="text-sm text-gray-400 mb-6">A atualização do contrato pode levar até 5 minutos.</p>
        <RouterLink :to="`/contratos/${contract.id}`" class="btn-primary">
          Ver Contrato Atualizado
        </RouterLink>
      </div>

      <!-- Pix expirado -->
      <div v-else-if="paymentState === 'expired'" class="card text-center py-12">
        <div class="flex justify-center mb-4">
          <svg class="w-14 h-14 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 class="text-xl font-bold text-gray-700 mb-2">Pix expirado</h2>
        <p class="text-sm text-gray-400 mb-6">O QR Code expirou. Gere um novo para continuar.</p>
        <button @click="generateNew" class="btn-primary">Gerar Novo Pix</button>
      </div>

      <!-- Pagamento pendente -->
      <template v-else>
        <div class="grid lg:grid-cols-2 gap-6">

          <!-- Resumo -->
          <div class="card">
            <h3 class="font-semibold text-gray-900 mb-4">Resumo do pagamento</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Contrato</span>
                <span class="font-medium">#{{ contract.id }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Parcela(s)</span>
                <span class="font-medium">{{ parcelasSelecionadas.map(p => '#' + p.numero).join(', ') }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Valor original</span>
                <span class="font-medium">{{ formatMoney(valorOriginal) }}</span>
              </div>
              <div v-if="jurosTotal > 0" class="flex justify-between text-red-600">
                <span>Juros + multa</span>
                <span class="font-medium">+ {{ formatMoney(jurosTotal) }}</span>
              </div>
              <div class="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                <span class="font-semibold text-gray-900">Total a pagar</span>
                <span class="font-bold text-lg text-gray-900">{{ formatMoney(valorTotal) }}</span>
              </div>
            </div>
          </div>

          <!-- QR Code + Pix -->
          <div class="card text-center">
            <h3 class="font-semibold text-gray-900 mb-4">Pague via Pix</h3>

            <!-- QR Code mockado -->
            <div class="flex justify-center mb-4">
              <div class="w-44 h-44 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-gray-200">
                <div class="grid grid-cols-8 gap-0.5 p-2">
                  <div v-for="i in 64" :key="i"
                    :class="['w-2 h-2 rounded-sm', Math.random() > 0.5 ? 'bg-gray-900' : 'bg-white']"
                  />
                </div>
              </div>
            </div>

            <div class="text-xs text-gray-400 mb-3 flex items-center justify-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Expira em: <span class="font-mono font-semibold text-gray-700">{{ timeDisplay }}</span>
            </div>

            <!-- Copia e Cola -->
            <div class="bg-gray-50 rounded-xl p-3 mb-3 text-left">
              <p class="text-xs text-gray-500 mb-1">Pix Copia e Cola</p>
              <p class="font-mono text-xs text-gray-700 break-all line-clamp-2">{{ pixCode }}</p>
            </div>

            <button @click="copyPix" :class="['w-full mb-2', copied ? 'btn-success' : 'btn-primary']">
              {{ copied ? 'Copiado!' : 'Copiar Código Pix' }}
            </button>

            <button class="w-full btn-secondary text-sm py-2.5 flex items-center justify-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>
              Enviar por WhatsApp
            </button>
          </div>
        </div>

        <!-- Botão de simulação (demo) -->
        <div class="card mt-4 border-dashed border-2 border-blue-200 bg-blue-50 text-center">
          <p class="text-sm text-blue-700 font-medium mb-2">Modo Demonstração</p>
          <p class="text-xs text-blue-600 mb-3">Em produção, a confirmação é automática via webhook do banco.</p>
          <button @click="simulatePayment" class="btn-primary text-sm py-2 px-6">
            Simular Pagamento Confirmado
          </button>
        </div>

        <!-- Informações pós-pagamento -->
        <div class="alert-info mt-4 text-sm">
          <p class="font-semibold mb-1">Após o pagamento</p>
          <p class="text-xs">A confirmação é processada em até 5 minutos. Você receberá uma notificação quando o pagamento for confirmado e o contrato atualizado.</p>
        </div>
      </template>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
