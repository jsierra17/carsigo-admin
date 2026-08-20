'use server'

import { createAdminClient } from '@/lib/firebase/service'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

export async function getRateCards(zoneId?: string) {
  if (!(await checkIsSuperAdmin())) return []
  const db = createAdminClient()
  const { data } = await db
    .from('rate_cards')
    .select('*')
    .order('created_at', { ascending: false })
  if (!zoneId) return data || []
  return (data || []).filter((c: { zone_id?: string | null }) => c.zone_id === zoneId)
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
  zone_id: string
}) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const db = createAdminClient()
  const { error } = await db.from('rate_cards').insert([{ ...payload, is_active: true }])
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
  zone_id: string
  is_active: boolean
}>) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const db = createAdminClient()
  const { error } = await db.from('rate_cards').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}

export async function deleteRateCard(id: string) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const db = createAdminClient()
  const { error } = await db.from('rate_cards').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifas')
  return { success: true }
}
