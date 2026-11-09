<script setup>
/**
 * Landing pública de CarSiGo (ruta `/`).
 *
 * Diseño: modo oscuro elegante y minimalista, paleta verde de la marca
 * (`carsigo-*` en style.css). Hero con mensaje de posicionamiento, CTA al
 * panel, sección de características y footer con términos y condiciones.
 * Responsive: móvil primero hasta desktop.
 */
import { useRouter } from 'vue-router'
import { ArrowRight, Gauge, MapPin, Shield, Wallet } from 'lucide-vue-next'

const router = useRouter()

const features = [
  {
    icon: MapPin,
    title: 'Cobertura por geofences',
    text: 'Límites oficiales de los 1122 municipios de Colombia (DANE) para delimitar zonas de servicio con precisión real.',
  },
  {
    icon: Wallet,
    title: 'Tarifas por zona',
    text: 'Tarifas independientes por municipio: base, tramos por kilómetro, turnos y comisiones sin interferencias.',
  },
  {
    icon: Gauge,
    title: 'Precio dinámico',
    text: 'Multiplicadores por festivos, días y franjas horarias con prioridades claro y auditables.',
  },
  {
    icon: Shield,
    title: 'Operación protegida',
    text: 'Accesos por roles, verificación de conductores y control de cambios sobre la operación real.',
  },
]
</script>

<template>
  <div class="flex min-h-screen flex-col bg-neutral-950 text-neutral-200">
    <!-- Resplandor decorativo del hero -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(31,165,120,0.16),transparent)]"
      aria-hidden="true"
    />

    <header class="relative mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
      <img src="/assets/logo.png" alt="CarSiGo" class="h-10 w-auto sm:h-12" />
    </header>

    <!-- Hero -->
    <main class="relative mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
      <section class="flex flex-col items-center pt-16 text-center sm:pt-24">
        <span
          class="inline-flex items-center gap-2 rounded-full border border-carsigo-500/30 bg-carsigo-950/60 px-3 py-1 text-xs font-medium text-carsigo-300"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-carsigo-400" />
          Hiperlocal · El Carmen de Bolívar
        </span>

        <h1
          class="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-neutral-50 sm:text-5xl lg:text-6xl"
        >
          Plataforma de transporte
          <span class="text-carsigo-400">hiperlocal</span>
        </h1>

        <p class="mt-5 max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
          Gestión de zonas, tarifas y conductores para la operación de El
          Carmen de Bolívar. Cobertura con límites municipales reales y
          precios que respetan el territorio.
        </p>

        <button
          class="group mt-9 inline-flex items-center gap-3 rounded-xl bg-carsigo-500 px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-carsigo-950 transition hover:bg-carsigo-400 focus:outline-none focus:ring-2 focus:ring-carsigo-300 focus:ring-offset-2 focus:ring-offset-neutral-950 sm:text-lg"
          @click="router.push('/login')"
        >
          Acceder al panel administrativo
          <ArrowRight :size="20" class="transition-transform group-hover:translate-x-1" />
        </button>
      </section>

      <!-- Características -->
      <section class="pb-16 pt-20 sm:pb-24 sm:pt-24">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="f in features"
            :key="f.title"
            class="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 transition hover:border-carsigo-500/40 hover:bg-neutral-900"
          >
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-carsigo-950 text-carsigo-400">
              <component :is="f.icon" :size="20" />
            </div>
            <h2 class="mt-4 text-sm font-semibold text-neutral-100">{{ f.title }}</h2>
            <p class="mt-1.5 text-sm leading-relaxed text-neutral-400">{{ f.text }}</p>
          </article>
        </div>
      </section>
    </main>

    <footer class="relative border-t border-neutral-800/80">
      <div
        class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-neutral-500 sm:flex-row sm:px-6"
      >
        <p>© {{ new Date().getFullYear() }} CarSiGo · Transporte hiperlocal</p>
        <RouterLink
          to="/terminos"
          class="font-medium text-neutral-400 transition hover:text-carsigo-400"
        >
          Términos y condiciones
        </RouterLink>
      </div>
    </footer>
  </div>
</template>
