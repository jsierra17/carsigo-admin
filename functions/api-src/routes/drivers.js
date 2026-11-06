import { Router } from 'express'
import { getDb, toPlainDocs } from '../lib/firebase-admin.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
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
 * Extrae la última ubicación conocida del conductor.
 * Soporta varias formas de almacenamiento según cómo se haya escrito el perfil.
 */
function extractLocation(profile) {
  const candidates = [
    [profile?.last_lat, profile?.last_lng],
    [profile?.current_lat, profile?.current_lng],
    [profile?.lat, profile?.lng],
  ]
  for (const [lat, lng] of candidates) {
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
  }
  const loc = profile?.location
  if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    return { lat: loc.latitude, lng: loc.longitude }
  }
  return null
}

/**
 * GET /api/drivers/nearby
 * Query: lat, lng, radius_km (default 10)
 *
 * Conductores con `driver_profiles.status === 'active'`, enrichidos con los
 * datos del documento `users` correspondiente (name, phone, avatar_url).
 */
router.get('/nearby', requireAuth, requireAdmin, readRateLimit, async (req, res, next) => {
  try {
    const lat = Number.parseFloat(req.query.lat)
    const lng = Number.parseFloat(req.query.lng)
    const radiusKm = Number.parseFloat(req.query.radius_km) || 10

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat y lng son requeridos y deben ser numéricos' })
    }

    const db = getDb()

    const snap = await db
      .collection('driver_profiles')
      .where('status', '==', 'active')
      .get()

    const profiles = toPlainDocs(snap)

    // Enriquecer con `users` (docId == user_id)
    const userIds = [...new Set(profiles.map((p) => p.user_id || p.id).filter(Boolean))]
    const usersById = new Map()
    if (userIds.length > 0) {
      const usersSnap = await db.getAll(
        userIds.map((uid) => db.collection('users').doc(uid)),
      )
      usersSnap.forEach((doc) => {
        if (doc.exists) usersById.set(doc.id, doc.data())
      })
    }

    const drivers = profiles
      .map((profile) => {
        const userId = profile.user_id || profile.id
        const user = usersById.get(userId) || {}
        const location = extractLocation(profile)
        const distance =
          location ? distanceKm(lat, lng, location.lat, location.lng) : null

        return {
          user_id: userId,
          name: user.full_name || user.name || null,
          phone: user.phone || null,
          avatar_url: user.avatar_url || null,
          vehicle_type: profile.vehicle_type || null,
          plate: profile.plate || null,
          is_available: profile.is_available ?? null,
          location,
          distance_km: distance === null ? null : Math.round(distance * 100) / 100,
        }
      })
      // Filtra por radio solo los que tienen ubicación conocida
      .filter((d) => d.distance_km === null || d.distance_km <= radiusKm)
      .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))

    res.json(drivers)
  } catch (error) {
    next(error)
  }
})

export default router
