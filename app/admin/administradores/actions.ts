'use server'

import { createAdminClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { checkIsSuperAdmin } from '@/lib/auth'

export async function inviteAdmin(formData: FormData) {
  if (!(await checkIsSuperAdmin())) {
    return { error: 'Acceso Denegado. Solo el Super Admin puede crear otros administradores.' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string || 'N/A'

  const adminSupabase = createAdminClient()

  // 1. Crear usuario en Auth
  const { data: newAuthUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'admin' }
  })

  if (createError) return { error: createError.message }

  // 2. Insertar en tabla public.users
  if (newAuthUser.user) {
    const { error: insertError } = await adminSupabase
      .from('users')
      .insert([{
        id: newAuthUser.user.id,
        role: 'admin',
        name: name,
        email: email,
        status: 'active',
        phone: phone
      }])

    if (insertError) console.error('Error insertando perfil:', insertError)
  }

  revalidatePath('/admin/administradores')
  return { success: true }
}

export async function getAdmins() {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('users')
    .select('id, name, email, role, status, phone')
    .in('role', ['admin', 'superadmin'])
    .order('name')

  if (error) return []
  return data || []
}

export async function toggleAdminStatus(userId: string, currentStatus: string) {
  if (!(await checkIsSuperAdmin())) {
    return { error: 'Acceso Denegado' }
  }

  const adminSupabase = createAdminClient()
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active'

  const { error } = await adminSupabase
    .from('users')
    .update({ status: newStatus })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/administradores')
  return { success: true }
}

export async function updateAdmin(userId: string, formData: FormData) {
  if (!(await checkIsSuperAdmin())) {
    return { error: 'Acceso Denegado. Solo el Super Admin puede modificar administradores.' }
  }

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const phone = formData.get('phone') as string || 'N/A'

  const adminSupabase = createAdminClient()

  // 1. Actualizar metadata en Auth
  const { error: authError } = await adminSupabase.auth.admin.updateUserById(
    userId,
    { email, user_metadata: { name, role: 'admin' } }
  )
  if (authError) return { error: authError.message }

  // 2. Actualizar en tabla public.users
  const { error: updateError } = await adminSupabase
    .from('users')
    .update({ name, email, phone })
    .eq('id', userId)

  if (updateError) return { error: updateError.message }

  revalidatePath('/admin/administradores')
  return { success: true }
}

