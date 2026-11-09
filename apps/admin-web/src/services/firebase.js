/**
 * Inicialización del Firebase Web SDK para el panel Vue.
 *
 * Las variables vienen del .env de la raíz del monorepo (Vite las expone
 * como import.meta.env porque `envPrefix` incluye VITE_).
 */
import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, setPersistence, browserSessionPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** Faltan credenciales si el .env no está cargado. */
export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
export const storage = getStorage(firebaseApp)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// Persistencia de sesión: la sesión se cierra al recargar la página o cerrar el navegador.
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('[firebase] no se pudo establecer la persistencia:', error)
})

/**
 *Obtiene el ID token del usuario actual (lo usa el cliente HTTP para
 * autenticar contra la Admin API con `Authorization: Bearer <idToken>`).
 * @param {boolean} [forceRefresh] Forzar renovación (tras cambiar custom claims)
 */
export async function getIdToken(forceRefresh = false) {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken(forceRefresh)
}
