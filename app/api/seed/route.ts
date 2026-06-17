import { NextResponse } from 'next/server'

const PROJECT_REF = 'gyfbazbvrgmwtwkkswdy'
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

export async function GET() {
  const pat = process.env.SUPABASE_PAT
  if (!pat) {
    return NextResponse.json({ error: 'SUPABASE_PAT no configurada' }, { status: 400 })
  }

  const statements = [
    // Columns
    `ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS included_km INT DEFAULT 2`,
    `ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS extra_km_percent NUMERIC DEFAULT 50`,
    `ALTER TABLE public.dynamic_pricing_rules ADD COLUMN IF NOT EXISTS vehicle_type TEXT CHECK (vehicle_type IN ('car', 'moto'))`,
    // Table
    `CREATE TABLE IF NOT EXISTS public.rate_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'moto')),
      day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'weekend', 'special')),
      shift_label TEXT NOT NULL CHECK (shift_label IN ('morning', 'evening')),
      shift_start TIME NOT NULL,
      shift_end TIME NOT NULL,
      base_fee NUMERIC NOT NULL,
      hourly_increase_percent NUMERIC NOT NULL DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rate_schedules_active ON public.rate_schedules(is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_rate_schedules_vehicle ON public.rate_schedules(vehicle_type)`,
    `CREATE INDEX IF NOT EXISTS idx_rate_schedules_day_type ON public.rate_schedules(day_type)`,
    `ALTER TABLE public.rate_schedules ENABLE ROW LEVEL SECURITY`,
    // Seed cards
    `INSERT INTO public.rate_cards (name, vehicle_type, base_fee, price_per_km, price_per_minute, minimum_fare, free_waiting_minutes, waiting_price_per_minute, commission_percent, included_km, extra_km_percent)
     SELECT 'Tarifa Moto - El Carmen de Bolívar', 'moto', 3500, 0, 0, 5000, 5, 200, 10, 2, 50
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_cards WHERE vehicle_type = 'moto')`,
    `INSERT INTO public.rate_cards (name, vehicle_type, base_fee, price_per_km, price_per_minute, minimum_fare, free_waiting_minutes, waiting_price_per_minute, commission_percent, included_km, extra_km_percent)
     SELECT 'Tarifa Carro - El Carmen de Bolívar', 'car', 5600, 0, 0, 5000, 5, 200, 10, 2, 50
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_cards WHERE vehicle_type = 'car')`,
    // Seed schedules
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Lun-Vie Mañana Moto', 'moto', 'weekday', 'morning', '04:30', '16:29', 3500, 3
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Lun-Vie Mañana Moto')`,
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Lun-Vie Tarde Moto', 'moto', 'weekday', 'evening', '16:30', '04:29', 4000, 13
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Lun-Vie Tarde Moto')`,
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Finde Mañana Moto', 'moto', 'weekend', 'morning', '04:30', '16:29', 4000, 4
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Finde Mañana Moto')`,
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Finde Tarde Moto', 'moto', 'weekend', 'evening', '16:30', '04:29', 4000, 20
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Finde Tarde Moto')`,
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Lun-Vie Mañana Carro', 'car', 'weekday', 'morning', '04:30', '16:29', 5600, 3
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Lun-Vie Mañana Carro')`,
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Lun-Vie Tarde Carro', 'car', 'weekday', 'evening', '16:30', '04:29', 6400, 13
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Lun-Vie Tarde Carro')`,
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Finde Mañana Carro', 'car', 'weekend', 'morning', '04:30', '16:29', 6400, 4
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Finde Mañana Carro')`,
    `INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
     SELECT 'Finde Tarde Carro', 'car', 'weekend', 'evening', '16:30', '04:29', 6400, 20
     WHERE NOT EXISTS (SELECT 1 FROM public.rate_schedules WHERE name = 'Finde Tarde Carro')`,
  ]

  const results: { label: string; status: string }[] = []
  for (const sql of statements) {
    const label = sql.split('\n')[0].substring(0, 80)
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql + ';' }),
      })
      if (res.ok) {
        results.push({ label, status: 'ok' })
      } else {
        const text = await res.text()
        results.push({ label, status: `error: ${text.substring(0, 100)}` })
      }
    } catch (err: any) {
      results.push({ label, status: `error: ${err.message}` })
    }
  }

  return NextResponse.json({ results })
}
