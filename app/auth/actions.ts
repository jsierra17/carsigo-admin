/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/firebase/server'
import { createAdminClient } from '@/lib/firebase/service'
import { SESSION_COOKIE, ROLE_COOKIE, STATUS_COOKIE } from '@/lib/firebase/server'
import { getFirebaseAdmin } from '@/lib/firebase/admin'

const OWNER_EMAIL = process.env.OWNER_EMAIL

export async function getMyRole() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  if (OWNER_EMAIL && user.email === OWNER_EMAIL) return 'superadmin'

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role || null
}

/** Devuelve el usuario + rol de la sesión del servidor (usado por el cliente). */
export async function getSessionCompat() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { user: null, role: null, status: null }

  if (OWNER_EMAIL && user.email === OWNER_EMAIL) {
    return { user, role: 'superadmin', status: 'active' }
  }

  const adminDb = createAdminClient()
  const { data: profile } = await adminDb
    .from('users')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  return { user, role: profile?.role || null, status: profile?.status || null }
}

/** Cierra la sesión del servidor (borra la cookie). */
export async function signOutCompat() {
  const db = await createClient()
  await db.auth.signOut()
  return { success: true }
}

/**
 * Devuelve un custom token de Firebase Auth para el usuario de la cookie.
 * El navegador usa signInWithCustomToken para firmar el SDK (necesario para
 * que las reglas de Firestore vean request.auth != null).
 * Los claims (role/status) se inyectan en el token para isAdmin() en reglas.
 */
export async function getBrowserSessionToken() {
  try {
    const db = await createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { token: null, error: 'No hay sesión activa' }

    const admin = getFirebaseAdmin()
    let role: string | null = null
    let status = 'active'
    const profile = await admin.db.collection('users').doc(user.id).get()
    if (profile.exists) {
      const data = profile.data() as any
      role = data?.role || null
      status = data?.status || 'active'
    }
    if (OWNER_EMAIL && user.email === OWNER_EMAIL) {
      role = 'superadmin'
      status = 'active'
    }

    const customToken = await admin.auth.createCustomToken(user.id, {
      role: role || 'passenger',
      status,
    })
    return { token: customToken, error: null }
  } catch (e: any) {
    console.error('getBrowserSessionToken:', e)
    return { token: null, error: e?.message || 'Error generando token' }
  }
}

/** Intercambia un idToken (obtenido en el cliente) por una cookie de sesión. */
export async function exchangeTokenForSession(idToken: string) {
  try {
    const admin = getFirebaseAdmin()
    const decoded = await admin.auth.verifyIdToken(idToken)
    const sessionCookie = await admin.auth.createSessionCookie(idToken, {
      expiresIn: 14 * 24 * 60 * 60 * 1000,
    })

    let role: string | null = null
    let status = 'active'
    const profile = await admin.db.collection('users').doc(decoded.uid).get()
    if (profile.exists) {
      const data = profile.data() as any
      role = data?.role || null
      status = data?.status || 'active'
    }
    if (OWNER_EMAIL && decoded.email === OWNER_EMAIL) {
      role = 'superadmin'
      status = 'active'
    }

    // Custom claims para las reglas de Firestore (isAdmin() usa request.auth.token.role).
    // El cliente hace getIdToken(true) después de este intercambio para recogerlos.
    try {
      await admin.auth.setCustomUserClaims(decoded.uid, { role: role || 'passenger', status })
    } catch (claimErr) {
      console.error('setCustomUserClaims:', claimErr)
    }

    const cookieStore = await cookies()
    const opts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 14 * 24 * 60 * 60,
    }
    cookieStore.set(SESSION_COOKIE, sessionCookie, opts)
    cookieStore.set(ROLE_COOKIE, role || '', opts)
    cookieStore.set(STATUS_COOKIE, status, opts)

    return { success: true }
  } catch (e: any) {
    console.error('exchangeTokenForSession:', e)
    return { success: false }
  }
}