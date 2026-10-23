import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/firebase/service'
import { calculateFare } from '@/lib/pricing-engine'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { passenger_id, vehicle_type, pickup_address, dropoff_address,
      pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, distance_km, duration_min, zone_id } = body

    if (!passenger_id || !vehicle_type || !pickup_address || !dropoff_address) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const db = createAdminClient()

    const fare = await calculateFare({ vehicle_type, distance_km: distance_km || 0, duration_min: duration_min || 0, zone_id: typeof zone_id === 'string' && zone_id ? zone_id : undefined })

    const { data: trip, error } = await db
      .from('trips')
      .insert({
        passenger_id,
        status: 'pending',
        fare_amount: fare.final_fare,
        commission_amount: fare.commission_amount,
        pickup_address,
        dropoff_address,
        pickup_location: pickup_lat && pickup_lng
          ? `SRID=4326;POINT(${pickup_lng} ${pickup_lat})` : null,
        dropoff_location: dropoff_lat && dropoff_lng
          ? `SRID=4326;POINT(${dropoff_lng} ${dropoff_lat})` : null,
        distance_km: distance_km || 0,
        duration_min: duration_min || 0,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ trip, fare_breakdown: fare }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const driver_id = searchParams.get('driver_id')
    const passenger_id = searchParams.get('passenger_id')

    const db = createAdminClient()
    let query = db.from('trips').select('*').order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (driver_id) query = query.eq('driver_id', driver_id)
    if (passenger_id) query = query.eq('passenger_id', passenger_id)

    const { data, error } = await query.limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
