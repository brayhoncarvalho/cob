<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackofficeLayout from '@/layouts/BackofficeLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useRules } from '@/stores/rules.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate, formatDateTime } = useFormatters()
const { state: flowState, approveNegotiation, rejectNegotiation, counterNegotiation, escalateNegotiation } = useFlow()
const { rules } = useRules()

const neg      = computed(() => flowState.negotiations.find(n => n.id === route.params.id))
const contract = computed(() => flowState.contracts.find(c => c.id === neg.value?.contratoId))

// Análise automática das regras
const analise = computed(() => {
  if (!neg.value || !contract.value) return []
  const pct = neg.value.entrada / contract.value.saldoDevedor
  const items = [
    {
      label: `Entrada ≥ ${(rules.entradaMinimaPct * 100).toFixed(0)}% do total`,
      ok: pct >= rules.entradaMinimaPct,
      detalhe: `${(pct * 100).toFixed(1)}% (${formatMoney(neg.value.entrada)})`,
    },
    {
      label: `Parcelamento ≤ ${rules.parcelasMaxAutoAprovacao}x`,
      ok: neg.value.numParcelas <= rules.parcelasMaxAutoAprovacao,
      detalhe: `${neg.value.numParcelas}x`,
    },
    {
      label: `Atraso ≤ ${rules.atrasoMaxAutoAprovacao} dias`,
      ok: (contract.value.diasAtraso ?? 0) <= rules.atrasoMaxAutoAprovacao,
      detalhe: `${contract.value.diasAtraso ?? 0} dias`,
    },
    {
      label: `Parcela ≥ ${formatMoney(rules.parcelaMinimaValor)}`,
      ok: neg.value.valorParcela >= rules.parcelaMinimaValor,
      detalhe: formatMoney(neg.value.valorParcela),
    },
    {
      label: `Dívida ≤ ${formatMoney(rules.valorMaxAutoAprovacao)}`,
      ok: contract.value.saldoDevedor <= rules.valorMaxAutoAprovacao,
      detalhe: formatMoney(contract.value.saldoDevedor),
    },
  ]
  return items
})

// Estado da decisão
const decisao      = ref(null) // 'aprovar' | 'reprovar' | 'contraproposta' | 'escalar'
const motivo       = ref('')
const contraEntrada   = ref('')
const contraParcelas  = ref('')
const loading      = ref(false)
const done         = ref(false)
const doneMsg      = ref('')

// Parcela calculada automaticamente: (totalAcordo - entrada) / numParcelas
const contraValorParc = computed(() => {
  const total = neg.value?.totalAcordo ?? 0
  const ent   = Number(contraEntrada.value) || 0
  const np    = Number(contraParcelas.value) || 1
  const v = Math.max(0, (total - ent) / np)
  return v > 0 ? Math.round(v * 100) / 100 : 0
})

// Acordo ativo (leitura)
const isAcordoView = computed(() => ['em_pagamento', 'quitado'].includes(neg.value?.status))
const parcelasPagas  = computed(() => neg.value?.parcelas?.filter(p => p.status === 'paga').length ?? 0)
const parcelasTotal  = computed(() => neg.value?.parcelas?.length ?? 0)
const progressoPct   = computed(() => parcelasTotal.value > 0 ? Math.round((parcelasPagas.value / parcelasTotal.value) * 100) : 0)

const parcelaBadge = (status) => {
  if (status === 'paga')    return 'bg-green-100 text-green-700'
  if (status === 'vencida') return 'bg-red-100 text-red-700'
  if (status === 'proxima') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-500'
}
const parcelaLabel = (status) => {
  if (status === 'paga')    return 'Paga'
  if (status === 'vencida') return 'Vencida'
  if (status === 'proxima') return 'Próxima'
  return 'Futura'
}

const precisaEscalar = computed(() =>
  contract.value?.saldoDevedor > rules.alcada1NivelMax
)

async function confirmar() {
  if (!decisao.value) return
  loading.value = true
  await new Promise(r => setTimeout(r, 800))
  loading.value = false

  const id = neg.value.id
  if (decisao.value === 'aprovar') {
    approveNegotiation(id, { motivo: motivo.value })
  } else if (decisao.value === 'reprovar') {
    rejectNegotiation(id, { motivo: motivo.value })
  } else if (decisao.value === 'contraproposta') {
    counterNegotiation(id, {
      motivo: motivo.value,
      entrada: contraEntrada.value,
      numParcelas: contraParcelas.value,
      valorParcela: contraValorParc.value,
    })
  } else if (decisao.value === 'escalar') {
    escalateNegotiation(id)
  }

  router.push('/backoffice/fila')
}
</script>

<template>
  <BackofficeLayout
    :title="`Análise — ${route.params.id}`"
    back-to="/backoffice/fila"
    back-label="Fila"
  >
    <div v-if="!neg" class="bg-white rounded-xl p-8 text-center text-gray-500">
      Proposta não encontrada.
    </div>

    <!-- VIEW ACORDO ATIVO / QUITADO ─────────────────────────────── -->
    <template v-else-if="isAcordoView">
      <div class="grid xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 space-y-4">

          <!-- Cabeçalho do acordo -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="font-semibold text-gray-900">Acompanhamento do Acordo</h3>
                <p class="text-xs text-gray-400 mt-0.5">Protocolo {{ neg.id }} · Contrato #{{ neg.contratoId }}</p>
              </div>
              <span :class="neg.status === 'quitado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'"
                    class="text-xs font-semibold px-3 py-1 rounded-full">
                {{ neg.status === 'quitado' ? 'Quitado' : 'Em Pagamento' }}
              </span>
            </div>

            <!-- Progresso -->
            <div class="mb-4">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>{{ parcelasPagas }} de {{ parcelasTotal }} parcelas pagas</span>
                <span class="font-semibold">{{ progressoPct }}%</span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  class="h-2.5 rounded-full transition-all duration-500"
                  :class="neg.status === 'quitado' ? 'bg-green-500' : 'bg-blue-500'"
                  :style="{ width: progressoPct + '%' }"
                />
              </div>
            </div>

            <!-- Resumo financeiro -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p class="text-xs text-gray-400">Entrada</p>
                <p class="font-bold text-blue-700">{{ formatMoney(neg.entrada) }}</p>
                <p class="text-xs text-gray-400">{{ neg.entradaPaga ? '✓ paga' : 'pendente' }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Parcelas</p>
                <p class="font-bold">{{ neg.numParcelas }}x {{ formatMoney(neg.valorParcela) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Total do acordo</p>
                <p class="font-bold">{{ formatMoney(neg.totalAcordo) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Desconto</p>
                <p class="font-bold text-green-600">{{ formatMoney(neg.desconto) }}</p>
                <p class="text-xs text-gray-400">{{ ((neg.desconto / neg.totalDivida) * 100).toFixed(1) }}%</p>
              </div>
            </div>
          </div>

          <!-- Tabela de parcelas -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Parcelas do Acordo</h3>
            <div v-if="neg.parcelas?.length" class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-100 text-xs text-gray-400 text-left">
                    <th class="pb-2 pr-3 font-medium">#</th>
                    <th class="pb-2 pr-3 font-medium">Vencimento</th>
                    <th class="pb-2 pr-3 font-medium">Valor</th>
                    <th class="pb-2 pr-3 font-medium">Status</th>
                    <th class="pb-2 font-medium">Pagamento</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="parcela in neg.parcelas" :key="parcela.numero"
                      class="border-b border-gray-50 last:border-0">
                    <td class="py-2 pr-3 font-mono text-gray-500">
                      {{ parcela.tipo === 'entrada' ? 'E' : parcela.numero }}
                    </td>
                    <td class="py-2 pr-3">{{ formatDate(parcela.vencimento) }}</td>
                    <td class="py-2 pr-3 font-semibold">{{ formatMoney(parcela.valor) }}</td>
                    <td class="py-2 pr-3">
                      <span :class="parcelaBadge(parcela.status)"
                            class="text-xs font-medium px-2 py-0.5 rounded-full">
                        {{ parcelaLabel(parcela.status) }}
                      </span>
                    </td>
                    <td class="py-2 text-gray-400 text-xs">
                      {{ parcela.dataPagamento ? formatDate(parcela.dataPagamento) : '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-gray-400 text-center py-4">Parcelas ainda não geradas.</p>
          </div>
        </div>

        <!-- Coluna lateral -->
        <div class="space-y-4">
          <div v-if="neg.status === 'quitado'" class="bg-green-50 border border-green-500/20 rounded-xl p-5 text-center">
            <svg class="w-10 h-10 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="font-semibold text-green-700 text-sm">Acordo Quitado</p>
            <p class="text-xs text-green-600 mt-1">Todas as parcelas foram pagas com sucesso.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Dados do Contrato</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-gray-400">Contrato</span><span class="font-medium">#{{ contract?.id }}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Tipo</span><span class="font-medium">{{ contract?.tipo }}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Saldo devedor</span><span class="font-semibold">{{ formatMoney(contract?.saldoDevedor) }}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Parcelas pagas</span><span class="font-medium text-green-600">{{ contract?.parcelasPagas }}/{{ contract?.totalParcelas }}</span></div>
              <div class="flex justify-between"><span class="text-gray-400">Aprovado em</span><span class="font-medium">{{ neg.dataAprovacao ? formatDate(neg.dataAprovacao) : '—' }}</span></div>
            </div>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Indicadores</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-400">Entrada (%)</span>
                <span :class="(neg.entrada / (neg.totalDivida || 1)) >= 0.20 ? 'text-green-600' : 'text-amber-600'" class="font-semibold">
                  {{ ((neg.entrada / (neg.totalDivida || 1)) * 100).toFixed(1) }}%
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Parcelamento</span>
                <span :class="neg.numParcelas <= 12 ? 'text-green-600' : 'text-amber-600'" class="font-semibold">
                  {{ neg.numParcelas }}x
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Desconto dado</span>
                <span class="font-semibold text-blue-700">{{ formatMoney(neg.desconto) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <div v-else-if="done" class="max-w-lg mx-auto text-center">
      <div class="bg-white rounded-2xl border border-gray-200 p-8">
        <div class="mb-4 flex justify-center">
          <svg v-if="decisao === 'aprovar'" class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <svg v-else-if="decisao === 'escalar'" class="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>
          <svg v-else-if="decisao === 'contraproposta'" class="w-12 h-12 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
          <svg v-else class="w-12 h-12 text-red-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h2 class="text-xl font-bold text-gray-900 mb-2">Decisão registrada</h2>
        <p class="text-gray-600 mb-6">{{ doneMsg }}</p>
        <button @click="router.push('/backoffice/fila')" class="btn-primary">
          Voltar à Fila
        </button>
      </div>
    </div>

    <template v-else>
      <div class="grid xl:grid-cols-3 gap-6">

        <!-- Coluna contexto -->
        <div class="xl:col-span-2 space-y-4">

          <!-- Dados do cliente -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Dados do cliente</h3>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div><p class="text-xs text-gray-400">Nome</p><p class="font-medium">João da Silva</p></div>
              <div><p class="text-xs text-gray-400">CPF</p><p class="font-medium font-mono">***.456.789-**</p></div>
              <div><p class="text-xs text-gray-400">Cliente desde</p><p class="font-medium">2019</p></div>
              <div><p class="text-xs text-gray-400">Score interno</p><p class="font-medium">620 (médio)</p></div>
            </div>
          </div>

          <!-- Histórico de pagamento -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Histórico de pagamento</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><p class="text-xs text-gray-400">Parcelas totais</p><p class="font-medium">{{ contract?.totalParcelas }}</p></div>
              <div><p class="text-xs text-gray-400">Pagas em dia</p><p class="font-medium text-green-600">{{ contract?.parcelasPagas }}</p></div>
              <div><p class="text-xs text-gray-400">Vencidas</p><p class="font-medium text-red-600">{{ contract?.parcelasVencidas }}</p></div>
              <div><p class="text-xs text-gray-400">Atraso atual</p><p class="font-semibold text-red-600">{{ contract?.diasAtraso }} dias</p></div>
              <div><p class="text-xs text-gray-400">Saldo devedor</p><p class="font-semibold">{{ formatMoney(contract?.saldoDevedor) }}</p></div>
              <div><p class="text-xs text-gray-400">Taxa de juros</p><p class="font-medium">{{ contract?.taxaJuros }}% a.m.</p></div>
            </div>
          </div>

          <!-- Proposta do cliente -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Proposta do cliente</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p class="text-xs text-gray-400">Entrada</p>
                <p class="font-bold text-blue-700">{{ formatMoney(neg.entrada) }}</p>
                <p class="text-xs text-gray-400">{{ ((neg.entrada / (contract?.saldoDevedor ?? 1)) * 100).toFixed(1) }}%</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Parcelas</p>
                <p class="font-bold">{{ neg.numParcelas }}x</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Valor da parcela</p>
                <p class="font-bold">{{ formatMoney(neg.valorParcela) }}</p>
              </div>
              <div>
                <p class="text-xs text-gray-400">Total do acordo</p>
                <p class="font-bold">{{ formatMoney(neg.totalAcordo) }}</p>
              </div>
            </div>
            <div class="mt-2 text-xs text-gray-500">
              Desconto implícito: {{ formatMoney(neg.desconto) }} ({{ ((neg.desconto / (contract?.saldoDevedor ?? 1)) * 100).toFixed(1) }}%)
            </div>
          </div>

          <!-- Análise automática -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Análise automática de regras</h3>
            <div class="space-y-2">
              <div v-for="item in analise" :key="item.label" class="flex items-center gap-3 text-sm">
                <span class="shrink-0">
                  <svg v-if="item.ok" class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <svg v-else class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                </span>
                <span :class="item.ok ? 'text-gray-700' : 'text-red-700 font-medium'" class="flex-1">{{ item.label }}</span>
                <span class="text-gray-500 text-xs">{{ item.detalhe }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Coluna decisão -->
        <div class="space-y-4">

          <div v-if="precisaEscalar" class="bg-red-50 border border-red-500/25 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
            <svg class="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5"/></svg>
            <span><strong>Atenção:</strong> Dívida acima da alçada do 1º Nível ({{ formatMoney(rules.alcada1NivelMax) }}). Escalone para o 2º Nível.</span>
          </div>

          <!-- Botões de decisão -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-4">Decisão</h3>
            <div class="grid grid-cols-2 gap-2 mb-4">
              <button
                @click="decisao = 'aprovar'"
                :class="['p-3 rounded-xl border-2 text-sm font-semibold transition-all text-center flex items-center justify-center gap-1.5', decisao === 'aprovar' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-green-500']"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                Aprovar
              </button>
              <button
                @click="decisao = 'reprovar'"
                :class="['p-3 rounded-xl border-2 text-sm font-semibold transition-all text-center flex items-center justify-center gap-1.5', decisao === 'reprovar' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-red-500']"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                Reprovar
              </button>
              <button
                @click="decisao = 'contraproposta'"
                :class="['col-span-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all text-center flex items-center justify-center gap-1.5', decisao === 'contraproposta' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-500']"
              >
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
                Contraproposta
              </button>
            </div>

            <!-- Motivo (reprovar / contraproposta) -->
            <div v-if="decisao === 'reprovar' || decisao === 'contraproposta'" class="mb-4">
              <label class="block text-xs font-medium text-gray-700 mb-1">
                Motivo / Observação
              </label>
              <textarea
                v-model="motivo"
                rows="3"
                placeholder="Descreva o motivo da decisão..."
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <!-- Campos contraproposta -->
            <div v-if="decisao === 'contraproposta'" class="space-y-3 mb-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Nova entrada (R$)</label>
                <input v-model="contraEntrada" type="number" placeholder="0,00" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Nº parcelas</label>
                <input v-model="contraParcelas" type="number" min="1" max="24" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <!-- Valor parcela calculado automaticamente -->
              <div class="rounded-lg bg-amber-50 border border-amber-500/25 px-3 py-2">
                <p class="text-xs text-amber-600 mb-0.5">Valor da parcela (calculado)</p>
                <p class="font-bold text-amber-800 text-sm">
                  {{ contraValorParc > 0 ? formatMoney(contraValorParc) : '—' }}
                </p>
                <p class="text-xs text-amber-400 mt-0.5">
                  Total: {{ formatMoney(neg.totalAcordo) }} − Entrada: {{ formatMoney(Number(contraEntrada) || 0) }} ÷ {{ contraParcelas || '?' }}x
                </p>
              </div>
            </div>

            <button
              @click="confirmar"
              :disabled="!decisao || loading"
              class="btn-primary w-full flex items-center justify-center gap-2"
            >
              <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {{ loading ? 'Processando...' : 'Confirmar Decisão' }}
            </button>
          </div>

          <!-- Escalar — ação secundária separada, sem ambiguidade visual -->
          <div class="border-t border-gray-100 pt-3 mt-1">
            <p class="text-xs text-gray-400 text-center mb-2">Fora da sua alçada?</p>
            <button
              @click="decisao = 'escalar'; confirmar()"
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-amber-50 hover:border-amber-500 hover:text-amber-700 text-gray-600 text-sm font-medium transition-all"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>
              </svg>
              Encaminhar para 2º Nível
            </button>
          </div>
        </div>
      </div>
    </template>

  </BackofficeLayout>
</template>
