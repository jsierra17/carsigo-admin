/* eslint-disable @typescript-eslint/no-explicit-any */
import { getFirebaseAdmin } from '@/lib/firebase/admin'
import { createCompatClient } from './firestore-compat'
import { Timestamp, GeoPoint } from 'firebase-admin/firestore'
import { adminFs } from './admin-fs'

/**
 * Client de compatibilidad con privilegios de administrador (solo servidor).
 * Usa el Admin SDK con service account, por lo que ignora las reglas.
 */
export function createAdminClient() {
  const { db, auth: adminAuth } = getFirebaseAdmin()

  const auth = {
    admin: {
      createUser: async (input: {
        email: string
        password: string
        email_confirm?: boolean
        user_metadata?: { name?: string; role?: string }
      }) => {
        try {
          const record = await adminAuth.createUser({
            email: input.email,
            password: input.password,
            emailVerified: !!input.email_confirm,
            displayName: input.user_metadata?.name || undefined,
          })
          return {
            data: { user: { id: record.uid, email: record.email } },
            error: null,
          }
        } catch (e: any) {
          return { data: { user: null }, error: { message: e?.message || String(e) } }
        }
      },
      updateUserById: async (
        uid: string,
        input: { email?: string; user_metadata?: { name?: string; role?: string } }
      ) => {
        try {
          const record = await adminAuth.updateUser(uid, {
            email: input.email,
            displayName: input.user_metadata?.name || undefined,
          })
          return {
            data: { user: { id: record.uid, email: record.email } },
            error: null,
          }
        } catch (e: any) {
          return { data: { user: null }, error: { message: e?.message || String(e) } }
        }
      },
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