-- ============================================================
-- TOPRIDE PHASE 2 REMAINING MIGRATION (2B -> 2H)
-- Run this in your Supabase Dashboard > SQL Editor
-- Project: jocpolzoovgpnbnhluoq
-- ============================================================

-- 1. Ensure Table Grants for all remaining Phase 2 tables
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.bookings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.passenger_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.luggage_packages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.notifications TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.universities TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.student_verifications TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.verification_requests TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.support_tickets TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.payout_records TO anon, authenticated, service_role;

-- 2. Clean and Set RLS Policies for Bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bookings viewable by passenger or trip driver" ON public.bookings;
DROP POLICY IF EXISTS "Passengers can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Passengers can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_all" ON public.bookings;
DROP POLICY IF EXISTS "bookings_select_party" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_passenger" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update_party" ON public.bookings;

CREATE POLICY "bookings_select_party" ON public.bookings FOR SELECT USING (
    auth.uid() = passenger_id OR 
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = bookings.trip_id AND trips.driver_id = auth.uid())
);

CREATE POLICY "bookings_insert_passenger" ON public.bookings FOR INSERT WITH CHECK (
    auth.uid() = passenger_id
);

CREATE POLICY "bookings_update_party" ON public.bookings FOR UPDATE USING (
    auth.uid() = passenger_id OR 
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = bookings.trip_id AND trips.driver_id = auth.uid())
);

-- 3. Clean and Set RLS Policies for Passenger Requests
ALTER TABLE public.passenger_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Requests viewable by everyone" ON public.passenger_requests;
DROP POLICY IF EXISTS "Passengers can insert own requests" ON public.passenger_requests;
DROP POLICY IF EXISTS "Passengers can update own requests" ON public.passenger_requests;
DROP POLICY IF EXISTS "passenger_requests_select_all" ON public.passenger_requests;
DROP POLICY IF EXISTS "passenger_requests_insert_passenger" ON public.passenger_requests;
DROP POLICY IF EXISTS "passenger_requests_update_passenger" ON public.passenger_requests;
DROP POLICY IF EXISTS "passenger_requests_delete_passenger" ON public.passenger_requests;

CREATE POLICY "passenger_requests_select_all" ON public.passenger_requests FOR SELECT USING (true);
CREATE POLICY "passenger_requests_insert_passenger" ON public.passenger_requests FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "passenger_requests_update_passenger" ON public.passenger_requests FOR UPDATE USING (auth.uid() = passenger_id);
CREATE POLICY "passenger_requests_delete_passenger" ON public.passenger_requests FOR DELETE USING (auth.uid() = passenger_id);

-- 4. Clean and Set RLS Policies for Luggage Packages
ALTER TABLE public.luggage_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Luggage viewable by everyone" ON public.luggage_packages;
DROP POLICY IF EXISTS "Senders can insert luggage" ON public.luggage_packages;
DROP POLICY IF EXISTS "Senders can update luggage" ON public.luggage_packages;
DROP POLICY IF EXISTS "luggage_select_all" ON public.luggage_packages;
DROP POLICY IF EXISTS "luggage_insert_sender" ON public.luggage_packages;
DROP POLICY IF EXISTS "luggage_update_sender" ON public.luggage_packages;
DROP POLICY IF EXISTS "luggage_delete_sender" ON public.luggage_packages;

CREATE POLICY "luggage_select_all" ON public.luggage_packages FOR SELECT USING (true);
CREATE POLICY "luggage_insert_sender" ON public.luggage_packages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "luggage_update_sender" ON public.luggage_packages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = traveler_id);
CREATE POLICY "luggage_delete_sender" ON public.luggage_packages FOR DELETE USING (auth.uid() = sender_id);

-- 5. Clean and Set RLS Policies for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_user" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_user" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;

CREATE POLICY "notifications_select_user" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_user" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT WITH CHECK (true);

-- 6. Clean and Set RLS Policies for Student & ID Verifications, Universities, Support
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Universities viewable by everyone" ON public.universities;
CREATE POLICY "Universities viewable by everyone" ON public.universities FOR SELECT USING (true);

ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_verifications_select_user" ON public.student_verifications;
DROP POLICY IF EXISTS "student_verifications_insert_user" ON public.student_verifications;
CREATE POLICY "student_verifications_select_user" ON public.student_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "student_verifications_insert_user" ON public.student_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verification_requests_select_user" ON public.verification_requests;
DROP POLICY IF EXISTS "verification_requests_insert_user" ON public.verification_requests;
CREATE POLICY "verification_requests_select_user" ON public.verification_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "verification_requests_insert_user" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_tickets_select_user" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_user" ON public.support_tickets;
CREATE POLICY "support_tickets_select_user" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "support_tickets_insert_user" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. CONCURRENCY-SAFE TRANSACTIONAL BOOKING FUNCTION (RPC)
-- Uses SELECT ... FOR UPDATE row-level lock on the trip and updates trip_seats ledger atomically
CREATE OR REPLACE FUNCTION public.book_trip_seats(
    p_trip_id UUID,
    p_passenger_id UUID,
    p_seats_count INT,
    p_luggage_tier TEXT,
    p_notes TEXT,
    p_total_paid NUMERIC,
    p_booking_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_trip RECORD;
    v_booking_id UUID;
    v_new_available INT;
    v_allocated_count INT;
BEGIN
    -- Security: verify passenger identity if authenticated context exists
    IF auth.uid() IS NOT NULL AND auth.uid() != p_passenger_id THEN
        RAISE EXCEPTION 'Unauthorized: passenger_id must match authenticated user' USING ERRCODE = '42501';
    END IF;

    IF p_seats_count <= 0 THEN
        RAISE EXCEPTION 'Seats count must be greater than zero' USING ERRCODE = 'P0001';
    END IF;

    -- 1. Acquire row-level lock on the trip to prevent concurrent overbooking
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Verify driver is not booking own trip
    IF v_trip.driver_id = p_passenger_id THEN
        RAISE EXCEPTION 'Drivers cannot book their own trip' USING ERRCODE = 'P0005';
    END IF;

    -- 3. Verify trip status is upcoming
    IF v_trip.status != 'upcoming' THEN
        RAISE EXCEPTION 'Trip is no longer open for booking' USING ERRCODE = 'P0003';
    END IF;

    -- 4. Check available seat count on trip
    IF v_trip.available_seats < p_seats_count THEN
        RAISE EXCEPTION 'Not enough seats available. Requested: %, Available: %', p_seats_count, v_trip.available_seats USING ERRCODE = 'P0004';
    END IF;

    -- 5. Insert Booking record
    v_booking_id := gen_random_uuid();
    INSERT INTO public.bookings (
        id,
        booking_ref,
        trip_id,
        passenger_id,
        seats_count,
        luggage_tier,
        passenger_notes,
        total_paid,
        payment_status,
        booking_status,
        created_at,
        updated_at
    )
    VALUES (
        v_booking_id,
        p_booking_ref,
        p_trip_id,
        p_passenger_id,
        p_seats_count,
        COALESCE(p_luggage_tier, 'small'),
        COALESCE(p_notes, ''),
        p_total_paid,
        'completed',
        'confirmed',
        NOW(),
        NOW()
    );

    -- 6. Allocate exact seats in public.trip_seats ledger
    UPDATE public.trip_seats
    SET status = 'booked',
        booking_id = v_booking_id
    WHERE id IN (
        SELECT id
        FROM public.trip_seats
        WHERE trip_id = p_trip_id AND status = 'available'
        ORDER BY seat_number ASC
        LIMIT p_seats_count
    );

    GET DIAGNOSTICS v_allocated_count = ROW_COUNT;
    IF v_allocated_count < p_seats_count THEN
        RAISE EXCEPTION 'Not enough available seats in seat ledger. Available: %, Needed: %', v_allocated_count, p_seats_count USING ERRCODE = 'P0004';
    END IF;

    -- 7. Decrement available seats on the trip
    v_new_available := v_trip.available_seats - p_seats_count;
    UPDATE public.trips
    SET available_seats = v_new_available,
        updated_at = NOW()
    WHERE id = p_trip_id;

    -- 8. Notifications
    INSERT INTO public.notifications (
        user_id,
        title,
        description,
        read,
        type,
        target_screen,
        target_id
    ) VALUES (
        p_passenger_id,
        'Booking Confirmed!',
        v_trip.origin || ' → ' || v_trip.destination || ' (' || p_seats_count || ' seat) confirmed. ' || v_trip.currency || p_total_paid || ' paid.',
        FALSE,
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
    ) VALUES (
        v_trip.driver_id,
        'New Passenger Booked!',
        p_seats_count || ' seat(s) booked on your ' || v_trip.origin || ' → ' || v_trip.destination || ' ride.',
        FALSE,
        'booking',
        'trips',
        v_trip.id::TEXT
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'booking_id', v_booking_id,
        'booking_ref', p_booking_ref,
        'available_seats', v_new_available
    );
END;
$$;

-- JSON Payload Overload for book_trip_seats
CREATE OR REPLACE FUNCTION public.book_trip_seats(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN public.book_trip_seats(
        (payload->>'trip_id')::UUID,
        (payload->>'passenger_id')::UUID,
        (payload->>'seats_count')::INT,
        payload->>'luggage_tier',
        payload->>'notes',
        (payload->>'total_paid')::NUMERIC,
        payload->>'booking_ref'
    );
END;
$$;

-- 8. TRANSACTIONAL CANCEL BOOKING FUNCTION (RPC)
CREATE OR REPLACE FUNCTION public.cancel_booking_atomic(
    p_booking_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by passenger'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_booking RECORD;
    v_trip RECORD;
    v_new_available INT;
BEGIN
    -- 1. Lock booking row
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Lock trip row
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = v_booking.trip_id
    FOR UPDATE;

    -- Security: only passenger or trip driver can cancel
    IF auth.uid() IS NOT NULL AND auth.uid() != v_booking.passenger_id AND auth.uid() != v_trip.driver_id THEN
        RAISE EXCEPTION 'Unauthorized: only passenger or driver can cancel booking' USING ERRCODE = '42501';
    END IF;

    IF v_booking.booking_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', TRUE, 'message', 'Booking already cancelled');
    END IF;

    -- 3. Update booking status
    UPDATE public.bookings
    SET booking_status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_booking_id;

    -- 4. Release seats in trip_seats ledger
    UPDATE public.trip_seats
    SET status = 'available',
        booking_id = NULL
    WHERE booking_id = p_booking_id;

    -- 5. Restore available seats count on trip
    v_new_available := v_trip.available_seats + v_booking.seats_count;
    UPDATE public.trips
    SET available_seats = v_new_available,
        updated_at = NOW()
    WHERE id = v_booking.trip_id;

    -- 6. Send notification
    INSERT INTO public.notifications (
        user_id,
        title,
        description,
        read,
        type,
        target_screen,
        target_id
    ) VALUES (
        v_booking.passenger_id,
        'Booking Cancelled',
        'Your booking for ' || v_trip.origin || ' → ' || v_trip.destination || ' has been cancelled. ' || p_reason,
        FALSE,
        'booking',
        'trips',
        v_trip.id::TEXT
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Booking cancelled and seats restored',
        'available_seats', v_new_available
    );
END;
$$;

-- JSON Payload Overload for cancel_booking_atomic
CREATE OR REPLACE FUNCTION public.cancel_booking_atomic(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN public.cancel_booking_atomic(
        (payload->>'booking_id')::UUID,
        (payload->>'user_id')::UUID,
        COALESCE(payload->>'reason', 'Cancelled by passenger')
    );
END;
$$;

-- 9. Explicit Grants
GRANT EXECUTE ON FUNCTION public.book_trip_seats(UUID, UUID, INT, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.book_trip_seats(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking_atomic(UUID, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_booking_atomic(JSONB) TO anon, authenticated, service_role;

-- 10. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
