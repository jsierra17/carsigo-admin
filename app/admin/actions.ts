'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { checkIsAdmin } from '@/lib/auth'

/**
 * Obtener métricas principales del Dashboard usando service_role.
 * Al ejecutarse en el servidor con service_role, no depende de RLS.
 */
export async function getDashboardMetrics() {
  if (!(await checkIsAdmin())) {
    return { pasajeros: 0, conductores: 0, pendientes: 0 }
  }

  const supabase = createAdminClient()
  try {
    const [pasajerosRes, conductoresRes, pendientesRes] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'passenger'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
      supabase.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ])

    return {
      pasajeros: pasajerosRes.count || 0,
      conductores: conductoresRes.count || 0,
      pendientes: pendientesRes.count || 0
    }
  } catch (error) {
    console.error('Error en getDashboardMetrics:', error)
    return { pasajeros: 0, conductores: 0, pendientes: 0 }
  }
}

/**
 * Obtener los conductores más recientes registrados.
 */
export async function getLatestDrivers(limit = 5) {
  if (!(await checkIsAdmin())) return []

  const supabase = createAdminClient()
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, phone, email, created_at')
      .eq('role', 'driver')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error al obtener conductores recientes:', error)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Error fatal obteniendo conductores:', err)
    return []
  }
}

/**
 * Buscar conductores por nombre, teléfono o email.
 */
export async function searchDrivers(query: string) {
  if (!(await checkIsAdmin())) return null

  const supabase = createAdminClient()
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, phone, status, driver_profiles ( vehicle_type, plate, total_rides, suspension_end_date )')
      .eq('role', 'driver')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)

    if (error) {
      console.error('Error buscando conductores:', error)
      return null
    }
    return data || []
  } catch (err) {
    console.error('Error fatal buscando conductores:', err)
    return null
  }
}
