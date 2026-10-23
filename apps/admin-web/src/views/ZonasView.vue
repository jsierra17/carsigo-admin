<script setup>
/**
 * Zonas de servicio: mapa de cobertura + gestión de geofences.
 *
 * Permite listar, activar/desactivar y eliminar zonas, y dibujar una nueva
 * zona haciendo clic en el mapa (el polígono se guarda como `boundary`
 * (array {lat,lng}) y `boundaries` (GeoJSON)).
 */
import { computed, onMounted, ref } from 'vue'
import { MapPin, Pencil, Plus, Power, Trash2, X } from 'lucide-vue-next'
import ZoneMap from '../components/ZoneMap.vue'
import Modal from '../components/ui/Modal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import Badge from '../components/ui/Badge.vue'
import { zonesService } from '../services/data.js'
import { pathsToGeoJson } from '../services/google-maps.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'

const toast = useToast()

const zones = ref([])
const selectedId = ref(null)
const drawing = ref(false)
const draftPath = ref([])
const saving = ref(false)
const confirmOpen = ref(false)
const zoneToDelete = ref(null)

const createOpen = ref(false)
const form = ref({ municipality_name: '', base_multiplier: 1, is_active: true })

const zonesData = useAsyncData(() => zonesService.list())

const selected = computed(() => zones.value.find((z) => z.id === selectedId.value) || null)

const stats = computed(() => {
  const active = zones.value.filter((z) => z.is_active).length
  return { total: zones.value.length, active, inactive: zones.value.length - active }
})

async function load() {
  const data = await zonesData.refresh()
  if (data) {
    zones.value = data
    if (!selectedId.value && data.length) selectZone(data[0].id)
  }
}

onMounted(load)

function selectZone(id) {
  selectedId.value = id
}

function startDrawing() {
  drawing.value = true
  draftPath.value = []
  createOpen.value = false
  toast.info('Haz clic en el mapa para delimitar la nueva zona')
}

function addVertex(point) {
  draftPath.value = [...draftPath.value, point]
}

function cancelDrawing() {
  drawing.value = false
  draftPath.value = []
}

function openCreateForm() {
  form.value = { municipality_name: '', base_multiplier: 1, is_active: true }
  createOpen.value = true
}

async function saveDraftZone() {
  if (draftPath.value.length < 3) {
    toast.error('El polígono necesita al menos 3 vértices')
    return
  }
  if (!form.value.municipality_name.trim()) {
    toast.error('Escribe el nombre del municipio')
    return
  }

  saving.value = true
  try {
    const boundaries = pathsToGeoJson(draftPath.value)
    const boundary = draftPath.value.map((p) => ({ lat: p.lat, lng: p.lng }))

    const id = await zonesService.create({
      municipality_name: form.value.municipality_name.trim(),
      boundaries,
      boundary: draftPath.value.map((p) => ({ lat: p.lat, lng: p.lng })),
      is_active: form.value.is_active,
      base_multiplier: Number(form.value.base_multiplier) || 1,
    })

    toast.success('Zona creada')
    cancelDrawing()
    await load()
    selectedId.value = id
  } catch (e) {
    toast.error(e?.message || 'No se pudo crear la zona')
  } finally {
    saving.value = false
  }
}

async function toggleZone(zone) {
  try {
    await zonesService.toggleStatus(zone.id, zone.is_active)
    toast.success(zone.is_active ? 'Zona desactivada' : 'Zona activada')
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo actualizar la zona')
  }
}

function askDelete(zone) {
  zoneToDelete.value = zone
  confirmOpen.value = true
}

async function confirmDelete() {
  if (!zoneToDelete.value) return
  try {
    await zonesService.remove(zoneToDelete.value.id)
    toast.success('Zona eliminada')
    if (selectedId.value === zoneToDelete.value.id) selectedId.value = null
    zoneToDelete.value = null
    confirmOpen.value = false
    await load()
  } catch (e) {
    toast.error(e?.message || 'No se pudo eliminar la zona')
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
    <!-- Encabezado -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-neutral-900">Zonas de servicio</h2>
        <p class="text-sm text-neutral-500">
          {{ stats.total }} zona(s) · {{ stats.active }} activa(s) · {{ stats.inactive }} inactiva(s)
        </p>
      </div>
      <div class="flex gap-2">
        <button
          v-if="!drawing"
          class="inline-flex items-center gap-2 rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700"
          @click="startDrawing"
        >
          <Plus :size="16" />
          Nueva zona
        </button>
        <template v-else>
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            @click="cancelDrawing"
          >
            <X :size="16" />
            Cancelar
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
            :disabled="draftPath.length < 3"
            @click="openCreateForm"
          >
            <MapPin :size="16" />
            Guardar ({{ draftPath.length }} vértices)
          </button>
        </template>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <!-- Lista de zonas -->
      <div class="space-y-2">
        <div
          v-if="zonesData.loading.value"
          class="rounded-xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-500"
        >
          Cargando zonas…
        </div>

        <div
          v-else-if="!zones.length"
          class="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center"
        >
          <MapPin :size="28" class="mx-auto text-neutral-300" />
          <p class="mt-2 text-sm font-medium text-neutral-700">No hay zonas registradas</p>
          <p class="text-xs text-neutral-500">Crea la primera con el botón «Nueva zona».</p>
        </div>

        <button
          v-for="zone in zones"
          :key="zone.id"
          class="w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:shadow"
          :class="
            zone.id === selectedId
              ? 'border-carsigo-400 ring-2 ring-carsigo-100'
              : 'border-neutral-200'
          "
          @click="selectZone(zone.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-neutral-800">
                {{ zone.municipality_name }}
              </p>
              <p class="text-xs text-neutral-500">
                Multiplicador {{ zone.base_multiplier ?? 1 }} ·
                {{ formatDate(zone.created_at) }}
              </p>
            </div>
            <Badge :label="zone.is_active ? 'active' : 'inactive'" />
          </div>

          <div class="mt-2 flex gap-1 border-t border-neutral-100 pt-2">
            <button
              class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100"
              @click.stop="toggleZone(zone)"
            >
              <Power :size="13" />
              {{ zone.is_active ? 'Desactivar' : 'Activar' }}
            </button>
            <button
              class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
              @click.stop="askDelete(zone)"
            >
              <Trash2 :size="13" />
              Eliminar
            </button>
          </div>
        </button>
      </div>

      <!-- Mapa -->
      <div class="h-[520px] lg:h-[calc(100vh-16rem)]">
        <ZoneMap
          :zones="zones"
          :selected-id="selectedId"
          :draft-path="draftPath"
          :drawing="drawing"
          @select-zone="selectZone"
          @add-vertex="addVertex"
        />
      </div>
    </div>

    <!-- Detalle de la zona seleccionada -->
    <div
      v-if="selected && !drawing"
      class="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <h3 class="text-sm font-semibold text-neutral-800">
        {{ selected.municipality_name }}
      </h3>
      <dl class="mt-2 grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-xs text-neutral-500">Slug</dt>
          <dd class="font-medium text-neutral-800">{{ selected.slug || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs text-neutral-500">Multiplicador</dt>
          <dd class="font-medium text-neutral-800">{{ selected.base_multiplier ?? 1 }}</dd>
        </div>
        <div>
          <dt class="text-xs text-neutral-500">Centro</dt>
          <dd class="font-medium text-neutral-800">
            {{ selected.center_lat?.toFixed?.(4) ?? '—' }},
            {{ selected.center_lng?.toFixed?.(4) ?? '—' }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-neutral-500">Radio urbano</dt>
          <dd class="font-medium text-neutral-800">{{ selected.urban_radius_km ?? '—' }} km</dd>
        </div>
      </dl>
    </div>

    <!-- Modal: datos de la nueva zona -->
    <Modal v-model="createOpen" title="Nueva zona de servicio" size="sm">
      <div class="space-y-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-neutral-600">
            Nombre del municipio <span class="text-red-500">*</span>
          </span>
          <input
            v-model="form.municipality_name"
            type="text"
            placeholder="Ej. El Carmen de Bolívar"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
          />
        </label>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-neutral-600">
            Multiplicador de tarifa
          </span>
          <input
            v-model="form.base_multiplier"
            type="number"
            step="0.1"
            min="0"
            class="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-carsigo-500 focus:ring-2 focus:ring-carsigo-100"
          />
        </label>

        <label class="flex items-center gap-2 text-sm text-neutral-700">
          <input v-model="form.is_active" type="checkbox" class="rounded border-neutral-300" />
          Zona activa
        </label>
      </div>

      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="createOpen = false"
        >
          Cancelar
        </button>
        <button
          class="rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
          :disabled="saving"
          @click="saveDraftZone"
        >
          {{ saving ? 'Guardando…' : 'Guardar zona' }}
        </button>
      </template>
    </Modal>

    <ConfirmDialog
      v-model="confirmOpen"
      title="Eliminar zona"
      :message="`¿Eliminar «${zoneToDelete?.municipality_name}»? Esta acción no se puede deshacer.`"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
    />
  </div>
</template>
