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
  // Corrigir negociações sem totalDivida (dados antigos no localStorage)
  state.negotiations
    .filter(n => !n.totalDivida)
    .forEach(n => {
      const c = state.contracts.find(c => c.id === n.contratoId)
      if (c) n.totalDivida = c.saldoDevedor
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

  // Remove qualquer proposta aberta anterior do mesmo contrato para não poluir
  // (mantém apenas as já resolvidas)
  state.negotiations = state.negotiations.filter(n =>
    n.contratoId !== contratoId || !['em_analise', 'contraproposta'].includes(n.status)
  )

  const neg = {
    id,
    status:        isAuto ? 'em_pagamento' : 'em_analise',
    nivel:         1, // sempre começa na Mesa (nível 1)
    contratoId,
    dataEnvio:     new Date().toISOString(),
    prazoResposta: new Date(Date.now() + 24 * 3600000).toISOString(),
    entrada,
    numParcelas,
    valorParcela,
    totalAcordo,
    totalDivida:   state.contracts.find(c => c.id === contratoId)?.saldoDevedor ?? 0,
    desconto,
    parcelas:      isAuto ? _buildParcelas({ entrada, numParcelas, valorParcela }) : null,
    // Campos de histórico do fluxo de aprovação dupla
    decisaoMesa:         null,
    motivoMesa:          null,
    dataDecisaoMesa:     null,
    contrapropostaMesa:  null,
    dataDecisaoGerencia: null,
    ...(isAuto ? { dataAprovacao: new Date().toISOString() } : {}),
  }

  state.negotiations.unshift(neg)

  if (isAuto) {
    _activateContract(contratoId, id)
  }

  persist()
  return neg
}

/**
 * Mesa (nível 1) ou Gerência (nível 2) aprova a proposta.
 *
 * - Mesa aprova: registra decisão, sobe para nível 2 (Gerência). NÃO ativa o contrato.
 * - Gerência aprova: ativa o contrato (em_pagamento). Palavra final.
 *   Se havia contraproposta da Mesa, usa os valores dela ao ativar.
 */
function approveNegotiation(id, { motivo = '' } = {}) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return

  const nivelAtual = neg.nivel ?? 1

  if (nivelAtual === 1) {
    // Mesa aprova → encaminha para Gerência
    neg.decisaoMesa     = 'aprovada'
    neg.motivoMesa      = motivo
    neg.dataDecisaoMesa = new Date().toISOString()
    neg.nivel           = 2
    // Mantém status em_analise — não ativa o contrato
  } else {
    // Gerência aprova → ativa o acordo (palavra final)
    // Se a Mesa tinha feito contraproposta, ativar com os valores aprovados pela Mesa
    if (neg.contrapropostaMesa) {
      neg.entrada      = neg.contrapropostaMesa.entrada
      neg.numParcelas  = neg.contrapropostaMesa.numParcelas
      neg.valorParcela = neg.contrapropostaMesa.valorParcela
      neg.totalAcordo  = neg.contrapropostaMesa.total
    }
    neg.status              = 'em_pagamento'
    neg.dataAprovacao       = new Date().toISOString()
    neg.dataDecisaoGerencia = new Date().toISOString()
    neg.motivoGerencia      = motivo
    if (!neg.parcelas) neg.parcelas = _buildParcelas(neg)
    _activateContract(neg.contratoId, id)
  }

  persist()
}

/**
 * Mesa (nível 1) ou Gerência (nível 2) reprova a proposta.
 * Ambos finalizam direto — Mesa não precisa passar pela Gerência para reprovar.
 */
function rejectNegotiation(id, { motivo = '' } = {}) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return
  const nivelAtual = neg.nivel ?? 1
  if (nivelAtual === 1) {
    // Mesa reprova → finaliza sem passar pela Gerência
    neg.decisaoMesa     = 'reprovada'
    neg.motivoMesa      = motivo
    neg.dataDecisaoMesa = new Date().toISOString()
  } else {
    // Gerência reprova → finaliza
    neg.dataDecisaoGerencia = new Date().toISOString()
    neg.motivoGerencia      = motivo
  }
  neg.status = 'reprovada'
  neg.motivo = motivo
  persist()
}

/**
 * Mesa (nível 1) ou Gerência (nível 2) envia contraproposta.
 *
 * - Mesa: salva em contrapropostaMesa, sobe para nível 2. Gerência valida.
 * - Gerência: salva em contraproposta → cliente responde. Palavra final.
 */
function counterNegotiation(id, { motivo = '', entrada, numParcelas, valorParcela }) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg) return

  const nivelAtual = neg.nivel ?? 1
  const ent = Number(entrada)      || Math.ceil(neg.entrada * 1.3)
  const np  = Number(numParcelas)  || Math.ceil(neg.numParcelas * 0.7)
  const vp  = Number(valorParcela) || Math.ceil(neg.valorParcela * 1.2)

  if (nivelAtual === 1) {
    // Mesa faz contraproposta → encaminha para Gerência validar
    neg.decisaoMesa        = 'contraproposta'
    neg.motivoMesa         = motivo
    neg.dataDecisaoMesa    = new Date().toISOString()
    neg.contrapropostaMesa = { entrada: ent, numParcelas: np, valorParcela: vp, total: ent + np * vp }
    neg.nivel              = 2
    // Mantém status em_analise — não notifica cliente ainda
  } else {
    // Gerência faz contraproposta → vai para cliente (palavra final)
    neg.status              = 'contraproposta'
    neg.motivo              = motivo
    neg.dataDecisaoGerencia = new Date().toISOString()
    neg.contraproposta      = { entrada: ent, numParcelas: np, valorParcela: vp, total: ent + np * vp }
  }

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
  neg.parcelas[parcelaIdx].dataPagamento = new Date().toISOString()
  // Seta entradaPaga quando a parcela de índice 0 (entrada) é paga
  if (parcelaIdx === 0) neg.entradaPaga = true
  // Garante exatamente uma proxima: reseta eventuais extras, depois promove o próximo futura
  neg.parcelas.forEach(p => { if (p.status === 'proxima') p.status = 'futura' })
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

  // Subtrai do saldo apenas o que foi efetivamente pago (evita recalcular do zero
  // com valorAtualizado das futuras, que difere do saldoDevedor original do contrato)
  let pago = 0
  for (const num of parcelaNumeros) {
    const p = c.parcelas.find(p => p.numero === num)
    if (p && p.status !== 'paga') {
      pago += p.valorAtualizado ?? p.valor ?? 0
      p.status = 'paga'
      p.dataPagamento = new Date().toISOString()
    }
  }
  c.saldoDevedor = Math.max(0, (c.saldoDevedor ?? 0) - pago)

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
 * Se não → status em_analise (vai para Mesa de crédito).
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
    totalDivida:         state.contracts.find(c => c.id === contratoId)?.saldoDevedor ?? 0,
    desconto:            Number(desconto),
    parcelas:            isAuto ? _buildParcelas({ entrada: Number(entrada), numParcelas: Number(numParcelas), valorParcela: Number(valorParcela) }) : null,
    // Campos de histórico do fluxo de aprovação dupla
    decisaoMesa:         null,
    motivoMesa:          null,
    dataDecisaoMesa:     null,
    contrapropostaMesa:  null,
    dataDecisaoGerencia: null,
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
  neg.dataCancelamento = new Date().toISOString()
  neg.canceladoPor = 'cliente'
  persist()
}

/** Cliente cancela proposta — apenas enquanto ainda não virou acordo ativo */
function clientCancelNegotiation(id) {
  const neg = state.negotiations.find(n => n.id === id)
  const cancellable =
    ['em_analise', 'contraproposta'].includes(neg?.status) ||
    (neg?.status === 'em_pagamento' && !neg.entradaPaga)
  if (!neg || !cancellable) return
  neg.status = 'cancelada'
  neg.dataCancelamento = new Date().toISOString()
  neg.canceladoPor = 'cliente'
  _deactivateContract(neg.contratoId)
  persist()
}

/**
 * Atendente cancela proposta — apenas enquanto ainda não virou acordo ativo.
 */
function cancelAttendantProposal(id) {
  const neg = state.negotiations.find(n => n.id === id)
  const cancellable =
    ['em_analise', 'contraproposta'].includes(neg?.status) ||
    (neg?.status === 'em_pagamento' && !neg.entradaPaga)
  if (!neg || !cancellable) return
  neg.status = 'cancelada'
  neg.dataCancelamento = new Date().toISOString()
  neg.canceladoPor = 'atendente'
  _deactivateContract(neg.contratoId)
  persist()
}

/**
 * Gerente cancela acordo — ação excepcional, pode cancelar qualquer estado não finalizado.
 */
function managerCancelNegotiation(id, { motivo = '' } = {}) {
  const neg = state.negotiations.find(n => n.id === id)
  if (!neg || ['cancelada', 'quitado', 'reprovada'].includes(neg.status)) return
  neg.status = 'cancelada'
  neg.dataCancelamento = new Date().toISOString()
  neg.canceladoPor = 'gerente'
  if (motivo) neg.motivoCancelamento = motivo
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
    acceptCounter,
    markParcelaPaid,
    payContractParcelas,
    resetFlow,
    submitAttendantProposal,
    clientApproveProposal,
    clientRejectProposal,
    cancelAttendantProposal,
    clientCancelNegotiation,
    managerCancelNegotiation,
  }
}
