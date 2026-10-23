<script setup>
/**
 * Layout principal del panel: barra lateral con las secciones de navegación
 * + barra superior con la sesión del usuario.
 */
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  Car,
  ClipboardCheck,
  Coins,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Route,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)

const sections = computed(() =>
  router
    .getRoutes()
    .filter((r) => r.meta?.icon && r.name)
    .map((r) => ({
      name: r.name,
      title: r.meta.title,
      icon: r.meta.icon,
      path: r.path.startsWith('/') ? r.path : `/${r.path}`,
    })),
)

const icons = {
  LayoutDashboard,
  Map,
  Coins,
  TrendingUp,
  Car,
  ClipboardCheck,
  Route,
  Wallet,
  ShieldCheck,
}

async function handleSignOut() {
  await authStore.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 text-neutral-900">
    <!-- Sidebar (móvil) -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-neutral-900/40 lg:hidden"
      @click="sidebarOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-200 bg-white transition-transform lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-16 items-center gap-3 border-b border-neutral-200 px-5">
        <img src="/assets/logo.png" alt="CarSiGo" class="h-8 w-auto" />
        <span class="text-lg font-bold tracking-tight">CarSiGo</span>
        <button
          class="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-100 lg:hidden"
          @click="sidebarOpen = false"
        >
          <X :size="18" />
        </button>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto p-3">
        <RouterLink
          v-for="section in sections"
          :key="section.name"
          :to="section.path"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
          active-class="!bg-carsigo-50 !text-carsigo-700"
          @click="sidebarOpen = false"
        >
          <component :is="icons[section.icon]" :size="18" class="shrink-0" />
          <span>{{ section.title }}</span>
        </RouterLink>
      </nav>

      <div class="border-t border-neutral-200 p-3">
        <div class="mb-2 px-3">
          <p class="truncate text-sm font-medium">{{ authStore.displayName || 'Sin nombre' }}</p>
          <p class="truncate text-xs text-neutral-500">{{ authStore.role || 'sin rol' }}</p>
        </div>
        <button
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-red-50 hover:text-red-600"
          @click="handleSignOut"
        >
          <LogOut :size="18" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>

    <!-- Contenido -->
    <div class="lg:pl-64">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur">
        <button class="rounded p-1 text-neutral-500 hover:bg-neutral-100 lg:hidden" @click="sidebarOpen = true">
          <Menu :size="20" />
        </button>
        <h1 class="text-base font-semibold">{{ route.meta?.title || 'Panel' }}</h1>
      </header>

      <main class="p-4 sm:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
