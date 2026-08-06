import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/service'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '0')
    const lng = parseFloat(searchParams.get('lng') || '0')
    const radius_km = parseFloat(searchParams.get('radius_km') || '10')

    const supabase = createAdminClient()

    const { data: activeDrivers, error } = await supabase
      .from('driver_profiles')
      .select(`
        user_id,
        vehicle_type,
        plate,
        users!inner(name, phone)
      `)
      .eq('status', 'active')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const drivers = (activeDrivers || []).map((d: {
      user_id: string
      vehicle_type?: string
      plate?: string
      users?: { name?: string; phone?: string } | null
    }) => ({
      user_id: d.user_id,
      name: (d.users as any)?.name,
      phone: (d.users as any)?.phone,
      vehicle_type: d.vehicle_type,
      plate: d.plate,
    }))

    return NextResponse.json(drivers)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
