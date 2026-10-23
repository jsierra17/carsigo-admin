<script setup>
/**
 * Precio dinámico: reglas de multiplicador por fecha, día u hora.
 *
 * Colección `dynamic_pricing_rules`. El motor de tarifas busca la primera
 * regla que coincida (ordenada por `priority` descendente) y aplica su
 * `multiplier`.
 */
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import DataTable from '../components/ui/DataTable.vue'
import Modal from '../components/ui/Modal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import FormField from '../components/ui/FormField.vue'
import Badge from '../components/ui/Badge.vue'
import { precioDinamicoService, tarifasService } from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'

const toast = useToast()

const rules = ref([])
const zones = ref([])
const modal = ref({ open: false, item: null })
const confirm = ref({ open: false, item: null })
const busy = ref(false)

const data = useAsyncData(() => precioDinamicoService.list())

const RULE_TYPES = [
  { id: 'specific_date', label: 'Fecha específica' },
  { id: 'date_range', label: 'Rango de fechas' },
  { id: 'day_of_week', label: 'Días de la semana' },
  { id: 'time_range', label: 'Rango horario' },
]

const WEEKDAYS = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' },
  { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' },
  { id: 6, label: 'Sáb' },
  { id: 7, label: 'Dom' },
]

const columns = [
  { key: 'name', label: 'Regla' },
  { key: 'rule_type', label: 'Tipo' },
  { key: 'schedule', label: 'Aplicación' },
  { key: 'multiplier', label: 'Multiplicador', align: 'right' },
  { key: 'priority', label: 'Prioridad', align: 'right' },
  { key: 'vehicle_type', label: 'Vehículo' },
  { key: 'zone', label: 'Zona' },
  { key: 'actions', label: '', align: 'right' },
]

const empty = () => ({
  id: null,
  name: '',
  description: '',
  rule_type: 'specific_date',
  multiplier: 1.25,
  priority: 100,
  is_active: true,
  vehicle_type: null,
  zone_id: zones.value[0]?.id || '',
  specific_date: new Date().toISOString().slice(0, 10),
  is_recurring: true,
  date_from: new Date().toISOString().slice(0, 10),
  date_to: new Date().toISOString().slice(0, 10),
  days_of_week: [],
  start_time: '18:00',
  end_time: '23:00',
  flat_surcharge: 0,
})

const form = ref(empty())

async function load() {
  const [ruleList, zoneList] = await Promise.all([
    data.refresh(),
    tarifasService.listZones(),
  ])
  if (ruleList) rules.value = ruleList
  if (zoneList) zones.value = zoneList
}

onMounted(load)

const zoneName = (id) =>
  zones.value.find((z) => z.id === id)?.municipality_name || (id ? id : 'Global')

function describeSchedule(rule) {
  switch (rule.rule_type) {
    case 'specific_date':
      return rule.specific_date + (rule.is_recurring ? ' (anual)' : '')
    case 'date_range':
      return `${rule.date_from} → ${rule.date_to}`
    case 'day_of_week': {
      const days = Array.isArray(rule.days_of_week) ? rule.days_of_week : []
      return days.map((d) => WEEKDAYS.find((w) => w.id === d)?.label || d).join(', ') || '—'
    }
    case 'time_range':
      return `${rule.start_time} → ${rule.end_time}`
    default:
      return '—'
  }
}

function openCreate() {
  form.value = empty()
  modal.value = { open: true, item: null }
}

function openEdit(rule) {
  form.value = { ...rule, days_of_week: Array.isArray(rule.days_of_week) ? [...rule.days_of_week] : [] }
  modal.value = { open: true, item: rule }
}

async function save() {
  busy.value = true
  try {
    const payload = { ...form.value }
    delete payload.id
    payload.multiplier = Number(payload.multiplier) || 1
    payload.priority = Number(payload.priority) || 0

    if (modal.value.item) await precioDinamicoService.update(modal.value.item.id, payload)
    else await precioDinamicoService.create(payload)

    toast.success(modal.value.item ? 'Regla actualizada' : 'Regla creada')
    modal.value.open = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo guardar la regla')
  } finally {
    busy.value = false
  }
}

function askDelete(rule) {
  confirm.value = { open: true, item: rule }
}

async function confirmDelete() {
  try {
    await precioDinamicoService.remove(confirm.value.item.id)
    toast.success('Regla eliminada')
    confirm.value.open = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo eliminar la regla')
  }
}

function toggleDay(day) {
  const days = form.value.days_of_week
  const index = days.indexOf(day)
  if (index >= 0) days.splice(index, 1)
  else days.push(day)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-neutral-900">Precio dinámico</h2>
        <p class="text-sm text-neutral-500">
          Multiplicadores por festivo, fecha, día u hora
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700"
        @click="openCreate"
      >
        <Plus :size="16" />
        Nueva regla
      </button>
    </div>

    <DataTable
      :columns="columns"
      :rows="rules"
      :loading="data.loading.value"
      empty-text="No hay reglas de precio dinámico"
    >
      <template #cell-rule_type="{ row }">
        <span class="text-neutral-600">
          {{ RULE_TYPES.find((t) => t.id === row.rule_type)?.label || row.rule_type }}
        </span>
      </template>
      <template #cell-schedule="{ row }">
        <span class="text-neutral-600">{{ describeSchedule(row) }}</span>
      </template>
      <template #cell-multiplier="{ row }">
        <span class="font-semibold text-neutral-800">×{{ Number(row.multiplier).toFixed(2) }}</span>
      </template>
      <template #cell-vehicle_type="{ row }">
        <Badge v-if="row.vehicle_type" :label="row.vehicle_type" />
        <span v-else class="text-xs text-neutral-400">Todos</span>
      </template>
      <template #cell-zone="{ row }">
        <span class="text-neutral-600">{{ zoneName(row.zone_id) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-carsigo-600"
            title="Editar"
            @click="openEdit(row)"
          >
            <Pencil :size="15" />
          </button>
          <button
            class="rounded p-1.5 text-neutral-500 transition hover:bg-red-50 hover:text-red-600"
            title="Eliminar"
            @click="askDelete(row)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </template>
    </DataTable>

    <Modal
      :model-value="modal.open"
      :title="modal.item ? 'Editar regla' : 'Nueva regla'"
      size="lg"
      @update:model-value="modal.open = $event"
    >
      <div class="grid gap-3 sm:grid-cols-2">
        <FormField label="Nombre" required>
          <input
            v-model="form.name"
            type="text"
            placeholder="Ej. Año Nuevo"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
          />
        </FormField>

        <FormField label="Descripción">
          <input
            v-model="form.description"
            type="text"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>

        <FormField label="Tipo de regla" required>
          <select
            v-model="form.rule_type"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option v-for="t in RULE_TYPES" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
        </FormField>

        <FormField label="Multiplicador" required hint="1.25 = +25% sobre la tarifa">
          <input
            v-model.number="form.multiplier"
            type="number"
            step="0.05"
            min="0.1"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>

        <FormField label="Prioridad" hint="Mayor = se evalúa antes">
          <input
            v-model.number="form.priority"
            type="number"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          />
        </FormField>

        <FormField label="Vehículo" hint="Vacío = aplica a todos">
          <select
            v-model="form.vehicle_type"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option :value="null">Todos</option>
            <option value="car">Carro</option>
            <option value="moto">Moto</option>
          </select>
        </FormField>

        <FormField label="Zona" hint="Vacío = regla global">
          <select
            v-model="form.zone_id"
            class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
          >
            <option :value="null">Global</option>
            <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.municipality_name }}</option>
          </select>
        </FormField>

        <!-- Campos por tipo de regla -->
        <template v-if="form.rule_type === 'specific_date'">
          <FormField label="Fecha" required>
            <input
              v-model="form.specific_date"
              type="date"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
            />
          </FormField>
          <FormField label="¿Se repite cada año?">
            <select
              v-model="form.is_recurring"
              class="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-carsigo-500"
            >
              <option :value="true">Sí</option>
              <option :value="false">No</option>
            </select>
          </FormField>
        </template>

        <template v-else-if="form.rule_type === 'date_range'">
          <FormField label="Desde" required>
            <input
              v-model="form.date_from"
              type="date"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
            />
          </FormField>
          <FormField label="Hasta" required>
            <input
              v-model="form.date_to"
              type="date"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
            />
          </FormField>
        </template>

        <template v-else-if="form.rule_type === 'day_of_week'">
          <div class="sm:col-span-2">
            <span class="mb-1 block text-xs font-medium text-neutral-600">Días</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="d in WEEKDAYS"
                :key="d.id"
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                :class="
                  form.days_of_week.includes(d.id)
                    ? 'bg-carsigo-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                "
                @click="toggleDay(d.id)"
              >
                {{ d.label }}
              </button>
            </div>
          </div>
        </template>

        <template v-else-if="form.rule_type === 'time_range'">
          <FormField label="Desde" required>
            <input
              v-model="form.start_time"
              type="time"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
            />
          </FormField>
          <FormField label="Hasta" required>
            <input
              v-model="form.end_time"
              type="time"
              class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500"
            />
          </FormField>
          <div class="sm:col-span-2">
            <span class="mb-1 block text-xs font-medium text-neutral-600">Días</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="d in WEEKDAYS"
                :key="d.id"
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
                :class="
                  form.days_of_week.includes(d.id)
                    ? 'bg-carsigo-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                "
                @click="toggleDay(d.id)"
              >
                {{ d.label }}
              </button>
            </div>
          </div>
        </template>
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

    <ConfirmDialog
      :model-value="confirm.open"
      title="Eliminar regla"
      :message="`¿Eliminar «${confirm.item?.name}»?`"
      confirm-label="Eliminar"
      @update:model-value="confirm.open = $event"
      @confirm="confirmDelete"
    />
  </div>
</template>
