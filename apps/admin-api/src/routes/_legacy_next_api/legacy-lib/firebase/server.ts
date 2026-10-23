/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from 'next/headers'
import { getFirebaseAdmin } from '@/lib/firebase/admin'
import { createCompatClient } from './firestore-compat'
import { restSignIn, sendPasswordReset } from './rest-auth'
import { Timestamp, GeoPoint } from 'firebase-admin/firestore'
import { adminFs } from './admin-fs'

export const SESSION_COOKIE = 'carsigo_session'
export const ROLE_COOKIE = 'carsigo_role'
export const STATUS_COOKIE = 'carsigo_status'

const SESSION_MAX_AGE = 24 * 60 * 60 // 24 h: tope servidor de la sesión de Firebase

function cookieOpts() {
  // Sin maxAge: cookie de sesión del navegador → se borra al cerrar la pestaña/ventana.
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
}

async function readProfile(uid: string) {
  const { db } = getFirebaseAdmin()
  const snap = await db.collection('users').doc(uid).get()
  return snap.exists ? (snap.data() as any) : null
}

/**
 * Client de compatibilidad (servidor). La sesión se maneja con una cookie
 * firmada por Firebase Admin (`carsigo_session`).
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { auth: adminAuth, db } = getFirebaseAdmin()

  const auth = {
    getUser: async () => {
      const token = cookieStore.get(SESSION_COOKIE)?.value
      if (!token) {
        return { data: { user: null }, error: { message: 'No session' } }
      }
      try {
        const decoded = await adminAuth.verifySessionCookie(token, false)
        const user = {
          id: decoded.uid,
          email: decoded.email || null,
          user_metadata: { name: decoded.name || null },
        }
        return { data: { user }, error: null }
      } catch (e: any) {
        return { data: { user: null }, error: { message: e?.message || 'Invalid session' } }
      }
    },

    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const res = await restSignIn(email, password)
      if (res.error || !res.idToken) {
        return { data: { user: null, session: null }, error: { message: res.error?.message || 'Invalid login credentials' } }
      }

      const decoded = await adminAuth.verifyIdToken(res.idToken)
      const sessionCookie = await adminAuth.createSessionCookie(res.idToken, {
        expiresIn: SESSION_MAX_AGE * 1000,
      })

      const profile = await readProfile(decoded.uid)
      const role = profile?.role || null
      const status = profile?.status || 'active'

      const base = cookieOpts()
      try {
        cookieStore.set(SESSION_COOKIE, sessionCookie, base)
        cookieStore.set(ROLE_COOKIE, role || '', base)
        cookieStore.set(STATUS_COOKIE, status, base)
      } catch {
        // Sin acceso de escritura (RSC): el middleware refresca la sesión.
      }

      const user = {
        id: decoded.uid,
        email: res.email || decoded.email || email,
        user_metadata: { name: decoded.name || profile?.name || null },
      }
      return { data: { user, session: { access_token: sessionCookie } }, error: null }
    },

    resetPasswordForEmail: async (email: string, options?: { redirectTo?: string }) => {
      return sendPasswordReset(email, options?.redirectTo)
    },

    exchangeCodeForSession: async () => {
      return { data: { session: null }, error: null }
    },

    signOut: async () => {
      try {
        cookieStore.delete(SESSION_COOKIE)
        cookieStore.delete(ROLE_COOKIE)
        cookieStore.delete(STATUS_COOKIE)
      } catch {
        // Sin acceso de escritura
      }
      return { error: null }
    },

    updateUser: async () => {
      return { data: { user: null }, error: { message: 'No disponible en servidor' } }
    },
  }

  return createCompatClient({
    db,
    Timestamp,
    GeoPoint,
    fs: adminFs,
    auth,
    server: true,
  })
}