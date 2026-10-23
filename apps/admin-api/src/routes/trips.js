import { Router } from 'express'
import { getDb, toPlainDocs, Timestamp, GeoPoint } from '../lib/firebase-admin.js'
import { calculateFare } from '../lib/pricing-engine.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { readRateLimit, writeRateLimit } from '../middleware/rate-limit.js'

const router = Router()

/**
 * Vocabulario único de estados de viaje. Debe coincidir con el que usan
 * la app móvil (trip_service.dart) y las `firestore.rules`; si divergen, la
 * escritura en Firestore se deniega en silencio.
 */
const TRIP_STATUSES = ['pending', 'accepted', 'inProgress', 'completed', 'cancelled']

/**
 * GET /api/trips
 * Query: status, driver_id, passenger_id, limit (default 50)
 */
router.get('/', requireAuth, requireAdmin, readRateLimit, async (req, res, next) => {
  try {
    const { status, driver_id, passenger_id } = req.query
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200)

    const db = getDb()
    let query = db.collection('trips').orderBy('created_at', 'desc')

    if (status) query = query.where('status', '==', status)
    if (driver_id) query = query.where('driver_id', '==', driver_id)
    if (passenger_id) query = query.where('passenger_id', '==', passenger_id)

    const snap = await query.limit(limit).get()
    res.json(toPlainDocs(snap))
  } catch (error) {
    next(error)
  }
})

/**
 * POST /api/trips
 * Crea un viaje pendiente con la tarifa calculada en servidor.
 */
router.post('/', requireAuth, requireAdmin, writeRateLimit, async (req, res, next) => {
  try {
    const {
      passenger_id,
      vehicle_type,
      pickup_address,
      dropoff_address,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      distance_km,
      duration_min,
      zone_id,
    } = req.body || {}

    if (!passenger_id || !vehicle_type || !pickup_address || !dropoff_address) {
      return res.status(400).json({ error: 'Faltan campos requeridos' })
    }

    const db = getDb()

    const fare = await calculateFare({
      vehicle_type,
      distance_km: distance_km || 0,
      duration_min: duration_min || 0,
      zone_id: typeof zone_id === 'string' && zone_id ? zone_id : undefined,
    })

    const tripRef = db.collection('trips').doc()
    const tripId = tripRef.id

    const trip = {
      id: tripId,
      passenger_id,
      status: 'pending',
      fare_amount: fare.final_fare,
      commission_amount: fare.commission_amount,
      pickup_address,
      dropoff_address,
      pickup_location:
        typeof pickup_lat === 'number' && typeof pickup_lng === 'number'
          ? new GeoPoint(pickup_lat, pickup_lng)
          : null,
      dropoff_location:
        typeof dropoff_lat === 'number' && typeof dropoff_lng === 'number'
          ? new GeoPoint(dropoff_lat, dropoff_lng)
          : null,
      pickup_lat: pickup_lat ?? null,
      pickup_lng: pickup_lng ?? null,
      dropoff_lat: dropoff_lat ?? null,
      dropoff_lng: dropoff_lng ?? null,
      distance_km: distance_km || 0,
      duration_min: duration_min || 0,
      vehicle_type,
      created_at: Timestamp.now(),
    }

    await tripRef.set(trip)

    res.status(201).json({ trip: { id: tripId, ...trip }, fare_breakdown: fare })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/trips/:id
 */
router.get('/:id', requireAuth, requireAdmin, readRateLimit, async (req, res, next) => {
  try {
    const db = getDb()
    const snap = await db.collection('trips').doc(req.params.id).get()

    if (!snap.exists) {
      return res.status(404).json({ error: 'Viaje no encontrado' })
    }
    res.json({ id: snap.id, ...snap.data() })
  } catch (error) {
    next(error)
  }
})

/**
 * PATCH /api/trips/:id
 * Body: { status?, driver_id?, driver_lat?, driver_lng? }
 */
router.patch('/:id', requireAuth, requireAdmin, writeRateLimit, async (req, res, next) => {
  try {
    const { status, driver_id, driver_lat, driver_lng } = req.body || {}

    if (status && !TRIP_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'status inválido',
        detail: `Valores permitidos: ${TRIP_STATUSES.join(', ')}`,
      })
    }

    const db = getDb()

    const ref = db.collection('trips').doc(req.params.id)
    const snap = await ref.get()
    if (!snap.exists) {
      return res.status(404).json({ error: 'Viaje no encontrado' })
    }

    const updates = {}
    if (status) updates.status = status
    if (driver_id) updates.driver_id = driver_id
    if (driver_lat !== undefined) updates.driver_lat = driver_lat
    if (driver_lng !== undefined) updates.driver_lng = driver_lng

    const now = Timestamp.now()
    if (status === 'accepted') updates.accepted_at = now
    if (status === 'active' || status === 'inProgress') updates.started_at = now
    if (status === 'completed') updates.completed_at = now

    await ref.update(updates)

    const updated = await ref.get()
    res.json({ id: updated.id, ...updated.data() })
  } catch (error) {
    next(error)
  }
})

export default router
