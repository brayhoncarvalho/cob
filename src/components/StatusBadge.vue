<script setup>
const props = defineProps({
  status: { type: String, required: true },
  small: { type: Boolean, default: false },
})

const MAP = {
  em_dia:       { label: 'Em dia',       cls: 'bg-green-100 text-green-800' },
  em_atraso:    { label: 'Em atraso',    cls: 'bg-red-100 text-red-800' },
  renegociado:  { label: 'Renegociado',  cls: 'bg-blue-100 text-blue-800' },
  em_analise:   { label: 'Em análise',   cls: 'bg-amber-100 text-amber-800' },
  em_pagamento: { label: 'Em pagamento', cls: 'bg-teal-100 text-teal-800' },
  aprovada:     { label: 'Aprovada',     cls: 'bg-green-100 text-green-800' },
  reprovada:    { label: 'Reprovada',    cls: 'bg-red-100 text-red-800' },
  cancelada:    { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-600' },
  contraproposta: { label: 'Contraproposta', cls: 'bg-purple-100 text-purple-800' },
  paga:         { label: 'Paga',         cls: 'bg-green-100 text-green-800' },
  vencida:      { label: 'Vencida',      cls: 'bg-red-100 text-red-800' },
  proxima:      { label: 'A vencer',     cls: 'bg-amber-100 text-amber-800' },
  futura:       { label: 'Futura',       cls: 'bg-gray-100 text-gray-600' },
}

const config = computed(() => MAP[props.status] ?? { label: props.status, cls: 'bg-gray-100 text-gray-600' })
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
