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
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <h2 class="text-lg font-bold text-gray-900">Contrato #{{ contract.id }}</h2>
          <span class="text-sm text-gray-500">{{ contract.tipo }}</span>
          <StatusBadge :status="contract.status" />
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Valor contratado</p>
            <p class="font-semibold">{{ formatMoney(contract.valorContratado) }}</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Saldo devedor</p>
            <p class="font-semibold" :class="contract.parcelasVencidas > 0 ? 'text-red-600' : ''">
              {{ formatMoney(contract.saldoDevedor) }}
            </p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Taxa de juros</p>
            <p class="font-semibold">{{ contract.taxaJuros }}% a.m.</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Contratado em</p>
            <p class="font-semibold">{{ formatDate(contract.dataContratacao) }}</p>
          </div>
          <div>
            <p class="text-gray-500 text-xs mb-0.5">Parcelas</p>
            <p class="font-semibold">{{ contract.parcelasPagas }} pagas / {{ contract.totalParcelas }} total</p>
          </div>
          <div v-if="contract.parcelasVencidas > 0">
            <p class="text-gray-500 text-xs mb-0.5">Juros e multa</p>
            <p class="font-semibold text-red-600">{{ formatMoney(jurosMulta) }}</p>
          </div>
        </div>

        <!-- Detalhamento Juros / Multa / IOF -->
        <div v-if="contract.parcelasVencidas > 0" class="mt-4 border border-red-100 rounded-lg overflow-hidden">
          <div class="bg-red-50 px-4 py-2 flex items-center justify-between">
            <span class="text-xs font-semibold text-red-700">Detalhamento de encargos</span>
            <span class="text-xs text-red-600">Parcelas {{ contract.parcelas.filter(p=>p.status==='vencida').map(p=>p.numero).join(', ') }}</span>
          </div>
          <div class="divide-y divide-red-50">
            <div class="px-4 py-2.5 flex justify-between text-sm">
              <span class="text-gray-600">Valor original vencido</span>
              <span class="font-medium">{{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+p.valor,0)) }}</span>
            </div>
            <div class="px-4 py-2.5 flex justify-between text-sm">
              <span class="text-red-700">Juros de mora</span>
              <span class="font-medium text-red-700">+ {{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+(p.juros??0),0)) }}</span>
            </div>
            <div class="px-4 py-2.5 flex justify-between text-sm">
              <span class="text-red-700">Multa contratual</span>
              <span class="font-medium text-red-700">+ {{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+(p.multa??0),0)) }}</span>
            </div>
            <div class="px-4 py-2.5 flex justify-between text-sm">
              <span class="text-red-700">IOF de mora</span>
              <span class="font-medium text-red-700">+ {{ formatMoney(contract.parcelas.filter(p=>p.status==='vencida').reduce((s,p)=>s+(p.iof??0),0)) }}</span>
            </div>
            <div class="px-4 py-2.5 flex justify-between text-sm font-bold bg-red-50">
              <span class="text-red-800">Total atualizado</span>
              <span class="text-red-800">{{ formatMoney(totalVencido) }}</span>
            </div>
          </div>
        </div>

        <!-- Alerta de atraso -->
        <div v-if="contract.parcelasVencidas > 0" class="alert-danger mt-4">
          <p class="font-semibold text-sm">{{ contract.parcelasVencidas }} parcela(s) vencida(s) — {{ contract.diasAtraso }} dias em atraso</p>
          <p class="text-xs mt-0.5">
            Total das vencidas: <strong>{{ formatMoney(totalVencido) }}</strong>
            <span v-if="jurosMulta > 0"> (sendo <strong>{{ formatMoney(jurosMulta) }}</strong> em juros e multa)</span>
          </p>
          <p class="text-xs mt-1 text-red-600/70">Saldo devedor total do contrato: {{ formatMoney(contract.saldoDevedor) }}</p>
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
        <div v-if="contract.status === 'quitado'" class="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-4 flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <p class="font-semibold text-emerald-800 text-sm">Contrato quitado!</p>
            <p class="text-xs text-emerald-700 mt-0.5">Todas as obrigações deste contrato foram cumpridas. Parabéns!</p>
          </div>
        </div>
      </div>

      <!-- Parcelas -->
      <div class="card mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-900">Parcelas</h3>
          <div class="flex gap-2 text-xs">
            <button
              v-if="contract.parcelas.some(p => p.status === 'vencida' || p.status === 'proxima')"
              @click="selecionadas = new Set(contract.parcelas.filter(p => p.status === 'vencida' || p.status === 'proxima').map(p => p.numero))"
              class="text-blue-600 hover:underline font-medium"
            >Selecionar todas em aberto</button>
            <span v-if="selecionadas.size > 0" class="text-gray-300">·</span>
            <button
              v-if="selecionadas.size > 0"
              @click="selecionadas = new Set()"
              class="text-gray-500 hover:underline"
            >Limpar</button>
          </div>
        </div>

        <div class="overflow-x-auto -mx-6 px-6">
          <table class="w-full text-sm min-w-[520px]">
            <thead>
              <tr class="text-xs text-gray-500 border-b border-gray-100">
                <th class="text-left py-2 font-medium w-8"></th>
                <th class="text-left py-2 font-medium">Parcela</th>
                <th class="text-left py-2 font-medium">Vencimento</th>
                <th class="text-left py-2 font-medium">Dt. Pagamento</th>
                <th class="text-right py-2 font-medium">Valor</th>
                <th class="text-center py-2 font-medium">Status</th>
                <th class="text-right py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="p in parcelasExibidas"
                :key="p.numero"
                :class="[
                  'transition-colors',
                  p.status === 'vencida' ? 'bg-red-50' : '',
                  p.status === 'proxima' ? 'bg-amber-50' : '',
                  selecionadas.has(p.numero) && p.status !== 'paga' ? 'outline outline-2 outline-blue-400/30' : '',
                ]"
              >
                <!-- Checkbox -->
                <td class="py-2.5 pr-2">
                  <input
                    v-if="p.status === 'vencida' || p.status === 'proxima'"
                    type="checkbox"
                    :checked="selecionadas.has(p.numero)"
                    @change="toggleParcela(p.numero)"
                    class="w-4 h-4 accent-blue-600 cursor-pointer"
                    :aria-label="`Selecionar parcela ${p.numero}`"
                  />
                  <span v-else class="block w-4" />
                </td>
                <!-- Número -->
                <td class="py-2.5 text-gray-500 font-mono text-xs pr-2">{{ p.numero }}</td>
                <!-- Vencimento -->
                <td class="py-2.5">
                  <span :class="p.status === 'vencida' ? 'text-red-700 font-medium' : ''">
                    {{ formatDate(p.vencimento) }}
                  </span>
                  <span v-if="p.status === 'vencida'" class="inline-flex items-center ml-1 text-xs text-red-500">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                  </span>
                  <span v-if="p.status === 'proxima' && !noMesVigente(p)" class="ml-1 text-[10px] text-amber-600 font-medium">(próx. mês)</span>
                </td>
                <!-- Dt. Pagamento -->
                <td class="py-2.5 text-sm">
                  <span v-if="p.dataPagamento" class="text-green-700 font-medium">{{ formatDate(p.dataPagamento) }}</span>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <!-- Valor -->
                <td class="py-2.5 text-right font-semibold">
                  <span :class="p.status === 'vencida' ? 'text-red-700' : 'text-gray-900'">
                    {{ formatMoney(p.valorAtualizado) }}
                  </span>
                  <span v-if="p.valorAtualizado !== p.valor" class="block text-xs text-gray-400 line-through">
                    {{ formatMoney(p.valor) }}
                  </span>
                </td>
                <!-- Status -->
                <td class="py-2.5 text-center">
                  <StatusBadge :status="p.status" small />
                </td>
                <!-- Ação -->
                <td class="py-2.5 text-right">
                  <RouterLink
                    v-if="parcela_action(p) === 'antecipar'"
                    :to="`/contratos/${contract.id}/antecipar?parcelas=${p.numero}`"
                    class="text-xs font-medium text-gray-500 hover:underline"
                  >
                    Antecipar
                  </RouterLink>
                  <span v-else class="text-xs text-gray-300">—</span>
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

        <!-- Barra de pagamento -->
        <div
          v-if="selecionadas.size > 0"
          class="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div class="text-sm">
            <span class="text-blue-700 font-medium">
              {{ selecionadas.size }} parcela{{ selecionadas.size > 1 ? 's' : '' }} selecionada{{ selecionadas.size > 1 ? 's' : '' }}:
            </span>
            <span class="text-xs text-blue-500 ml-1">
              {{ [...selecionadas].sort((a,b)=>a-b).join(', ') }}
            </span>
            <span v-if="jurosSelecionados > 0" class="block text-xs text-red-500 mt-0.5">
              Incl. {{ formatMoney(jurosSelecionados) }} em juros e multa
            </span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-lg font-bold text-blue-900">{{ formatMoney(totalSelecionado) }}</span>
            <RouterLink
              :to="`/contratos/${contract.id}/pagar?parcelas=${querySelecionadas}`"
              class="btn-primary text-sm py-2 px-4 whitespace-nowrap"
            >
              Pagar com Pix
            </RouterLink>
          </div>
        </div>

        <div
          v-else-if="contract.parcelas.some(p => p.status === 'vencida' || p.status === 'proxima')"
          class="mt-4 text-sm text-gray-400 text-center py-2"
        >
          Selecione as parcelas que deseja pagar.
        </div>
      </div>

      <!-- Botões de ação -->
      <div class="flex flex-wrap gap-3">
        <RouterLink
          :to="`/contratos/${contract.id}/antecipar`"
          class="btn-secondary"
        >
          Antecipar Parcelas
        </RouterLink>
        <RouterLink
          v-if="contract.parcelasVencidas > 0 && !contract.acordoAtivo"
          :to="`/contratos/${contract.id}/negociar`"
          class="btn-primary"
        >
          Negociar Contrato
        </RouterLink>
      </div>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
