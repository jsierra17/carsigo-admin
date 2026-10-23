import fs from 'node:fs'
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp, GeoPoint, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// Re-exportados para consumo directo desde las rutas.
export { Timestamp, GeoPoint, FieldValue }

/**
 * Singleton del Admin SDK de Firebase (solo servidor).
 *
 * Reemplaza el antiguo stack `admin.ts` + `service.ts` + `firestore-compat.ts`.
 * No hay wrapper: se usan las APIs nativas de firebase-admin
 * (db.collection('x').where(...), db.doc('x/y'), admin.auth(), ...).
 */
let cached = null

export function getFirebaseAdmin() {
  if (cached) return cached

  if (getApps().length === 0) {
    initializeApp({ credential: resolveCredential() })
  }

  cached = {
    db: getFirestore(),
    auth: getAuth(),
    storage: getStorage(),
    Timestamp,
    GeoPoint,
    FieldValue,
  }
  return cached
}

/**
 * Resuelve la credencial de Firebase en este orden:
 *
 * 1. `FIREBASE_SERVICE_ACCOUNT` → ruta a un JSON (desarrollo local).
 * 2. `FIREBASE_SERVICE_ACCOUNT_JSON` → el JSON en línea, o en base64
 *    (contenedores / Cloud Run, donde no hay sistema de archivos con secretos).
 * 3. Application Default Credentials → la cuenta de servicio de la propia
 *    plataforma (Cloud Run, Cloud Build, App Hosting).
 */
function resolveCredential() {
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT
  if (saPath && fs.existsSync(saPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'))
    return cert(serviceAccount)
  }

  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (inline) {
    const json = inline.trim().startsWith('{')
      ? inline
      : Buffer.from(inline, 'base64').toString('utf8')
    return cert(JSON.parse(json))
  }

  // ADC: en Cloud Run usa la cuenta de servicio del runtime.
  return applicationDefault()
}

/** Instancia de Firestore con privilegios de administrador. */
export function getDb() {
  return getFirebaseAdmin().db
}

/** Instancia de Firebase Auth con privilegios de administrador. */
export function getAdminAuth() {
  return getFirebaseAdmin().auth
}

/** Normaliza un snapshot de Firestore a un array de objetos planos. */
export function toPlainDocs(snapshot) {
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return { id: doc.id, ...data }
  })
}
