/**
 * Cliente HTTP hacia la CarSiGo Admin API.
 *
 * Añade automáticamente el header `Authorization: Bearer <idToken>` con el
 * token del usuario de Firebase, y normaliza los errores.
 */
import { getIdToken } from './firebase.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/** Error de API con el status HTTP y el cuerpo de la respuesta. */
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const finalHeaders = { 'Content-Type': 'application/json', ...headers }

  if (auth) {
    const token = await getIdToken()
    if (token) finalHeaders.Authorization = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    throw new ApiError('No hay conexión con el servidor', 0, null)
  }

  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload.error || payload.detail)) ||
      `Error ${response.status}`
    throw new ApiError(message, response.status, payload)
  }

  return payload
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}

// ── Endpoints del panel ────────────────────────────────────────────────────

export const pricingApi = {
  /** @param {{vehicle_type:'moto'|'car', distance_km:number, zone_id?:string}} input */
  estimate: (input) => api.post('/pricing/estimate', input),
}

export const driversApi = {
  nearby: (lat, lng, radiusKm = 10) =>
    api.get(`/drivers/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`),
}

export const tripsApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString()
    return api.get(`/trips${query ? `?${query}` : ''}`)
  },
  get: (id) => api.get(`/trips/${id}`),
  create: (payload) => api.post('/trips', payload),
  update: (id, payload) => api.patch(`/trips/${id}`, payload),
}

export const zonesApi = {
  /** @param {{lat:number, lng:number}} point */
  check: (point) => api.post('/zones/check', point),
}

export const adminApi = {
  /** Asigna el rol de un usuario (requiere token superadmin). */
  setUserRole: (uid, role) => api.post(`/admin/users/${uid}/role`, { role }),
  getUser: (uid) => api.get(`/admin/users/${uid}`),
}
