import { reactive, readonly } from 'vue'

const MOCK_USERS = {
  '123.456.789-00': { senha: 'Dock@2026', role: 'client',     nome: 'João da Silva',   cpf: '123.456.789-00' },
  '111.111.111-11': { senha: 'Dock@2026', role: 'analyst',    nome: 'Pedro Alves',     cpf: '111.111.111-11' },
  '222.222.222-22': { senha: 'Dock@2026', role: 'manager',    nome: 'Carlos Mendes',   cpf: '222.222.222-22' },
  '444.444.444-44': { senha: 'Dock@2026', role: 'attendant',  nome: 'Mariana Lima',    cpf: '444.444.444-44' },
}

const state = reactive({
  isAuthenticated: false,
  user: null,
  role: null,
})

function loadFromStorage() {
  try {
    const saved = sessionStorage.getItem('auth_portal')
    if (saved) {
      const data = JSON.parse(saved)
      state.isAuthenticated = data.isAuthenticated ?? false
      state.user = data.user ?? null
      state.role = data.role ?? null
    }
  } catch (_) { /* ignore */ }
}

function saveToStorage() {
  sessionStorage.setItem('auth_portal', JSON.stringify({
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    role: state.role,
  }))
}

loadFromStorage()

export function useAuth() {
  function login(cpf, senha) {
    const user = MOCK_USERS[cpf]
    if (user && user.senha === senha) {
      state.isAuthenticated = true
      state.user = { nome: user.nome, cpf: user.cpf }
      state.role = user.role
      saveToStorage()
      return { success: true, role: user.role }
    }
    return { success: false }
  }

  function logout() {
    state.isAuthenticated = false
    state.user = null
    state.role = null
    sessionStorage.removeItem('auth_portal')
  }

  return {
    state: readonly(state),
    login,
    logout,
  }
}
