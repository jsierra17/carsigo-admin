import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/firebase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const db = await createClient()
    await db.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/admin', request.url))
}
