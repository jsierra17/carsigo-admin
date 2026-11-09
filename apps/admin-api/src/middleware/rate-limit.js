/**
 * Limitador de peticiones por IP y por ruta.
 *
 * Implementación en memoria (un proceso). Suficiente para la Admin API:
 * es una superficie de ataque pública, así que sin esto cualquier agente
 * podría agotar las cuotas de Firestore de forma barata.
 */
import { checkRateLimit } from '../lib/rate-limit.js'

/** Ventana por defecto: 15 minutos. */
const WINDOW_MS = 15 * 60 * 1000

/**
 * Identificador del cliente: IP resuelta por Express (con `trust proxy`
 * activo, `req.ip` es el primer hop NO confiable — la IP real del cliente
 * detrás de Cloud Run/Cloud Functions). Usar `x-forwarded-for` a mano tomaría
 * el primer valor del header, que el propio cliente puede falsificar para
 * rotar identidad y saltarse el rate limit.
 */
function clientKey(req) {
  return `${req.baseUrl || ''}${req.path || ''}:${req.ip || 'desconocido'}`
}

/**
 * Crea un middleware de límite.
 * @param {object} [options]
 * @param {number} [options.max]        Máximo de peticiones en la ventana
 * @param {number} [options.windowMs]   Duración de la ventana
 * @param {string} [options.scope]      Prefijo para separar contadores
 */
export function rateLimit({ max = 100, windowMs = WINDOW_MS, scope = 'api' } = {}) {
  return (req, res, next) => {
    const key = `${scope}:${clientKey(req)}`
    if (!checkRateLimit(key, max, windowMs)) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)))
      return res.status(429).json({
        error: 'Demasiadas peticiones',
        detail: `Máximo ${max} peticiones por ${Math.round(windowMs / 60000)} minuto(s). Reintenta más tarde.`,
      })
    }
    next()
  }
}

/**
 * Límite más estricto para las operaciones de escritura y para la gestión
 * de roles: son las que un atacante usaría para hacer daño real.
 */
export const writeRateLimit = rateLimit({ max: 30, windowMs: WINDOW_MS, scope: 'write' })

/** Límite para lectura de datos sensibles. */
export const readRateLimit = rateLimit({ max: 120, windowMs: WINDOW_MS, scope: 'read' })
