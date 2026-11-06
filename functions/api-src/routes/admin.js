import { Router } from 'express'
import { getAdminAuth, getDb } from '../lib/firebase-admin.js'
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js'
import { writeRateLimit } from '../middleware/rate-limit.js'

const router = Router()

export const VALID_ROLES = ['admin', 'superadmin', 'conductor', 'passenger']

/**
 * POST /api/admin/users/:uid/role
 * Headers: Authorization: Bearer <idToken>   (el token debe tener role === 'superadmin')
 * Body: { role: 'admin' | 'superadmin' | 'conductor' | 'passenger' }
 *
 * Actualiza el rol del usuario en dos lugares:
 *   1. Custom claims de Firebase Auth  â†’ `admin.auth().setCustomUserClaims()`
 *      (de ahí lee `decodedToken.role` el resto de la API).
 *   2. Documento `users/{uid}.role` en Firestore â†’ para las consultas del panel.
 */
router.post('/users/:uid/role', requireAuth, requireSuperAdmin, writeRateLimit, async (req, res, next) => {
  try {
    const { uid } = req.params
    const { role } = req.body || {}

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: 'Rol inválido',
        detail: `Valores permitidos: ${VALID_ROLES.join(', ')}`,
      })
    }

    const auth = getAdminAuth()
    const db = getDb()

    // El usuario objetivo debe existir en Auth
    let target
    try {
      target = await auth.getUser(uid)
    } catch (error) {
      return res.status(404).json({ error: 'Usuario no encontrado en Firebase Auth' })
    }

    // 1) Custom claims (preserva los claims existentes)
    const existingClaims = target.customClaims || {}
    await auth.setCustomUserClaims(uid, { ...existingClaims, role })

    // 2) Espejo en Firestore
    const userRef = db.collection('users').doc(uid)
    const userSnap = await userRef.get()
    const patch = { role, updated_at: new Date().toISOString() }
    if (!userSnap.exists) patch.id = uid
    await userRef.set(patch, { merge: true })

    res.json({
      uid,
      role,
      email: target.email ?? null,
      updated: true,
      note: 'El token del usuario debe renovarse para reflejar el nuevo rol.',
    })
  } catch (error) {
    next(error)
  }
})

/**
 * GET /api/admin/users/:uid
 * Headers: Authorization: Bearer <idToken>
 * Lee el usuario desde Auth + Firestore (útil para depurar roles).
 */
router.get('/users/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params
    const auth = getAdminAuth()
    const db = getDb()

    let authUser = null
    try {
      const record = await auth.getUser(uid)
      authUser = {
        uid: record.uid,
        email: record.email ?? null,
        displayName: record.displayName ?? null,
        disabled: record.disabled,
        customClaims: record.customClaims || {},
      }
    } catch {
      authUser = null
    }

    const userSnap = await db.collection('users').doc(uid).get()
    const profile = userSnap.exists ? { id: userSnap.id, ...userSnap.data() } : null

    res.json({ uid, auth: authUser, profile })
  } catch (error) {
    next(error)
  }
})

export default router
