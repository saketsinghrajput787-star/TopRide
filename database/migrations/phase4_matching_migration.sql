-- ============================================================
-- TOPRIDE SUPABASE POSTGRESQL SCHEMA — PHASE 4
-- AUTOMATIC PASSENGER -> DRIVER/TRIP MATCHING & ATOMIC ASSIGNMENT
-- Run this in your Supabase Dashboard > SQL Editor
-- Project: jocpolzoovgpnbnhluoq
-- ============================================================

-- 1. ADD RATING COUNT COLUMN TO PUBLIC.PROFILES (FOR NEW DRIVER WEIGHTED RATING)
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Backfill rating_count from public.reviews if reviews table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reviews') THEN
        UPDATE public.profiles p
        SET rating_count = (
            SELECT COUNT(*) 
            FROM public.reviews r 
            WHERE r.reviewee_id = p.id
        )
        WHERE p.rating_count = 0 OR p.rating_count IS NULL;
    END IF;
END $$;

-- 2. ADD MATCHING METADATA TO BOOKINGS
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'direct',
    ADD COLUMN IF NOT EXISTS match_score NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_bookings_assignment_type ON public.bookings(assignment_type);

-- 3. ADD MATCHING METADATA TO PASSENGER REQUESTS
ALTER TABLE public.passenger_requests
    ADD COLUMN IF NOT EXISTS assigned_trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS match_score NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS idx_passenger_requests_assigned_trip ON public.passenger_requests(assigned_trip_id);

-- 4. CONCURRENCY-SAFE ATOMIC MATCHING & SEAT ASSIGNMENT RPC
-- Uses SELECT ... FOR UPDATE exclusive row locking to prevent race conditions and overbooking.
CREATE OR REPLACE FUNCTION public.assign_and_book_matched_trip(
    p_trip_id UUID,
    p_passenger_id UUID,
    p_seats_count INT,
    p_luggage_tier TEXT,
    p_notes TEXT,
    p_total_paid NUMERIC,
    p_booking_ref TEXT,
    p_match_score NUMERIC DEFAULT NULL,
    p_assignment_type TEXT DEFAULT 'automatic'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trip RECORD;
    v_booking_id UUID;
    v_new_available INT;
    v_existing_booking UUID;
BEGIN
    -- 1. Row-level exclusive lock on the trip to prevent race conditions & overbooking
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0002', 'message', 'Trip not found');
    END IF;

    -- 2. Hard constraint: Trip must still be upcoming
    IF v_trip.status != 'upcoming' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0003', 'message', 'Trip is no longer open for booking');
    END IF;

    -- 3. Hard constraint: Passenger cannot book their own trip
    IF v_trip.driver_id = p_passenger_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0005', 'message', 'Drivers cannot book their own trip');
    END IF;

    -- 4. Hard constraint: Passenger must not already have an active booking on the same trip
    SELECT id INTO v_existing_booking
    FROM public.bookings
    WHERE trip_id = p_trip_id
      AND passenger_id = p_passenger_id
      AND booking_status = 'confirmed'
    LIMIT 1;

    IF v_existing_booking IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0006', 'message', 'Passenger already has an active booking on this trip');
    END IF;

    -- 5. Hard constraint: Trip must have enough available seats
    IF v_trip.available_seats < p_seats_count THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0004', 'message', 'Not enough seats available');
    END IF;

    -- 6. Atomically decrement seats (guaranteeing available_seats >= 0)
    v_new_available := v_trip.available_seats - p_seats_count;
    UPDATE public.trips
    SET available_seats = v_new_available,
        updated_at = NOW()
    WHERE id = p_trip_id;

    -- 7. Insert authoritative Booking record
    INSERT INTO public.bookings (
        booking_ref,
        trip_id,
        passenger_id,
        seats_count,
        luggage_tier,
        passenger_notes,
        total_paid,
        payment_status,
        booking_status,
        assignment_type,
        match_score
    )
    VALUES (
        p_booking_ref,
        p_trip_id,
        p_passenger_id,
        p_seats_count,
        COALESCE(p_luggage_tier, 'small'),
        COALESCE(p_notes, ''),
        p_total_paid,
        'completed',
        'confirmed',
        COALESCE(p_assignment_type, 'automatic'),
        p_match_score
    )
    RETURNING id INTO v_booking_id;

    -- 8. Insert Notification for Passenger
    INSERT INTO public.notifications (
        user_id,
        title,
        description,
        read,
        type,
        target_screen,
        target_id
    )
    VALUES (
        p_passenger_id,
        'Trip Matched & Confirmed',
        'Your ride from ' || v_trip.origin || ' to ' || v_trip.destination || ' has been matched and confirmed (Ref: ' || p_booking_ref || ').',
        false,
        'booking',
        'trips',
        v_trip.id::TEXT
    );

    -- 9. Insert Notification for Driver
    INSERT INTO public.notifications (
        user_id,
        title,
        description,
        read,
        type,
        target_screen,
        target_id
    )
    VALUES (
        v_trip.driver_id,
        'New Passenger Matched',
        'A passenger was automatically matched to your trip from ' || v_trip.origin || ' to ' || v_trip.destination || ' (' || p_seats_count || ' seat(s)).',
        false,
        'booking',
        'trips',
        v_trip.id::TEXT
    );

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'booking_ref', p_booking_ref,
        'trip_id', p_trip_id,
        'remaining_seats', v_new_available
    );
END;
$$;

-- Grant execution permission on assign_and_book_matched_trip
GRANT EXECUTE ON FUNCTION public.assign_and_book_matched_trip TO authenticated, service_role;
