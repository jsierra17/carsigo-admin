-- CarSiGo - Esquema de Base de Datos
-- PostgreSQL + PostGIS + Supabase Auth

-- Extensión PostGIS para geolocalización
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- TABLA: users (perfiles de usuarios)
-- Vinculada a auth.users de Supabase vía id (UUID)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT DEFAULT 'N/A',
  role TEXT NOT NULL CHECK (role IN ('passenger', 'driver', 'admin', 'superadmin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLA: driver_profiles (perfiles de conductores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.driver_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  plate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  total_rides INTEGER DEFAULT 0,
  suspension_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLA: trips (viajes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES public.users(id),
  driver_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'active', 'completed', 'cancelled')),
  fare_amount NUMERIC DEFAULT 0,
  commission_amount NUMERIC DEFAULT 0,
  pickup_address TEXT,
  dropoff_address TEXT,
  pickup_location GEOMETRY(Point, 4326),
  dropoff_location GEOMETRY(Point, 4326),
  driver_lat NUMERIC,
  driver_lng NUMERIC,
  distance_km NUMERIC DEFAULT 0,
  duration_min NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- TABLA: driver_applications (solicitudes de conductor)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.driver_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  full_name TEXT NOT NULL,
  id_number TEXT NOT NULL,
  plate TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  color TEXT,
  vehicle_type TEXT NOT NULL,
  cedula_url TEXT,
  selfie_url TEXT,
  tarjeta_propiedad_url TEXT,
  licencia_url TEXT,
  soat_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT
);

-- ============================================================
-- TABLA: settlements (liquidaciones financieras)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.users(id),
  reference TEXT NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  trip_count INTEGER NOT NULL DEFAULT 0,
  total_fare NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  driver_payout NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLA: geofences (geocercas / zonas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_name TEXT NOT NULL,
  boundaries GEOMETRY NOT NULL,
  is_active BOOLEAN DEFAULT true,
  base_multiplier NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLA: wallets (billeteras de conductores)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id),
  balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON public.driver_profiles(status);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON public.trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_passenger ON public.trips(passenger_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_applications_status ON public.driver_applications(status);
CREATE INDEX IF NOT EXISTS idx_settlements_created_at ON public.settlements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_driver ON public.settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_geofences_active ON public.geofences(is_active);
CREATE INDEX IF NOT EXISTS idx_geofences_boundaries ON public.geofences USING GIST (boundaries);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);

-- ============================================================
-- TABLA: rate_cards (tarifas base por tipo de vehículo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car', 'moto')),
  base_fee NUMERIC NOT NULL DEFAULT 2500,
  price_per_km NUMERIC NOT NULL DEFAULT 1000,
  price_per_minute NUMERIC NOT NULL DEFAULT 150,
  minimum_fare NUMERIC NOT NULL DEFAULT 5000,
  free_waiting_minutes INT DEFAULT 5,
  waiting_price_per_minute NUMERIC DEFAULT 200,
  commission_percent NUMERIC DEFAULT 10,
  included_km INT DEFAULT 2,
  extra_km_percent NUMERIC DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLA: rate_schedules (horarios de tarifa progresiva)
-- ============================================================
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

-- ============================================================
-- TABLA: dynamic_pricing_rules (reglas de precio dinámico)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dynamic_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('time_range', 'day_of_week', 'specific_date', 'date_range', 'demand_zone', 'event')),
  start_time TIME,
  end_time TIME,
  days_of_week INT[],
  specific_date DATE,
  is_recurring BOOLEAN DEFAULT false,
  date_from DATE,
  date_to DATE,
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  flat_surcharge NUMERIC DEFAULT 0,
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
  vehicle_type TEXT CHECK (vehicle_type IN ('car', 'moto')),
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TABLA: trip_fare_breakdown (desglose de tarifa por viaje)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_fare_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  rate_card_id UUID REFERENCES public.rate_cards(id),
  base_fee NUMERIC DEFAULT 0,
  distance_charge NUMERIC DEFAULT 0,
  time_charge NUMERIC DEFAULT 0,
  waiting_charge NUMERIC DEFAULT 0,
  dynamic_multiplier NUMERIC DEFAULT 1.0,
  surcharges JSONB DEFAULT '[]',
  subtotal NUMERIC DEFAULT 0,
  commission_percent NUMERIC DEFAULT 10,
  commission_amount NUMERIC DEFAULT 0,
  driver_earnings NUMERIC DEFAULT 0,
  distance_km NUMERIC DEFAULT 0,
  duration_min NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_active ON public.rate_cards(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_cards_vehicle ON public.rate_cards(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_rate_schedules_active ON public.rate_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_schedules_vehicle ON public.rate_schedules(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_rate_schedules_day_type ON public.rate_schedules(day_type);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_rules_active ON public.dynamic_pricing_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_rules_type ON public.dynamic_pricing_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_rules_dates ON public.dynamic_pricing_rules(specific_date);
CREATE INDEX IF NOT EXISTS idx_trip_fare_breakdown_trip ON public.trip_fare_breakdown(trip_id);

-- ============================================================
-- RLS — habilitado en base de datos real
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES — settlements
-- ============================================================
CREATE POLICY settlements_select_driver ON public.settlements FOR SELECT
  USING (driver_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY settlements_update_admin ON public.settlements FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ============================================================
-- POLICIES — users (admin puede ver/tocar cualquier perfil)
-- ============================================================
CREATE POLICY users_select_own ON public.users FOR SELECT
  USING (id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY users_update_own ON public.users FOR UPDATE
  USING (id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY users_insert_auth ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================
-- POLICIES — driver_profiles (solo SELECT; writes via RPC)
-- ============================================================
CREATE POLICY driver_profiles_select_all ON public.driver_profiles FOR SELECT
  USING (true);
-- INSERT/UPDATE no se pueden crear via Management API (auth.uid() bug en esta tabla).
-- Usar RPC: public.set_driver_availability(), public.create_driver_profile()

-- ============================================================
-- POLICIES — trips (pasajero crea, conductor acepta, admin todo)
-- ============================================================
CREATE POLICY trips_insert_passenger ON public.trips FOR INSERT
  WITH CHECK (passenger_id = auth.uid());
CREATE POLICY trips_select_own ON public.trips FOR SELECT
  USING (passenger_id = auth.uid()
    OR driver_id = auth.uid()
    OR (status = 'pending' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'driver')
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY trips_update_involved ON public.trips FOR UPDATE
  USING (passenger_id = auth.uid()
    OR driver_id = auth.uid()
    OR (status = 'pending' AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'driver')
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ============================================================
-- POLICIES — driver_applications
-- ============================================================
CREATE POLICY driver_applications_insert_own ON public.driver_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY driver_applications_select_own ON public.driver_applications FOR SELECT
  USING (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY driver_applications_update_admin ON public.driver_applications FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ============================================================
-- POLICIES — geofences (SELECT público, CRUD admin)
-- ============================================================
CREATE POLICY geofences_select ON public.geofences FOR SELECT
  USING (true);
CREATE POLICY geofences_write_admin ON public.geofences FOR INSERT
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY geofences_update_admin ON public.geofences FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ============================================================
-- POLICIES — wallets
-- ============================================================
CREATE POLICY wallets_select_own ON public.wallets FOR SELECT
  USING (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY wallets_update_admin ON public.wallets FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ============================================================
-- POLICIES — rate_cards / rate_schedules / dynamic_pricing
-- ============================================================
CREATE POLICY rate_cards_select ON public.rate_cards FOR SELECT USING (true);
CREATE POLICY rate_cards_write_admin ON public.rate_cards FOR INSERT
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY rate_cards_update_admin ON public.rate_cards FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

CREATE POLICY rate_schedules_select ON public.rate_schedules FOR SELECT USING (true);
CREATE POLICY rate_schedules_write_admin ON public.rate_schedules FOR INSERT
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY rate_schedules_update_admin ON public.rate_schedules FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

CREATE POLICY dynamic_pricing_rules_select ON public.dynamic_pricing_rules FOR SELECT USING (true);
CREATE POLICY dynamic_pricing_rules_write_admin ON public.dynamic_pricing_rules FOR INSERT
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));
CREATE POLICY dynamic_pricing_rules_update_admin ON public.dynamic_pricing_rules FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ============================================================
-- POLICIES — trip_fare_breakdown (solo pasajero/conductor/admin)
-- ============================================================
CREATE POLICY trip_fare_breakdown_select ON public.trip_fare_breakdown FOR SELECT
  USING ((EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id
    AND (t.passenger_id = auth.uid() OR t.driver_id = auth.uid())))
    OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin','superadmin'));

-- ============================================================
-- RPC FUNCTIONS (bypass driver_profiles RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_driver_availability(p_available BOOLEAN)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.driver_profiles
  SET status = CASE WHEN p_available THEN 'active' ELSE 'suspended' END
  WHERE user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_driver_profile(p_vehicle_type TEXT, p_plate TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.driver_profiles (user_id, vehicle_type, plate, status)
  VALUES (auth.uid(), p_vehicle_type, p_plate, 'pending')
  ON CONFLICT (user_id) DO UPDATE
  SET vehicle_type = p_vehicle_type, plate = p_plate;
END;
$$;
