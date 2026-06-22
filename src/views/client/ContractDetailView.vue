<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate } = useFormatters()
const { state: flowState } = useFlow()

const contract = computed(() => flowState.contracts.find(c => c.id === route.params.id))
const acordoAtivo = computed(() => {
  if (!contract.value?.acordoAtivo) return null
  return flowState.negotiations.find(n => n.id === contract.value.acordoAtivo)
})

// Valores derivados das parcelas (fonte da verdade)
const totalVencido = computed(() =>
  contract.value?.parcelas
    .filter(p => p.status === 'vencida')
    .reduce((s, p) => s + p.valorAtualizado, 0) ?? 0
)
const jurosMulta = computed(() =>
  contract.value?.parcelas
    .filter(p => p.status === 'vencida')
    .reduce((s, p) => s + (p.juros ?? 0) + (p.multa ?? 0), 0) ?? 0
)

const showAll = ref(false)
const showEncargos = ref(false)
const parcelasExibidas = computed(() => {
  if (!contract.value) return []
  if (showAll.value) return contract.value.parcelas
  // Mostra pagas (últimas 2), vencidas, proxima e futuras (primeiras 3)
  const pagas   = contract.value.parcelas.filter(p => p.status === 'paga').slice(-2)
  const outras  = contract.value.parcelas.filter(p => p.status !== 'paga').slice(0, 8)
  return [...pagas, ...outras]
})

const statusIcon = {
  paga:    'paga',
  vencida: 'vencida',
  proxima: 'proxima',
  futura:  'futura',
}

function parcela_action(p) {
  if (p.status === 'vencida' || p.status === 'proxima') return 'pagar'
  if (p.status === 'futura') return 'antecipar'
  return null
}

// ── Seleção de parcelas para pagamento ──────────────────────────────────────
const hoje = new Date()

function noMesVigente(p) {
  const v = new Date(p.vencimento + 'T00:00:00')
  return v.getFullYear() === hoje.getFullYear() && v.getMonth() === hoje.getMonth()
}

const selecionadas = ref(new Set())

watch(contract, c => {
  if (!c) return
  selecionadas.value = new Set(
    c.parcelas
      .filter(p => p.status === 'vencida' || (p.status === 'proxima' && noMesVigente(p)))
      .map(p => p.numero)
  )
}, { immediate: true })

function toggleParcela(numero) {
  const s = new Set(selecionadas.value)
  if (s.has(numero)) s.delete(numero)
  else s.add(numero)
  selecionadas.value = s
}

const parcelasSelecionadasObj = computed(() =>
  contract.value?.parcelas.filter(p => selecionadas.value.has(p.numero)) ?? []
)

const totalSelecionado = computed(() =>
  parcelasSelecionadasObj.value.reduce((s, p) => s + p.valorAtualizado, 0)
)

const jurosSelecionados = computed(() =>
  parcelasSelecionadasObj.value.reduce((s, p) => s + (p.juros ?? 0) + (p.multa ?? 0), 0)
)

const querySelecionadas = computed(() =>
  [...selecionadas.value].sort((a, b) => a - b).join(',')
)

const parcelasEmAberto = computed(() =>
  contract.value?.parcelas.filter(p => p.status === 'vencida' || p.status === 'proxima') ?? []
)
</script>

<template>
  <ClientLayout
    :title="`Contrato #${route.params.id}`"
    back-to="/contratos"
    back-label="Contratos"
  >
    <div v-if="!contract" class="card text-center text-gray-500 py-12">
      Contrato não encontrado.
    </div>

    <template v-else>
      <!-- Info do contrato -->
      <div class="card mb-6">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-bold text-gray-900">Contrato #{{ contract.id }}</h2>
            <span class="text-sm text-gray-400">{{ contract.tipo }}</span>
          </div>
          <StatusBadge :status="contract.status" />
        </div>

        <!-- Métricas principais -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-gray-400 text-xs mb-0.5">Saldo devedor</p>
            <p class="font-semibold" :class="contract.parcelasVencidas > 0 ? 'text-red-700' : 'text-gray-900'">
              {{ formatMoney(contract.saldoDevedor) }}
            </p>
          </div>
          <div>
            <p class="text-gray-400 text-xs mb-0.5">Parcelas</p>
            <p class="font-semibold text-gray-900">{{ contract.parcelasPagas }}/{{ contract.totalParcelas }}</p>
          </div>
        </div>

        <!-- Info secundária compacta -->
        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
          <span>{{ formatMoney(contract.valorContratado) }} contratado</span>
          <span>{{ contract.taxaJuros }}% a.m.</span>
          <span>Contratado em {{ formatDate(contract.dataContratacao) }}</span>
        </div>

        <!-- Encargos de atraso (colapsável) — só exibe se não há acordo ativo -->
        <div v-if="contract.parcelasVencidas > 0 && !acordoAtivo" class="mt-4">
          <button
            @click="showEncargos = !showEncargos"
            class="w-full flex items-center justify-between gap-2 bg-red-50 border border-red-500/20 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            :aria-expanded="showEncargos"
          >
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
              <span class="text-xs font-semibold text-red-700">
                {{ contract.parcelasVencidas }} parcela{{ contract.parcelasVencidas > 1 ? 's' : '' }} vencida{{ contract.parcelasVencidas > 1 ? 's' : '' }}
                &middot; {{ contract.diasAtraso }} dias em atraso
                &middot; <span class="font-bold">{{ formatMoney(totalVencido) }}</span>
              </span>
            </div>
            <svg
              class="w-4 h-4 text-red-400 shrink-0 transition-transform duration-200"
              :class="showEncargos ? 'rotate-180' : ''"
              fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
            </svg>
          </button>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150"
            leave-to-class="opacity-0"
          >
            <div v-if="showEncargos" class="mt-1 border border-red-500/20 rounded-lg overflow-hidden">
              <div class="px-4 py-1.5 bg-red-50 flex justify-end">
                <span class="text-xs text-red-400">Parcelas {{ contract.parcelas.filter(p=>p.status==='vencida').map(p=>p.numero).join(', ') }}</span>
              </div>
              <div class="divide-y divide-gray-50">
                <div class="px-4 py-2.5 flex justify-between text-sm">
                  <span class="text-gray-600">Valor original vencido</span>
                  <span class="font-medium text-gray-900">{{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+p.valor,0)) }}</span>
                </div>
                <div class="px-4 py-2.5 flex justify-between text-sm">
                  <span class="text-red-600">Juros de mora</span>
                  <span class="font-medium text-red-600">+ {{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+(p.juros??0),0)) }}</span>
                </div>
                <div class="px-4 py-2.5 flex justify-between text-sm">
                  <span class="text-red-600">Multa contratual</span>
                  <span class="font-medium text-red-600">+ {{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+(p.multa??0),0)) }}</span>
                </div>
                <div v-if="contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+(p.iof??0),0) > 0" class="px-4 py-2.5 flex justify-between text-sm">
                  <span class="text-red-600">IOF de mora</span>
                  <span class="font-medium text-red-600">+ {{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+(p.iof??0),0)) }}</span>
                </div>
                <div class="px-4 py-2.5 flex justify-between text-sm font-bold bg-red-50">
                  <span class="text-red-800">Total a pagar</span>
                  <span class="text-red-800">{{ formatMoney(totalVencido) }}</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Acordo ativo -->
        <div v-if="acordoAtivo" class="alert-info mt-4">
          <p class="font-semibold text-sm">Acordo ativo: {{ acordoAtivo.id }}</p>
          <p class="text-xs mt-0.5">
            {{ acordoAtivo.numParcelas }}x de {{ formatMoney(acordoAtivo.valorParcela) }} via boleto/Pix
          </p>
          <RouterLink :to="`/negociacoes/${acordoAtivo.id}`" class="text-xs text-blue-700 font-medium hover:underline mt-1 block">
            Ver detalhes do acordo →
          </RouterLink>
        </div>

        <!-- Banner de quitação -->
        <div v-if="contract.status === 'quitado'" class="mt-4 rounded-xl bg-green-50 border border-green-500/25 px-4 py-4 flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <p class="font-semibold text-green-800 text-sm">Contrato quitado!</p>
            <p class="text-xs text-green-700 mt-0.5">Todas as obrigações deste contrato foram cumpridas. Parabéns!</p>
          </div>
        </div>
      </div>

      <!-- Parcelas pendentes (selecionáveis) -->
      <div v-if="parcelasEmAberto.length > 0 && !acordoAtivo && contract.status !== 'quitado'" class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="font-semibold text-gray-900">Parcelas pendentes</h3>
            <p class="text-xs text-gray-400 mt-0.5">Selecione as que deseja pagar</p>
          </div>
          <div class="flex gap-3 text-xs">
            <button @click="selecionadas = new Set(parcelasEmAberto.map(p => p.numero))" class="text-blue-600 hover:underline font-medium">Selecionar todas</button>
            <button @click="selecionadas = new Set()" class="text-gray-400 hover:underline">Limpar</button>
          </div>
        </div>

        <div class="divide-y divide-gray-100 -mx-6 overflow-hidden">
          <button
            v-for="p in parcelasEmAberto"
            :key="p.numero"
            type="button"
            @click="toggleParcela(p.numero)"
            :aria-pressed="selecionadas.has(p.numero)"
            class="w-full flex items-center gap-3 px-6 py-3.5 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
            :class="selecionadas.has(p.numero) ? 'bg-blue-50 hover:bg-blue-100' : p.status === 'vencida' ? 'hover:bg-red-50' : 'hover:bg-amber-50'"
          >
            <!-- Checkbox visual -->
            <div
              class="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
              :class="selecionadas.has(p.numero) ? 'bg-blue-600 border-blue-600' : p.status === 'vencida' ? 'border-red-500 bg-white' : 'border-amber-500 bg-white'"
            >
              <svg v-if="selecionadas.has(p.numero)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            </div>

            <!-- Número -->
            <span class="text-xs font-mono text-gray-400 w-8 shrink-0">{{ p.numero }}</span>

            <!-- Descrição -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium" :class="p.status === 'vencida' ? 'text-red-700' : 'text-gray-700'">
                {{ p.status === 'vencida' ? 'Venceu em' : 'Vence em' }} {{ formatDate(p.vencimento) }}
              </p>
              <p v-if="p.status === 'proxima' && !noMesVigente(p)" class="text-xs text-amber-600">Próximo mês</p>
              <p v-if="(p.juros ?? 0) + (p.multa ?? 0) > 0" class="text-xs text-red-500">
                + {{ formatMoney((p.juros ?? 0) + (p.multa ?? 0)) }} em juros e multa
              </p>
            </div>

            <!-- Valor -->
            <div class="text-right shrink-0">
              <p class="font-semibold" :class="selecionadas.has(p.numero) ? 'text-blue-800' : p.status === 'vencida' ? 'text-red-700' : 'text-gray-800'">{{ formatMoney(p.valorAtualizado) }}</p>
              <p v-if="p.valorAtualizado !== p.valor" class="text-xs text-gray-400 line-through">{{ formatMoney(p.valor) }}</p>
            </div>

            <!-- Badge -->
            <StatusBadge :status="p.status" small />
          </button>
        </div>

        <!-- Barra de pagamento -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150"
          leave-to-class="opacity-0"
        >
          <div v-if="selecionadas.size > 0" class="mt-4 bg-blue-600 rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-sm text-white font-semibold">
                {{ selecionadas.size }} parcela{{ selecionadas.size > 1 ? 's' : '' }} selecionada{{ selecionadas.size > 1 ? 's' : '' }}
              </p>
              <p v-if="jurosSelecionados > 0" class="text-xs text-blue-200 mt-0.5">
                Incl. {{ formatMoney(jurosSelecionados) }} em encargos
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xl font-bold text-white">{{ formatMoney(totalSelecionado) }}</span>
              <RouterLink
                :to="`/contratos/${contract.id}/pagar?parcelas=${querySelecionadas}`"
                class="bg-white text-blue-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
              >
                Pagar com Pix
              </RouterLink>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Extrato de parcelas -->
      <div class="card mb-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="font-semibold text-gray-900">Extrato de parcelas</h3>
          <div class="flex flex-wrap gap-2">
            <RouterLink
              :to="`/contratos/${contract.id}/antecipar`"
              class="btn-secondary text-sm py-1.5 px-3"
            >
              Antecipar Parcelas
            </RouterLink>
            <RouterLink
              v-if="contract.parcelasVencidas > 0 && !contract.acordoAtivo"
              :to="`/contratos/${contract.id}/negociar`"
              class="btn-primary text-sm py-1.5 px-3"
            >
              Negociar
            </RouterLink>
          </div>
        </div>

        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm min-w-[460px]">
            <thead>
              <tr class="text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left py-2 font-medium">Parcela</th>
                <th class="text-left py-2 font-medium">Vencimento</th>
                <th class="text-left py-2 font-medium">Dt. Pagamento</th>
                <th class="text-right py-2 font-medium">Valor</th>
                <th class="text-center py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="p in parcelasExibidas"
                :key="p.numero"
                :class="[
                  p.status === 'vencida' && !acordoAtivo ? 'bg-red-50' : '',
                  p.status === 'vencida' && acordoAtivo ? 'bg-blue-100' : '',
                  p.status === 'proxima' ? 'bg-blue-100' : '',
                ]"
              >
                <td class="py-2.5 text-gray-500 font-mono text-xs">{{ p.numero }}</td>
                <td class="py-2.5">
                  <span :class="p.status === 'vencida' && !acordoAtivo ? 'text-red-700 font-medium' : 'text-gray-700'">
                    {{ formatDate(p.vencimento) }}
                  </span>
                </td>
                <td class="py-2.5 text-sm">
                  <span v-if="p.dataPagamento" class="text-green-700 font-medium">{{ formatDate(p.dataPagamento) }}</span>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <td class="py-2.5 text-right font-semibold">
                  <span :class="p.status === 'vencida' && !acordoAtivo ? 'text-red-700' : 'text-gray-900'">{{ formatMoney(p.valorAtualizado) }}</span>
                  <span v-if="p.valorAtualizado !== p.valor" class="block text-xs text-gray-400 line-through">{{ formatMoney(p.valor) }}</span>
                </td>
                <td class="py-2.5 text-center">
                  <StatusBadge :status="acordoAtivo && p.status === 'vencida' ? 'em_acordo' : p.status" small />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          v-if="contract.parcelas.length > parcelasExibidas.length || (showAll && contract.parcelas.length > 4)"
          @click="showAll = !showAll"
          class="mt-3 text-sm text-blue-600 hover:underline"
        >
          {{ showAll ? 'Ver menos' : `Ver todas as ${contract.parcelas.length} parcelas` }}
        </button>
      </div>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
