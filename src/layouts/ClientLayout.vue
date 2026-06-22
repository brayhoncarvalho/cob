<script setup>
import { computed, ref } from 'vue'
import { useAuth } from '@/stores/auth.js'
import { useRouter } from 'vue-router'
import { useFlow } from '@/stores/flow.js'
import { useRules } from '@/stores/rules.js'
import { useProposal } from '@/stores/proposal.js'

const { state, logout } = useAuth()
const router = useRouter()
const baseUrl = import.meta.env.BASE_URL
const { resetFlow } = useFlow()
const { resetRules } = useRules()
const { clear: clearProposal } = useProposal()

const userInitials = computed(() => {
  const nome = state.user?.nome || ''
  const parts = nome.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return nome.slice(0, 2).toUpperCase()
})

const showDropdown = ref(false)

function handleLogout() {
  showDropdown.value = false
  logout()
  router.push('/login')
}

function handleReset() {
  showDropdown.value = false
  resetFlow()
  resetRules()
  clearProposal()
  router.push('/dashboard')
}

defineProps({
  backTo:    { type: String, default: null },
  backLabel: { type: String, default: 'Voltar' },
  title:     { type: String, default: '' },
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-blue-600 sticky top-0 z-40">
      <div class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <!-- Logo + Nav -->
        <div class="flex items-center gap-6">
          <RouterLink to="/dashboard" class="flex items-center gap-2 shrink-0">
            <img :src="baseUrl + 'dock.png'" alt="Logo" class="h-8 w-auto brightness-0 invert" />
          </RouterLink>
          <nav class="hidden sm:flex items-center gap-0.5">
            <!-- Início -->
            <RouterLink
              to="/dashboard"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-700/60 transition-colors"
              active-class="!text-white bg-blue-700/60"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              Início
            </RouterLink>
            <!-- Contratos -->
            <RouterLink
              to="/contratos"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-700/60 transition-colors"
              active-class="!text-white bg-blue-700/60"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Contratos
            </RouterLink>
            <!-- Negociações -->
            <RouterLink
              to="/negociacoes"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-700/60 transition-colors"
              active-class="!text-white bg-blue-700/60"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              Negociações
            </RouterLink>
            <!-- Pagamentos -->
            <RouterLink
              to="/pagamentos"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:text-white hover:bg-blue-700/60 transition-colors"
              active-class="!text-white bg-blue-700/60"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/>
              </svg>
              Pagamentos
            </RouterLink>
          </nav>
        </div>

        <!-- Usuário -->
        <div class="flex items-center gap-2">
          <div class="relative">
            <button
              @click="showDropdown = !showDropdown"
              class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-blue-700/60 transition-colors"
            >
              <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span class="text-xs font-bold text-blue-600 leading-none">{{ userInitials }}</span>
              </div>
              <span class="hidden sm:block text-sm font-medium text-white">
                {{ state.user?.nome?.split(' ')[0] }}
              </span>
              <svg class="hidden sm:block w-3.5 h-3.5 text-blue-100" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>

            <!-- Dropdown -->
            <div
              v-if="showDropdown"
              class="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
              @click.stop
            >
              <div class="px-4 py-2 border-b border-gray-100">
                <p class="text-sm font-semibold text-gray-900">{{ state.user?.nome }}</p>
                <p class="text-xs text-gray-400">Cliente</p>
              </div>
              <button
                @click="handleLogout"
                class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                Sair
              </button>
              <button
                @click="handleReset"
                class="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:bg-gray-50 transition-colors border-t border-gray-100 mt-1"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
                Resetar fluxo (demo)
              </button>
            </div>
          </div>

          <!-- Overlay para fechar dropdown -->
          <div v-if="showDropdown" class="fixed inset-0 z-40" @click="showDropdown = false" />
        </div>
      </div>
    </header>

    <!-- Page header with back button -->
    <div v-if="backTo || title" class="bg-white border-b border-gray-100">
      <div class="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
        <RouterLink
          v-if="backTo"
          :to="backTo"
          class="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          {{ backLabel }}
        </RouterLink>
        <span v-if="backTo && title" class="text-gray-400">/</span>
        <h1 v-if="title" class="text-lg font-semibold text-gray-900">{{ title }}</h1>
      </div>
    </div>

    <!-- Content -->
    <main class="max-w-5xl mx-auto px-4 py-8">
      <slot />
    </main>

    <!-- Mobile bottom nav -->
    <nav class="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40">
      <div class="flex">
        <RouterLink
          to="/dashboard"
          class="flex-1 flex flex-col items-center py-2.5 text-gray-400 transition-colors"
          active-class="text-blue-600"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span class="text-xs mt-0.5 font-medium">Início</span>
        </RouterLink>
        <RouterLink
          to="/contratos"
          class="flex-1 flex flex-col items-center py-2.5 text-gray-400 transition-colors"
          active-class="text-blue-600"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span class="text-xs mt-0.5 font-medium">Contratos</span>
        </RouterLink>
        <RouterLink
          to="/negociacoes"
          class="flex-1 flex flex-col items-center py-2.5 text-gray-400 transition-colors"
          active-class="text-blue-600"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span class="text-xs mt-0.5 font-medium">Negociações</span>
        </RouterLink>
        <RouterLink
          to="/pagamentos"
          class="flex-1 flex flex-col items-center py-2.5 text-gray-400 transition-colors"
          active-class="text-blue-600"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/>
          </svg>
          <span class="text-xs mt-0.5 font-medium">Pagamentos</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
