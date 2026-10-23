<script setup>
/**
 * Viajes: historial con filtro por estado.
 */
import { onMounted, ref, watch } from 'vue'
import { Route } from 'lucide-vue-next'
import DataTable from '../components/ui/DataTable.vue'
import Badge from '../components/ui/Badge.vue'
import { viajesService } from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'

const trips = ref([])
const status = ref('')

const data = useAsyncData(() => viajesService.list({ status: status.value }))

const STATUSES = [
  { id: '', label: 'Todos' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'accepted', label: 'Aceptados' },
  { id: 'inProgress', label: 'En curso' },
  { id: 'completed', label: 'Completados' },
  { id: 'cancelled', label: 'Cancelados' },
]

const columns = [
  { key: 'id', label: 'Viaje' },
  { key: 'pickup_address', label: 'Recogida' },
  { key: 'dropoff_address', label: 'Destino' },
  { key: 'vehicle_type', label: 'Vehículo' },
  { key: 'distance_km', label: 'Distancia', align: 'right' },
  { key: 'fare_amount', label: 'Tarifa', align: 'right' },
  { key: 'status', label: 'Estado' },
  { key: 'created_at', label: 'Creado' },
]

async function load() {
  const result = await data.refresh()
  if (result) trips.value = result
}

onMounted(load)
watch(status, load)

function formatDate(value) {
  if (!value) return '—'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const currency = (value) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  )
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-neutral-900">Viajes</h2>
        <p class="text-sm text-neutral-500">{{ trips.length }} viaje(s)</p>
      </div>

      <select
        v-model="status"
        class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
      >
        <option v-for="s in STATUSES" :key="s.id" :value="s.id">{{ s.label }}</option>
      </select>
    </div>

    <DataTable
      :columns="columns"
      :rows="trips"
      :loading="data.loading.value"
      empty-text="No hay viajes con este filtro"
    >
      <template #cell-id="{ row }">
        <span class="font-mono text-xs text-neutral-500">{{ String(row.id).slice(0, 10) }}…</span>
      </template>
      <template #cell-vehicle_type="{ row }">
        <Badge v-if="row.vehicle_type" :label="row.vehicle_type" />
      </template>
      <template #cell-distance_km="{ row }">
        {{ Number(row.distance_km || 0).toFixed(1) }} km
      </template>
      <template #cell-fare_amount="{ row }">
        {{ currency(row.fare_amount) }}
      </template>
      <template #cell-status="{ row }">
        <Badge :label="row.status" />
      </template>
      <template #cell-created_at="{ row }">
        <span class="text-neutral-500">{{ formatDate(row.created_at) }}</span>
      </template>
    </DataTable>
  </div>
</template>
