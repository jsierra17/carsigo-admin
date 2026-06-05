import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'todoobraparabien1998@gmail.com'

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // ── Rutas públicas ───────────────────────────────────────
  const publicPaths = ['/', '/login', '/auth/callback', '/reset-password']
  const isPublicPath = publicPaths.some(p => pathname === p || pathname.startsWith('/auth/'))

  // Si no hay sesión y no es ruta pública → redirigir al login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si ya está autenticado y va a /login → redirigir al panel
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  // ── Usuario autenticado: validar rol y estado ────────────
  if (user) {
    // Owner bypass
    if (user.email === OWNER_EMAIL) {
      return supabaseResponse
    }

    const { data: userData } = await supabase
      .from('users')
      .select('status, role')
      .eq('id', user.id)
      .single()

    // Bloqueo por cuenta inactiva
    if (userData?.status === 'inactive') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'account_paused')
      const response = NextResponse.redirect(url)
      response.cookies.delete('sb-access-token')
      return response
    }

    // Bloqueo de rutas sensibles: solo superadmin
    const isSensitiveRoute =
      pathname.startsWith('/admin/finanzas') ||
      pathname.startsWith('/admin/administradores') ||
      pathname.startsWith('/admin/zonas')

    if (isSensitiveRoute && userData?.role !== 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
