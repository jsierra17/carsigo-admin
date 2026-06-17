-- Migration 002: Rate Schedules + Progressive Pricing

-- 1. Add columns to rate_cards
ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS included_km INT DEFAULT 2;
ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS extra_km_percent NUMERIC DEFAULT 50;

-- 2. Create rate_schedules table
CREATE TABLE IF NOT EXISTS public.rate_schedules (
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
);

CREATE INDEX IF NOT EXISTS idx_rate_schedules_active ON public.rate_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_schedules_vehicle ON public.rate_schedules(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_rate_schedules_day_type ON public.rate_schedules(day_type);

-- Add vehicle_type to dynamic_pricing_rules
ALTER TABLE public.dynamic_pricing_rules ADD COLUMN IF NOT EXISTS vehicle_type TEXT CHECK (vehicle_type IN ('car', 'moto'));

-- Enable RLS
ALTER TABLE public.rate_schedules ENABLE ROW LEVEL SECURITY;

-- 3. Seed rate_cards
INSERT INTO public.rate_cards (name, vehicle_type, base_fee, price_per_km, price_per_minute, minimum_fare, free_waiting_minutes, waiting_price_per_minute, commission_percent, included_km, extra_km_percent)
VALUES
  ('Tarifa Moto - El Carmen de Bolívar', 'moto', 3500, 0, 0, 5000, 5, 200, 10, 2, 50),
  ('Tarifa Carro - El Carmen de Bolívar', 'car', 5600, 0, 0, 5000, 5, 200, 10, 2, 50)
ON CONFLICT DO NOTHING;

-- 4. Seed rate_schedules (Moto)
INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
VALUES
  ('Lun-Vie Mañana Moto', 'moto', 'weekday', 'morning', '04:30', '16:29', 3500, 3),
  ('Lun-Vie Tarde Moto', 'moto', 'weekday', 'evening', '16:30', '04:29', 4000, 13),
  ('Finde Mañana Moto', 'moto', 'weekend', 'morning', '04:30', '16:29', 4000, 4),
  ('Finde Tarde Moto', 'moto', 'weekend', 'evening', '16:30', '04:29', 4000, 20)
ON CONFLICT DO NOTHING;

-- 5. Seed rate_schedules (Carro = 60% more)
INSERT INTO public.rate_schedules (name, vehicle_type, day_type, shift_label, shift_start, shift_end, base_fee, hourly_increase_percent)
VALUES
  ('Lun-Vie Mañana Carro', 'car', 'weekday', 'morning', '04:30', '16:29', 5600, 3),
  ('Lun-Vie Tarde Carro', 'car', 'weekday', 'evening', '16:30', '04:29', 6400, 13),
  ('Finde Mañana Carro', 'car', 'weekend', 'morning', '04:30', '16:29', 6400, 4),
  ('Finde Tarde Carro', 'car', 'weekend', 'evening', '16:30', '04:29', 6400, 20)
ON CONFLICT DO NOTHING;
