-- ============================================================
-- TOPRIDE PHASE 2A MIGRATION: RLS, ATOMIC SEATS & RPC
-- Run this in your Supabase Dashboard > SQL Editor
-- Project: jocpolzoovgpnbnhluoq
-- ============================================================

-- 1. Ensure Table Grants for authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.trips TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.trip_seats TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vehicles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.profiles TO anon, authenticated, service_role;

-- 2. Ensure Unique Constraint on trip_seats(trip_id, seat_number)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trip_seats_trip_id_seat_number_key'
    ) THEN
        ALTER TABLE public.trip_seats 
        ADD CONSTRAINT trip_seats_trip_id_seat_number_key UNIQUE (trip_id, seat_number);
    END IF;
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN
        NULL;
END $$;

-- 3. Enable RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_seats ENABLE ROW LEVEL SECURITY;

-- 4. Helper Function for Driver Ownership Check (Avoids RLS subquery recursion)
CREATE OR REPLACE FUNCTION public.is_trip_driver(check_trip_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.trips
        WHERE id = check_trip_id
        AND driver_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_trip_driver(UUID) TO anon, authenticated, service_role;

-- 5. Dynamically Drop ALL Existing Policies on trips & trip_seats
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'trips'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.trips', pol.policyname);
    END LOOP;

    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'trip_seats'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.trip_seats', pol.policyname);
    END LOOP;
END $$;

-- 6. Create Fresh RLS Policies for trips
CREATE POLICY "trips_select_all" 
    ON public.trips FOR SELECT 
    USING (true);

CREATE POLICY "trips_insert_driver" 
    ON public.trips FOR INSERT 
    WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "trips_update_driver" 
    ON public.trips FOR UPDATE 
    USING (auth.uid() = driver_id);

CREATE POLICY "trips_delete_driver" 
    ON public.trips FOR DELETE 
    USING (auth.uid() = driver_id);

-- 7. Create Fresh RLS Policies for trip_seats using helper function
CREATE POLICY "trip_seats_select_all" 
    ON public.trip_seats FOR SELECT 
    USING (true);

CREATE POLICY "trip_seats_insert_driver" 
    ON public.trip_seats FOR INSERT 
    WITH CHECK (public.is_trip_driver(trip_id));

CREATE POLICY "trip_seats_update_driver" 
    ON public.trip_seats FOR UPDATE 
    USING (public.is_trip_driver(trip_id));

CREATE POLICY "trip_seats_delete_driver" 
    ON public.trip_seats FOR DELETE 
    USING (public.is_trip_driver(trip_id));

-- 8. Trigger Function for atomic seat generation
CREATE OR REPLACE FUNCTION public.handle_trip_seats_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    s INT;
BEGIN
    IF NEW.total_seats IS NOT NULL AND NEW.total_seats > 0 THEN
        FOR s IN 1..NEW.total_seats LOOP
            INSERT INTO public.trip_seats (id, trip_id, seat_number, status)
            VALUES (gen_random_uuid(), NEW.id, s, 'available')
            ON CONFLICT (trip_id, seat_number) DO NOTHING;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_trip_seats ON public.trips;
CREATE TRIGGER trigger_generate_trip_seats
    AFTER INSERT ON public.trips
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_trip_seats_generation();

-- 9A. Transactional RPC (JSON payload signature)
CREATE OR REPLACE FUNCTION public.create_trip_with_seats(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_driver_id UUID;
    v_vehicle_id UUID;
    v_trip_id UUID;
    v_total_seats INT;
    s INT;
BEGIN
    v_driver_id := (payload->>'driver_id')::UUID;
    v_total_seats := (payload->>'total_seats')::INT;

    -- Security check: driver must match auth.uid() if authenticated
    IF auth.uid() IS NOT NULL AND auth.uid() != v_driver_id THEN
        RAISE EXCEPTION 'Unauthorized: driver_id must match authenticated user' USING ERRCODE = '42501';
    END IF;

    IF payload->>'vehicle_id' IS NOT NULL AND payload->>'vehicle_id' != '' THEN
        v_vehicle_id := (payload->>'vehicle_id')::UUID;
    ELSE
        v_vehicle_id := NULL;
    END IF;

    -- Insert Trip
    INSERT INTO public.trips (
        id,
        driver_id,
        vehicle_id,
        origin,
        origin_detail,
        destination,
        destination_detail,
        date,
        departure_time,
        arrival_time,
        duration,
        total_seats,
        available_seats,
        price_per_seat,
        currency,
        luggage_allowed,
        luggage_details,
        instant_booking,
        trip_rules,
        stops,
        status
    ) VALUES (
        gen_random_uuid(),
        v_driver_id,
        v_vehicle_id,
        payload->>'origin',
        COALESCE(payload->>'origin_detail', ''),
        payload->>'destination',
        COALESCE(payload->>'destination_detail', ''),
        payload->>'date',
        payload->>'departure_time',
        COALESCE(payload->>'arrival_time', ''),
        COALESCE(payload->>'duration', ''),
        v_total_seats,
        v_total_seats,
        (payload->>'price_per_seat')::NUMERIC,
        COALESCE(payload->>'currency', '₹'),
        COALESCE(payload->>'luggage_allowed', 'Medium'),
        COALESCE(payload->>'luggage_details', ''),
        COALESCE((payload->>'instant_booking')::BOOLEAN, TRUE),
        COALESCE(payload->'trip_rules', '[]'::jsonb),
        COALESCE(payload->'stops', '[]'::jsonb),
        'upcoming'
    )
    RETURNING id INTO v_trip_id;

    -- Atomically insert seats
    FOR s IN 1..v_total_seats LOOP
        INSERT INTO public.trip_seats (id, trip_id, seat_number, status)
        VALUES (gen_random_uuid(), v_trip_id, s, 'available')
        ON CONFLICT (trip_id, seat_number) DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'trip_id', v_trip_id
    );
END;
$$;

-- 9B. Transactional RPC (Individual arguments signature)
CREATE OR REPLACE FUNCTION public.create_trip_with_seats(
    p_driver_id UUID,
    p_vehicle_id UUID,
    p_origin TEXT,
    p_origin_detail TEXT,
    p_destination TEXT,
    p_destination_detail TEXT,
    p_date TEXT,
    p_departure_time TEXT,
    p_arrival_time TEXT,
    p_duration TEXT,
    p_total_seats INTEGER,
    p_price_per_seat NUMERIC,
    p_currency TEXT,
    p_luggage_allowed TEXT,
    p_luggage_details TEXT,
    p_instant_booking BOOLEAN,
    p_trip_rules JSONB,
    p_stops JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN public.create_trip_with_seats(jsonb_build_object(
        'driver_id', p_driver_id,
        'vehicle_id', p_vehicle_id,
        'origin', p_origin,
        'origin_detail', p_origin_detail,
        'destination', p_destination,
        'destination_detail', p_destination_detail,
        'date', p_date,
        'departure_time', p_departure_time,
        'arrival_time', p_arrival_time,
        'duration', p_duration,
        'total_seats', p_total_seats,
        'price_per_seat', p_price_per_seat,
        'currency', p_currency,
        'luggage_allowed', p_luggage_allowed,
        'luggage_details', p_luggage_details,
        'instant_booking', p_instant_booking,
        'trip_rules', p_trip_rules,
        'stops', p_stops
    ));
END;
$$;

-- 10. Explicit Grants
GRANT EXECUTE ON FUNCTION public.create_trip_with_seats(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_trip_with_seats(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, JSONB, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_trip_seats_generation() TO anon, authenticated, service_role;

-- 11. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
