<script setup>
import { computed, ref } from 'vue'
import { useAuth } from '@/stores/auth.js'
import { useRouter } from 'vue-router'
import { useFlow } from '@/stores/flow.js'
import { useRules } from '@/stores/rules.js'

const { state, logout } = useAuth()
const router = useRouter()
const baseUrl = import.meta.env.BASE_URL
const { resetFlow } = useFlow()
const { resetRules } = useRules()

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
    <header class="bg-teal-800 text-white sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <RouterLink to="/atendimento" class="flex items-center gap-2">
            <img :src="baseUrl + 'dock.png'" alt="Logo" class="h-7 w-auto brightness-0 invert" />
            <span class="text-sm font-semibold text-teal-100">Atendimento</span>
          </RouterLink>
        </div>

        <!-- Avatar dropdown -->
        <div class="relative">
          <button
            @click="showDropdown = !showDropdown"
            class="flex items-center gap-2 rounded-full hover:bg-teal-700 transition px-2 py-1"
          >
            <div class="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
              {{ userInitials }}
            </div>
            <span class="hidden sm:block text-sm text-teal-100">{{ state.user?.nome }}</span>
            <svg class="w-4 h-4 text-teal-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
          </button>

          <div v-if="showDropdown" class="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
            <button @click="handleReset" class="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
              Resetar fluxo (demo)
            </button>
            <div class="border-t border-gray-100 my-1" />
            <button @click="handleLogout" class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="max-w-7xl mx-auto px-4 py-6">
      <!-- Back link -->
      <div v-if="backTo" class="mb-4">
        <RouterLink :to="backTo" class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
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
  <!-- Click outside to close dropdown -->
  <div v-if="showDropdown" class="fixed inset-0 z-40" @click="showDropdown = false" />
</template>
