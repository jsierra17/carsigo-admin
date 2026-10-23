<script setup>
/**
 * Vista de inicio de sesión.
 *
 * El login se resuelve en el CLIENTE con el Firebase Web SDK
 * (`signInWithPopup` para Google, `signInWithEmailAndPassword` para email).
 * No hay backend de autenticación: el panel obtiene el ID token y lo envía
 * a la Admin API como `Authorization: Bearer <idToken>`.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, Car, Loader2, LogIn, ShieldCheck } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const mode = ref('email') // 'email' | 'google'
const submitting = ref(false)

async function submit() {
  submitting.value = true
  try {
    if (mode.value === 'google') {
      await authStore.signInWithGoogle()
    } else {
      await authStore.signInWithEmail(email.value, password.value)
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch {
    // El error ya quedó en authStore.error
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
    <div class="w-full max-w-md">
      <div class="mb-8 flex flex-col items-center gap-3 text-center">
        <img src="/assets/logo.png" alt="CarSiGo" class="h-12 w-auto" />
        <h1 class="text-2xl font-bold tracking-tight">Panel de administración</h1>
        <p class="text-sm text-neutral-500">CarSiGo · El Carmen de Bolívar</p>
      </div>

      <form
        class="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
        @submit.prevent="submit"
      >
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          :disabled="submitting"
          @click="mode = 'google'; submit()"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
            <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
          </svg>
          Continuar con Google
        </button>

        <div class="flex items-center gap-3 text-xs text-neutral-400">
          <span class="h-px flex-1 bg-neutral-200" />
          o con email
          <span class="h-px flex-1 bg-neutral-200" />
        </div>

        <div class="space-y-3">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-neutral-600">Correo electrónico</span>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              required
              placeholder="admin@carsigo.co"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-neutral-600">Contraseña</span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              placeholder="••••••••"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none transition focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
            />
          </label>
        </div>

        <p
          v-if="authStore.error"
          class="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <AlertCircle :size="14" class="mt-0.5 shrink-0" />
          {{ authStore.error }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="flex w-full items-center justify-center gap-2 rounded-lg bg-carsigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
        >
          <Loader2 v-if="submitting" :size="16" class="animate-spin" />
          <LogIn v-else :size="16" />
          Iniciar sesión
        </button>
      </form>

      <p class="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-400">
        <ShieldCheck :size="14" />
        Acceso restringido a administradores autorizados
        <Car :size="14" />
      </p>
    </div>
  </div>
</template>
