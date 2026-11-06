#!/usr/bin/env node
/**
 * Constructor de geofences para CarSiGo.
 *
 * Genera el polígono de área de servicio a partir de:
 *   - un círculo para el casco urbano (radio configurable), y
 *   - el buffer de N metros alrededor del eje de cada corredor vial,
 *     usando la polilínea real de Google Directions API.
 *
 * Salida: un JSON con `boundary` (array de {lat,lng}), `boundaries` (GeoJSON
 * en string) y `urban_polygons` (mapa de corredores) — el formato exacto que
 * consume `zone_service.dart` (Flutter) y el panel admin.
 *
 * Uso:
 *   node scripts/geofence-builder.js                  # muestra el resultado
 *   node scripts/geofence-builder.js --write          # escribe en Firestore
 *   node scripts/geofence-builder.js --corridor=x     # solo un corredor
 *
 * Variables de entorno:
 *   GOOGLE_WEB_SERVICES_KEY   API key de Google Maps (Places/Directions)
 *   FIREBASE_SERVICE_ACCOUNT  ruta al service account (para --write)
 *   ZONE_ID                   id del documento en `geofences` (por defecto: el de
 *                              El Carmen de Bolívar)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as turf from '@turf/turf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CONFIG = {
  town: { lat: 9.7205, lng: -75.1174 },
  urbanRadiusKm: 2.5,
  bufferMeters: 200,

  // Corredores: destino + waypoints opcionales (fuerzan el recorrido).
  corridors: {
    cansona: {
      label: 'Cansona (hasta Institución Educativa Caracolí)',
      dest: '9.7317,-75.2653',
      waypoints: 'via:9.7334,-75.1667|via:9.7095,-75.2012|via:9.7500,-75.2333',
    },
    malanoche: {
      label: 'Mala Noche (RN 25 hacia San Jacinto)',
      dest: '9.75039,-75.12026',
      waypoints: 'via:9.75039,-75.12026',
    },
    miraflores: {
      label: 'Miraflores (Ruta del Sol - Sector 3, antes de Roma)',
      dest: '9.7180,-75.0800',
      waypoints: 'via:9.7180,-75.0800',
    },
    verdun: {
      label: 'Verdún (centro poblado)',
      dest: '9.7180213,-75.1209887',
      waypoints: 'via:9.7180213,-75.1209887',
    },
  },
}

const ZONE_ID =
  process.env.ZONE_ID || '17oKw6fEKDE7vkHZkHwe' // El Carmen de Bolívar

// ── Utilidades ─────────────────────────────────────────────────────────────

function decodePolyline(encoded) {
  const points = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let b
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dlat
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += dlng
    points.push([lng / 1e5, lat / 1e5])
  }
  return points
}

function readRootEnv() {
  const env = {}
  for (const file of ['.env', '.env.production']) {
    const full = path.join(ROOT, file)
    if (!fs.existsSync(full)) continue
    for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#') || !line.includes('=')) continue
      const i = line.indexOf('=')
      const key = line.slice(0, i).trim()
      const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
      if (!(key in env)) env[key] = value
    }
  }
  return env
}

function distanceKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// ── Generador ──────────────────────────────────────────────────────────────

async function fetchRoute(key, corridor) {
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${CONFIG.town.lat},${CONFIG.town.lng}` +
    `&destination=${corridor.dest}&waypoints=${corridor.waypoints}&mode=driving&key=${key}`

  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK') {
    throw new Error(`Directions ${data.status}: ${data.error_message || ''}`)
  }

  const route = data.routes[0]
  const km = route.legs.reduce((sum, leg) => sum + leg.distance.value / 1000, 0)
  const points = decodePolyline(route.overview_polyline.points)
  return { km, points }
}

async function build() {
  const env = { ...readRootEnv(), ...process.env }
  const key = env.GOOGLE_WEB_SERVICES_KEY || env.VITE_GOOGLE_MAPS_KEY
  if (!key) {
    throw new Error(
      'Falta GOOGLE_WEB_SERVICES_KEY (o VITE_GOOGLE_MAPS_KEY) en el .env',
    )
  }

  const only = process.argv.find((a) => a.startsWith('--corridor='))?.split('=')[1]

  // Casco urbano
  const townCircle = turf.circle(
    turf.point([CONFIG.town.lng, CONFIG.town.lat]),
    CONFIG.urbanRadiusKm,
    { units: 'kilometers' },
  )

  const urbanPolygons = {
    town: townCircle.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng })),
  }
  let boundary = townCircle
  const report = []

  for (const [key2, corridor] of Object.entries(CONFIG.corridors)) {
    if (only && only !== key2) continue

    const { km, points } = await fetchRoute(key, corridor)
    const line = turf.lineString(points)
    const buffered = turf.buffer(line, CONFIG.bufferMeters, { units: 'meters' })

    urbanPolygons[key2] = buffered.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
    boundary = turf.union(turf.featureCollection([boundary, buffered]))

    report.push({ corredor: key2, km: Number(km.toFixed(2)), puntos: points.length })
    console.log(`  ✓ ${corridor.label} — ${km.toFixed(2)} km`)
  }

  const isMulti = boundary.geometry.type === 'MultiPolygon'
  const ring = isMulti
    ? boundary.geometry.coordinates[0][0]
    : boundary.geometry.coordinates[0]

  const result = {
    boundary_array: ring.map(([lng, lat]) => ({ lat, lng })),
    boundaries_geojson: JSON.stringify(boundary.geometry),
    urban_polygons_map: urbanPolygons,
  }

  // Área total en km²
  const area = turf.area(turf.feature(boundary.geometry)) / 1e6

  console.log('\n  ── Resultado ──')
  console.log(`  Tipo de geometría : ${boundary.geometry.type}`)
  console.log(`  Puntos del borde   : ${result.boundary_array.length}`)
  console.log(`  Área de servicio   : ${area.toFixed(1)} km²`)
  console.log(`  Corredores         : ${Object.keys(urbanPolygons).join(', ')}`)
  console.log(`  Radio casco urbano : ${CONFIG.urbanRadiusKm} km`)
  console.log(`  Buffer de corredor : ${CONFIG.bufferMeters} m\n`)

  return { result, report, area }
}

async function writeToFirestore(result) {
  const env = { ...readRootEnv(), ...process.env }
  const saPath = env.FIREBASE_SERVICE_ACCOUNT
  if (!saPath) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT')

  const { cert, getApps, initializeApp } = await import('firebase-admin/app')
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore')

  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, 'utf8'))) })
  }
  const db = getFirestore()

  await db
    .collection('geofences')
    .doc(ZONE_ID)
    .update({
      boundary: result.boundary_array,
      boundaries: result.boundaries_geojson,
      urban_polygons: result.urban_polygons_map,
      updated_at: FieldValue.serverTimestamp(),
    })

  console.log(`  ✓ Escrito en geofences/${ZONE_ID}`)
}

const args = process.argv.slice(2)
console.log('\n=== CarSiGo · Constructor de geofences ===\n')

try {
  const { result } = await build()

  if (args.includes('--write')) {
    await writeToFirestore(result)
    console.log('')
  } else {
    const out = path.join(ROOT, 'geofence_output.json')
    fs.writeFileSync(out, JSON.stringify(result))
    console.log(`  (no se escribió en Firestore; JSON en ${out})`)
    console.log('  Usa --write para actualizar Firestore\n')
  }
} catch (error) {
  console.error('\n  ERROR:', error.message, '\n')
  process.exit(1)
}
