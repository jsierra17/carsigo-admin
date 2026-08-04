-- Migration 003: Trip status improvements

-- Allow driver_id to be nullable (passenger creates trip without driver)
ALTER TABLE public.trips ALTER COLUMN driver_id DROP NOT NULL;

-- Add new columns
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_lat NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_lng NUMERIC;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS duration_min NUMERIC DEFAULT 0;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Update status check constraint to include 'accepted'
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE public.trips ADD CONSTRAINT trips_status_check CHECK (status IN ('pending', 'accepted', 'active', 'completed', 'cancelled'));
