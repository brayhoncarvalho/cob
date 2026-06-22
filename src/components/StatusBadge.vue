<script setup>
const props = defineProps({
  status: { type: String, required: true },
  small: { type: Boolean, default: false },
})

const MAP = {
  em_dia:       { label: 'Em dia',       cls: 'bg-green-50 text-green-700' },
  em_atraso:    { label: 'Em atraso',    cls: 'bg-red-50 text-red-700' },
  renegociado:  { label: 'Renegociado',  cls: 'bg-blue-100 text-blue-600' },
  em_analise:   { label: 'Em análise',   cls: 'bg-amber-50 text-amber-700' },
  em_pagamento: { label: 'Em pagamento', cls: 'bg-blue-100 text-blue-600' },
  aprovada:     { label: 'Aprovada',     cls: 'bg-green-50 text-green-700' },
  reprovada:    { label: 'Reprovada',    cls: 'bg-red-50 text-red-700' },
  cancelada:    { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-700' },
  contraproposta: { label: 'Contraproposta', cls: 'bg-amber-50 text-amber-700' },
  pending_client_approval: { label: 'Aguardando cliente', cls: 'bg-amber-50 text-amber-700' },
  paga:         { label: 'Paga',         cls: 'bg-green-50 text-green-700' },
  quitado:      { label: 'Quitado',      cls: 'bg-green-50 text-green-700' },
  vencida:      { label: 'Vencida',      cls: 'bg-red-50 text-red-700' },
  em_acordo:    { label: 'Em acordo',    cls: 'bg-blue-100 text-blue-600' },
  proxima:      { label: 'A vencer',     cls: 'bg-amber-50 text-amber-700' },
  futura:       { label: 'Futura',       cls: 'bg-gray-100 text-gray-700' },
}

const config = computed(() => MAP[props.status] ?? { label: props.status, cls: 'bg-gray-100 text-gray-700' })
</script>

<script>
import { computed } from 'vue'
export default {}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center font-semibold rounded-full',
      small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      config.cls
    ]"
  >
    {{ config.label }}
  </span>
</template>
