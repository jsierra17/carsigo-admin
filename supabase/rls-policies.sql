-- ============================================================
-- RLS Policies para CarSiGo
-- Roles: passenger, driver, admin, superadmin
-- ============================================================

-- Helper: check if current user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'));
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: check if current user has driver role
CREATE OR REPLACE FUNCTION public.is_driver()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'driver');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 1. users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "users_insert_auth" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- ============================================================
-- 2. driver_profiles
-- ============================================================
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_profiles_select_all" ON public.driver_profiles
  FOR SELECT USING (true);

CREATE POLICY "driver_profiles_insert_own" ON public.driver_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "driver_profiles_update_own" ON public.driver_profiles
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- 3. trips
-- ============================================================
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_select_own" ON public.trips
  FOR SELECT USING (
    passenger_id = auth.uid()
    OR driver_id = auth.uid()
    OR (status = 'pending' AND public.is_driver())
    OR public.is_admin()
  );

CREATE POLICY "trips_insert_passenger" ON public.trips
  FOR INSERT WITH CHECK (passenger_id = auth.uid());

CREATE POLICY "trips_update_involved" ON public.trips
  FOR UPDATE USING (
    passenger_id = auth.uid()
    OR driver_id = auth.uid()
    OR public.is_admin()
  );

-- ============================================================
-- 4. driver_applications
-- ============================================================
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "driver_applications_select_own" ON public.driver_applications
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "driver_applications_insert_own" ON public.driver_applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "driver_applications_update_admin" ON public.driver_applications
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- 5. settlements (admin only)
-- ============================================================
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlements_admin" ON public.settlements
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 6. geofences (read all, write admin)
-- ============================================================
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geofences_select" ON public.geofences
  FOR SELECT USING (true);

CREATE POLICY "geofences_write_admin" ON public.geofences
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "geofences_update_admin" ON public.geofences
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "geofences_delete_admin" ON public.geofences
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 7. wallets (read own, write admin)
-- ============================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "wallets_update_admin" ON public.wallets
  FOR UPDATE USING (public.is_admin());

-- ============================================================
-- 8. rate_cards (read all, write admin)
-- ============================================================
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_cards_select" ON public.rate_cards
  FOR SELECT USING (true);

CREATE POLICY "rate_cards_write_admin" ON public.rate_cards
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "rate_cards_update_admin" ON public.rate_cards
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "rate_cards_delete_admin" ON public.rate_cards
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 9. rate_schedules (read all, write admin)
-- ============================================================
ALTER TABLE public.rate_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_schedules_select" ON public.rate_schedules
  FOR SELECT USING (true);

CREATE POLICY "rate_schedules_write_admin" ON public.rate_schedules
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "rate_schedules_update_admin" ON public.rate_schedules
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "rate_schedules_delete_admin" ON public.rate_schedules
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 10. dynamic_pricing_rules (read all, write admin)
-- ============================================================
ALTER TABLE public.dynamic_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dynamic_pricing_rules_select" ON public.dynamic_pricing_rules
  FOR SELECT USING (true);

CREATE POLICY "dynamic_pricing_rules_write_admin" ON public.dynamic_pricing_rules
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "dynamic_pricing_rules_update_admin" ON public.dynamic_pricing_rules
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "dynamic_pricing_rules_delete_admin" ON public.dynamic_pricing_rules
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 11. trip_fare_breakdown (read own, write system)
-- ============================================================
ALTER TABLE public.trip_fare_breakdown ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_fare_breakdown_select" ON public.trip_fare_breakdown
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND (t.passenger_id = auth.uid() OR t.driver_id = auth.uid()))
    OR public.is_admin()
  );

-- Allow service_role (admin client) to insert
-- Allow authenticated users to insert their own trip breakdowns
CREATE POLICY "trip_fare_breakdown_insert" ON public.trip_fare_breakdown
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.passenger_id = auth.uid())
    OR public.is_admin()
  );
