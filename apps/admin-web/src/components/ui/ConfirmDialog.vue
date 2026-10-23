<script setup>
/** Diálogo de confirmación para acciones destructivas. */
import { AlertTriangle } from 'lucide-vue-next'

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '¿Confirmas la acción?' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirmar' },
  cancelLabel: { type: String, default: 'Cancelar' },
  danger: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div class="flex gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            :class="danger ? 'bg-red-50 text-red-600' : 'bg-carsigo-50 text-carsigo-600'"
          >
            <AlertTriangle :size="20" />
          </span>
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-neutral-900">{{ title }}</h3>
            <p v-if="message" class="mt-1 text-sm text-neutral-600">{{ message }}</p>
          </div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            :disabled="loading"
            @click="close"
          >
            {{ cancelLabel }}
          </button>
          <button
            class="rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            :class="danger ? 'bg-red-600 hover:bg-red-700' : 'bg-carsigo-600 hover:bg-carsigo-700'"
            :disabled="loading"
            @click="emit('confirm')"
          >
            {{ loading ? 'Procesando…' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
