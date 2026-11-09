<script setup>
/**
 * Zonas de servicio: mapa de cobertura + gestión de geofences.
 *
 * Flujo definitivo (sin dibujo manual):
 * - El mapa (ZoneMap) muestra los municipios del GeoJSON DANE pintados por
 *   estado de negocio: verde (is_active: true), gris (is_active: false),
 *   invisibles los que no están en Firestore.
 * - Creación: el usuario busca un municipio en el mapa y, con match único,
 *   ZoneMap emite 'create-zone' → createZoneWithTariffs() crea el geofence
 *   (slug derivado del nombre oficial DANE) y clona las tarifas de la zona
 *   maestra con writeBatch(s) atómicos.
 * - Eliminación: borrado EN CASCADA (geofence + rate_cards + rate_schedules +
 *   dynamic_pricing_rules con zone_id == slug) previa confirmación.
 */
import { computed, onMounted, ref } from 'vue'
import { MapPin, PencilRuler, Plus, Power, Trash2 } from 'lucide-vue-next'
import ZoneMap from '../components/ZoneMap.vue'
import Modal from '../components/ui/Modal.vue'
import ConfirmDialog from '../components/ui/ConfirmDialog.vue'
import Badge from '../components/ui/Badge.vue'
import {
  createZoneWithTariffs,
  MASTER_ZONE_SLUG,
  zonesService,
} from '../services/data.js'
import { useAsyncData } from '../composables/useAsyncData.js'
import { useToast } from '../composables/useToast.js'

const toast = useToast()

const zones = ref([])
const selectedId = ref(null)
const saving = ref(false)
const confirmOpen = ref(false)
const zoneToDelete = ref(null)

const zonesData = useAsyncData(() => zonesService.list())

/* Editor de techos por distancia (geofences.rings) */
const ringsOpen = ref(false)
/** Copia editable del array rings: [{max_km, car, moto}] */
const ringsForm = ref([])

/** Techos del geofence de la zona; el motor de precios los lee por orden. */
const selectedRings = computed(() =>
  Array.isArray(selected.value?.rings) ? selected.value.rings : [],
)

const selected = computed(() => zones.value.find((z) => z.id === selectedId.value) || null)

const stats = computed(() => {
  const active = zones.value.filter((z) => z.is_active).length
  return { total: zones.value.length, active, inactive: zones.value.length - active }
})

async function load() {
  const data = await zonesData.refresh()
  if (data) zones.value = data
}

onMounted(load)

function selectZone(id) {
  selectedId.value = id
}

/** Abre el editor de techos con una copia editable (números normalizados). */
function openRingsEditor() {
  ringsForm.value = selectedRings.value.map((r) => ({
    max_km: numOr(r?.max_km, 0),
    car: numOr(r?.car, 0),
    moto: numOr(r?.moto, 0),
  }))
  ringsOpen.value = true
}

function numOr(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function addRingRow() {
  const max = ringsForm.value.at(-1)?.max_km ?? 0
  ringsForm.value.push({ max_km: max + 2, car: 0, moto: 0 })
}

function removeRingRow(index) {
  ringsForm.value.splice(index, 1)
}

async function saveRings() {
  if (!selected.value) return
  // Normaliza y parte: el motor de precios corta en el PRIMERO ring con
  // distance <= max_km, así que el orden ascendente es obligatorio.
  const rings = ringsForm.value
    .filter((r) => r.max_km > 0)
    .map((r) => ({
      max_km: numOr(r.max_km, 0),
      car: numOr(r.car, 0),
      moto: numOr(r.moto, 0),
    }))
    .sort((a, b) => a.max_km - b.max_km)

  try {
    await zonesService.update(selected.value.id, { rings })
    toast.success(`Techos de «${selected.value.municipality_name}» actualizados (${rings.length} anillo/es)`)
    ringsOpen.value = false
    await load()
  } catch (e) {
    console.error('ERROR AL GUARDAR RINGS:', e)
    toast.error(e?.message || 'No se pudieron guardar los techos')
  }
}

/**
 * Handler del evento 'create-zone' de ZoneMap (match único del buscador).
 * Crea el geofence y clona las tarifas de la zona maestra de forma atómica.
 */
async function handleCreateZone(payload) {
  console.log('1. ZonasView recibió create-zone:', payload?.municipality_name)
  saving.value = true
  try {
    const { id, slug, cloned } = await createZoneWithTariffs(payload)
    const total = cloned.rate_cards + cloned.rate_schedules + cloned.dynamic_pricing_rules
    console.log('Zona creada OK. id:', id, '| slug:', slug, '| tarifas clonadas:', cloned)
    toast.success(
      `Zona «${payload.municipality_name}» creada (slug: ${slug}). ` +
        `Tarifas clonadas de ${MASTER_ZONE_SLUG}: ${total} documento(s).`,
    )
    await load()
    selectedId.value = id
  } catch (e) {
    console.error('ERROR AL CREAR ZONA:', e)
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
  const { id, slug, municipality_name } = zoneToDelete.value
  try {
    const counts = await zonesService.removeCascade(id, slug)
    const total = counts.rate_cards + counts.rate_schedules + counts.dynamic_pricing_rules
    toast.success(
      `Zona «${municipality_name}» eliminada junto con ${total} documento(s) de tarifas.`,
    )
    if (selectedId.value === id) selectedId.value = null
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
      <p v-if="saving" class="text-sm font-medium text-amber-600">Guardando zona…</p>
    </div>

    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <!-- Lista de zonas (columna izquierda) -->
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
          <p class="text-xs text-neutral-500">
            Busca un municipio o ciudad en el mapa y pulsa «Agregar zona» para crear la primera.
          </p>
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
              <p class="truncate text-xs text-neutral-500">
                Slug: {{ zone.slug || '—' }} · {{ formatDate(zone.created_at) }}
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

      <!-- Mapa + Detalle (columna derecha): diseño VERTICAL -->
      <div class="space-y-4">
        <!-- Mapa: altura fija controlada (380px) -->
        <div class="h-[380px] rounded-xl border border-neutral-200 overflow-hidden">
          <ZoneMap :zones="zones" @create-zone="handleCreateZone" />
        </div>

        <!-- Detalle de la zona seleccionada (debajo del mapa, ancho completo) -->
        <div
          v-if="selected"
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

      <!-- Techos por distancia (rings): lo que el motor usa como tope -->
      <div v-if="selectedRings.length" class="mt-4 border-t border-neutral-100 pt-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Techos por distancia (rings)
          </h4>
          <button
            class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-carsigo-600 transition hover:bg-carsigo-50"
            @click="openRingsEditor"
          >
            <PencilRuler :size="13" />
            Editar techos
          </button>
        </div>
        <table class="mt-2 w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-neutral-500">
              <th class="py-1 font-medium">Hasta (km)</th>
              <th class="py-1 font-medium">Tope carro</th>
              <th class="py-1 font-medium">Tope moto</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(ring, index) in selectedRings"
              :key="index"
              class="border-t border-neutral-100"
            >
              <td class="py-1.5 text-neutral-800">≤ {{ ring.max_km }} km</td>
              <td class="py-1.5 font-medium text-neutral-800">
                ${{ Number(ring.car).toLocaleString('es-CO') }}
              </td>
              <td class="py-1.5 font-medium text-neutral-800">
                ${{ Number(ring.moto).toLocaleString('es-CO') }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="mt-1 text-xs text-neutral-400">
          El precio final no supera estos topes (excepto en festivos, donde el
          multiplicador se aplica después del techo).
        </p>
      </div>
    </div>
      </div>
    </div>

    <!-- Modal: editor de techos por distancia (rings) -->
    <Modal v-model="ringsOpen" title="Techos por distancia" size="sm">
      <p class="mb-3 text-xs text-neutral-500">
        El motor corta el subtotal en el tope del primer anillo cuya distancia
        alcanza el viaje. Guárdalos en orden ascendente (se ordenan
        automáticamente al guardar).
      </p>
      <div class="space-y-2">
        <div class="grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 text-xs font-medium text-neutral-500">
          <span>Hasta (km)</span>
          <span>Tope carro</span>
          <span>Tope moto</span>
          <span />
        </div>
        <div
          v-for="(ring, index) in ringsForm"
          :key="index"
          class="grid grid-cols-[1fr_1fr_1fr_2rem] items-center gap-2"
        >
          <input
            v-model.number="ring.max_km"
            type="number"
            min="0"
            step="1"
            class="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-carsigo-500"
          />
          <input
            v-model.number="ring.car"
            type="number"
            min="0"
            step="100"
            class="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-carsigo-500"
          />
          <input
            v-model.number="ring.moto"
            type="number"
            min="0"
            step="100"
            class="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-carsigo-500"
          />
          <button
            class="rounded p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
            title="Eliminar anillo"
            @click="removeRingRow(index)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
      <button
        class="mt-3 inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
        @click="addRingRow"
      >
        <Plus :size="13" />
        Añadir anillo
      </button>

      <template #footer>
        <button
          class="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          @click="ringsOpen = false"
        >
          Cancelar
        </button>
        <button
          class="rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-carsigo-700 disabled:opacity-60"
          @click="saveRings"
        >
          Guardar techos
        </button>
      </template>
    </Modal>

    <ConfirmDialog
      v-model="confirmOpen"
      title="Eliminar zona"
      message="Al eliminar esta zona, se eliminarán también sus tarifas asociadas. ¿Estás seguro?"
      confirm-label="Eliminar"
      @confirm="confirmDelete"
    />
  </div>
</template>
