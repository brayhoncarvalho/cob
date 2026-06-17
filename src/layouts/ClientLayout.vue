<script setup>
import { computed } from 'vue'
import { useAuth } from '@/stores/auth.js'
import { useRouter } from 'vue-router'

const { state, logout } = useAuth()
const router = useRouter()
const baseUrl = import.meta.env.BASE_URL

const userInitials = computed(() => {
  const nome = state.user?.nome || ''
  const parts = nome.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return nome.slice(0, 2).toUpperCase()
})

function handleLogout() {
  logout()
  router.push('/login')
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
    <header class="bg-[#2563eb] sticky top-0 z-40">
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
          </nav>
        </div>

        <!-- Usuário -->
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-[#2563eb] leading-none">{{ userInitials }}</span>
            </div>
            <span class="hidden sm:block text-sm font-medium text-white">
              {{ state.user?.nome?.split(' ')[0] }}
            </span>
          </div>
          <button
            @click="handleLogout"
            title="Sair"
            class="flex items-center gap-1 text-blue-200 hover:text-white transition-colors p-2 rounded-lg hover:bg-blue-700/60"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
            </svg>
            <span class="hidden sm:inline text-sm font-medium">Sair</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Page header with back button -->
    <div v-if="backTo || title" class="bg-white border-b border-gray-100">
      <div class="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
        <RouterLink
          v-if="backTo"
          :to="backTo"
          class="flex items-center gap-1 text-sm text-gray-500 hover:text-[#2563eb] transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          {{ backLabel }}
        </RouterLink>
        <span v-if="backTo && title" class="text-gray-300">/</span>
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
          active-class="text-[#2563eb]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span class="text-xs mt-0.5 font-medium">Início</span>
        </RouterLink>
        <RouterLink
          to="/contratos"
          class="flex-1 flex flex-col items-center py-2.5 text-gray-400 transition-colors"
          active-class="text-[#2563eb]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span class="text-xs mt-0.5 font-medium">Contratos</span>
        </RouterLink>
        <RouterLink
          to="/negociacoes"
          class="flex-1 flex flex-col items-center py-2.5 text-gray-400 transition-colors"
          active-class="text-[#2563eb]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span class="text-xs mt-0.5 font-medium">Negociações</span>
        </RouterLink>
      </div>
    </nav>
  </div>
</template>
