'use server'

import { createAdminClient } from '@/lib/firebase/service'
import { revalidatePath } from 'next/cache'
import { checkIsAdmin } from '@/lib/auth'

export async function reviewDriverApplication(id: string, status: 'approved' | 'rejected') {
  if (!(await checkIsAdmin())) return { error: 'Acceso Denegado' }

  const adminDb = createAdminClient()
  const { data: app, error: appError } = await adminDb
    .from('driver_applications')
    .select('user_id, vehicle_type, plate')
    .eq('id', id)
    .single()

  if (appError || !app) return { error: appError?.message || 'Solicitud no encontrada' }

  const { error } = await adminDb
    .from('driver_applications')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  // Si se aprueba, actualizar rol y crear driver_profile
  if (status === 'approved') {
    await adminDb.from('users').update({ role: 'driver' }).eq('id', app.user_id)
    await adminDb.from('driver_profiles').upsert({
      user_id: app.user_id,
      vehicle_type: app.vehicle_type,
      plate: app.plate,
      status: 'active',
    })
  }

  revalidatePath('/admin/solicitudes')
  return { success: true }
}

export async function listDriverApplications(filter: 'all' | 'pending' | 'approved' | 'rejected') {
  if (!(await checkIsAdmin())) return { data: null, error: 'Acceso Denegado' }

  const adminDb = createAdminClient()
  let query = adminDb.from('driver_applications').select('*').order('created_at', { ascending: false })

  if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
