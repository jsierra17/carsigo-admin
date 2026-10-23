<script setup>
/**
 * Dashboard: métricas operativas y actividad reciente.
 */
import { onMounted, computed, ref } from 'vue'
import {
  Car,
  CarTaxiFront,
  Clock,
  MapPin,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-vue-next'
import StatCard from '../components/ui/StatCard.vue'
import DataTable from '../components/ui/DataTable.vue'
import Badge from '../components/ui/Badge.vue'
import { dashboardService } from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useAuthStore } from '../stores/auth.js'

const authStore = useAuthStore()

const metrics = ref({ pasajeros: 0, conductores: 0, pendientes: 0 })
const tripsToday = ref(0)
const loading = ref(true)

const recentDrivers = ref([])

const metricsData = useAsyncData(() => dashboardService.getMetrics())
const driversData = useAsyncData(() => dashboardService.getLatestDrivers(5))

onMounted(async () => {
  const m = await metricsData.refresh()
  if (m) metrics.value = m
  const d = await driversData.refresh()
  if (d) recentDrivers.value = d
  loading.value = false
})

const driverColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'email', label: 'Correo' },
  { key: 'created_at', label: 'Registrado' },
]

function formatDate(value) {
  if (!value) return '—'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-neutral-900">
        {{ greeting }}, {{ authStore.displayName || 'administrador' }}
      </h2>
      <p class="text-sm text-neutral-500">Resumen de la operación en El Carmen de Bolívar</p>
    </div>

    <!-- Métricas -->
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Pasajeros"
        :value="metrics.pasajeros"
        :icon="Users"
        tone="brand"
        hint="Usuarios con rol pasajero"
      />
      <StatCard
        label="Conductores"
        :value="metrics.conductores"
        :icon="Car"
        tone="success"
        hint="Usuarios con rol conductor"
      />
      <StatCard
        label="Solicitudes pendientes"
        :value="metrics.pendientes"
        :icon="Clock"
        tone="warning"
        hint="Conductor por revisar"
      />
      <StatCard
        label="Zonas activas"
        :value="authStore.isSuperAdmin ? '—' : '—'"
        :icon="MapPin"
        tone="default"
        hint="Ver sección Zonas"
      />
    </div>

    <!-- Actividad reciente -->
    <div class="grid gap-4 lg:grid-cols-2">
      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-neutral-700">Conductores recientes</h3>
        <DataTable
          :columns="driverColumns"
          :rows="recentDrivers"
          :loading="driversData.loading.value"
          empty-text="Aún no hay conductores registrados"
        >
          <template #cell-name="{ row }">
            <div class="flex items-center gap-2">
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-carsigo-50 text-xs font-semibold text-carsigo-700">
                {{ (row.name || '?').charAt(0).toUpperCase() }}
              </span>
              <span class="font-medium text-neutral-800">{{ row.name || row.full_name || '—' }}</span>
            </div>
          </template>
          <template #cell-created_at="{ row }">
            <span class="text-neutral-500">{{ formatDate(row.created_at) }}</span>
          </template>
        </DataTable>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-neutral-700">Accesos rápidos</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <RouterLink
            to="/solicitudes"
            class="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-carsigo-300 hover:shadow"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium text-neutral-800">Revisar solicitudes</span>
              <span class="block truncate text-xs text-neutral-500">Conductores nuevos</span>
            </span>
          </RouterLink>

          <RouterLink
            to="/tarifas"
            class="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-carsigo-300 hover:shadow"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-carsigo-50 text-carsigo-600">
              <TrendingUp :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium text-neutral-800">Ajustar tarifas</span>
              <span class="block truncate text-xs text-neutral-500">Base, turnos y km</span>
            </span>
          </RouterLink>

          <RouterLink
            to="/zonas"
            class="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-carsigo-300 hover:shadow"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <MapPin :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium text-neutral-800">Zonas de servicio</span>
              <span class="block truncate text-xs text-neutral-500">Mapa de cobertura</span>
            </span>
          </RouterLink>

          <RouterLink
            to="/viajes"
            class="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-carsigo-300 hover:shadow"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <CarTaxiFront :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium text-neutral-800">Ver viajes</span>
              <span class="block truncate text-xs text-neutral-500">Historial y estados</span>
            </span>
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
