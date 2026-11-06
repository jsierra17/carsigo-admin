import { Router } from 'express'
import { getDb, toPlainDocs } from '../lib/firebase-admin.js'
import { requireAuth } from '../middleware/auth.js'
import { readRateLimit } from '../middleware/rate-limit.js'

const router = Router()

const EARTH_RADIUS_KM = 6371

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Ray casting: ¿el punto está dentro del anillo?
 * @param {number} testLat @param {number} testLng
 * @param {Array<{lat:number,lng:number}>} ring
 */
export function pointInRing(testLat, testLng, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng
    const yi = ring[i].lat
    const xj = ring[j].lng
    const yj = ring[j].lat
    const intersects = yi > testLat !== yj > testLat &&
      testLng < ((xj - xi) * (testLat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Normaliza `urban_polygons` (objeto de anillos o lista de anillos) a lista de anillos. */
function extractRings(polygons) {
  if (!polygons) return []
  const rings = Array.isArray(polygons) ? polygons : Object.values(polygons)
  return rings
    .map((ring) =>
      Array.isArray(ring)
        ? ring
            .filter((p) => p && typeof p.lat === 'number' && typeof p.lng === 'number')
            .map((p) => ({ lat: p.lat, lng: p.lng }))
        : null,
    )
    .filter((ring) => ring && ring.length >= 3)
}

/**
 * POST /api/zones/check
 * Body: { lat, lng }
 *
 * Determina si un punto cae dentro de alguna geofence activa.
 * - `contains`: dentro del polígono principal de servicio (`boundary`).
 * - `contains_urban`: dentro de un corredor (`urban_polygons`) o del casco
 *   urbano (radio `urban_radius_km` alrededor de `center_lat/center_lng`).
 */
router.post('/check', requireAuth, readRateLimit, async (req, res, next) => {
  try {
    const { lat, lng } = req.body || {}

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat y lng son requeridos' })
    }

    const db = getDb()
    const snap = await db.collection('geofences').where('is_active', '==', true).get()
    const zones = toPlainDocs(snap)

    for (const zone of zones) {
      const boundary = Array.isArray(zone.boundary) ? zone.boundary : []
      const contains = pointInRing(lat, lng, boundary)

      // Corredores de servicio
      const urbanRings = extractRings(zone.urban_polygons)
      const inCorridor = urbanRings.some((ring) => pointInRing(lat, lng, ring))

      // Casco urbano (radio)
      const centerLat = typeof zone.center_lat === 'number' ? zone.center_lat : null
      const centerLng = typeof zone.center_lng === 'number' ? zone.center_lng : null
      const urbanRadiusKm = typeof zone.urban_radius_km === 'number' ? zone.urban_radius_km : 2.5
      const inUrbanCore =
        centerLat !== null &&
        centerLng !== null &&
        distanceKm(lat, lng, centerLat, centerLng) <= urbanRadiusKm

      if (contains || inCorridor || inUrbanCore) {
        return res.json({
          zone: {
            id: zone.id,
            municipality_name: zone.municipality_name,
            base_multiplier: zone.base_multiplier ?? 1,
            slug: zone.slug ?? null,
            center_lat: zone.center_lat ?? null,
            center_lng: zone.center_lng ?? null,
          },
          contains,
          contains_urban: inCorridor || inUrbanCore,
        })
      }
    }

    res.json({ zone: null, contains: false, contains_urban: false })
  } catch (error) {
    next(error)
  }
})

export default router
