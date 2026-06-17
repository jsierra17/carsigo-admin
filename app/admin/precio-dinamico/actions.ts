'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

export async function getDynamicPricingRules() {
  if (!(await checkIsSuperAdmin())) return []
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('dynamic_pricing_rules')
    .select('*')
    .order('priority', { ascending: false })
  return data || []
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
  priority?: number
}) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('dynamic_pricing_rules').insert([{ ...payload, is_active: true }])
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
}>) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('dynamic_pricing_rules').update(payload).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/precio-dinamico')
  return { success: true }
}

export async function deleteDynamicPricingRule(id: string) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('dynamic_pricing_rules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/precio-dinamico')
  return { success: true }
}

export async function getGeofences() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('geofences')
    .select('id, municipality_name')
    .eq('is_active', true)
    .order('municipality_name')
  return data || []
}
