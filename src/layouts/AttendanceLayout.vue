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
  router.push('/atendimento')
}

defineProps({
  backTo: { type: String, default: null },
  backLabel: { type: String, default: 'Voltar' },
  title: { type: String, default: '' },
})
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Header -->
    <header class="bg-blue-700 text-white sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <RouterLink to="/atendimento" class="flex items-center gap-2">
            <img :src="baseUrl + 'dock.png'" alt="Logo" class="h-7 w-auto brightness-0 invert" />
            <span class="text-sm font-semibold text-blue-100">Atendimento</span>
          </RouterLink>
        </div>

        <!-- Avatar dropdown -->
        <div class="relative">
          <button
            @click="showDropdown = !showDropdown"
            class="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-blue-600 transition-colors"
          >
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-blue-600 leading-none">{{ userInitials }}</span>
            </div>
            <div class="hidden sm:block text-left">
              <p class="text-sm font-medium text-white leading-none">{{ state.user?.nome?.split(' ')[0] }}</p>
              <p class="text-xs text-blue-100 mt-0.5">Atendente</p>
            </div>
            <svg class="hidden sm:block w-3.5 h-3.5 text-blue-100" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>

          <div
            v-if="showDropdown"
            class="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50"
            @click.stop
          >
            <!-- Info do usuário -->
            <div class="px-4 py-2.5 border-b border-gray-100">
              <p class="text-sm font-semibold text-gray-900">{{ state.user?.nome }}</p>
              <p class="text-xs text-gray-400">Atendente</p>
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

          <!-- Overlay fecha ao clicar fora — dentro do mesmo contexto de stacking -->
          <div v-if="showDropdown" class="fixed inset-0 z-40" @click="showDropdown = false" />
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="max-w-7xl mx-auto px-4 py-6">
      <!-- Back link -->
      <div v-if="backTo" class="mb-4">
        <RouterLink :to="backTo" class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {{ backLabel }}
        </RouterLink>
      </div>

      <!-- Title -->
      <h1 v-if="title" class="page-title mb-6">{{ title }}</h1>

      <slot />
    </main>
  </div>
</template>
