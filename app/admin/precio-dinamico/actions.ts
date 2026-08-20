'use server'

import { createAdminClient } from '@/lib/firebase/service'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

// Todo en UNA llamada: reglas + zonas disponibles para el selector.
export async function getPricingData() {
  if (!(await checkIsSuperAdmin())) return { rules: [], geofences: [] }
  const db = createAdminClient()
  const [rulesRes, fencesRes] = await Promise.all([
    db.from('dynamic_pricing_rules').select('*').order('priority', { ascending: false }),
    db
      .from('geofences')
      .select('id, municipality_name')
      .eq('is_active', true)
      .order('municipality_name'),
  ])
  return { rules: rulesRes.data || [], geofences: fencesRes.data || [] }
}

export async function getDynamicPricingRules(zoneId?: string) {
  if (!(await checkIsSuperAdmin())) return []
  const db = createAdminClient()
  const { data } = await db
    .from('dynamic_pricing_rules')
    .select('*')
    .order('priority', { ascending: false })
  if (!zoneId) return data || []
  return (data || []).filter((r: { zone_id?: string | null }) => r.zone_id === zoneId)
}

export async function createDynamicPricingRule(payload: {
  name: string
  description?: string
  rule_type: string
  start_time?: string | null
  end_time?: string | null
  days_of_week?: number[] | null
  specific_date?: string | null
  is_recurring?: boolean
  date_from?: string | null
  date_to?: string | null
  multiplier: number
  flat_surcharge?: number
  geofence_id?: string | null
  vehicle_type?: string | null
  priority?: number
  zone_id?: string | null
}) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const db = createAdminClient()
  const { error } = await db.from('dynamic_pricing_rules').insert([{ ...payload, is_active: true }])
  if (error) return { error: error.message }
  revalidatePath('/admin/precio-dinamico')
  return { success: true }
}

export async function updateDynamicPricingRule(id: string, payload: Partial<{
  name: string
  description: string
  rule_type: string
  start_time: string | null
  end_time: string | null
  days_of_week: number[] | null
  specific_date: string | null
  is_recurring: boolean
  date_from: string | null
  date_to: string | null
  multiplier: number
  flat_surcharge: number
  geofence_id: string | null
  is_active: boolean
  priority: number
  zone_id: string | null
}>) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const db = createAdminClient()
  const { error } = await db.from('dynamic_pricing_rules').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/precio-dinamico')
  return { success: true }
}

export async function deleteDynamicPricingRule(id: string) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const db = createAdminClient()
  const { error } = await db.from('dynamic_pricing_rules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/precio-dinamico')
  return { success: true }
}

export async function getGeofences() {
  const db = createAdminClient()
  const { data } = await db
    .from('geofences')
    .select('id, municipality_name')
    .eq('is_active', true)
    .order('municipality_name')
  return data || []
}
