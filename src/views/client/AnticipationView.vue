<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClientLayout from '@/layouts/ClientLayout.vue'
import { useFormatters } from '@/composables/useFormatters.js'
import { useFlow } from '@/stores/flow.js'
import { useRules } from '@/stores/rules.js'

const route  = useRoute()
const router = useRouter()
const { formatMoney, formatDate } = useFormatters()
const { state: flowState } = useFlow()
const { rules } = useRules()

const contract = computed(() => flowState.contracts.find(c => c.id === route.params.id))

const parcelasFuturas = computed(() =>
  contract.value?.parcelas.filter(p => p.status === 'futura' || p.status === 'proxima') ?? []
)

const selecionadas = ref(new Set())

function toggleParcela(num) {
  if (selecionadas.value.has(num)) selecionadas.value.delete(num)
  else selecionadas.value.add(num)
}

// Desconto: configurado em Parâmetros (descontoAntecipacaoPct) aplicado por parcela selecionada
const valorOriginal = computed(() =>
  parcelasFuturas.value
    .filter(p => selecionadas.value.has(p.numero))
    .reduce((s, p) => s + p.valor, 0)
)
const desconto = computed(() => {
  const pct = rules.descontoAntecipacaoPct ?? 0.075
  return valorOriginal.value * pct
})
const valorFinal = computed(() => Math.max(0, valorOriginal.value - desconto.value))

function gerarPix() {
  router.push({
    path: `/contratos/${contract.value.id}/pagar`,
    query: { parcelas: [...selecionadas.value].join(',') }
  })
}
</script>

<template>
  <ClientLayout
    :title="`Antecipar Parcelas — #${route.params.id}`"
    :back-to="`/contratos/${route.params.id}`"
    back-label="Contrato"
  >
    <div v-if="!contract" class="card text-center py-12 text-gray-500">Contrato não encontrado.</div>

    <template v-else>
      <div class="alert-info mb-6 text-sm">
        💡 Antecipe parcelas futuras e economize nos juros. Selecione as parcelas que deseja quitar hoje.
      </div>

      <div class="grid lg:grid-cols-2 gap-6">

        <!-- Lista de parcelas futuras -->
        <div class="card">
          <h3 class="font-semibold text-gray-900 mb-1">
            Selecione as parcelas
          </h3>
          <p class="text-xs text-gray-400 mb-4">{{ parcelasFuturas.length }} disponíveis para antecipação</p>

          <div v-if="parcelasFuturas.length === 0" class="text-center text-gray-400 py-6">
            Nenhuma parcela disponível para antecipar.
          </div>

          <div v-else class="space-y-2 max-h-80 overflow-y-auto pr-1">
            <label
              v-for="p in parcelasFuturas"
              :key="p.numero"
              class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
              :class="selecionadas.has(p.numero)
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-100 hover:border-gray-200'"
            >
              <input
                type="checkbox"
                :checked="selecionadas.has(p.numero)"
                @change="toggleParcela(p.numero)"
                class="accent-blue-600 w-4 h-4"
              />
              <div class="flex-1 flex justify-between text-sm">
                <div>
                  <span class="font-medium text-gray-900">Parcela #{{ p.numero }}</span>
                  <span class="text-gray-400 ml-2">{{ formatDate(p.vencimento) }}</span>
                </div>
                <span class="font-semibold text-gray-900">{{ formatMoney(p.valor) }}</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Resultado da antecipação -->
        <div class="space-y-4">
          <div class="card border-2" :class="selecionadas.size > 0 ? 'border-green-500/25 bg-green-50' : 'border-gray-100'">
            <h3 class="font-semibold mb-3" :class="selecionadas.size > 0 ? 'text-green-800' : 'text-gray-700'">
              Resultado da antecipação
            </h3>

            <div v-if="selecionadas.size === 0" class="text-gray-400 text-sm text-center py-4">
              Selecione ao menos uma parcela
            </div>

            <template v-else>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600">Parcelas selecionadas</span>
                  <span class="font-semibold">{{ selecionadas.size }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">Valor original</span>
                  <span class="font-semibold">{{ formatMoney(valorOriginal) }}</span>
                </div>
                <div class="flex justify-between text-green-700">
                  <span>Desconto por antecipação</span>
                  <span class="font-semibold">- {{ formatMoney(desconto) }}</span>
                </div>
                <div class="border-t border-green-500/25 pt-2 flex justify-between">
                  <span class="font-bold text-green-800">VALOR A PAGAR HOJE</span>
                  <span class="font-bold text-green-800 text-base">{{ formatMoney(valorFinal) }}</span>
                </div>
                <div class="text-center text-xs font-semibold text-green-700 bg-green-100 rounded-lg py-1.5 mt-1 flex items-center justify-center gap-1.5">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>
                  Economia: {{ formatMoney(desconto) }}
                </div>
              </div>

              <button @click="gerarPix" class="btn-success w-full mt-4">
                Gerar Pix — {{ formatMoney(valorFinal) }}
              </button>
            </template>
          </div>

          <div class="alert-info text-xs">
            <p class="font-semibold mb-1">Como funciona o desconto?</p>
            <p>Ao antecipar, você economiza os juros que seriam cobrados nos meses futuros. O desconto é proporcional ao número de parcelas antecipadas.</p>
          </div>
        </div>
      </div>
    </template>
    <div class="h-16 sm:hidden" />
  </ClientLayout>
</template>
