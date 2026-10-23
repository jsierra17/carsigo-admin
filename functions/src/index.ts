/**
 * Cloud Function HTTP que expone la CarSiGo Admin API (Express).
 *
 * El código de la API vive en `apps/admin-api` y se copia a `api-src/`
 * antes de compilar (ver scripts/prepare-functions.js). Cloud Functions
 * despliega únicamente el contenido de esta carpeta.
 */
import { onRequest } from 'firebase-functions/https'
import { setGlobalOptions } from 'firebase-functions'
import { createApp } from '../api-src/app.js'

setGlobalOptions({ maxInstances: 10, region: 'us-central1' })

const app = createApp()

/**
 * GET/POST/PATCH /api/** -> Admin API
 */
export const adminApi = onRequest(
  {
    region: 'us-central1',
    // Invocación pública: el rewrite de Firebase Hosting no envía un
    // header Authorization, así que la función debe ser alcanzable.
    // La seguridad real la aporta la API: cada endpoint sensible valida
    // el Bearer token y el custom claim del rol.
    invoker: 'public',
    // Hash del código de la API. Fuerza al CLI de Firebase a detectar el
    // cambio y desplegar, porque por defecto solo compara la definición
    // de la función (no su implementación interna).
    labels: { 'api-build': '73081c001cb4' },
    // Cuenta de servicio con permisos plenos de Firebase Admin
    // (Firestore, Auth y Storage). Requerida porque la API usa el Admin SDK.
    serviceAccount: 'firebase-adminsdk-fbsvc@carsigo-9e508.iam.gserviceaccount.com',
  },
  app,
)
