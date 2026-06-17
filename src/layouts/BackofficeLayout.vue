<script setup>
import { computed } from 'vue'
import { useAuth } from '@/stores/auth.js'
import { useRouter } from 'vue-router'

const { state, logout } = useAuth()
const router = useRouter()
const baseUrl = import.meta.env.BASE_URL

const isAnalyst = computed(() => state.role === 'analyst')
const isManager = computed(() => state.role === 'manager')

const userInitials = computed(() => {
  const nome = state.user?.nome || ''
  const parts = nome.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return nome.slice(0, 2).toUpperCase()
})

const navItems = computed(() => {
  if (isManager.value) {
    return [{
      label: 'Dashboard',
      to: '/backoffice/gerente',
      iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    }]
  }
  return [{
    label: 'Fila de Aprovação',
    to: '/backoffice/fila',
    iconPath: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  }]
})

function handleLogout() {
  logout()
  router.push('/login')
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
    <header class="bg-gray-900 text-white sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <RouterLink :to="isManager ? '/backoffice/gerente' : '/backoffice/fila'" class="flex items-center gap-2">
            <img :src="baseUrl + 'dock.png'" alt="Logo" class="h-7 w-auto brightness-0 invert" />
            <span class="text-sm font-semibold text-gray-300">
              {{ isManager ? 'Mesa de Crédito — 2º Nível' : 'Mesa de Crédito — 1º Nível' }}
            </span>
          </RouterLink>
          <nav class="hidden sm:flex items-center gap-1">
            <RouterLink
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700/80 transition-colors"
              active-class="text-white bg-gray-700/80"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" :d="item.iconPath"/>
              </svg>
              <span>{{ item.label }}</span>
            </RouterLink>
          </nav>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-[#2563eb] leading-none">{{ userInitials }}</span>
            </div>
            <div class="hidden sm:block">
              <p class="text-sm font-medium text-white leading-none">{{ state.user?.nome?.split(' ')[0] }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ isManager ? 'Gerente' : 'Analista' }}</p>
            </div>
          </div>
          <button
            @click="handleLogout"
            title="Sair"
            class="flex items-center gap-1 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/80"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
            </svg>
            <span class="hidden sm:inline text-sm">Sair</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Sub-header -->
    <div v-if="backTo || title" class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
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

    <main class="max-w-7xl mx-auto px-4 py-8">
      <slot />
    </main>
  </div>
</template>
