/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { getApps, getApp, initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc, onSnapshot, Timestamp, GeoPoint } from 'firebase/firestore'
import { getAuth, signInWithEmailAndPassword, signInWithCustomToken, updatePassword, onAuthStateChanged } from 'firebase/auth'
import { createCompatClient } from './firestore-compat'
import { getSessionCompat, signOutCompat, exchangeTokenForSession, getBrowserSessionToken } from '@/app/auth/actions'
import { confirmPasswordReset, sendPasswordReset } from './rest-auth'

const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG)
}

/** Client de compatibilidad (navegador). La sesión real vive en la cookie del servidor. */
export function createClient() {
  const app = getFirebaseApp()
  const firebaseAuth = getAuth(app)

  const auth = {
    getUser: async () => {
      const s = await getSessionCompat()
      if (s?.user) return { data: { user: s.user }, error: null }
      return { data: { user: null }, error: { message: 'No session' } }
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, email, password)
        const idToken = await cred.user.getIdToken()
        const ok = await exchangeTokenForSession(idToken)
        if (!ok.success) throw new Error('No se pudo crear la sesión del servidor')
        // Refrescar el token del navegador para recoger los custom claims (role/status)
        // que se setean en el servidor, necesarios para las reglas de Firestore.
        await cred.user.getIdToken(true)
        const user = {
          id: cred.user.uid,
          email: cred.user.email,
          user_metadata: { name: cred.user.displayName },
        }
        return { data: { user, session: { access_token: idToken } }, error: null }
      } catch (e: any) {
        return {
          data: { user: null, session: null },
          error: { message: e?.code === 'auth/invalid-credential' ? 'Invalid login credentials' : e?.message || 'Error de autenticación' },
        }
      }
    },

    signOut: async () => {
      await signOutCompat()
      try {
        await firebaseAuth.signOut()
      } catch {
        // No aplica
      }
      return { error: null }
    },

    updateUser: async ({ password }: { password?: string }) => {
      // Flujo de enlace de recuperación (oobCode en la URL)
      if (typeof window !== 'undefined' && password) {
        const oobCode = new URLSearchParams(window.location.search).get('oobCode')
        if (oobCode) {
          const res = await confirmPasswordReset(oobCode, password)
          if (res.error) return { data: { user: null }, error: res.error }
          return { data: { user: null }, error: null }
        }
      }
      const current = firebaseAuth.currentUser
      if (!current || !password) {
        return { data: { user: null }, error: { message: 'No hay una sesión activa. Usa el enlace de recuperación.' } }
      }
      try {
        await updatePassword(current, password)
        return {
          data: {
            user: { id: current.uid, email: current.email, user_metadata: { name: current.displayName } },
          },
          error: null,
        }
      } catch (e: any) {
        return { data: { user: null }, error: { message: e?.message || 'No se pudo actualizar la contraseña' } }
      }
    },

    resetPasswordForEmail: async (email: string, options?: { redirectTo?: string }) => {
      return sendPasswordReset(email, options?.redirectTo)
    },

    /** Firma el SDK del navegador si existe cookie pero firebaseAuth está en blanco. */
    ensureBrowserSession: async () => {
      if (firebaseAuth.currentUser) return true
      const { token } = await getBrowserSessionToken()
      if (!token) return false
      try {
        await signInWithCustomToken(firebaseAuth, token)
        return true
      } catch (e: any) {
        console.error('ensureBrowserSession:', e)
        return false
      }
    },

    onAuthStateChange: (cb: (event: string, session?: any) => void) => {
      const unsub = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          cb('SIGNED_IN', {
            user: { id: user.uid, email: user.email, user_metadata: { name: user.displayName } },
          })
        } else {
          cb('SIGNED_OUT')
        }
      })
      return { data: { subscription: { unsubscribe: unsub } } }
    },
  }

  return createCompatClient({
    db: getFirestore(app),
    Timestamp,
    GeoPoint,
    fs: { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, addDoc },
    auth,
    server: false,
    channelFactory: () => {
      const listeners: { table: string; cb: () => void }[] = []
      let unsubs: (() => void)[] = []
      return {
        on(_evt: string, cfg: any, cb: any) {
          if (cfg?.table) listeners.push({ table: cfg.table, cb })
          return this
        },
        subscribe(cb?: (status: string) => void) {
          const db = getFirestore(app)
          unsubs = listeners.map((l) =>
            onSnapshot(collection(db, l.table), () => {
              try {
                l.cb()
              } catch {
                // Ignorar errores del listener
              }
            })
          )
          cb?.('SUBSCRIBED')
          return this
        },
        unsubscribe() {
          unsubs.forEach((u) => u())
          unsubs = []
        },
      }
    },
  })
}