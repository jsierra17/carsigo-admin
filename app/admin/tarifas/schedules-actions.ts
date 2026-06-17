'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

export async function getRateSchedules() {
  if (!(await checkIsSuperAdmin())) return []
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('rate_schedules')
    .select('*')
    .order('vehicle_type')
    .order('day_type')
    .order('shift_start')
  return data || []
}

export async function createRateSchedule(payload: {
  name: string
  vehicle_type: string
  day_type: string
  shift_label: string
  shift_start: string
  shift_end: string
  base_fee: number
  hourly_increase_percent: number
}) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rate_schedules').insert([{ ...payload, is_active: true }])
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}

export async function updateRateSchedule(id: string, payload: Partial<{
  name: string
  vehicle_type: string
  day_type: string
  shift_label: string
  shift_start: string
  shift_end: string
  base_fee: number
  hourly_increase_percent: number
  is_active: boolean
}>) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rate_schedules').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}

export async function deleteRateSchedule(id: string) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rate_schedules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}
