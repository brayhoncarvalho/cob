<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AttendanceLayout from '@/layouts/AttendanceLayout.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'

const router = useRouter()
const { formatMoney } = useFormatters()
const { state: flowState } = useFlow()

// ── Base de clientes (mock) ───────────────────────────────────────────────────
const CLIENTES_BASE = [
  { cpf: '123.456.789-00', nome: 'João da Silva',    telefone: '(63) 95448-9531' },
  { cpf: '321.654.987-00', nome: 'Maria Aparecida',  telefone: '(11) 98765-4321' },
  { cpf: '456.789.123-00', nome: 'Carlos Ferreira',  telefone: '(21) 97654-3210' },
  { cpf: '789.123.456-00', nome: 'Fernanda Rocha',   telefone: '(47) 96543-2109' },
  { cpf: '147.258.369-00', nome: 'Roberto Mendes',   telefone: '(51) 95432-1098' },
]

// Enriquecer clientes com dados de contratos e negociações
const clientesBase = computed(() =>
  CLIENTES_BASE.map(c => {
    // No demo real o CPF do João é o único com dados — os demais ficam sem pendências
    const isJoao = c.cpf === '123.456.789-00'
    const negociacoes = isJoao
      ? flowState.negotiations
      : flowState.negotiations.filter(n => n.clienteCpf === c.cpf)

    const contratos = isJoao
      ? flowState.contracts
      : []

    const emAtraso       = contratos.filter(ct => ct.status === 'em_atraso').length
    const pendingApproval = negociacoes.filter(n => n.status === 'pending_client_approval').length
    const acordoAtivo     = negociacoes.filter(n => n.status === 'em_pagamento').length
    const emAnalise       = negociacoes.filter(n => n.status === 'em_analise').length

    // Urgência: 0=ok, 1=em análise, 2=em atraso, 3=aguardando aprovação
    const urgencia = pendingApproval > 0 ? 3 : emAtraso > 0 ? 2 : emAnalise > 0 ? 1 : 0

    return {
      ...c,
      totalContratos: contratos.length,
      emAtraso,
      pendingApproval,
      acordoAtivo,
      emAnalise,
      urgencia,
    }
  })
)

// ── Busca ─────────────────────────────────────────────────────────────────────
const busca = ref('')
const filtroAtivo = ref('todos') // 'todos' | 'pendente' | 'atraso' | 'acordo'

const FILTROS = [
  { key: 'todos',    label: 'Todos',               cor: 'gray' },
  { key: 'pendente', label: 'Aguardando aprovação', cor: 'purple' },
  { key: 'atraso',   label: 'Em atraso',            cor: 'red' },
  { key: 'acordo',   label: 'Acordo ativo',         cor: 'teal' },
]

const clientesFiltrados = computed(() => {
  const termo = busca.value.trim().toLowerCase()

  let lista = clientesBase.value

  // Filtro por categoria
  if (filtroAtivo.value === 'pendente') lista = lista.filter(c => c.pendingApproval > 0)
  else if (filtroAtivo.value === 'atraso') lista = lista.filter(c => c.emAtraso > 0)
  else if (filtroAtivo.value === 'acordo') lista = lista.filter(c => c.acordoAtivo > 0)

  // Busca textual (nome, CPF)
  if (termo) {
    lista = lista.filter(c =>
      c.nome.toLowerCase().includes(termo) ||
      c.cpf.replace(/\D/g, '').includes(termo.replace(/\D/g, ''))
    )
  }

  // Ordenar por urgência desc, depois nome asc
  return [...lista].sort((a, b) => {
    if (b.urgencia !== a.urgencia) return b.urgencia - a.urgencia
    return a.nome.localeCompare(b.nome)
  })
})

// ── Métricas (clicáveis como filtros) ─────────────────────────────────────────
const metricas = computed(() => [
  {
    key:   'todos',
    label: 'Total de clientes',
    valor: clientesBase.value.length,
    cor:   'blue',
    icon:  'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  },
  {
    key:   'pendente',
    label: 'Aguardando aprovação',
    valor: clientesBase.value.filter(c => c.pendingApproval > 0).length,
    cor:   'purple',
    icon:  'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  },
  {
    key:   'atraso',
    label: 'Contratos em atraso',
    valor: clientesBase.value.filter(c => c.emAtraso > 0).length,
    cor:   'red',
    icon:  'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  },
  {
    key:   'acordo',
    label: 'Acordos ativos',
    valor: clientesBase.value.filter(c => c.acordoAtivo > 0).length,
    cor:   'green',
    icon:  'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
])

// Urgência → config visual
const URGENCIA_CONFIG = {
  3: { border: 'border-l-4 border-amber-400', badge: 'bg-amber-100 text-amber-700', texto: 'Aguardando aprovação', dot: 'bg-amber-400 animate-pulse' },
  2: { border: 'border-l-4 border-red-400',    badge: 'bg-red-100 text-red-700',    texto: 'Contrato em atraso',     dot: 'bg-red-400' },
  1: { border: 'border-l-4 border-amber-300',  badge: 'bg-amber-100 text-amber-700', texto: 'Proposta em análise',    dot: 'bg-amber-400' },
  0: { border: '',                              badge: '',                             texto: '',                       dot: 'bg-gray-300' },
}

const COR_METRICA = {
  blue:   { bg: 'bg-blue-50 hover:bg-blue-100',   text: 'text-blue-700',   ring: 'ring-blue-400',   ativo: 'bg-blue-600 text-white' },
  purple: { bg: 'bg-amber-50 hover:bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-400', ativo: 'bg-amber-600 text-white' },
  red:    { bg: 'bg-red-50 hover:bg-red-100',     text: 'text-red-700',    ring: 'ring-red-400',    ativo: 'bg-red-600 text-white' },
  green:  { bg: 'bg-green-50 hover:bg-green-100', text: 'text-green-700',  ring: 'ring-green-400',  ativo: 'bg-green-600 text-white' },
}

function toggleFiltro(key) {
  filtroAtivo.value = filtroAtivo.value === key ? 'todos' : key
}

function iniciarAtendimento(clienteId) {
  router.push(`/atendimento/cliente/${clienteId}/negociar`)
}

function initials(nome) {
  const parts = nome.trim().split(' ')
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}
</script>

<template>
  <AttendanceLayout title="">

    <!-- ── Métricas clicáveis ──────────────────────────────────────────── -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <button
        v-for="m in metricas"
        :key="m.key"
        type="button"
        @click="toggleFiltro(m.key)"
        class="rounded-xl p-4 text-left transition-all border-2"
        :class="filtroAtivo === m.key
          ? [COR_METRICA[m.cor].ativo, 'border-transparent shadow-md scale-[1.01]']
          : [COR_METRICA[m.cor].bg, 'border-transparent', 'hover:shadow-sm']"
      >
        <div class="flex items-start justify-between mb-2">
          <p class="text-2xl font-bold" :class="filtroAtivo === m.key ? 'text-white' : COR_METRICA[m.cor].text">{{ m.valor }}</p>
          <svg
            class="w-5 h-5 shrink-0"
            :class="filtroAtivo === m.key ? 'text-white/70' : COR_METRICA[m.cor].text + '/60'"
            fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" :d="m.icon"/>
          </svg>
        </div>
        <p class="text-xs leading-tight" :class="filtroAtivo === m.key ? 'text-white/80' : 'text-gray-500'">{{ m.label }}</p>
      </button>
    </div>

    <!-- ── Barra de busca + filtros rápidos ───────────────────────────── -->
    <div class="card mb-5 !p-4">
      <!-- Campo de busca -->
      <div class="relative mb-3">
        <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
        </svg>
        <input
          v-model="busca"
          type="search"
          placeholder="Buscar por nome ou CPF…"
          class="input-field pl-11 pr-10 text-base"
          aria-label="Buscar cliente"
        />
        <button
          v-if="busca"
          type="button"
          @click="busca = ''"
          class="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Limpar busca"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Chips de filtro rápido -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="f in FILTROS"
          :key="f.key"
          type="button"
          @click="toggleFiltro(f.key)"
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border"
          :class="filtroAtivo === f.key
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800'"
        >
          <span
            v-if="f.key !== 'todos'"
            class="w-1.5 h-1.5 rounded-full"
            :class="{
              'bg-amber-500': f.key === 'pendente',
              'bg-red-500':    f.key === 'atraso',
              'bg-blue-500':   f.key === 'acordo',
            }"
          />
          {{ f.label }}
          <span
            v-if="f.key !== 'todos'"
            class="ml-0.5 tabular-nums"
          >
            ({{ metricas.find(m => m.key === f.key)?.valor ?? 0 }})
          </span>
        </button>
      </div>
    </div>

    <!-- ── Lista de clientes ───────────────────────────────────────────── -->
    <div class="space-y-2">

      <!-- Contador de resultados -->
      <div class="flex items-center justify-between mb-3">
        <p class="text-sm text-gray-500">
          <span class="font-semibold text-gray-900">{{ clientesFiltrados.length }}</span>
          cliente{{ clientesFiltrados.length !== 1 ? 's' : '' }}
          <span v-if="busca"> para "<span class="font-medium text-gray-800">{{ busca }}</span>"</span>
          <span v-if="filtroAtivo !== 'todos'"> · filtro ativo</span>
        </p>
        <p class="text-xs text-gray-400">Ordenado por urgência</p>
      </div>

      <!-- Empty state de busca -->
      <div v-if="clientesFiltrados.length === 0" class="card text-center py-12">
        <svg class="w-10 h-10 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
        </svg>
        <p class="text-gray-500 font-medium">Nenhum cliente encontrado</p>
        <p class="text-xs text-gray-400 mt-1">
          <span v-if="busca">Verifique o nome ou CPF digitado.</span>
          <span v-else>Nenhum cliente com este filtro.</span>
        </p>
        <button
          type="button"
          @click="busca = ''; filtroAtivo = 'todos'"
          class="mt-3 text-sm text-blue-600 hover:underline"
        >Limpar filtros</button>
      </div>

      <!-- Cards de cliente -->
      <div
        v-for="c in clientesFiltrados"
        :key="c.cpf"
        class="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
        :class="URGENCIA_CONFIG[c.urgencia].border"
      >
        <div class="flex items-center gap-4 p-4">

          <!-- Avatar com indicador de urgência -->
          <div class="relative shrink-0">
            <div class="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              {{ initials(c.nome) }}
            </div>
            <span
              v-if="c.urgencia > 0"
              class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white"
              :class="URGENCIA_CONFIG[c.urgencia].dot"
            />
          </div>

          <!-- Info do cliente -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-semibold text-gray-900 leading-tight">{{ c.nome }}</p>
              <!-- Badge de urgência -->
              <span
                v-if="c.urgencia > 0"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="URGENCIA_CONFIG[c.urgencia].badge"
              >{{ URGENCIA_CONFIG[c.urgencia].texto }}</span>
              <!-- Badge demo: clientes sem atividade real -->
              <span
                v-if="c.totalContratos === 0 && c.urgencia === 0"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-400 border border-dashed border-gray-300"
              >Demo</span>
            </div>

            <p class="text-xs text-gray-400 font-mono mt-0.5">{{ c.cpf }}</p>

            <!-- Chips de status rápido -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              <span v-if="c.totalContratos > 0" class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {{ c.totalContratos }} contrato{{ c.totalContratos !== 1 ? 's' : '' }}
              </span>
              <span v-if="c.emAtraso > 0" class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {{ c.emAtraso }} em atraso
              </span>
              <span v-if="c.pendingApproval > 0" class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {{ c.pendingApproval }} aguard. aprovação
              </span>
              <span v-if="c.acordoAtivo > 0" class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {{ c.acordoAtivo }} acordo ativo
              </span>
              <span v-if="c.emAnalise > 0" class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {{ c.emAnalise }} em análise
              </span>
            </div>
          </div>

          <!-- Ações -->
          <div class="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-2">
            <!-- Proposta pendente: mostra botão de acompanhamento, bloqueia nova simulação -->
            <button
              v-if="c.pendingApproval > 0"
              @click="iniciarAtendimento(c.cpf)"
              class="text-sm py-2 px-4 whitespace-nowrap rounded-lg border-2 border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-colors flex items-center gap-1.5"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.573-3.007-9.964-7.178z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Ver proposta
            </button>
            <!-- Sem proposta pendente: atendimento normal -->
            <button
              v-else
              @click="iniciarAtendimento(c.cpf)"
              class="btn-primary text-sm py-2 px-4 whitespace-nowrap"
            >
              Atender
            </button>
          </div>
        </div>
      </div>

    </div>
    <div class="h-8" />
  </AttendanceLayout>
</template>
