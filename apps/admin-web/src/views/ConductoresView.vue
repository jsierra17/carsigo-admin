<script setup>
/**
 * Conductores: listado con búsqueda, estado y disponibilidad.
 */
import { computed, onMounted, ref } from 'vue'
import { Ban, CheckCircle2, Search } from 'lucide-vue-next'
import DataTable from '../components/ui/DataTable.vue'
import Badge from '../components/ui/Badge.vue'
import { conductoresService } from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'

const toast = useToast()

const drivers = ref([])
const search = ref('')
const statusFilter = ref('all')

const data = useAsyncData(() => conductoresService.list())

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'vehicle_type', label: 'Vehículo' },
  { key: 'plate', label: 'Placa' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'status', label: 'Estado' },
  { key: 'is_available', label: 'Disponible' },
  { key: 'registered', label: 'Registrado' },
  { key: 'actions', label: '', align: 'right' },
]

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return drivers.value.filter((d) => {
    if (statusFilter.value !== 'all' && d.status !== statusFilter.value) return false
    if (!term) return true
    return [d.name, d.email, d.phone, d.plate]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term)
  })
})

async function load() {
  const result = await data.refresh()
  if (result) drivers.value = result
}

onMounted(load)

async function toggle(driver) {
  try {
    await conductoresService.toggleStatus(driver.id, driver.status)
    toast.success(
      driver.status === 'active' ? 'Conductor suspendido' : 'Conductor reactivado',
    )
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo actualizar el conductor')
  }
}

function formatDate(value) {
  if (!value) return '—'
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-neutral-900">Conductores</h2>
      <p class="text-sm text-neutral-500">
        {{ drivers.length }} conductor(es) registrado(s)
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="relative">
        <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar por nombre, placa o teléfono…"
          class="w-64 rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
        />
      </div>

      <select
        v-model="statusFilter"
        class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
      >
        <option value="all">Todos los estados</option>
        <option value="active">Activos</option>
        <option value="suspended">Suspendidos</option>
        <option value="pending">Pendientes</option>
      </select>
    </div>

    <DataTable
      :columns="columns"
      :rows="filtered"
      :loading="data.loading.value"
      empty-text="No hay conductores que coincidan"
    >
      <template #cell-name="{ row }">
        <div class="flex items-center gap-2">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-full bg-carsigo-50 text-xs font-semibold text-carsigo-700"
          >
            {{ (row.name || '?').charAt(0).toUpperCase() }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-medium text-neutral-800">{{ row.name || '—' }}</p>
            <p class="truncate text-xs text-neutral-500">{{ row.email || '—' }}</p>
          </div>
        </div>
      </template>

      <template #cell-vehicle_type="{ row }">
        <Badge v-if="row.vehicle_type" :label="row.vehicle_type" />
        <span v-else class="text-neutral-400">—</span>
      </template>

      <template #cell-status="{ row }">
        <Badge :label="row.status" />
      </template>

      <template #cell-is_available="{ row }">
        <span
          class="inline-flex h-2 w-2 rounded-full"
          :class="row.is_available ? 'bg-emerald-500' : 'bg-neutral-300'"
          :title="row.is_available ? 'Disponible' : 'No disponible'"
        />
      </template>

      <template #cell-registered="{ row }">
        <span class="text-neutral-500">{{ formatDate(row.created_at) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <button
          class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
          :class="
            row.status === 'active'
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
          "
          @click="toggle(row)"
        >
          <Ban v-if="row.status === 'active'" :size="13" />
          <CheckCircle2 v-else :size="13" />
          {{ row.status === 'active' ? 'Suspender' : 'Reactivar' }}
        </button>
      </template>
    </DataTable>
  </div>
</template>
