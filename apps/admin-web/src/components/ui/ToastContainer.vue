<script setup>
/** Contenedor global de notificaciones. Se monta una vez en App.vue. */
import { useToast } from '../../composables/useToast.js'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next'

const { toasts, dismiss } = useToast()

const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
}
const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg"
        :class="styles[toast.type] || styles.info"
      >
        <component :is="icons[toast.type] || icons.info" :size="16" class="mt-0.5 shrink-0" />
        <p class="flex-1 leading-snug">{{ toast.message }}</p>
        <button class="shrink-0 opacity-60 transition hover:opacity-100" @click="dismiss(toast.id)">
          <X :size="14" />
        </button>
      </div>
    </div>
  </Teleport>
</template>
