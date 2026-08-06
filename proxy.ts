import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, ROLE_COOKIE, STATUS_COOKIE } from '@/lib/supabase/server'

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next({ request })

  const session = request.cookies.get(SESSION_COOKIE)?.value
  const role = request.cookies.get(ROLE_COOKIE)?.value
  const status = request.cookies.get(STATUS_COOKIE)?.value

  // ── Rutas públicas ───────────────────────────────────────
  const publicPaths = ['/', '/login', '/reset-password']
  const isPublicPath =
    publicPaths.some((p) => pathname === p) ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/')

  // Sin sesión y ruta protegida → login
  if (!session && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Con sesión y en /login → panel
  if (session && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  // Cuenta pausada → forzar logout
  if (session && status === 'inactive') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'account_paused')
    const res = NextResponse.redirect(url)
    res.cookies.delete(SESSION_COOKIE)
    res.cookies.delete(ROLE_COOKIE)
    res.cookies.delete(STATUS_COOKIE)
    return res
  }

  // Rutas sensibles: solo superadmin (la verificación real ocurre en las
  // server actions con el Admin SDK).
  const isSensitiveRoute =
    pathname.startsWith('/admin/finanzas') ||
    pathname.startsWith('/admin/administradores') ||
    pathname.startsWith('/admin/zonas')

  if (session && isSensitiveRoute && role !== 'superadmin') {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}