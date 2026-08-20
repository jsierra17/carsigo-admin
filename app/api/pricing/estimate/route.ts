import { NextResponse } from 'next/server'
import { calculateFare } from '@/lib/pricing-engine'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { vehicle_type, distance_km, duration_min, datetime, zone_id } = body

    if (!vehicle_type || !['moto', 'car'].includes(vehicle_type)) {
      return NextResponse.json({ error: 'vehicle_type debe ser "moto" o "car"' }, { status: 400 })
    }
    if (typeof distance_km !== 'number' || distance_km < 0) {
      return NextResponse.json({ error: 'distance_km requerido y debe ser >= 0' }, { status: 400 })
    }

    const breakdown = await calculateFare({
      vehicle_type,
      distance_km,
      duration_min: duration_min || 0,
      datetime: datetime ? new Date(datetime) : undefined,
      zone_id: typeof zone_id === 'string' && zone_id ? zone_id : undefined,
    })

    return NextResponse.json(breakdown)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
