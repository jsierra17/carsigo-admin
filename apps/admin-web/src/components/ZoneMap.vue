<script setup>
/**
 * Mapa de zonas de servicio con la Google Maps JS API.
 *
 * Dibuja un polígono por geofence (a partir del campo `boundaries` en GeoJSON),
 * resalta la zona seleccionada y permite dibujar un borrador haciendo clic.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle, Loader2 } from 'lucide-vue-next'
import { geoJsonToPaths, loadGoogleMaps } from '../services/google-maps.js'

const props = defineProps({
  zones: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  draftPath: { type: Array, default: () => [] },
  drawing: { type: Boolean, default: false },
  center: { type: Object, default: () => ({ lat: 9.7205, lng: -75.1174 }) },
  zoom: { type: Number, default: 12 },
})

const emit = defineEmits(['select-zone', 'add-vertex'])

const mapEl = ref(null)
const loading = ref(true)
const error = ref(null)

let maps = null
let map = null
let listeners = []
const zonePolygons = new Map()

const COLORS = {
  default: { fill: '#1fa578', stroke: '#106b51' },
  inactive: { fill: '#9ca3af', stroke: '#6b7280' },
  selected: { fill: '#3b82f6', stroke: '#1d4ed8' },
  draft: { fill: '#f59e0b', stroke: '#b45309' },
}

function clearListeners() {
  listeners.forEach((l) => l.remove())
  listeners = []
}

function clearPolygons() {
  zonePolygons.forEach((polygon) => polygon.setMap(null))
  zonePolygons.clear()
}

function renderZones() {
  if (!map || !maps) return
  clearPolygons()

  for (const zone of props.zones) {
    const paths = geoJsonToPaths(zone.boundaries)
    if (!paths.length) continue

    const isSelected = zone.id === props.selectedId
    const palette = isSelected
      ? COLORS.selected
      : zone.is_active
        ? COLORS.default
        : COLORS.inactive

    paths.forEach((path) => {
      const polygon = new maps.Polygon({
        paths: path.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: palette.stroke,
        strokeOpacity: 0.9,
        strokeWeight: isSelected ? 3 : 2,
        fillColor: palette.fill,
        fillOpacity: isSelected ? 0.35 : 0.2,
        clickable: true,
        zIndex: isSelected ? 10 : 1,
      })
      polygon.setMap(map)
      zonePolygons.set(zone.id, polygon)

      const listener = polygon.addListener('click', () => emit('select-zone', zone.id))
      listeners.push(listener)
    })
  }
}

let draftPolyline = null
let draftMarkers = []

function renderDraft() {
  if (!map || !maps) return

  if (draftPolyline) {
    draftPolyline.setMap(null)
    draftPolyline = null
  }
  draftMarkers.forEach((m) => m.setMap(null))
  draftMarkers = []

  const path = props.draftPath
  if (!path.length) return

  if (path.length > 1) {
    draftPolyline = new maps.Polyline({
      path: path.map((p) => ({ lat: p.lat, lng: p.lng })),
      strokeColor: COLORS.draft.stroke,
      strokeOpacity: 1,
      strokeWeight: 3,
      zIndex: 20,
    })
    draftPolyline.setMap(map)
  }

  path.forEach((p) => {
    const marker = new maps.Marker({
      position: { lat: p.lat, lng: p.lng },
      map,
      zIndex: 21,
    })
    draftMarkers.push(marker)
  })
}

onMounted(async () => {
  try {
    maps = await loadGoogleMaps()
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

    const clickListener = map.addListener('click', (e) => {
      if (!props.drawing) return
      const latLng = e.latLng
      emit('add-vertex', { lat: latLng.lat(), lng: latLng.lng() })
    })
    listeners.push(clickListener)

    loading.value = false
    renderZones()
    renderDraft()
  } catch (e) {
    console.error('[ZoneMap]', e)
    error.value = e?.message || 'No se pudo cargar el mapa'
    loading.value = false
  }
})

watch(() => props.zones, renderZones, { deep: true })
watch(() => props.selectedId, renderZones)
watch(() => props.draftPath, renderDraft, { deep: true })

onBeforeUnmount(() => {
  clearListeners()
  clearPolygons()
  if (draftPolyline) draftPolyline.setMap(null)
  draftMarkers.forEach((m) => m.setMap(null))
})
</script>

<template>
  <div class="relative h-full w-full overflow-hidden rounded-xl bg-neutral-100">
    <div ref="mapEl" class="h-full w-full" />

    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center gap-2 bg-neutral-100 text-sm text-neutral-500"
    >
      <Loader2 :size="16" class="animate-spin" />
      Cargando mapa…
    </div>

    <div
      v-if="error"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-50 p-6 text-center"
    >
      <AlertTriangle :size="28" class="text-amber-500" />
      <p class="text-sm font-medium text-neutral-800">Mapa no disponible</p>
      <p class="max-w-sm text-xs text-neutral-500">{{ error }}</p>
    </div>

    <div
      v-if="drawing"
      class="pointer-events-none absolute inset-x-0 top-0 bg-amber-500/90 px-4 py-2 text-center text-xs font-medium text-white"
    >
      Modo dibujo: haz clic en el mapa para agregar vértices
    </div>
  </div>
</template>
