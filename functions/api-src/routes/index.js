import { Router } from 'express'
import pricingRoutes from './pricing.js'
import driversRoutes from './drivers.js'
import tripsRoutes from './trips.js'
import zonesRoutes from './zones.js'
import adminRoutes from './admin.js'

const router = Router()

// Sonda de salud accesible también por /api/health (útil para monitorear a
// través del rewrite de Hosting, que solo expone /api/**).
router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'carsigo-admin-api', time: new Date().toISOString() })
})

router.use('/pricing', pricingRoutes)
router.use('/drivers', driversRoutes)
router.use('/trips', tripsRoutes)
router.use('/zones', zonesRoutes)
router.use('/admin', adminRoutes)

export default router
