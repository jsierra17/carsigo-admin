'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

export async function getRateCards() {
  if (!(await checkIsSuperAdmin())) return []
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('rate_cards')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export async function createRateCard(payload: {
  name: string
  vehicle_type: string
  base_fee: number
  price_per_km: number
  price_per_minute: number
  minimum_fare: number
  free_waiting_minutes: number
  waiting_price_per_minute: number
  commission_percent: number
}) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rate_cards').insert([{ ...payload, is_active: true }])
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}

export async function updateRateCard(id: string, payload: Partial<{
  name: string
  vehicle_type: string
  base_fee: number
  price_per_km: number
  price_per_minute: number
  minimum_fare: number
  free_waiting_minutes: number
  waiting_price_per_minute: number
  commission_percent: number
  is_active: boolean
}>) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rate_cards').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}

export async function deleteRateCard(id: string) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('rate_cards').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}
