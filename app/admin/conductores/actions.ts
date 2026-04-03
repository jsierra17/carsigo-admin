'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

export async function toggleDriverStatus(driverId: string, currentStatus: string) {
  const adminSupabase = createAdminClient()

  // Si está pendiente, lo aprobamos. Si está activo, lo suspendemos.
  let newStatus = 'active'
  if (currentStatus === 'active') newStatus = 'suspended'
  if (currentStatus === 'suspended') newStatus = 'active'

  const { error } = await adminSupabase
    .from('driver_profiles')
    .update({ status: newStatus })
    .eq('user_id', driverId)

  if (error) {
    console.error('Error updating driver status:', error)
    return { error: error.message }
  }

  revalidatePath('/admin/conductores')
  revalidatePath('/admin')
  return { success: true }
}

export async function approveDriver(driverId: string) {
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
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('driver_profiles')
    .update({ status: 'suspended' })
    .eq('user_id', driverId)

  if (error) return { error: error.message }

  revalidatePath('/admin/conductores')
  return { success: true }
}
