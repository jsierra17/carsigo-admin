<script setup>
/**
 * Mapa de zonas de servicio con la Google Maps JS API.
 *
 * Lógica de negocio definitiva:
 * - Silueta REAL de los 1122 municipios de Colombia (GeoJSON DANE vía
 *   geoBoundaries, en `public/geo/colombia-municipios.geojson`, capa map.data).
 * - ESTILO CONDICIONAL: verde los municipios con geofence `is_active: true`,
 *   gris los `is_active: false`, invisibles los que no estén en Firestore.
 * - Buscador: compara contra los features del GeoJSON (no usa Geocoder),
 *   resalta el feature y encuadra con fitBounds. Con match (único) permite
 *   "Agregar zona", que emite 'create-zone' para que la vista cree el
 *   documento + clone las tarifas de la zona maestra.
 * - Sin polígonos azules ni dibujo manual: la geometría real manda.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle, Loader2, Plus, Search, X } from 'lucide-vue-next'
import { loadGoogleMaps } from '../services/google-maps.js'

const props = defineProps({
  zones: { type: Array, default: () => [] },
  center: { type: Object, default: () => ({ lat: 9.7205, lng: -75.1174 }) },
  zoom: { type: Number, default: 12 },
})

const emit = defineEmits(['create-zone'])

const mapEl = ref(null)
const loading = ref(true)
const error = ref(null)

/* Estado del buscador de municipios (GeoJSON) */
const searchQuery = ref('')
const searching = ref(false)
const searchError = ref('')
/** Información del último match (único) para el botón Agregar zona. */
const foundMunicipality = ref(null)

let maps = null
let map = null
let geoLoadPromise = null
let listeners = []
/** features resaltados temporalmente por el buscador; se revierten con revertStyle. */
let highlightedFeatures = []

const COLORS = {
  active: { fill: '#1fa578', stroke: '#106b51', opacity: 0.45 },
  inactive: { fill: '#9ca3af', stroke: '#6b7280', opacity: 0.45 },
  highlight: { fill: '#f59e0b', stroke: '#b45309', opacity: 0.55 },
}

/** URL del GeoJSON de municipios servido desde Vite/Firebase Hosting. */
const MUNICIPIOS_GEOJSON_URL = '/geo/colombia-municipios.geojson'

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos/diacríticos
}

/**
 * Alias para nombres problemáticos en el GeoJSON (truncados, abreviados, etc.).
 * Clave = término de búsqueda normalizado; Valor = nombre real en shapeName (normalizado).
 * Así "barranquilla" -> "distrito especial industrial y portuario de barr*".
 */
const SEARCH_ALIASES = {
  barranquilla: 'distrito especial industrial y portuario de barr*',
  bogota: 'bogota, d.c.',
  'bogota d.c.': 'bogota, d.c.',
}

/**
 * Resuelve un término de búsqueda a su alias real si existe.
 * @param {string} term - término ya normalizado
 * @returns {string} - término a buscar realmente en el GeoJSON
 */
function resolveSearchAlias(term) {
  return SEARCH_ALIASES[term] || term
}

/** Trunca nombres largos para el botón, tooltip muestra el nombre completo. */
function truncateName(name, max = 38) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

/** Mapa: clave normalizada del municipio -> is_active de su geofence. */
function zoneStatusIndex() {
  const index = new Map()
  for (const zone of props.zones) {
    if (!zone?.municipality_name) continue
    index.set(normalizeName(zone.municipality_name), !!zone.is_active)
  }
  return index
}

function clearListeners() {
  listeners.forEach((l) => l.remove())
  listeners = []
}

function clearHighlights() {
  if (!map) return
  highlightedFeatures.forEach((feature) => map.data.revertStyle(feature))
  highlightedFeatures = []
}

/**
 * Aplica los estilos de negocio sobre TODOS los features:
 * - con geofence activo     -> verde
 * - con geofence inactivo   -> gris
 * - sin geofence            -> restaura estilo base (transparente)
 */
async function syncZoneStyles() {
  if (!map) return
  if (geoLoadPromise) await geoLoadPromise

  const status = zoneStatusIndex()
  clearHighlights()
  map.data.forEach((feature) => {
    const key = normalizeName(feature.getProperty('shapeName'))
    if (!status.has(key)) {
      if (feature.getProperty('zoneStyled') === true) {
        map.data.revertStyle(feature)
        feature.setProperty('zoneStyled', false)
      }
      return
    }
    const palette = status.get(key) ? COLORS.active : COLORS.inactive
    map.data.overrideStyle(feature, {
      fillColor: palette.fill,
      fillOpacity: palette.opacity,
      strokeColor: palette.stroke,
      strokeOpacity: 0.9,
      strokeWeight: 1.5,
    })
    feature.setProperty('zoneStyled', true)
  })
}

/** Hook de Google: la API key fue rechazada por Maps JS API. */
function onAuthFailure() {
  console.error('[ZoneMap] gm_authFailure: Maps JS API rechazó la API key (dominio/API/cuota).')
  error.value =
    'Google Maps rechazó la autenticación de la API key (gm_authFailure). Revisa restricciones de sitio web y APIs habilitadas.'
}

/**
 * Busca un municipio o ciudad EN EL GEOJSON (no usa Geocoder): recorre los
 * features de `map.data`, resalta los que coinciden con `overrideStyle` y
 * encuadra el mapa a los límites reales con `fitBounds`.
 * Normaliza (minúsculas, sin tildes) y usa búsqueda parcial (includes)
 * para tolerar nombres como "Barranquilla" vs "Barranquilla D.E.".
 */
async function handleSearch() {
  const query = searchQuery.value.trim()
  searchError.value = ''
  foundMunicipality.value = null
  if (!query || !map) {
    clearHighlights()
    return
  }

  console.log('Buscando municipio/ciudad en GeoJSON:', query)

  searching.value = true
  try {
    // Espera a que loadGeoJson termine (el archivo pesa ~10MB la 1a vez).
    if (geoLoadPromise) await geoLoadPromise

    const normalized = normalizeName(query)
    // Resuelve alias (ej. "barranquilla" -> "distrito especial industrial y portuario de barr*")
    const searchTerm = resolveSearchAlias(normalized)

    // Búsqueda flexible: normaliza ambos lados y usa includes().
    // Prioridad: EXACTO -> EMPIEZA POR -> CONTIENE.
    const exact = []
    const starts = []
    const contains = []
    map.data.forEach((feature) => {
      const n = normalizeName(feature.getProperty('shapeName'))
      if (n === searchTerm) exact.push(feature)
      else if (n.startsWith(searchTerm)) starts.push(feature)
      else if (n.includes(searchTerm)) contains.push(feature)
    })
    const cands = exact.length ? exact : starts.length ? starts : contains

    console.log('Buscando:', query, '| normalizado:', normalized, '| término real:', searchTerm, '| coincidencias exactas:', exact.length, '| empiezan por:', starts.length, '| contienen:', contains.length)

    if (!cands.length) {
      searchError.value = `La ciudad o municipio ingresado no se encuentra en Colombia o no está disponible en la base de datos. Por favor, verifica el nombre.`
      return
    }
    if (cands.length > 1) {
      searchError.value = `Hay ${cands.length} municipios o ciudades que coinciden: sé más específico.`
      return
    }

    const feature = cands[0]
    const shapeName = feature.getProperty('shapeName')

    // Resalta el feature (temporal, sobre el estilo de negocio).
    highlightedFeatures.forEach((f) => map.data.revertStyle(f))
    highlightedFeatures = [feature]
    map.data.overrideStyle(feature, {
      fillColor: COLORS.highlight.fill,
      fillOpacity: COLORS.highlight.opacity,
      strokeColor: COLORS.highlight.stroke,
      strokeWeight: 3,
      strokeOpacity: 1,
    })

    // Encuadra a los límites REALES del municipio.
    const bounds = new maps.LatLngBounds()
    feature.getGeometry().forEachLatLng((latLng) => bounds.extend(latLng))
    if (bounds.isEmpty()) {
      searchError.value = 'No se pudieron calcular los límites del municipio.'
      return
    }
    map.fitBounds(bounds)

    foundMunicipality.value = { name: shapeName, feature }
    console.log('Seleccionado:', shapeName, bounds)
  } catch (e) {
    console.error('[ZoneMap] Error al buscar en el GeoJSON:', e)
    searchError.value = 'No se pudieron procesar los límites del municipio.'
  } finally {
    searching.value = false
  }
}

/**
 * Límite de vértices por anillo al persistir. El GeoJSON DANE llega a ~70k
 * vértices y un documento de Firestore admite 1MB: decimamos el anillo para
 * que `boundary` (array) y `boundaries` (GeoJSON string) quepan siempre. La
 * silueta que se dibuja en pantalla es el feature live del GeoJSON, así que
 * esta decimación solo afecta a la copia persistida (precisión sobrada).
 */
const MAX_RING_POINTS = 4000

/**
 * Decima un anillo conservando un submuestreo uniforme (y el último punto,
 * que cierra el polígono en el formato del DANE).
 */
function decimateRing(ring, maxPoints = MAX_RING_POINTS) {
  const valid = ring.filter((p) => Array.isArray(p) && p.length >= 2)
  if (valid.length <= maxPoints) return valid
  const step = Math.ceil(valid.length / maxPoints)
  const out = valid.filter((_, i) => i % step === 0)
  const last = valid[valid.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

/**
 * Extrae las coordenadas GeoJSON de una google.maps.Data.Geometry de forma
 * SÍNCRONA. Nota: Data.Feature NO tiene `toObject()`; `toGeoJson()` es
 * async (callback) y no sirve para construir el payload en el handler.
 * @returns {{type: string, coordinates: unknown[]} | null}
 */
function geometryToGeoJson(geometry) {
  if (!geometry) return null
  const type = geometry.getType()
  try {
    if (type === 'Polygon') {
      const coordinates = geometry
        .getArray() // LinearRing[]
        .map((ring) => ring.getArray().map((ll) => [ll.lng(), ll.lat()]))
      return { type, coordinates }
    }
    if (type === 'MultiPolygon') {
      const coordinates = geometry
        .getArray() // Polygon[]
        .map((polygon) =>
          polygon.getArray().map((ring) => ring.getArray().map((ll) => [ll.lng(), ll.lat()])),
        )
      return { type, coordinates }
    }
    return null
  } catch (e) {
    console.error('[ZoneMap] geometryToGeoJson falló:', e)
    return null
  }
}

/**
 * Convierte el feature del GeoJSON en el payload para `geofences`:
 * `boundaries` (GeoJSON en string) + `boundary` (array de puntos del anillo
 * exterior del primer polígono, lo que consume la app móvil).
 * @returns {object | null} null si la geometría no se puede extrer
 */
function featureToPayload(feature) {
  const geometry = feature.getGeometry()
  const extracted = geometryToGeoJson(geometry)
  if (!extracted?.coordinates?.length) {
    console.error('[ZoneMap] feature sin geometría utilizable:', feature.getProperty('shapeName'))
    return null
  }

  // Decimación: asegura que el documento quepa en Firestore.
  const coordinates =
    extracted.type === 'MultiPolygon'
      ? extracted.coordinates.map((polygon) => polygon.map((ring) => decimateRing(ring)))
      : extracted.coordinates.map((ring) => decimateRing(ring))

  const geojson = {
    type: 'Feature',
    geometry: { type: extracted.type, coordinates },
    properties: { shapeName: feature.getProperty('shapeName') },
  }

  // Anillo exterior del primer polígono -> `boundary` array (app móvil).
  const firstPolygon = extracted.type === 'MultiPolygon' ? coordinates[0] : coordinates
  const outerRing = Array.isArray(firstPolygon?.[0]) ? firstPolygon[0] : null
  const boundary = (outerRing || [])
    .map(([lng, lat]) => ({ lat, lng }))

  return {
    municipality_name: feature.getProperty('shapeName') || '',
    boundaries: JSON.stringify(geojson),
    boundary,
  }
}

function emitCreateZone() {
  if (!foundMunicipality.value) return
  try {
    const payload = {
      ...featureToPayload(foundMunicipality.value.feature),
      official_name: foundMunicipality.value.name,
    }
    if (!payload?.boundaries || !payload?.municipality_name) {
      console.error('[ZoneMap] payload inválido al crear zona:', payload)
      searchError.value = 'No se pudo extraer la geometría del municipio. Revisa la consola (F12).'
      return
    }
    console.log(
      '[ZoneMap] create-zone:',
      payload.municipality_name,
      '| boundary pts:',
      payload.boundary.length,
      '| boundaries bytes:',
      payload.boundaries.length,
    )
    emit('create-zone', payload)
  } catch (e) {
    console.error('[ZoneMap] ERROR emit creating zone payload:', e)
    searchError.value = 'Error al preparar los datos de la zona (ver consola).'
  }
}

function handleClearSearch() {
  searchQuery.value = ''
  searchError.value = ''
  foundMunicipality.value = null
  clearHighlights()
  syncZoneStyles()
  map?.setCenter(props.center)
  map?.setZoom(props.zoom)
}

onMounted(async () => {
  try {
    // Garantiza que el DOM (el div del mapa) ya está montado y con tamaño
    // definido: Google Maps necesita un contenedor con alto/ancho reales.
    await nextTick()

    maps = await loadGoogleMaps()

    if (!maps || typeof maps.Map !== 'function') {
      throw new Error(
        'google.maps no está disponible (revisa la API key de Google y si el dominio está autorizado).',
      )
    }

    map = new maps.Map(mapEl.value, {
      center: props.center,
      zoom: props.zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#f8f9fa' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#525f7f' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#f8f9fa' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8eaf0' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eef1f5' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d6e8f5' }] },
      ],
    })

    // Hook de Google cuando la API key es rechazada.
    window.addEventListener('gm_authFailure', onAuthFailure)

    // Sin geofence -> transparente (no se pintan los municipios externos).
    map.data.setStyle({
      fillOpacity: 0,
      strokeOpacity: 0,
      strokeWeight: 0,
      clickable: false,
    })

    geoLoadPromise = new Promise((resolve) => {
      map.data.loadGeoJson(MUNICIPIOS_GEOJSON_URL, {}, (features) => {
        console.log('GeoJSON municipios cargados:', features.length)
        resolve()
      })
    })
    await geoLoadPromise
    await syncZoneStyles()

    loading.value = false
  } catch (e) {
    console.error('[ZoneMap]', e)
    error.value = e?.message || 'No se pudo cargar el mapa'
    loading.value = false
  }
})

// Cuando props.zones cambia (creación, toggle, borrado) se re-pintan los
// colores de negocio (verde/gris/invisible) sobre los features.
watch(
  () => props.zones,
  () => {
    syncZoneStyles()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  clearListeners()
  window.removeEventListener('gm_authFailure', onAuthFailure)
})
</script>

<template>
  <div class="relative h-full min-h-[600px] w-full overflow-hidden rounded-xl bg-neutral-100">
    <div ref="mapEl" class="h-full w-full" />

    <!-- Buscador de municipios y ciudades (lupa) encima del mapa -->
    <div class="absolute left-3 top-3 z-10 w-72 sm:w-80">
      <div
        class="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 shadow-md"
      >
        <Search :size="16" class="shrink-0 text-neutral-400" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar municipio o ciudad…"
          class="w-full border-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-neutral-400"
          @keydown.enter.prevent="handleSearch"
        />
        <Loader2 v-if="searching" :size="16" class="shrink-0 animate-spin text-neutral-400" />
        <button
          v-else-if="searchQuery"
          title="Limpiar búsqueda"
          class="shrink-0 rounded p-0.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          @click="handleClearSearch"
        >
          <X :size="16" />
        </button>
      </div>

      <p
        v-if="searchError"
        class="mt-1 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800 shadow-sm"
      >
        {{ searchError }}
      </p>

      <!-- Agregar zona: visible al tener un match único de municipio o ciudad -->
      <button
        v-if="foundMunicipality"
        class="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-carsigo-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-carsigo-700"
        @click="emitCreateZone"
        :title="foundMunicipality.name"
      >
        <Plus :size="16" />
        Agregar zona: {{ truncateName(foundMunicipality.name) }}
      </button>
    </div>
  </div>
</template>
