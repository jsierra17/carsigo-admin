'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/service'

const OWNER_EMAIL = process.env.OWNER_EMAIL

export async function getMyRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  if (OWNER_EMAIL && user.email === OWNER_EMAIL) return 'superadmin'

  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role || null
}
