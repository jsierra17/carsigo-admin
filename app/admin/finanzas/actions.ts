'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

export async function getSettlements() {
  if (!(await checkIsSuperAdmin())) return []
  const supabase = createAdminClient()
  try {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return []
    return data || []
  } catch {
    return []
  }
}

export async function getTripStats() {
  if (!(await checkIsSuperAdmin())) {
    return { conductoresActivos: 0, volumenTotal: 0, comisionCarSiGo: 0, tieneDataReal: false }
  }
  const supabase = createAdminClient()
  try {
    const [conductoresRes, walletsRes, tripsRes] = await Promise.all([
      supabase.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('wallets').select('balance'),
      supabase.from('trips').select('fare_amount, commission_amount, status').eq('status', 'completed')
    ]);

    const conductoresActivos = conductoresRes.count || 0;
    const wallets = walletsRes.data || [];
    const trips = tripsRes.data || [];

    let volumenReal = 0
    let comisionReal = 0

    if (trips.length > 0) {
      volumenReal = trips.reduce((sum, t) => sum + (Number(t.fare_amount) || 0), 0)
      comisionReal = trips.reduce((sum, t) => sum + (Number(t.commission_amount) || 0), 0)
      if (comisionReal === 0) comisionReal = volumenReal * 0.10
    } else if (wallets.length > 0) {
      const saldoTotal = wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0)
      volumenReal = saldoTotal
      comisionReal = saldoTotal * 0.10
    }

    return {
      conductoresActivos,
      volumenTotal: Math.round(volumenReal),
      comisionCarSiGo: Math.round(comisionReal),
      tieneDataReal: trips.length > 0 || wallets.length > 0
    }
  } catch {
    return { conductoresActivos: 0, volumenTotal: 0, comisionCarSiGo: 0, tieneDataReal: false }
  }
}

export async function performSettlement(data: {
  amount: number,
  driverCount: number,
  volumenBase: number
}) {
  if (!(await checkIsSuperAdmin())) return { error: 'Acceso Denegado' }
  const supabase = createAdminClient()

  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const referencia = `LIQ-${fecha}-${Math.floor(Math.random() * 9000) + 1000}`

  const { error } = await supabase
    .from('settlements')
    .insert([{
      total_amount: data.amount,
      drivers_involved: data.driverCount,
      volume_base: data.volumenBase,
      reference: referencia,
      status: 'completed'
    }])

  if (error) return { error: error.message }

  revalidatePath('/admin/finanzas')
  return { success: true, referencia }
}
