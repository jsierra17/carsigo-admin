<script setup>
/**
 * Tarifas: tarjetas de tarifa (`rate_cards`) y turnos (`rate_schedules`).
 *
 * Ambas colecciones se administran directamente contra Firestore. Cada tarifa
 * y cada turno pertenece a una zona (`zone_id` = slug del municipio).
 */
import { computed, onMounted, ref, watch } from 'vue'
import { Copy, Layers, Pencil, Plus, Trash2, Wallet } from 'lucide-vue-next'
import DataTable from '../components/ui/DataTable.vue'
import Modal from '../components/ui/Modal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import Badge from '../components/ui/Badge.vue'
import FormField from '../components/ui/FormField.vue'
import { tarifasService } from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'

const toast = useToast()

const cards = ref([])
const schedules = ref([])
const zones = ref([])
const selectedZone = ref('')
const tab = ref('cards')

const data = useAsyncData(() => tarifasService.getAll())

const modal = ref({ open: false, kind: 'card', item: null })
const confirm = ref({ open: false, kind: null, item: null })
const copyOpen = ref(false)
const copyForm = ref({ source: '', target: '' })
const migrateOpen = ref(false)
const busy = ref(false)

const zoneName = (id) => zones.value.find((z) => z.id === id)?.municipality_name || id || '—'

const visibleCards = computed(() =>
  selectedZone.value ? cards.value.filter((c) => c.zone_id === selectedZone.value) : cards.value,
)
const visibleSchedules = computed(() =>
  selectedZone.value
    ? schedules.value.filter((s) => s.zone_id === selectedZone.value)
    : schedules.value,
)

const cardColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'vehicle_type', label: 'Vehículo' },
  { key: 'base_fee', label: 'Base', align: 'right' },
  { key: 'minimum_fare', label: 'Mínimo', align: 'right' },
  { key: 'included_km', label: 'Km incl.', align: 'right' },
  { key: 'tier1_rate_per_km', label: '$/km (1)', align: 'right' },
  { key: 'tier2_rate_per_km', label: '$/km (2)', align: 'right' },
  { key: 'commission_percent', label: 'Comisión %', align: 'right' },
  { key: 'zone', label: 'Zona' },
  { key: 'actions', label: '', align: 'right' },
]

const scheduleColumns = [
  { key: 'name', label: 'Nombre' },
  { key: 'vehicle_type', label: 'Vehículo' },
  { key: 'day_type', label: 'Días' },
  { key: 'shift_start', label: 'Desde' },
  { key: 'shift_end', label: 'Hasta' },
  { key: 'base_fee', label: 'Base', align: 'right' },
  { key: 'hourly_increase_percent', label: '%/hora', align: 'right' },
  { key: 'zone', label: 'Zona' },
  { key: 'actions', label: '', align: 'right' },
]

const emptyCard = () => ({
  id: null,
  name: '',
  vehicle_type: 'car',
  base_fee: 4500,
  minimum_fare: 4500,
  included_km: 1.5,
  tier1_max_km: 4,
  tier1_rate_per_km: 1000,
  tier2_max_km: 8,
  tier2_rate_per_km: 1200,
  commission_percent: 12,
  price_per_km: 0,
  price_per_minute: 0,
  free_waiting_minutes: 5,
  waiting_price_per_minute: 200,
  extra_km_percent: 0,
  zone_id: selectedZone.value || zones.value[0]?.id || '',
  is_active: true,
})

const emptySchedule = () => ({
  id: null,
  name: '',
  vehicle_type: 'car',
  day_type: 'weekday',
  shift_label: 'day',
  shift_start: '05:00',
  shift_end: '18:29',
  base_fee: 4500,
  hourly_increase_percent: 0.4,
  zone_id: selectedZone.value || zones.value[0]?.id || '',
  is_active: true,
})

const form = ref(emptyCard())

async function load() {
  const result = await data.refresh()
  if (!result) return
  cards.value = result.cards
  schedules.value = result.schedules
  zones.value = result.zones
  if (!selectedZone.value) selectedZone.value = result.defaultZoneId || result.zones[0]?.id || ''
}

onMounted(load)

watch(selectedZone, () => {
  if (modal.value.open) {
    form.value.zone_id = selectedZone.value || zones.value[0]?.id || ''
  }
})

function openCreate(kind) {
  form.value = kind === 'card' ? emptyCard() : emptySchedule()
  modal.value = { open: true, kind, item: null }
}

function openEdit(kind, item) {
  form.value = { ...item }
  modal.value = { open: true, kind, item }
}

async function save() {
  busy.value = true
  try {
    const payload = { ...form.value }
    delete payload.id

    if (modal.value.kind === 'card') {
      if (modal.value.item) await tarifasService.updateCard(modal.value.item.id, payload)
      else await tarifasService.createCard(payload)
    } else {
      if (modal.value.item) await tarifasService.updateSchedule(modal.value.item.id, payload)
      else await tarifasService.createSchedule(payload)
    }

    toast.success(modal.value.item ? 'Cambios guardados' : 'Creado correctamente')
    modal.value.open = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo guardar')
  } finally {
    busy.value = false
  }
}

function askDelete(kind, item) {
  confirm.value = { open: true, kind, item }
}

async function confirmDelete() {
  const { kind, item } = confirm.value
  try {
    if (kind === 'card') await tarifasService.removeCard(item.id)
    else await tarifasService.removeSchedule(item.id)
    toast.success('Eliminado')
    confirm.value.open = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo eliminar')
  }
}

async function doCopy() {
  if (!copyForm.value.source || !copyForm.value.target) {
    toast.error('Selecciona la zona origen y la zona destino')
    return
  }
  if (copyForm.value.source === copyForm.value.target) {
    toast.error('Las zonas deben ser distintas')
    return
  }
  busy.value = true
  try {
    const result = await tarifasService.copyZonePricing(
      copyForm.value.source,
      copyForm.value.target,
    )
    toast.success(`Copiado: ${result.cards} tarifas y ${result.schedules} turnos`)
    copyOpen.value = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo copiar')
  } finally {
    busy.value = false
  }
}

async function doMigrate() {
  if (!selectedZone.value) {
    toast.error('Selecciona la zona destino en el filtro superior')
    return
  }
  busy.value = true
  try {
    const counts = await tarifasService.migrateLegacyPricing(selectedZone.value)
    const total = Object.values(counts).reduce((s, n) => s + n, 0)
    toast.success(`${total} registros migrados a ${zoneName(selectedZone.value)}`)
    migrateOpen.value = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo migrar')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-neutral-900">Tarifas</h2>
        <p class="text-sm text-neutral-500">
          Tarjetas de tarifa y turnos con incremento por hora
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="copyOpen = true"
        >
          <Copy :size="16" />
          Copiar entre zonas
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="migrateOpen = true"
        >
          <Layers :size="16" />
          Migrar sin zona
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700"
          @click="openCreate(tab)"
        >
          <Plus :size="16" />
          {{ tab === 'cards' ? 'Nueva tarifa' : 'Nuevo turno' }}
        </button>
      </div>
    </div>

    <!-- Filtro de zona + pestañas -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
        <button
          v-for="t in [
            { id: 'cards', label: 'Tarifas base' },
            { id: 'schedules', label: 'Turnos y horarios' },
          ]"
          :key="t.id"
          class="rounded-md px-3 py-1.5 text-sm font-medium transition"
          :class="
            tab === t.id
              ? 'bg-carsigo-600 text-white'
              : 'text-neutral-600 hover:bg-neutral-100'
          "
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <label class="flex items-center gap-2 text-sm text-neutral-600">
        <span class="font-medium">Zona</span>
        <select
          v-model="selectedZone"
          class="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-carsigo-500"
        >
          <option value="">Todas las zonas</option>
          <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.municipality_name }}</option>
        </select>
      </label>
    </div>

    <!-- Tabla de tarjetas -->
    <DataTable
      v-if="tab === 'cards'"
      :columns="cardColumns"
      :rows="visibleCards"
      :loading="data.loading.value"
      empty-text="No hay tarjetas de tarifa para esta zona"
    >
      <template #cell-vehicle_type="{ row }">
        <Badge :label="row.vehicle_type" />
      </template>
      <template #cell-zone="{ row }">
        <span class="text-neutral-600">{{ zoneName(row.zone_id) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-carsigo-600"
            title="Editar"
            @click="openEdit('card', row)"
          >
            <Pencil :size="15" />
          </button>
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
            title="Eliminar"
            @click="askDelete('card', row)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </template>
    </DataTable>

    <!-- Tabla de turnos -->
    <DataTable
      v-else
      :columns="scheduleColumns"
      :rows="visibleSchedules"
      :loading="data.loading.value"
      empty-text="No hay turnos para esta zona"
    >
      <template #cell-vehicle_type="{ row }">
        <Badge :label="row.vehicle_type" />
      </template>
      <template #cell-day_type="{ row }">
        <Badge :label="row.day_type" />
      </template>
      <template #cell-zone="{ row }">
        <span class="text-neutral-600">{{ zoneName(row.zone_id) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-carsigo-600"
            title="Editar"
            @click="openEdit('schedule', row)"
          >
            <Pencil :size="15" />
          </button>
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
            title="Eliminar"
            @click="askDelete('schedule', row)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </template>
    </DataTable>

    <!-- Modal de edición -->
    <Modal
      :model-value="modal.open"
      :title="`${modal.item ? 'Editar' : 'Nuevo'} ${modal.kind === 'card' ? 'tarjeta' : 'turno'}`"
      size="lg"
      @update:model-value="modal.open = $event"
    >
      <div v-if="modal.kind === 'card'" class="grid gap-3 sm:grid-cols-2">
        <FormField label="Nombre" required>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
          />
        </FormField>
        <FormField label="Vehículo" required>
          <select
            v-model="form.vehicle_type"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option value="car">Carro</option>
            <option value="moto">Moto</option>
          </select>
        </FormField>
        <FormField label="Tarifa base" required>
          <input
            v-model.number="form.base_fee"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Tarifa mínima" required>
          <input
            v-model.number="form.minimum_fare"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Km incluidos" hint="Se cobran a partir de este valor">
          <input
            v-model.number="form.included_km"
            type="number"
            step="0.1"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Comisión (%)" required>
          <input
            v-model.number="form.commission_percent"
            type="number"
            step="0.1"
            min="0"
            max="100"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Tope tramo 1 (km)">
          <input
            v-model.number="form.tier1_max_km"
            type="number"
            step="0.5"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="$ por km (tramo 1)">
          <input
            v-model.number="form.tier1_rate_per_km"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Tope tramo 2 (km)">
          <input
            v-model.number="form.tier2_max_km"
            type="number"
            step="0.5"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="$ por km (tramo 2)">
          <input
            v-model.number="form.tier2_rate_per_km"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Minutos de espera gratis">
          <input
            v-model.number="form.free_waiting_minutes"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="$ por minuto de espera">
          <input
            v-model.number="form.waiting_price_per_minute"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Zona" required>
          <select
            v-model="form.zone_id"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.municipality_name }}</option>
          </select>
        </FormField>
      </div>

      <div v-else class="grid gap-3 sm:grid-cols-2">
        <FormField label="Nombre" required>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
          />
        </FormField>
        <FormField label="Vehículo" required>
          <select
            v-model="form.vehicle_type"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option value="car">Carro</option>
            <option value="moto">Moto</option>
          </select>
        </FormField>
        <FormField label="Tipo de día" required>
          <select
            v-model="form.day_type"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option value="weekday">Lunes a jueves</option>
            <option value="weekend">Viernes a domingo</option>
            <option value="special">Fecha especial</option>
          </select>
        </FormField>
        <FormField label="Etiqueta del turno" required>
          <select
            v-model="form.shift_label"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option value="day">Día</option>
            <option value="night">Noche</option>
            <option value="morning">Mañana</option>
            <option value="evening">Tarde</option>
          </select>
        </FormField>
        <FormField label="Hora de inicio" required>
          <input
            v-model="form.shift_start"
            type="time"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Hora de fin" required>
          <input
            v-model="form.shift_end"
            type="time"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Tarifa base del turno" required>
          <input
            v-model.number="form.base_fee"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField
          label="% de incremento por hora"
          hint="Se aplica sobre la base según las horas desde el inicio del turno"
        >
          <input
            v-model.number="form.hourly_increase_percent"
            type="number"
            step="0.1"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>
        <FormField label="Zona" required>
          <select
            v-model="form.zone_id"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.municipality_name }}</option>
          </select>
        </FormField>
      </div>

      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="modal.open = false"
        >
          Cancelar
        </button>
        <button
          class="rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
          :disabled="busy"
          @click="save"
        >
          {{ busy ? 'Guardando…' : 'Guardar' }}
        </button>
      </template>
    </Modal>

    <!-- Modal: copiar entre zonas -->
    <Modal v-model="copyOpen" title="Copiar tarifas entre zonas" size="sm">
      <div class="space-y-3">
        <FormField label="Zona origen" required>
          <select
            v-model="copyForm.source"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option value="">Selecciona…</option>
            <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.municipality_name }}</option>
          </select>
        </FormField>
        <FormField label="Zona destino" required>
          <select
            v-model="copyForm.target"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option value="">Selecciona…</option>
            <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.municipality_name }}</option>
          </select>
        </FormField>
      </div>
      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="copyOpen = false"
        >
          Cancelar
        </button>
        <button
          class="rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
          :disabled="busy"
          @click="doCopy"
        >
          Copiar
        </button>
      </template>
    </Modal>

    <!-- Modal: migrar configuración sin zona -->
    <Modal v-model="migrateOpen" title="Migrar configuración sin zona" size="sm">
      <p class="text-sm text-neutral-600">
        Asocia todos los registros que no tienen zona (tarjetas, turnos y reglas de precio
        dinámico) a la zona seleccionada en el filtro superior:
        <strong class="text-neutral-800">{{ zoneName(selectedZone) }}</strong
        >.
      </p>
      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="migrateOpen = false"
        >
          Cancelar
        </button>
        <button
          class="rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
          :disabled="busy"
          @click="doMigrate"
        >
          Migrar
        </button>
      </template>
    </Modal>

    <ConfirmDialog
      :model-value="confirm.open"
      :title="`Eliminar ${confirm.kind === 'card' ? 'tarjeta' : 'turno'}`"
      :message="`¿Eliminar «${confirm.item?.name}»?`"
      confirm-label="Eliminar"
      @update:model-value="confirm.open = $event"
      @confirm="confirmDelete"
    />
  </div>
</template>
