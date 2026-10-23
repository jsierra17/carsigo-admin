/**
 * Limitador de peticiones en memoria (ventana deslizante simple).
 * Suficiente para un proceso único; con varias instancias habría que usar
 * Redis o Firestore para compartir el contador.
 */
const rateMap = new Map()

/**
 * @param {string} key    Identificador del cliente (IP, uid, etc.)
 * @param {number} [maxAttempts]  Máximo de intentos en la ventana
 * @param {number} [windowMs]      Duración de la ventana en ms
 * @returns {boolean} true si se permite la petición
 */
export function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now()
  const entry = rateMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  entry.count++
  if (entry.count > maxAttempts) return false

  return true
}

/** Limpia el estado del limitador (tests). */
export function resetRateLimits() {
  rateMap.clear()
}
