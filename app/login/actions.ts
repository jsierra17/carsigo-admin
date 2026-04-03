'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Autentica al administrador con email y contraseña.
 * Redirige al panel /admin si las credenciales son correctas.
 */
export async function login(formData: FormData) {
  const supabase = await createClient()

  // Conversión de tipos para conveniencia
  // En la práctica, se deben validar los campos de entrada
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Credenciales incorrectas o usuario no autorizado.' }
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

/**
 * Envía un email de recuperación de contraseña al administrador.
 * Supabase maneja el enlace seguro de restablecimiento.
 */
export async function resetPassword(email: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // La URL a la que redirige Supabase después del clic en el email
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
  })

  if (error) {
    return { error: 'No se pudo enviar el correo. Verifica que el email sea correcto.' }
  }

  return { success: true }
}
