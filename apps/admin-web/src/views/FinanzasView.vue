<script setup>
/**
 * Finanzas: volumen, comisión y liquidaciones.
 */
import { computed, onMounted, ref } from 'vue'
import { Banknote, Percent, TrendingUp, Users } from 'lucide-vue-next'
import StatCard from '../components/ui/StatCard.vue'
import DataTable from '../components/ui/DataTable.vue'
import Modal from '../components/ui/Modal.vue'
import Badge from '../components/ui/Badge.vue'
import FormField from '../components/ui/FormField.vue'
import { finanzasService } from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'

const toast = useToast()

const settlements = ref([])
const stats = ref({
  conductoresActivos: 0,
  volumenTotal: 0,
  comisionCarSiGo: 0,
  tieneDataReal: false,
})
const settleOpen = ref(false)
const settleForm = ref({ amount: 0, driverCount: 0, volumeBase: 0 })
const busy = ref(false)

const statsData = useAsyncData(() => finanzasService.getStats())
const settlementsData = useAsyncData(() => finanzasService.listSettlements())

const columns = [
  { key: 'reference', label: 'Referencia' },
  { key: 'total_amount', label: 'Monto', align: 'right' },
  { key: 'volume_base', label: 'Volumen base', align: 'right' },
  { key: 'drivers_involved', label: 'Conductores', align: 'right' },
  { key: 'status', label: 'Estado' },
  { key: 'created_at', label: 'Fecha' },
]

async function load() {
  const [s, l] = await Promise.all([statsData.refresh(), settlementsData.refresh()])
  if (s) stats.value = s
  if (l) settlements.value = l
}

onMounted(load)

function openSettlement() {
  settleForm.value = {
    amount: stats.value.volumenTotal,
    driverCount: stats.value.conductoresActivos,
    volumeBase: stats.value.volumenTotal,
  }
  settleOpen.value = true
}

async function createSettlement() {
  busy.value = true
  try {
    const reference = await finanzasService.performSettlement({
      amount: Number(settleForm.value.amount) || 0,
      driverCount: Number(settleForm.value.driverCount) || 0,
      volumeBase: Number(settleForm.value.volumeBase) || 0,
    })
    toast.success(`Liquidación ${reference} registrada`)
    settleOpen.value = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo registrar la liquidación')
  } finally {
    busy.value = false
  }
}

const currency = (value) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

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
      <h2 class="text-lg font-semibold text-neutral-900">Finanzas</h2>
      <p class="text-sm text-neutral-500">Volumen, comisión y liquidaciones</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Volumen total"
        :value="currency(stats.volumenTotal)"
        :icon="TrendingUp"
        tone="brand"
        :hint="stats.tieneDataReal ? 'Viajes completados' : 'Sin datos de viajes'"
      />
      <StatCard
        label="Comisión CarSiGo"
        :value="currency(stats.comisionCarSiGo)"
        :icon="Percent"
        tone="success"
        hint="Porcentaje de cada tarifa"
      />
      <StatCard
        label="Conductores activos"
        :value="stats.conductoresActivos"
        :icon="Users"
        tone="default"
      />
      <StatCard
        label="Liquidaciones"
        :value="settlements.length"
        :icon="Banknote"
        tone="warning"
      />
    </div>

    <div class="flex justify-end">
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700"
        @click="openSettlement"
      >
        <Banknote :size="16" />
        Registrar liquidación
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="settlements"
      :loading="settlementsData.loading.value"
      empty-text="No hay liquidaciones registradas"
    >
      <template #cell-reference="{ row }">
        <span class="font-mono text-xs text-neutral-700">{{ row.reference }}</span>
      </template>
      <template #cell-total_amount="{ row }">
        {{ currency(row.total_amount) }}
      </template>
      <template #cell-volume_base="{ row }">
        {{ currency(row.volume_base) }}
      </template>
      <template #cell-status="{ row }">
        <Badge :label="row.status" />
      </template>
      <template #cell-created_at="{ row }">
        <span class="text-neutral-500">{{ formatDate(row.created_at) }}</span>
      </template>
    </DataTable>

    <Modal v-model="settleOpen" title="Registrar liquidación" size="sm">
      <div class="space-y-3">
        <FormField label="Monto a liquidar" required>
          <input
            v-model.number="settleForm.amount"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Volumen base">
          <input
            v-model.number="settleForm.volumeBase"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Conductores involucrados">
          <input
            v-model.number="settleForm.driverCount"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
      </div>
      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="settleOpen = false"
        >
          Cancelar
        </button>
        <button
          class="rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
          :disabled="busy"
          @click="createSettlement"
        >
          {{ busy ? 'Registrando…' : 'Registrar' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
