import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // La raíz '/' ahora es nuestra Landing Page, no se redirige.

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
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, maxAge: 5400 })
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Si no hay usuario y trata de entrar a /admin, redirigir a /login
  if (!user && request.nextUrl.pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Si hay usuario, optimizamos las verificaciones de DB
  if (user) {
    // BYPASS TOTAL PARA EL DUEÑO: Ahorra todas las consultas de DB en cada navegación
    if (user.email === 'todoobraparabien1998@gmail.com') {
      return supabaseResponse;
    }

    // Una sola consulta combinada para Status y Rol (Optimizada)
    const { data: userData } = await supabase
      .from('users')
      .select('status, role')
      .eq('id', user.id)
      .single()

    // 1. Bloqueo por cuenta pausada
    if (userData && userData.status === 'inactive') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'account_paused')
      const response = NextResponse.redirect(url)
      // Borrar cookies de sesión para forzar re-login si lo activan luego
      response.cookies.delete('sb-access-token')
      return response
    }

    // 2. Control de acceso RBAC para rutas sensibles
    const isSensitiveRoute = request.nextUrl.pathname.startsWith('/admin/finanzas') || 
                            request.nextUrl.pathname.startsWith('/admin/administradores')

    if (isSensitiveRoute && userData?.role !== 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
