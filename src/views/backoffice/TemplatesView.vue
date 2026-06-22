<script setup>
import { ref, computed, watch } from 'vue'
import BackofficeLayout from '@/layouts/BackofficeLayout.vue'
import { useTemplates } from '@/stores/templates.js'

const { state, updateTemplate, resetTemplates } = useTemplates()

// Template ativo
const templateAtivo = ref(state.templates[0]?.id ?? null)
const canalAtivo    = ref('email')   // 'email' | 'whatsapp' | 'sms'
const resetted      = ref(false)

const template = computed(() => state.templates.find(t => t.id === templateAtivo.value))

// Campos editáveis reativos (cópias locais para preview antes de salvar)
const draftAssunto = ref('')
const draftCorpo   = ref('')

watch([templateAtivo, canalAtivo], () => {
  if (!template.value) return
  if (canalAtivo.value === 'email') {
    draftAssunto.value = template.value.email.assunto
    draftCorpo.value   = template.value.email.corpo
  } else {
    draftAssunto.value = ''
    draftCorpo.value   = template.value[canalAtivo.value] ?? ''
  }
}, { immediate: true })

function salvar() {
  if (!template.value) return
  if (canalAtivo.value === 'email') {
    updateTemplate(templateAtivo.value, 'email', 'assunto', draftAssunto.value)
    updateTemplate(templateAtivo.value, 'email', 'corpo', draftCorpo.value)
  } else {
    updateTemplate(templateAtivo.value, canalAtivo.value, null, draftCorpo.value)
  }
  // Feedback visual
  savedFlash.value = true
  setTimeout(() => savedFlash.value = false, 2000)
}
const savedFlash = ref(false)

function restaurar() {
  resetTemplates()
  resetted.value = true
  setTimeout(() => resetted.value = false, 3000)
  // Recarrega draft
  const t = state.templates.find(t => t.id === templateAtivo.value)
  if (!t) return
  if (canalAtivo.value === 'email') {
    draftAssunto.value = t.email.assunto
    draftCorpo.value   = t.email.corpo
  } else {
    draftCorpo.value = t[canalAtivo.value] ?? ''
  }
}

// Preview: substitui variáveis com dados mockados
const mockData = {
  nome: 'João da Silva',
  cpf_parcial: '***.***.456-78',
  valor: 'R$ 1.234,56',
  vencimento: '15/08/2025',
  contrato: 'CTR-2024-001',
  link_portal: 'https://portal.dock.com.br',
  parcelas_atraso: '2',
  desconto: '15%',
}

function renderPreview(texto) {
  if (!texto) return ''
  return Object.entries(mockData).reduce(
    (t, [k, v]) => t.replaceAll(`{${k}}`, `<strong class="text-blue-700">${v}</strong>`),
    texto.replace(/\n/g, '<br />')
  )
}

const previewAssunto = computed(() => renderPreview(draftAssunto.value))
const previewCorpo   = computed(() => renderPreview(draftCorpo.value))
const previewCorpoSms = computed(() =>
  previewCorpo.value.replace(/<strong class="text-blue-700">/g, '<strong class="text-blue-100">')
)

const CANAIS = [
  { id: 'email',    label: 'E-mail',    icon: '✉️' },
  { id: 'whatsapp', label: 'WhatsApp',  icon: '💬' },
  { id: 'sms',      label: 'SMS',       icon: '📱' },
]

const VARIAVEIS = [
  { v: '{nome}',            desc: 'Nome completo do cliente' },
  { v: '{cpf_parcial}',     desc: 'CPF mascarado' },
  { v: '{valor}',           desc: 'Valor da parcela' },
  { v: '{vencimento}',      desc: 'Data de vencimento' },
  { v: '{contrato}',        desc: 'Número do contrato' },
  { v: '{link_portal}',     desc: 'Link do portal do cliente' },
  { v: '{parcelas_atraso}', desc: 'Qtd. parcelas em atraso' },
  { v: '{desconto}',        desc: 'Percentual de desconto ofertado' },
]

function inserirVariavel(v) {
  draftCorpo.value += v
}
</script>

<template>
  <BackofficeLayout title="Templates de Comunicação">
    <div class="flex gap-6 min-h-[70vh]">

      <!-- ── Sidebar: lista de momentos ── -->
      <aside class="w-64 shrink-0">
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">9 momentos</p>
          </div>
          <nav class="divide-y divide-gray-50">
            <button
              v-for="t in state.templates"
              :key="t.id"
              @click="templateAtivo = t.id"
              :class="[
                'w-full text-left px-4 py-3 text-sm transition-colors',
                templateAtivo === t.id
                  ? 'bg-blue-50 text-blue-800 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              ]"
            >
              {{ t.label }}
            </button>
          </nav>
        </div>

        <!-- Restaurar padrão -->
        <button @click="restaurar" class="btn-secondary w-full mt-3 text-sm flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
          Restaurar padrão
        </button>

        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200"
          leave-to-class="opacity-0"
        >
          <div v-if="resetted" class="mt-2 bg-amber-50 border border-amber-500/25 rounded-lg px-3 py-2 text-xs text-amber-700">
            Templates restaurados para o padrão.
          </div>
        </Transition>
      </aside>

      <!-- ── Área de edição ── -->
      <div class="flex-1 min-w-0">

        <div v-if="!template" class="card text-center py-12 text-gray-400">Selecione um momento.</div>

        <template v-else>
          <div class="mb-4">
            <h2 class="text-base font-semibold text-gray-900">{{ template.label }}</h2>
            <p class="text-sm text-gray-500 mt-0.5">{{ template.descricao }}</p>
          </div>

          <!-- Seletor de canal -->
          <div class="flex gap-2 mb-4">
            <button
              v-for="c in CANAIS"
              :key="c.id"
              @click="canalAtivo = c.id"
              :class="[
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                canalAtivo === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              ]"
            >
              {{ c.icon }} {{ c.label }}
            </button>
          </div>

          <!-- Editor + Preview lado a lado -->
          <div class="grid lg:grid-cols-2 gap-4">

            <!-- Editor -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
              <div class="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Editor</span>
                <span class="text-xs text-gray-400">Edite livremente</span>
              </div>
              <div class="p-4 flex-1 flex flex-col gap-3">
                <!-- Assunto (só email) -->
                <div v-if="canalAtivo === 'email'">
                  <label class="block text-xs font-medium text-gray-600 mb-1">Assunto</label>
                  <input v-model="draftAssunto" type="text" class="input-field text-sm" placeholder="Assunto do e-mail" />
                </div>
                <!-- Corpo -->
                <div class="flex-1 flex flex-col">
                  <label class="block text-xs font-medium text-gray-600 mb-1">
                    {{ canalAtivo === 'email' ? 'Corpo do e-mail' : 'Mensagem' }}
                    <span v-if="canalAtivo === 'sms'" class="text-gray-400 ml-1">({{ draftCorpo.length }}/160 chars ideais)</span>
                  </label>
                  <textarea
                    v-model="draftCorpo"
                    class="input-field text-sm font-mono flex-1 resize-y min-h-[180px]"
                    :placeholder="canalAtivo === 'sms' ? 'Máx. 160 caracteres idealmente' : 'Corpo da mensagem'"
                  />
                </div>
                <!-- Variáveis disponíveis -->
                <div>
                  <p class="text-xs text-gray-500 mb-1.5">Clique para inserir variável no corpo:</p>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="{ v, desc } in VARIAVEIS"
                      :key="v"
                      @click="inserirVariavel(v)"
                      :title="desc"
                      class="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded font-mono transition-colors"
                    >{{ v }}</button>
                  </div>
                </div>
              </div>
              <div class="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
                <Transition
                  enter-active-class="transition-opacity duration-300"
                  enter-from-class="opacity-0"
                  leave-active-class="transition-opacity duration-200"
                  leave-to-class="opacity-0"
                >
                  <span v-if="savedFlash" class="text-xs text-green-600 font-medium self-center">✓ Salvo!</span>
                </Transition>
                <button @click="salvar" class="btn-primary text-sm flex items-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                  Salvar
                </button>
              </div>
            </div>

            <!-- Preview -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
              <div class="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pré-visualização</span>
                <span class="text-xs text-gray-400">Dados: João da Silva</span>
              </div>

              <!-- Preview Email -->
              <div v-if="canalAtivo === 'email'" class="p-4 flex-1">
                <div class="border border-gray-200 rounded-lg overflow-hidden">
                  <div class="bg-gray-50 px-4 py-2 border-b border-gray-100">
                    <p class="text-xs text-gray-500">Assunto:</p>
                    <p class="text-sm font-medium text-gray-800" v-html="previewAssunto" />
                  </div>
                  <div class="p-4 text-sm text-gray-700 leading-relaxed" v-html="previewCorpo" />
                </div>
              </div>

              <!-- Preview WhatsApp -->
              <div v-else-if="canalAtivo === 'whatsapp'" class="p-4 flex-1">
                <div class="max-w-xs">
                  <div class="bg-green-50 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-gray-800 shadow-sm leading-relaxed" v-html="previewCorpo" />
                  <p class="text-xs text-gray-400 mt-1 text-right">Agora · ✓✓</p>
                </div>
              </div>

              <!-- Preview SMS -->
              <div v-else-if="canalAtivo === 'sms'" class="p-4 flex-1">
                <div class="max-w-xs">
                  <div class="bg-blue-500 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-white leading-relaxed" v-html="previewCorpoSms" />
                  <p class="text-xs text-gray-400 mt-1">Mensagem de texto</p>
                  <p
                    :class="draftCorpo.length > 160 ? 'text-red-500' : 'text-gray-400'"
                    class="text-xs mt-0.5"
                  >
                    {{ draftCorpo.length }} / 160 caracteres
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </BackofficeLayout>
</template>
