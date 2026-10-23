import { Router } from 'express'
import { calculateFare } from '../lib/pricing-engine.js'
import { requireAuth } from '../middleware/auth.js'
import { writeRateLimit } from '../middleware/rate-limit.js'

const router = Router()

/**
 * POST /api/pricing/estimate
 * Body: { vehicle_type, distance_km, duration_min?, datetime?, zone_id?, ... }
 */
router.post('/estimate', requireAuth, writeRateLimit, async (req, res, next) => {
  try {
    const {
      vehicle_type,
      distance_km,
      duration_min,
      datetime,
      zone_id,
      from_lat,
      from_lng,
      to_lat,
      to_lng,
    } = req.body || {}

    if (!vehicle_type || !['moto', 'car'].includes(vehicle_type)) {
      return res.status(400).json({ error: 'vehicle_type debe ser "moto" o "car"' })
    }
    if (typeof distance_km !== 'number' || distance_km < 0) {
      return res.status(400).json({ error: 'distance_km requerido y debe ser >= 0' })
    }

    const breakdown = await calculateFare({
      vehicle_type,
      distance_km,
      duration_min: duration_min || 0,
      datetime: datetime ? new Date(datetime) : undefined,
      zone_id: typeof zone_id === 'string' && zone_id ? zone_id : undefined,
      from_lat: typeof from_lat === 'number' ? from_lat : undefined,
      from_lng: typeof from_lng === 'number' ? from_lng : undefined,
      to_lat: typeof to_lat === 'number' ? to_lat : undefined,
      to_lng: typeof to_lng === 'number' ? to_lng : undefined,
    })

    res.json(breakdown)
  } catch (error) {
    next(error)
  }
})

export default router
