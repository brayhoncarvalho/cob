<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackofficeLayout from '@/layouts/BackofficeLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useRules } from '@/stores/rules.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate, formatDateTime } = useFormatters()
const { state: flowState, approveNegotiation, rejectNegotiation, counterNegotiation, managerCancelNegotiation } = useFlow()
const { rules } = useRules()

const neg      = computed(() => flowState.negotiations.find(n => n.id === route.params.id))
const contract = computed(() => flowState.contracts.find(c => c.id === neg.value?.contratoId))

const decisao   = ref(null)
const motivo    = ref('')
const loading   = ref(false)

const motivoCancelamento = ref('')
const confirmandoCancelamento = ref(false)

function cancelarAcordo() {
  managerCancelNegotiation(neg.value.id, { motivo: motivoCancelamento.value })
  router.push('/backoffice/gerente/acordos')
}

// Contraproposta — pré-preenchida com valores da Mesa se houver
const contraEntrada  = ref('')
const contraParcelas = ref('')

// Pré-preencher se a Mesa fez contraproposta
const hasMesaCounter = computed(() => !!neg.value?.contrapropostaMesa)

function preencherComMesa() {
  if (!neg.value?.contrapropostaMesa) return
  contraEntrada.value  = neg.value.contrapropostaMesa.entrada
  contraParcelas.value = neg.value.contrapropostaMesa.numParcelas
}

// Parcela calculada automaticamente: (saldoDevedor - entrada) / numParcelas
const contraValorParc = computed(() => {
  const divida = contract.value?.saldoDevedor ?? neg.value?.totalAcordo ?? 0
  const ent   = Number(contraEntrada.value) || 0
  const np    = Number(contraParcelas.value) || 1
  const v = Math.max(0, (divida - ent) / np)
  return v > 0 ? Math.round(v * 100) / 100 : 0
})

const totalContraproposta = computed(() =>
  (Number(contraEntrada.value) || 0) + (Number(contraParcelas.value) || 1) * contraValorParc.value
)

const contraErro = computed(() => {
  if (decisao.value !== 'contraproposta') return null
  const divida = contract.value?.saldoDevedor ?? 0
  const ent = Number(contraEntrada.value) || 0
  if (!ent && !contraParcelas.value) return null
  if (ent >= divida) return `Entrada de ${formatMoney(ent)} supera a dívida de ${formatMoney(divida)}.`
  if (totalContraproposta.value > divida * 1.02) return `Total de ${formatMoney(totalContraproposta.value)} supera a dívida de ${formatMoney(divida)}.`
  return null
})

// O que a mesa decidiu
const decisaoMesaInfo = computed(() => {
  if (!neg.value?.decisaoMesa) return null
  if (neg.value.decisaoMesa === 'aprovada') {
    return { tipo: 'aprovada', cor: 'green', label: 'Mesa aprovou', descricao: 'A Mesa de Crédito aprovou esta proposta nos termos originais do cliente.' }
  }
  if (neg.value.decisaoMesa === 'contraproposta') {
    const cp = neg.value.contrapropostaMesa
    return {
      tipo: 'contraproposta',
      cor: 'amber',
      label: 'Mesa sugeriu contraproposta',
      descricao: `Entrada: ${formatMoney(cp?.entrada)} · ${cp?.numParcelas}x de ${formatMoney(cp?.valorParcela)} · Total: ${formatMoney(cp?.total)}`,
    }
  }
  return null
})

// Análise da proposta (valores atuais, considerando contraproposta da Mesa se houver)
const analise = computed(() => {
  if (!neg.value || !contract.value) return []
  const cp = neg.value.contrapropostaMesa
  const entradaRef = cp ? cp.entrada : neg.value.entrada
  const parcelasRef = cp ? cp.numParcelas : neg.value.numParcelas
  const parcelaRef  = cp ? cp.valorParcela : neg.value.valorParcela
  const pct = entradaRef / contract.value.saldoDevedor
  return [
    { label: 'Entrada (%)',        valor: `${(pct*100).toFixed(1)}%`,               alerta: pct < 0.10 },
    { label: 'Parcelamento',       valor: `${parcelasRef}x`,                         alerta: parcelasRef > 18 },
    { label: 'Atraso',             valor: `${contract.value.diasAtraso} dias`,        alerta: (contract.value.diasAtraso ?? 0) > 120 },
    { label: 'Dívida total',       valor: formatMoney(contract.value.saldoDevedor),   alerta: contract.value.saldoDevedor > 50000 },
    { label: 'Valor da parcela',   valor: formatMoney(parcelaRef),                   alerta: parcelaRef < rules.parcelaMinimaValor },
    { label: 'Desconto implícito', valor: `${((neg.value.desconto / contract.value.saldoDevedor)*100).toFixed(1)}%`, alerta: false },
  ]
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

// Rótulos de impacto da decisão da gerência
const decisaoInfo = computed(() => {
  switch (decisao.value) {
    case 'aprovar':        return { cor: 'green', texto: 'Acordo ativado imediatamente — cliente recebe notificação de pagamento.' }
    case 'reprovar':       return { cor: 'red',   texto: 'Processo finalizado — cliente será informado sobre a reprovação.' }
    case 'contraproposta': return { cor: 'blue',  texto: 'Proposta enviada ao cliente para aceite ou recusa.' }
    default: return null
  }
})

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
  }

  router.push('/backoffice/gerente')
}
</script>

<template>
  <BackofficeLayout
    :title="`Análise — ${route.params.id}`"
    back-to="/backoffice/gerente"
    back-label="Gestão de Crédito"
  >
    <div v-if="!neg" class="bg-white rounded-xl p-8 text-center text-gray-500">Proposta não encontrada.</div>

    <!-- VIEW ACORDO ATIVO / QUITADO ─────────────────────────────── -->
    <template v-else-if="isAcordoView">
      <div class="grid xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 space-y-4">
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
            <div class="mb-4">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>{{ parcelasPagas }} de {{ parcelasTotal }} parcelas pagas</span>
                <span class="font-semibold">{{ progressoPct }}%</span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2.5">
                <div class="h-2.5 rounded-full transition-all duration-500"
                  :class="neg.status === 'quitado' ? 'bg-green-500' : 'bg-blue-500'"
                  :style="{ width: progressoPct + '%' }" />
              </div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p class="text-xs text-gray-400">Entrada</p><p class="font-bold text-blue-700">{{ formatMoney(neg.entrada) }}</p><p class="text-xs text-gray-400">{{ neg.entradaPaga ? '✓ paga' : 'pendente' }}</p></div>
              <div><p class="text-xs text-gray-400">Parcelas</p><p class="font-bold">{{ neg.numParcelas }}x {{ formatMoney(neg.valorParcela) }}</p></div>
              <div><p class="text-xs text-gray-400">Total do acordo</p><p class="font-bold">{{ formatMoney(neg.totalAcordo) }}</p></div>
              <div><p class="text-xs text-gray-400">Desconto</p><p class="font-bold text-green-600">{{ formatMoney(neg.desconto) }}</p><p class="text-xs text-gray-400">{{ ((neg.desconto / neg.totalDivida) * 100).toFixed(1) }}%</p></div>
            </div>
          </div>
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
                  <tr v-for="parcela in neg.parcelas" :key="parcela.numero" class="border-b border-gray-50 last:border-0">
                    <td class="py-2 pr-3 font-mono text-gray-500">{{ parcela.tipo === 'entrada' ? 'E' : parcela.numero }}</td>
                    <td class="py-2 pr-3">{{ formatDate(parcela.vencimento) }}</td>
                    <td class="py-2 pr-3 font-semibold">{{ formatMoney(parcela.valor) }}</td>
                    <td class="py-2 pr-3"><span :class="parcelaBadge(parcela.status)" class="text-xs font-medium px-2 py-0.5 rounded-full">{{ parcelaLabel(parcela.status) }}</span></td>
                    <td class="py-2 text-gray-400 text-xs">{{ parcela.dataPagamento ? formatDate(parcela.dataPagamento) : '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="text-sm text-gray-400 text-center py-4">Parcelas ainda não geradas.</p>
          </div>
        </div>
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

          <!-- Cancelamento excepcional (apenas gerente, apenas em_pagamento) -->
          <div v-if="neg.status === 'em_pagamento'" class="bg-white rounded-xl border border-red-200 p-5">
            <h3 class="font-semibold text-red-700 mb-1 text-sm">Cancelamento excepcional</h3>
            <p class="text-xs text-gray-500 mb-3">Ação irreversível — restaura a dívida original do contrato.</p>
            <template v-if="!confirmandoCancelamento">
              <button
                @click="confirmandoCancelamento = true"
                class="w-full text-sm font-semibold text-red-600 border-2 border-red-300 hover:bg-red-50 rounded-xl py-2 transition-colors"
              >
                Cancelar acordo
              </button>
            </template>
            <template v-else>
              <div class="mb-3">
                <label class="block text-xs font-medium text-gray-700 mb-1">Motivo do cancelamento</label>
                <textarea v-model="motivoCancelamento" rows="2" placeholder="Justificativa obrigatória..."
                  class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div class="flex gap-2">
                <button @click="confirmandoCancelamento = false" class="flex-1 text-sm text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors">Voltar</button>
                <button
                  @click="cancelarAcordo"
                  :disabled="!motivoCancelamento.trim()"
                  class="flex-1 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl py-2 transition-colors disabled:opacity-40"
                >
                  Confirmar
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- VIEW ANÁLISE DA GERÊNCIA ──────────────────────────────────────────── -->
    <template v-else>
      <div class="grid xl:grid-cols-3 gap-6">

        <div class="xl:col-span-2 space-y-4">

          <!-- Contexto da decisão da Mesa -->
          <div v-if="decisaoMesaInfo" :class="{
            'bg-green-50 border-green-300': decisaoMesaInfo.tipo === 'aprovada',
            'bg-amber-50 border-amber-300': decisaoMesaInfo.tipo === 'contraproposta',
          }" class="rounded-xl border px-5 py-4">
            <div class="flex items-start gap-3">
              <div :class="{
                'bg-green-100': decisaoMesaInfo.tipo === 'aprovada',
                'bg-amber-100': decisaoMesaInfo.tipo === 'contraproposta',
              }" class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <svg v-if="decisaoMesaInfo.tipo === 'aprovada'" class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                <svg v-else class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <p class="text-sm font-semibold" :class="decisaoMesaInfo.tipo === 'aprovada' ? 'text-green-800' : 'text-amber-800'">
                    {{ decisaoMesaInfo.label }}
                  </p>
                  <span class="text-xs text-gray-400" v-if="neg.dataDecisaoMesa">{{ formatDate(neg.dataDecisaoMesa) }}</span>
                </div>
                <p class="text-xs" :class="decisaoMesaInfo.tipo === 'aprovada' ? 'text-green-700' : 'text-amber-700'">
                  {{ decisaoMesaInfo.descricao }}
                </p>
                <p v-if="neg.motivoMesa" class="text-xs text-gray-500 mt-1 italic">"{{ neg.motivoMesa }}"</p>
              </div>
              <!-- Botão atalho: usar valores da Mesa na contraproposta -->
              <button
                v-if="decisaoMesaInfo.tipo === 'contraproposta'"
                @click="decisao = 'contraproposta'; preencherComMesa()"
                class="shrink-0 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Usar valores →
              </button>
            </div>
          </div>

          <!-- Dados da proposta -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">Proposta original do cliente</h3>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><p class="text-xs text-gray-400">Protocolo</p><p class="font-mono font-semibold">{{ neg.id }}</p></div>
              <div><p class="text-xs text-gray-400">Contrato</p><p class="font-semibold">#{{ neg.contratoId }}</p></div>
              <div><p class="text-xs text-gray-400">Enviada em</p><p class="font-semibold">{{ formatDateTime(neg.dataEnvio) }}</p></div>
              <div><p class="text-xs text-gray-400">Entrada</p><p class="font-bold text-blue-700">{{ formatMoney(neg.entrada) }}</p></div>
              <div><p class="text-xs text-gray-400">Parcelas</p><p class="font-bold">{{ neg.numParcelas }}x {{ formatMoney(neg.valorParcela) }}</p></div>
              <div><p class="text-xs text-gray-400">Total proposto</p><p class="font-bold">{{ formatMoney(neg.totalAcordo) }}</p></div>
            </div>
          </div>

          <!-- Análise -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-3">
              Indicadores
              <span v-if="hasMesaCounter" class="ml-2 text-xs font-normal text-amber-600">(com valores da contraproposta da Mesa)</span>
            </h3>
            <div class="space-y-2">
              <div v-for="item in analise" :key="item.label" class="flex justify-between items-center py-1.5 border-b border-gray-50 text-sm">
                <span class="text-gray-600">{{ item.label }}</span>
                <span :class="item.alerta ? 'text-red-600 font-semibold' : 'text-gray-900 font-medium'" class="flex items-center gap-1">
                  <svg v-if="item.alerta" class="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                  {{ item.valor }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Decisão -->
        <div>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <h3 class="font-semibold text-gray-900 mb-1">Decisão da Gerência</h3>
            <p class="text-xs text-gray-400 mb-4">Esta decisão é definitiva e irrevogável</p>
            <div class="space-y-2 mb-4">
              <button
                v-for="d in [
                  { key: 'aprovar',        label: 'Aprovar',        cls: 'border-green-500 bg-green-50 text-green-700',  iconPath: 'M4.5 12.75l6 6 9-13.5' },
                  { key: 'reprovar',       label: 'Reprovar',       cls: 'border-red-500 bg-red-50 text-red-700',        iconPath: 'M6 18L18 6M6 6l12 12' },
                  { key: 'contraproposta', label: 'Contraproposta', cls: 'border-blue-500 bg-blue-50 text-blue-700',     iconPath: 'M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3' },
                ]"
                :key="d.key"
                @click="decisao = d.key"
                :class="['w-full px-3 py-3 min-h-[52px] rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center gap-1.5', decisao === d.key ? d.cls : 'border-gray-200 text-gray-600 hover:border-gray-300']"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" :d="d.iconPath"/></svg>
                {{ d.label }}
              </button>
            </div>

            <div v-if="decisao === 'reprovar'" class="mb-4">
              <label class="block text-xs font-medium text-gray-700 mb-1">Motivo da reprovação <span class="text-red-500">*</span></label>
              <textarea v-model="motivo" rows="3" placeholder="Justificativa da decisão..."
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>

            <div v-if="decisao === 'aprovar'" class="mb-4">
              <label class="block text-xs font-medium text-gray-700 mb-1">Observação (opcional)</label>
              <textarea v-model="motivo" rows="2" placeholder="Observações sobre a aprovação..."
                class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <!-- Info sobre o que será ativado -->
              <div v-if="hasMesaCounter" class="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                <strong>Nota:</strong> Ao aprovar, o acordo será ativado com os valores da contraproposta da Mesa.
              </div>
            </div>

            <!-- Campos contraproposta -->
            <div v-if="decisao === 'contraproposta'" class="space-y-3 mb-4">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Nova entrada (R$)</label>
                <input v-model="contraEntrada" type="number" placeholder="0,00"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Nº parcelas</label>
                <input v-model="contraParcelas" type="number" min="1" max="36"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div class="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                <p class="text-xs text-blue-600 mb-0.5">Valor da parcela (calculado)</p>
                <p class="font-bold text-blue-800 text-sm">{{ contraValorParc > 0 ? formatMoney(contraValorParc) : '—' }}</p>
                <p class="text-xs text-blue-400 mt-0.5">Total: {{ formatMoney(totalContraproposta) }} (entrada + {{ contraParcelas || '?' }}x)</p>
              </div>
              <div v-if="contraErro" class="rounded-lg bg-red-50 border border-red-300 px-3 py-2 text-xs text-red-700 flex items-start gap-1.5">
                <svg class="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                {{ contraErro }}
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Justificativa</label>
                <textarea v-model="motivo" rows="2" placeholder="Motivo da contraproposta para o cliente..."
                  class="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <!-- Preview impacto -->
            <div v-if="decisaoInfo" class="mb-4 rounded-lg px-3 py-2.5 text-xs" :class="{
              'bg-green-50 border border-green-200 text-green-800': decisaoInfo.cor === 'green',
              'bg-red-50 border border-red-200 text-red-800': decisaoInfo.cor === 'red',
              'bg-blue-50 border border-blue-200 text-blue-800': decisaoInfo.cor === 'blue',
            }">
              <span class="font-semibold">Próximo passo: </span>{{ decisaoInfo.texto }}
            </div>

            <button
              @click="confirmar"
              :disabled="!decisao || loading || !!contraErro"
              class="btn-primary w-full flex items-center justify-center gap-2"
            >
              <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              {{ loading ? 'Processando...' : 'Confirmar Decisão Final' }}
            </button>
          </div>
        </div>
      </div>
    </template>

  </BackofficeLayout>
</template>
