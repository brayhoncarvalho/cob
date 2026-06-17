import { reactive, watch } from 'vue'
import defaults from '@/mocks/rules.json'

const STORAGE_KEY = 'portal_rules_v1'

function loadRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const rules = reactive(loadRules() ?? JSON.parse(JSON.stringify(defaults)))

// Persiste automaticamente toda vez que rules muda
watch(
  () => JSON.stringify(rules),
  (json) => localStorage.setItem(STORAGE_KEY, json),
)

function updateRules(partial) {
  Object.assign(rules, partial)
}

function resetRules() {
  Object.assign(rules, JSON.parse(JSON.stringify(defaults)))
  localStorage.removeItem(STORAGE_KEY)
}

export function useRules() {
  return { rules, updateRules, resetRules }
}
