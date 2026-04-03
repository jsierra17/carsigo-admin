'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function inviteAdmin(formData: FormData) {
  const adminSupabase = createAdminClient()
  const userSupabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string || 'N/A'

  // Verificar si el usuario actual es superadmin
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return { error: 'No estás autenticado' }

  // BYPASS DE SEGURIDAD PARA EL PROPIETARIO
  if (user.email !== 'todoobraparabien1998@gmail.com') {
    const { data: userData } = await adminSupabase.from('users').select('role').eq('id', user.id).single()
    if (userData?.role !== 'superadmin') {
      return { error: 'Acceso Denegado. Solo el Super Admin puede crear otros administradores.' }
    }
  }

  // Si es superadmin, procedemos a crear la cuenta
  const { data: newAuthUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, phone, role: 'admin' }
  })

  if (createError) {
    return { error: createError.message }
  }

  // Actualizamos o insertamos el perfil en public.users con el rol de admin
  if (newAuthUser.user) {
    const { error: upsertError } = await adminSupabase
      .from('users')
      .upsert({
        id: newAuthUser.user.id,
        role: 'admin',
        name: name,
        email: email,
        status: 'active',
        phone: phone
      })

    if (upsertError) {
      console.error('Error actualizando perfil usuario', upsertError)
    }
  }

  revalidatePath('/admin/administradores')
  return { success: true }
}

export async function getAdmins() {
  try {
    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('users')
      .select('id, name, email, role, status, phone')
      .in('role', ['admin', 'superadmin'])
      .order('name')

    if (error) {
      console.error('Error fetching admins:', error)
      return []
    }
    return data || []
  } catch (err) {
    console.error('Fatal error in getAdmins:', err)
    return []
  }
}

export async function toggleAdminStatus(userId: string, currentStatus: string) {
  const adminSupabase = createAdminClient()
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

  const { error } = await adminSupabase
    .from('users')
    .update({ status: newStatus })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/administradores')
  return { success: true }
}

export async function updateAdmin(userId: string, formData: FormData) {
  const adminSupabase = createAdminClient()
  const userSupabase = await createClient()

  const email = formData.get('email') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string

  // Verificar si el usuario actual es superadmin
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return { error: 'No estás autenticado' }

  // BYPASS DE SEGURIDAD PARA EL PROPIETARIO
  if (user.email !== 'todoobraparabien1998@gmail.com') {
    const { data: userData } = await adminSupabase.from('users').select('role').eq('id', user.id).single()
    if (userData?.role !== 'superadmin') {
      return { error: 'Acceso Denegado.' }
    }
  }

  // 1. Actualizar Auth (email y metadata)
  const { error: authError } = await adminSupabase.auth.admin.updateUserById(userId, {
    email: email,
    user_metadata: { name, phone, role: 'admin' }
  })

  if (authError) return { error: authError.message }

  // 2. Actualizar Tabla users (perfil)
  const { error: dbError } = await adminSupabase
    .from('users')
    .update({ name, email, phone })
    .eq('id', userId)

  if (dbError) return { error: dbError.message }

  revalidatePath('/admin/administradores')
  return { success: true }
}
