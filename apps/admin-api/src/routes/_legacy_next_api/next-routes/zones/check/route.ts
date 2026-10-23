import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/firebase/service'

export async function POST(req: Request) {
  try {
    const { lat, lng } = await req.json()

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat y lng son requeridos' }, { status: 400 })
    }

    const db = createAdminClient()

    const { data, error } = await db
      .from('geofences')
      .select('id, municipality_name, base_multiplier, boundaries')
      .eq('is_active', true)
      .filter('boundaries', 'st_contains', `POINT(${lng} ${lat})`)
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ zone: null })
    }

    return NextResponse.json({ zone: data || null })
  } catch {
    return NextResponse.json({ zone: null })
  }
}
