import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/service'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { status, driver_id, driver_lat, driver_lng } = body
    const supabase = createAdminClient()

    const updates: Record<string, any> = {}
    if (status) updates.status = status
    if (driver_id) updates.driver_id = driver_id
    if (driver_lat !== undefined) updates.driver_lat = driver_lat
    if (driver_lng !== undefined) updates.driver_lng = driver_lng

    if (status === 'accepted') updates.accepted_at = new Date().toISOString()
    if (status === 'active') updates.started_at = new Date().toISOString()
    if (status === 'completed') updates.completed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('trips')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('trips').select('*').eq('id', id).single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
