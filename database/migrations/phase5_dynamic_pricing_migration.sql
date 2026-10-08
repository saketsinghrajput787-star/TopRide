-- ============================================================
-- TOPRIDE SUPABASE POSTGRESQL SCHEMA — PHASE 5
-- DYNAMIC MARKET PRICING ENGINE & IMMUTABLE BOOKING PRICE
-- Run this in your Supabase Dashboard > SQL Editor
-- Project: jocpolzoovgpnbnhluoq
-- ============================================================

-- 1. ADD MARKET PRICING COLUMNS TO PUBLIC.TRIPS
ALTER TABLE public.trips 
    ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS current_market_price NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS pricing_metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS price_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing trips with price_per_seat as base and current market price
UPDATE public.trips
SET 
    base_price = COALESCE(base_price, price_per_seat),
    current_market_price = COALESCE(current_market_price, price_per_seat),
    price_updated_at = NOW()
WHERE current_market_price IS NULL;

-- 2. ADD IMMUTABLE BOOKING PRICE COLUMN TO PUBLIC.BOOKINGS
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS price_at_booking NUMERIC(10,2);

-- Backfill existing bookings with calculated unit price (total_paid / seats_count)
UPDATE public.bookings
SET price_at_booking = ROUND(total_paid / GREATEST(seats_count, 1), 2)
WHERE price_at_booking IS NULL;

-- 3. CREATE PRICE SNAPSHOT / HISTORY TABLE FOR MARKET TRANSPARENCY & AUDITING
CREATE TABLE IF NOT EXISTS public.price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    market_origin TEXT NOT NULL,
    market_destination TEXT NOT NULL,
    travel_date TEXT NOT NULL,
    base_price NUMERIC(10,2) NOT NULL,
    demand_count INT DEFAULT 0,
    supply_seats INT DEFAULT 0,
    demand_supply_ratio NUMERIC(5,2) DEFAULT 1.0,
    demand_multiplier NUMERIC(5,4) DEFAULT 1.0,
    time_multiplier NUMERIC(5,4) DEFAULT 1.0,
    occupancy_multiplier NUMERIC(5,4) DEFAULT 1.0,
    price_floor NUMERIC(10,2),
    price_ceiling NUMERIC(10,2),
    final_price NUMERIC(10,2) NOT NULL,
    trigger_event TEXT DEFAULT 'created',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_trip_id ON public.price_history(trip_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created_at ON public.price_history(created_at);

-- 4. UPDATE ATOMIC BOOKING FUNCTION TO IMMUTABLY STORE price_at_booking
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
    v_unit_price NUMERIC;
BEGIN
    -- 1. Row-level exclusive lock on the trip
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0002', 'message', 'Trip not found');
    END IF;

    IF v_trip.status != 'upcoming' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0003', 'message', 'Trip is no longer open for booking');
    END IF;

    IF v_trip.driver_id = p_passenger_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0005', 'message', 'Drivers cannot book their own trip');
    END IF;

    SELECT id INTO v_existing_booking
    FROM public.bookings
    WHERE trip_id = p_trip_id
      AND passenger_id = p_passenger_id
      AND booking_status = 'confirmed'
    LIMIT 1;

    IF v_existing_booking IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0006', 'message', 'Passenger already has an active booking on this trip');
    END IF;

    IF v_trip.available_seats < p_seats_count THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'P0004', 'message', 'Not enough seats available');
    END IF;

    -- Authoritative unit price at booking time (locked from trip)
    v_unit_price := COALESCE(v_trip.current_market_price, v_trip.price_per_seat);

    -- Atomically decrement seats
    v_new_available := v_trip.available_seats - p_seats_count;
    UPDATE public.trips
    SET available_seats = v_new_available,
        updated_at = NOW()
    WHERE id = p_trip_id;

    -- Insert authoritative Booking record with immutable price_at_booking
    INSERT INTO public.bookings (
        booking_ref,
        trip_id,
        passenger_id,
        seats_count,
        luggage_tier,
        passenger_notes,
        total_paid,
        price_at_booking,
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
        v_unit_price,
        'completed',
        'confirmed',
        COALESCE(p_assignment_type, 'automatic'),
        p_match_score
    )
    RETURNING id INTO v_booking_id;

    -- Notifications
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
        'remaining_seats', v_new_available,
        'price_at_booking', v_unit_price
    );
END;
$$;
