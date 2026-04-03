'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

/**
 * Obtiene el historial completo de liquidaciones registradas en el sistema.
 * Retorna un array vacío si la tabla aún no existe.
 */
export async function getSettlements() {
  const supabase = createAdminClient()
  try {
    const { data, error } = await supabase
      .from('settlements')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Finanzas: Tabla de liquidaciones no disponible aún.')
      return []
    }
    return data || []
  } catch {
    return []
  }
}

/**
 * Obtiene estadísticas financieras reales desde la base de datos (Optimizada con Promise.all).
 * Consulta: driver_profiles (conductores activos), wallets y trips (viajes completados) de forma concurrente.
 */
export async function getTripStats() {
  const supabase = createAdminClient()

  try {
    // Ejecutar todas las consultas de forma concurrente para eliminar el waterfall de ~3s
    const [conductoresRes, walletsRes, tripsRes] = await Promise.all([
      supabase.from('driver_profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('wallets').select('balance'),
      supabase.from('trips').select('fare_amount, commission_amount, status').eq('status', 'completed')
    ]);

    const conductoresActivos = conductoresRes.count || 0;
    const wallets = walletsRes.data || [];
    const trips = tripsRes.data || [];
    const tripsError = tripsRes.error;
    const walletError = walletsRes.error;

    // Calcular volumen real si hay datos de viajes
    let volumenReal = 0
    let comisionReal = 0

    if (!tripsError && trips.length > 0) {
      // Datos reales de viajes completados
      volumenReal = trips.reduce((sum, t) => sum + (t.fare_amount || 0), 0)
      comisionReal = trips.reduce((sum, t) => sum + (t.commission_amount || 0), 0)

      // Si commission_amount no existe, calcular el 12%
      if (comisionReal === 0) {
        comisionReal = volumenReal * 0.12
      }
    } else if (!walletError && wallets.length > 0) {
      // Fallback: usar saldo de wallets como indicador de volumen
      const saldoTotal = wallets.reduce((sum, w) => sum + (w.balance || 0), 0)
      volumenReal = saldoTotal
      comisionReal = saldoTotal * 0.12
    }

    return {
      conductoresActivos,
      volumenTotal: Math.round(volumenReal),
      comisionCarSiGo: Math.round(comisionReal),
      tieneDataReal: (!tripsError && trips.length > 0) || (!walletError && wallets.length > 0)
    }
  } catch (err) {
    console.error('Error obteniendo estadísticas financieras:', err)
    return {
      conductoresActivos: 0,
      volumenTotal: 0,
      comisionCarSiGo: 0,
      tieneDataReal: false
    }
  }
}

/**
 * Registra una nueva liquidación en el historial.
 * En producción, aquí se marcarían los viajes como 'liquidados'.
 * Recibe el monto de comisión real y la cantidad de conductores involucrados.
 */
export async function performSettlement(data: {
  amount: number,
  driverCount: number,
  volumenBase: number
}) {
  const supabase = createAdminClient()

  // Generar referencia única con prefijo de fecha para auditoría
  const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const referencia = `LIQ-${fecha}-${Math.floor(Math.random() * 9000) + 1000}`

  const { error } = await supabase
    .from('settlements')
    .insert([{
      total_amount: data.amount,
      drivers_involved: data.driverCount,
      volume_base: data.volumenBase,
      reference: referencia,
      status: 'completed',
      created_at: new Date().toISOString()
    }])

  if (error) {
    console.error('Error registrando liquidación:', error)
    return { error: 'No se pudo completar la liquidación. Verifica la conexión.' }
  }

  revalidatePath('/admin/finanzas')
  return { success: true, referencia }
}
