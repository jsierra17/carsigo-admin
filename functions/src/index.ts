/**
 * Cloud Function HTTP que expone la CarSiGo Admin API (Express).
 *
 * El código de la API vive en `apps/admin-api` y se copia a `api-src/`
 * antes de compilar (ver scripts/prepare-functions.js). Cloud Functions
 * despliega únicamente el contenido de esta carpeta.
 */
import { onRequest, onCall } from 'firebase-functions/https'
import { setGlobalOptions } from 'firebase-functions'
import { createApp } from '../api-src/app.js'
import { getFirestore } from 'firebase-admin/firestore'

setGlobalOptions({ maxInstances: 10, region: 'us-central1' })

const app = createApp()
const db = getFirestore()

/**
 * GET/POST/PATCH /api/** -> Admin API
 */
export const adminApi = onRequest(
  {
    region: 'us-central1',
    invoker: 'public',
    labels: { 'api-build': '61c10b239d40' },
    serviceAccount: 'firebase-adminsdk-fbsvc@carsigo-9e508.iam.gserviceaccount.com',
  },
  app,
)

/**
 * findNearbyDrivers — Busca conductores disponibles en radio creciente.
 *
 * Recibe: { pickup_lat, pickup_lng, zone_id }
 * Busca conductores con is_available: true en radio 1km → 2km → 3km (máximo).
 * Devuelve la lista de conductores encontrados con su distancia al pickup.
 *
 * Solo usuarios autenticados (passenger) pueden invocarla.
 */
export const findNearbyDrivers = onCall(
  {
    region: 'us-central1',
    invoker: 'public',
    serviceAccount: 'firebase-adminsdk-fbsvc@carsigo-9e508.iam.gserviceaccount.com',
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new Error('Authentication required')
    }

    const { pickup_lat, pickup_lng } = request.data as {
      pickup_lat: number
      pickup_lng: number
    }

    if (typeof pickup_lat !== 'number' || typeof pickup_lng !== 'number') {
      throw new Error('pickup_lat y pickup_lng son requeridos')
    }

    const RADIUS_STEPS_KM = [1, 2, 3] // km

    // Helper: distancia haversine en km
    const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
      const R = 6371
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLng = ((lng2 - lng1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    // Buscar conductores activos con rol driver
    const driversSnap = await db
      .collection('driver_profiles')
      .where('is_available', '==', true)
      .get()

    if (driversSnap.empty) {
      return { drivers: [], searchedRadiusKm: 0 }
    }

    // Recopilar conductores con su ubicación y distancia
    type DriverInfo = {
      uid: string
      name: string
      vehicle_type: string
      lat: number
      lng: number
      distanceKm: number
      is_available: boolean
    }

    const allDrivers: DriverInfo[] = []

    for (const doc of driversSnap.docs) {
      const data = doc.data()
      const uid = doc.id
      const lat = data.current_lat ?? data.lat ?? data.location_latitude
      const lng = data.current_lng ?? data.lng ?? data.location_longitude

      if (typeof lat !== 'number' || typeof lng !== 'number') continue

      const dist = haversineKm(pickup_lat, pickup_lng, lat, lng)

      // Obtener nombre del usuario
      let name = 'Conductor'
      try {
        const userDoc = await db.collection('users').doc(uid).get()
        if (userDoc.exists) {
          const userData = userDoc.data()
          name = (userData?.name as string) || (userData?.full_name as string) || 'Conductor'
        }
      } catch (_) {
        // Ignorar error de lectura de usuario
      }

      allDrivers.push({
        uid,
        name,
        vehicle_type: (data.vehicle_type as string) ?? 'moto',
        lat,
        lng,
        distanceKm: dist,
        is_available: data.is_available === true,
      })
    }

    // Expansión de radio: 1km → 2km → 3km
    for (const radiusKm of RADIUS_STEPS_KM) {
      const found = allDrivers.filter((d) => d.distanceKm <= radiusKm)
      if (found.length > 0) {
        return {
          drivers: found.sort((a, b) => a.distanceKm - b.distanceKm),
          searchedRadiusKm: radiusKm,
          totalFound: found.length,
        }
      }
    }

    // Ningún conductor encontrado en 3km
    return {
      drivers: [],
      searchedRadiusKm: 3,
      totalFound: 0,
    }
  },
)
