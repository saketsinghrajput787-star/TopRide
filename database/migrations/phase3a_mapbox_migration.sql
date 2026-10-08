-- ============================================================
-- TOPRIDE PHASE 3A MIGRATION
-- Real Mapbox Maps, Geocoding Coordinates & Route Persistence
-- Run this in your Supabase Dashboard > SQL Editor
-- Project: jocpolzoovgpnbnhluoq
-- ============================================================

-- 1. ADD GEOGRAPHIC COORDINATE & MAPBOX FIELDS TO TRIPS
ALTER TABLE public.trips 
    ADD COLUMN IF NOT EXISTS origin_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS origin_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS origin_place_id TEXT,
    ADD COLUMN IF NOT EXISTS origin_address TEXT,
    ADD COLUMN IF NOT EXISTS destination_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS destination_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS destination_place_id TEXT,
    ADD COLUMN IF NOT EXISTS destination_address TEXT,
    ADD COLUMN IF NOT EXISTS route_geometry JSONB;

-- 2. ADD GEOGRAPHIC COORDINATE FIELDS TO PASSENGER REQUESTS
ALTER TABLE public.passenger_requests 
    ADD COLUMN IF NOT EXISTS origin_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS origin_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS origin_place_id TEXT,
    ADD COLUMN IF NOT EXISTS origin_address TEXT,
    ADD COLUMN IF NOT EXISTS destination_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS destination_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS destination_place_id TEXT,
    ADD COLUMN IF NOT EXISTS destination_address TEXT;

-- 3. ADD GEOGRAPHIC COORDINATE FIELDS TO LUGGAGE PACKAGES
ALTER TABLE public.luggage_packages 
    ADD COLUMN IF NOT EXISTS origin_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS origin_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS origin_place_id TEXT,
    ADD COLUMN IF NOT EXISTS origin_address TEXT,
    ADD COLUMN IF NOT EXISTS destination_latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS destination_longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS destination_place_id TEXT,
    ADD COLUMN IF NOT EXISTS destination_address TEXT;

-- 4. CREATE INDEXES FOR FAST GEOGRAPHIC / LOCATION SEARCH
CREATE INDEX IF NOT EXISTS idx_trips_origin_coords ON public.trips(origin_latitude, origin_longitude);
CREATE INDEX IF NOT EXISTS idx_trips_dest_coords ON public.trips(destination_latitude, destination_longitude);
CREATE INDEX IF NOT EXISTS idx_passenger_requests_coords ON public.passenger_requests(origin_latitude, destination_latitude);
CREATE INDEX IF NOT EXISTS idx_luggage_coords ON public.luggage_packages(origin_latitude, destination_latitude);

-- 5. UPDATE EXISTING SEED TRIPS WITH ACCURATE MAPBOX COORDINATES (BACKWARD COMPATIBILITY)
UPDATE public.trips
SET 
    origin_latitude = 12.9716,
    origin_longitude = 77.5946,
    origin_address = 'Bengaluru, Karnataka, India',
    destination_latitude = 17.3850,
    destination_longitude = 78.4867,
    destination_address = 'Hyderabad, Telangana, India'
WHERE origin ILIKE '%Bengaluru%' AND destination ILIKE '%Hyderabad%' AND origin_latitude IS NULL;

UPDATE public.trips
SET 
    origin_latitude = 12.9716,
    origin_longitude = 77.5946,
    origin_address = 'Bengaluru, Karnataka, India',
    destination_latitude = 12.2958,
    destination_longitude = 76.6394,
    destination_address = 'Mysuru, Karnataka, India'
WHERE origin ILIKE '%Bengaluru%' AND destination ILIKE '%Mysuru%' AND origin_latitude IS NULL;
