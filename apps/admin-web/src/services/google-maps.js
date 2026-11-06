/**
 * Carga perezosa de la Google Maps JavaScript API.
 *
 * La API se inicializa una sola vez por sesión del navegador. Si la clave no
 * está configurada, se lanza un error descriptivo en lugar de fallar en silencio.
 */
import { Loader } from '@googlemaps/js-api-loader'

let loaderPromise = null

export function getMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
}

export function isMapsConfigured() {
  return Boolean(getMapsApiKey())
}

/**
 * @returns {Promise<typeof google.maps>}
 */
export function loadGoogleMaps() {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return Promise.resolve(window.google.maps)
  }
  if (!loaderPromise) {
    const apiKey = getMapsApiKey()
    if (!apiKey) {
      return Promise.reject(
        new Error(
          'Falta la clave de Google Maps. Define VITE_GOOGLE_MAPS_KEY en el .env de la raíz.',
        ),
      )
    }
    loaderPromise = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['geometry'],
    }).load()
  }
  return loaderPromise
}

/**
 * Convierte un GeoJSON (string u objeto) en una lista de anillos de
 * `{ lat, lng }`. Soporta Polygon y MultiPolygon.
 * @returns {Array<Array<{lat:number,lng:number}>>}
 */
export function geoJsonToPaths(geojson) {
  if (!geojson) return []
  let parsed = geojson
  if (typeof geojson === 'string') {
    try {
      parsed = JSON.parse(geojson)
    } catch {
      return []
    }
  }
  if (!parsed || !parsed.coordinates) return []

  const polygons = parsed.type === 'MultiPolygon' ? parsed.coordinates : [parsed.coordinates]
  return polygons
    .map((poly) => poly?.[0])
    .filter((ring) => Array.isArray(ring) && ring.length >= 3)
    .map((ring) => ring.map(([lng, lat]) => ({ lat, lng })))
}

/**
 * Convierte una lista de puntos `{lat,lng}` en un GeoJSON Polygon.
 * @returns {string} GeoJSON serializado
 */
export function pathsToGeoJson(paths) {
  const ring = paths.map((p) => [p.lng, p.lat])
  if (ring.length > 0) ring.push(ring[0])
  return JSON.stringify({
    type: 'Polygon',
    coordinates: [ring],
  })
}

/** Centro (lat/lng) de una lista de puntos. */
export function centerOf(paths) {
  if (!paths?.length) return null
  const lat = paths.reduce((s, p) => s + p.lat, 0) / paths.length
  const lng = paths.reduce((s, p) => s + p.lng, 0) / paths.length
  return { lat, lng }
}
