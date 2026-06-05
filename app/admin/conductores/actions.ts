'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkIsAdmin } from '@/lib/auth'

export async function toggleDriverStatus(driverId: string, currentStatus: string) {
  if (!(await checkIsAdmin())) return { error: 'Acceso Denegado' }
  
  const adminSupabase = createAdminClient()
  let newStatus = 'active'
  if (currentStatus === 'active') newStatus = 'suspended'
  if (currentStatus === 'suspended') newStatus = 'active'

  const { error } = await adminSupabase
    .from('driver_profiles')
    .update({ status: newStatus })
    .eq('user_id', driverId)

  if (error) return { error: error.message }

  revalidatePath('/admin/conductores')
  return { success: true }
}

export async function approveDriver(driverId: string) {
  if (!(await checkIsAdmin())) return { error: 'Acceso Denegado' }
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('driver_profiles')
    .update({ status: 'active' })
    .eq('user_id', driverId)

  if (error) return { error: error.message }
  revalidatePath('/admin/conductores')
  return { success: true }
}

export async function suspendDriver(driverId: string) {
  if (!(await checkIsAdmin())) return { error: 'Acceso Denegado' }
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('driver_profiles')
    .update({ status: 'suspended' })
    .eq('user_id', driverId)

  if (error) return { error: error.message }
  revalidatePath('/admin/conductores')
  return { success: true }
}
