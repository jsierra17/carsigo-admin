import { getAdminAuth } from '../lib/firebase-admin.js'

/**
 * Middleware de autenticación por Bearer Token (Firebase ID Token).
 *
 * El panel Vue obtiene el ID token con Firebase Web SDK
 * (`signInWithPopup` / `signInWithEmailAndPassword`) y lo envía como:
 *   Authorization: Bearer <idToken>
 */

/**
 * Exige un ID token válido. Deja el token decodificado en `req.user`.
 */
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null

  if (!token) {
    return res.status(401).json({
      error: 'Falta el header Authorization',
      detail: 'Formato esperado: Authorization: Bearer <idToken>',
    })
  }

  try {
    req.user = await getAdminAuth().verifyIdToken(token)
    next()
  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido o expirado',
      detail: error.message,
    })
  }
}

/**
 * Exige un rol específico en los custom claims del token.
 * El rol se asigna con `admin.auth().setCustomUserClaims(uid, { role })`.
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' })
    }
    if (req.user.role !== role) {
      return res.status(403).json({
        error: `Acceso denegado`,
        detail: `Se requiere el rol "${role}" y el token actual tiene "${req.user.role ?? 'sin rol'}"`,
      })
    }
    next()
  }
}

/**
 * Atajo: exige rol superadmin.
 */
export const requireSuperAdmin = requireRole('superadmin')

/**
 * Exige rol de administrador (admin o superadmin).
 *
 * Los endpoints que devuelven PII (viajes, conductores) o que escriben en
 * Firestore con el Admin SDK DEBEN usar este middleware: el Admin SDK ignora
 * las `firestore.rules`, así que la única barrera es aquí.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' })
  }
  const role = req.user.role
  if (role !== 'admin' && role !== 'superadmin') {
    return res.status(403).json({
      error: 'Acceso denegado',
      detail: `Se requiere rol admin o superadmin y el token actual tiene "${role ?? 'sin rol'}"`,
    })
  }
  next()
}
