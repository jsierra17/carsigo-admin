import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import * as fs from 'fs'

let cached: { db: Firestore; auth: Auth } | null = null

/**
 * Singleton del Admin SDK de Firebase (solo servidor).
 * Usa el service account definido en FIREBASE_SERVICE_ACCOUNT o las ADC.
 */
export function getFirebaseAdmin() {
  if (cached) return cached

  if (getApps().length === 0) {
    const saPath = process.env.FIREBASE_SERVICE_ACCOUNT
    if (saPath && fs.existsSync(saPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'))
      initializeApp({ credential: cert(serviceAccount) })
    } else {
      initializeApp()
    }
  }

  cached = { db: getFirestore(), auth: getAuth() }
  return cached
}