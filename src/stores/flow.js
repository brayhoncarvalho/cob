import { reactive } from 'vue'
import initialNegotiations from '@/mocks/negotiations.json'
import initialContracts    from '@/mocks/contracts.json'
import { useRules } from '@/stores/rules.js'

const STORAGE_KEY = 'portal_flow_v2'

// ── helpers ──────────────────────────────────────────────────────────────────

function freshState() {
  return {
    negotiations: JSON.parse(JSON.stringify(initialNegotiations)),
    contracts:    JSON.parse(JSON.stringify(initialContracts)),
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    negotiations: state.negotiations,
    contracts:    state.contracts,
  }))
}

function _buildParcelas({ entrada, numParcelas, valorParcela }) {
  const parcelas = []
  const hoje = new Date()

  // Entrada via Pix — vence amanhã
  const dEnt = new Date(hoje)
  dEnt.setDate(dEnt.getDate() + 1)
  parcelas.push({ numero: 0, tipo: 'entrada', vencimento: dEnt.toISOString().split('T')[0], valor: entrada, valorAtualizado: entrada, status: 'proxima' })

  // Parcelas mensais
  for (let i = 1; i <= numParcelas; i++) {
    const d = new Date(hoje)
    d.setMonth(d.getMonth() + i)
    parcelas.push({ numero: i, tipo: 'parcela', vencimento: d.toISOString().split('T')[0], valor: valorParcela, valorAtualizado: valorParcela, status: i === 1 ? 'futura' : 'futura' })
  }
  // Primeira parcela mensal fica como proxima depois que entrada for paga
  if (parcelas[1]) parcelas[1].status = 'futura'
  return parcelas
}

// ── state ────────────────────────────────────────────────────────────────────

const state = reactive(loadState() ?? freshState())

// Sanitização de boot: garantir que contratos com acordoAtivo
// apontando para negociação cancelada/inexistente fiquem limpos
;(function _sanitize() {
  // Considera inativas: cancelada, quitado, reprovada
  const inactiveIds = new Set(
    state.negotiations
      .filter(n => ['cancelada', 'quitado', 'reprovada'].includes(n.status))
      .map(n => n.id)
  )
  // Também limpa acordoAtivo se o ID não existe mais nas negociações
  const allNegIds = new Set(state.negotiations.map(n => n.id))
  state.contracts.forEach(c => {
    const isStale = c.acordoAtivo && (inactiveIds.has(c.acordoAtivo) || !allNegIds.has(c.acordoAtivo))
    if (isStale) {
      c.acordoAtivo = null
    }
    // Recalcular status real pelas parcelas do contrato
    const parcelas = c.parcelas ?? []
    if (parcelas.length > 0) {
      const vencidas = parcelas.filter(p => p.status === 'vencida')
      if (parcelas.every(p => p.status === 'paga')) {
        c.status = 'quitado'
      } else if (c.acordoAtivo) {
        c.status = 'renegociado'
      } else if (vencidas.length > 0) {
        c.status = 'em_atraso'
        c.parcelasVencidas = vencidas.length
      } else {
        c.status = 'em_dia'
        c.parcelasVencidas = 0
      }
    }
  })
  // Corrigir negociações em_pagamento com entrada paga mas sem parcela 'proxima'
  state.negotiations
    .filter(n => n.status === 'em_pagamento' && n.entradaPaga && n.parcelas?.length > 0)
    .forEach(n => {
      const temProxima = n.parcelas.some(p => p.status === 'proxima')
      if (!temProxima) {
        const next = n.parcelas.find((p, i) => i > 0 && p.status === 'futura')
        if (next) next.status = 'proxima'
      }
    })
  persist()
})()

// ── actions ──────────────────────────────────────────────────────────────────

/**
 * Verifica bloqueios de negócio antes de criar proposta.
 * Retorna string com motivo do bloqueio ou null se ok.
 */
function _verificarBloqueio(contratoId) {
  const { rules } = useRules()

  const negsDoContrato = state.negotiations.filter(n => n.contratoId === contratoId)

  // Bloqueio por limite de tentativas
  const tentativas = negsDoContrato.filter(n =>
    ['em_analise', 'contraproposta', 'em_pagamento', 'aprovada', 'reprovada', 'cancelada', 'quitado'].includes(n.status)
  ).length
  const maxTentativas = rules.maxTentativasNegociacao ?? 3
  if (tentativas >= maxTentativas) {
    return `blocked_tentativas:${maxTentativas}`
  }

  return null
}
function submitProposal({ id, contratoId, entrada, numParcelas, valorParcela,
                          totalAcordo, desconto, proposalStatus }) {
  const bloqueio = _verificarBloqueio(contratoId)
  if (bloqueio) return { error: bloqueio }
  const isAuto = proposalStatus === 'auto'
  const nivel  = proposalStatus === 'mesa2' ? 2 : 1

  // Remove qualquer proposta aberta anterior do mesmo contrato para não poluir
  // (mantém apenas as já resolvidas)
  state.negotiations = state.negotiations.filter(n =>
    n.contratoId !== contratoId || !['em_analise', 'contraproposta'].includes(n.status)
  )

  const neg = {
    id,
    status:        isAuto ? 'em_pagamento' : 'em_analise',
    nivel:         1, // sempre começa na mesa — analista decide se escala
    contratoId,
    dataEnvio:     new Date().toISOString(),
    prazoResposta: new Date(Date.now() + 24 * 3600000).toISOString(), // 24h sempre
    entrada,
    numParcelas,
    valorParcela,
    totalAcordo,
    desconto,
    parcelas:      isAuto ? _buildParcelas({ entrada, numParcelas, valorParcela }) : null,
    ...(isAuto ? { dataAprovacao: new Date().toISOString() } : {}),
  }

  state.negotiations.unshift(neg)

  if (isAuto) {
    _activateContract(contratoId, id)
  }

  persist()
  return neg
}

/** Analista / Gerente aprova a proposta */
function approveNegotiation(id, { motivo = '' } = {}) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  neg.status        = 'em_pagamento'
  neg.dataAprovacao = new Date().toISOString()
  neg.motivoAnalise = motivo
  if (!neg.parcelas) neg.parcelas = _buildParcelas(neg)
  _activateContract(neg.contratoId, id)
  persist()
}

/** Analista / Gerente reprova a proposta */
function rejectNegotiation(id, { motivo = '' } = {}) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  neg.status = 'reprovada'
  neg.motivo = motivo
  persist()
}

/** Analista / Gerente envia contraproposta */
function counterNegotiation(id, { motivo = '', entrada, numParcelas, valorParcela }) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  const ent  = Number(entrada)     || Math.ceil(neg.entrada * 1.3)
  const np   = Number(numParcelas) || Math.ceil(neg.numParcelas * 0.7)
  const vp   = Number(valorParcela)|| Math.ceil(neg.valorParcela * 1.2)
  neg.status         = 'contraproposta'
  neg.motivo         = motivo
  neg.contraproposta = { entrada: ent, numParcelas: np, valorParcela: vp,
                         total: ent + np * vp }
  persist()
}

/** Analista escala para 2º Nível */
function escalateNegotiation(id) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  neg.nivel = 2
  persist()
}

/** Cliente aceita a contraproposta */
function acceptCounter(id) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg?.contraproposta) return
  neg.entrada      = neg.contraproposta.entrada
  neg.numParcelas  = neg.contraproposta.numParcelas
  neg.valorParcela = neg.contraproposta.valorParcela
  neg.totalAcordo  = neg.contraproposta.total
  neg.status        = 'em_pagamento'
  neg.dataAprovacao = new Date().toISOString()
  neg.parcelas      = _buildParcelas(neg)
  _activateContract(neg.contratoId, id)
  persist()
}

/** Marca uma parcela de acordo como paga */
function markParcelaPaid(negId, parcelaIdx) {
  const neg = state.negotiations.find(n => n.id === negId)
  if (!neg?.parcelas) return
  neg.parcelas[parcelaIdx].status = 'paga'
  // Seta entradaPaga quando a parcela de índice 0 (entrada) é paga
  if (parcelaIdx === 0) neg.entradaPaga = true
  // Promove próxima futura para proxima
  const next = neg.parcelas.find((p, i) => i > parcelaIdx && p.status === 'futura')
  if (next) next.status = 'proxima'

  // Verifica quitação total (todas as parcelas pagas)
  const todasPagas = neg.parcelas.every(p => p.status === 'paga')
  if (todasPagas) {
    neg.status       = 'quitado'
    neg.dataQuitacao = new Date().toISOString()
    // Limpa acordo ativo e recalcula status do contrato pelas suas próprias parcelas
    const contrato = state.contracts.find(c => c.id === neg.contratoId)
    if (contrato) {
      contrato.acordoAtivo = null
      const parcelas = contrato.parcelas ?? []
      if (parcelas.every(p => p.status === 'paga')) {
        contrato.status       = 'quitado'
        contrato.dataQuitacao = new Date().toISOString()
      } else if (parcelas.some(p => p.status === 'vencida')) {
        contrato.status = 'em_atraso'
      } else {
        contrato.status = 'em_dia'
      }
    }
  }

  persist()
}

/** Marca parcelas de um contrato como pagas (pagamento direto, não acordo) */
function payContractParcelas(contratoId, parcelaNumeros) {
  const c = state.contracts.find(c => c.id === contratoId)
  if (!c) return
  for (const num of parcelaNumeros) {
    const p = c.parcelas.find(p => p.numero === num)
    if (p && p.status !== 'paga') {
      p.status = 'paga'
      p.dataPagamento = new Date().toISOString()
    }
  }
  // Marcar entradaPaga na negociação ativa deste contrato
  const negAtiva = state.negotiations.find(n =>
    n.contratoId === contratoId && n.status === 'em_pagamento'
  )
  if (negAtiva) {
    negAtiva.entradaPaga = true
    // Marcar a parcela de entrada (índice 0) como paga no acordo
    if (negAtiva.parcelas?.length > 0 && negAtiva.parcelas[0].status !== 'paga') {
      negAtiva.parcelas[0].status = 'paga'
      negAtiva.parcelas[0].dataPagamento = new Date().toISOString()
      // Promover a próxima parcela futura para 'proxima' (igual ao markParcelaPaid)
      const next = negAtiva.parcelas.find((p, i) => i > 0 && p.status === 'futura')
      if (next) next.status = 'proxima'
    }
  }
  // Recalcular métricas do contrato
  const vencidas = c.parcelas.filter(p => p.status === 'vencida')
  c.parcelasVencidas = vencidas.length
  c.parcelasPagas = c.parcelas.filter(p => p.status === 'paga').length
  if (vencidas.length === 0) {
    c.diasAtraso = 0
    if (c.parcelas.every(p => p.status === 'paga')) {
      c.status = 'quitado'
    } else {
      c.status = 'em_dia'
    }
  }
  // Promover próxima parcela
  const proxima = c.parcelas.find(p => p.status === 'futura')
  if (proxima && !c.parcelas.some(p => p.status === 'proxima')) {
    proxima.status = 'proxima'
  }
  persist()
}

/** Reseta tudo para o estado inicial dos JSONs */
function resetFlow() {
  const fresh = freshState()
  state.negotiations.splice(0, state.negotiations.length, ...fresh.negotiations)
  state.contracts.splice(0, state.contracts.length, ...fresh.contracts)
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Atendente simula proposta em nome do cliente.
 * Se auto-aprovável → status em_pagamento direto.
 * Se não → status em_analise (vai para mesa de crédito).
 */
function submitAttendantProposal({ id, contratoId, clienteCpf, entrada, numParcelas, valorParcela,
                                   totalAcordo, desconto, atendenteCpf, proposalStatus }) {
  const bloqueio = _verificarBloqueio(contratoId)
  if (bloqueio) return { error: bloqueio }

  const isAuto = proposalStatus === 'auto'

  state.negotiations = state.negotiations.filter(n =>
    n.contratoId !== contratoId || !['em_analise', 'contraproposta', 'pending_client_approval'].includes(n.status)
  )
  const neg = {
    id,
    status:              isAuto ? 'em_pagamento' : 'em_analise',
    nivel:               isAuto ? 0 : 1,
    contratoId,
    clienteCpf,
    simuladoPorAtendente: atendenteCpf,
    dataEnvio:           new Date().toISOString(),
    dataAprovacao:       isAuto ? new Date().toISOString() : null,
    prazoResposta:       new Date(Date.now() + 48 * 3600000).toISOString(),
    entrada:             Number(entrada),
    numParcelas:         Number(numParcelas),
    valorParcela:        Number(valorParcela),
    totalAcordo:         Number(totalAcordo),
    desconto:            Number(desconto),
    parcelas:            isAuto ? _buildParcelas({ entrada: Number(entrada), numParcelas: Number(numParcelas), valorParcela: Number(valorParcela) }) : null,
  }
  state.negotiations.push(neg)
  if (isAuto) _activateContract(contratoId, id)
  persist()
  return neg
}

/** Cliente aprova proposta sugerida pelo atendente */
function clientApproveProposal(id) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  // Segue o fluxo normal: vai para análise (mesa) ou auto-aprovação baseada nas regras
  // Por simplicidade no demo: vai para em_pagamento direto (acordo iniciado)
  neg.status        = 'em_pagamento'
  neg.dataAprovacao = new Date().toISOString()
  neg.parcelas      = _buildParcelas(neg)
  _activateContract(neg.contratoId, id)
  persist()
}

/** Cliente rejeita proposta sugerida pelo atendente */
function clientRejectProposal(id) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  neg.status = 'cancelada'
  persist()
}

/** Cliente cancela proposta que ainda está em análise */
function clientCancelNegotiation(id) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg || !['em_analise', 'contraproposta', 'em_pagamento'].includes(neg.status)) return
  neg.status = 'cancelada'
  neg.dataCancelamento = new Date().toISOString()
  _deactivateContract(neg.contratoId)
  persist()
}

/** Atendente cancela proposta pendente de aprovação do cliente */
function cancelAttendantProposal(id) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  neg.status = 'cancelada'
  neg.dataCancelamento = new Date().toISOString()
  _deactivateContract(neg.contratoId)
  persist()
}

// ── private ───────────────────────────────────────────────────────────────────

function _activateContract(contratoId, negId) {
  const c = state.contracts.find(c => c.id === contratoId)
  if (!c) return
  c.status     = 'renegociado'
  c.acordoAtivo = negId
  // Zera parcelas vencidas (acordo congela o débito)
  c.parcelasVencidas = 0
}

function _deactivateContract(contratoId) {
  const c = state.contracts.find(c => c.id === contratoId)
  if (!c) return
  c.acordoAtivo = null
  // Recalcular parcelas vencidas reais
  const vencidas = c.parcelas.filter(p => p.status === 'vencida')
  c.parcelasVencidas = vencidas.length
  if (vencidas.length > 0) {
    c.status = 'em_atraso'
  } else if (c.parcelas.every(p => p.status === 'paga')) {
    c.status = 'quitado'
  } else {
    c.status = 'em_dia'
  }
}

// ── export ────────────────────────────────────────────────────────────────────

export function useFlow() {
  return {
    state,
    submitProposal,
    approveNegotiation,
    rejectNegotiation,
    counterNegotiation,
    escalateNegotiation,
    acceptCounter,
    markParcelaPaid,
    payContractParcelas,
    resetFlow,
    submitAttendantProposal,
    clientApproveProposal,
    clientRejectProposal,
    cancelAttendantProposal,
    clientCancelNegotiation,
  }
}
