import { reactive, readonly } from 'vue'

const state = reactive({
  // Proposta montada no simulador
  proposal: null,
  // Resultado retornado (auto | mesa1 | mesa2 | blocked | contraproposta)
  result: null,
  // Dados do contrato no momento da negociação
  contractSnapshot: null,
})

export function useProposal() {
  function setProposal(p) {
    state.proposal = { ...p }
  }

  function setResult(r) {
    state.result = { ...r }
  }

  function setContractSnapshot(c) {
    state.contractSnapshot = { ...c }
  }

  function clear() {
    state.proposal = null
    state.result = null
    state.contractSnapshot = null
  }

  return {
    state: readonly(state),
    setProposal,
    setResult,
    setContractSnapshot,
    clear,
  }
}
