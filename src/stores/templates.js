import { reactive } from 'vue'
import defaultTemplates from '@/mocks/templates.json'

const STORAGE_KEY = 'portal_templates_v1'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persist(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded — ignorar silenciosamente
  }
}

// Estado reativo: array de templates (mesma estrutura do JSON)
const state = reactive({
  templates: loadFromStorage() ?? JSON.parse(JSON.stringify(defaultTemplates)),
})

export function useTemplates() {
  function updateTemplate(id, canal, campo, valor) {
    const t = state.templates.find(t => t.id === id)
    if (!t) return
    if (canal === 'email') {
      t.email[campo] = valor
    } else {
      t[canal] = valor
    }
    persist(state.templates)
  }

  function resetTemplates() {
    state.templates = JSON.parse(JSON.stringify(defaultTemplates))
    localStorage.removeItem(STORAGE_KEY)
  }

  return { state, updateTemplate, resetTemplates }
}
