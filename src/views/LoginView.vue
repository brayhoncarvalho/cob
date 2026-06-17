<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth.js'

const baseUrl = import.meta.env.BASE_URL

const router  = useRouter()
const { login } = useAuth()

const cpf        = ref('')
const senha      = ref('')
const errorMsg   = ref('')
const loading    = ref(false)
const showSenha  = ref(false)

// CPF mask
function onCpfInput(e) {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
  v = v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  cpf.value = v
}

const canSubmit = computed(() => cpf.value.length === 14 && senha.value.length >= 6)

const DEMO_USERS = [
  { label: 'CLIENTE', labelClass: 'bg-blue-500/20 text-blue-300', nome: 'João da Silva', cpf: '123.456.789-00', senha: '123456' },
  { label: 'MESA 1',  labelClass: 'bg-amber-500/20 text-amber-300', nome: 'Pedro Alves',   cpf: '111.111.111-11', senha: '123456' },
  { label: 'GERENTE', labelClass: 'bg-purple-500/20 text-purple-300', nome: 'Carlos Mendes', cpf: '222.222.222-22', senha: '123456' },
]

const activeDemo = ref(null)

function fillCredentials(user) {
  cpf.value   = user.cpf
  senha.value = user.senha
  activeDemo.value = user.cpf
  errorMsg.value = ''
}

async function handleLogin() {
  if (!canSubmit.value) return
  loading.value = true
  errorMsg.value = ''

  // Simula latência de rede
  await new Promise(r => setTimeout(r, 700))

  const result = login(cpf.value, senha.value)

  if (result.success) {
    if (result.role === 'client')  router.push('/dashboard')
    else if (result.role === 'analyst') router.push('/backoffice/fila')
    else if (result.role === 'manager') router.push('/backoffice/gerente')
  } else {
    errorMsg.value = 'CPF ou senha incorretos. Verifique e tente novamente.'
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">

      <!-- Logo -->
      <div class="text-center mb-8">
        <img :src="baseUrl + 'dock.png'" alt="Logo" class="h-12 mx-auto mb-4" />
        <h1 class="text-2xl font-bold text-gray-900">Portal de Negociação</h1>
        <p class="text-gray-500 text-sm mt-1">Acesse sua área segura</p>
      </div>

      <!-- Card -->
      <div class="card shadow-lg">
        <form @submit.prevent="handleLogin" class="space-y-5">

          <!-- CPF -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">CPF</label>
            <input
              :value="cpf"
              @input="onCpfInput"
              type="text"
              inputmode="numeric"
              placeholder="000.000.000-00"
              class="input-field"
              autocomplete="username"
              maxlength="14"
            />
          </div>

          <!-- Senha -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
            <div class="relative">
              <input
                v-model="senha"
                :type="showSenha ? 'text' : 'password'"
                placeholder="••••••••"
                class="input-field pr-12"
                autocomplete="current-password"
                maxlength="20"
              />
              <button
                type="button"
                @click="showSenha = !showSenha"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg v-if="!showSenha" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Erro -->
          <div v-if="errorMsg" class="alert-danger text-sm">
            {{ errorMsg }}
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="!canSubmit || loading"
            class="btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>

          <!-- Links -->
          <div class="text-center space-y-1">
            <button type="button" class="text-sm text-blue-600 hover:underline block w-full">
              Esqueci minha senha
            </button>
            <button type="button" class="text-sm text-gray-500 hover:underline block w-full">
              Primeiro acesso
            </button>
          </div>
        </form>
      </div>

      <!-- Hint de demo -->
      <div class="mt-6 bg-gray-800/90 rounded-xl px-4 py-3 text-xs space-y-2">
        <p class="font-semibold text-gray-300 mb-1">Credenciais de demo — clique para preencher</p>
        <div class="space-y-1.5">
          <button
            v-for="u in DEMO_USERS"
            :key="u.cpf"
            type="button"
            @click="fillCredentials(u)"
            class="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors text-left"
            :class="activeDemo === u.cpf ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'"
          >
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0" :class="u.labelClass">{{ u.label }}</span>
            <span class="text-gray-300 font-medium">{{ u.nome }}</span>
            <svg v-if="activeDemo === u.cpf" class="ml-auto w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            <svg v-else class="ml-auto w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15"/><path stroke-linecap="round" stroke-linejoin="round" d="M18 12H9m0 0l3-3m-3 3l3 3"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
