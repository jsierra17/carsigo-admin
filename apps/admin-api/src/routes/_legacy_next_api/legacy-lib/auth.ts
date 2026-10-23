import { createClient } from '@/lib/firebase/server'
import { createAdminClient } from '@/lib/firebase/service'

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'todoobraparabien1998@gmail.com'

export async function getCurrentUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  return user
}

export async function getUserRole(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null

  if (user.email === OWNER_EMAIL) return 'superadmin'

  const adminDb = createAdminClient()
  const { data: userData } = await adminDb
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return userData?.role || null
}

export async function checkIsAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'admin' || role === 'superadmin'
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  const role = await getUserRole()
  return role === 'superadmin'
}
