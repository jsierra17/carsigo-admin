import { ref } from 'vue'

/**
 * Notificaciones tipo toast (éxito / error / info).
 * Estado global sencillo, sin dependencia externa.
 */
const toasts = ref([])
let nextId = 1

function push(message, type = 'info', duration = 4000) {
  const id = nextId++
  toasts.value = [...toasts.value, { id, message, type }]
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (msg, d) => push(msg, 'success', d),
    error: (msg, d) => push(msg, 'error', d ?? 6000),
    info: (msg, d) => push(msg, 'info', d),
  }
}
