'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/firebase/server'

export async function login(formData: FormData) {
  const db = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await db.auth.signInWithPassword(data)

  if (error) {
    return { error: 'Credenciales incorrectas o usuario no autorizado.' }
  }

  revalidatePath('/', 'layout')
  redirect('/admin')
}

export async function resetPassword(email: string) {
  const db = await createClient()
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}


