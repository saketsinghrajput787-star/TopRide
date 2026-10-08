-- ============================================================
-- TOPRIDE SUPABASE POSTGRESQL SCHEMA (PHASE 2)
-- ============================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Clean Existing Tables (if recreating)
-- DROP TABLE IF EXISTS reviews CASCADE;
-- DROP TABLE IF EXISTS support_tickets CASCADE;
-- DROP TABLE IF EXISTS payout_records CASCADE;
-- DROP TABLE IF EXISTS verification_requests CASCADE;
-- DROP TABLE IF EXISTS student_verifications CASCADE;
-- DROP TABLE IF EXISTS universities CASCADE;
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS conversations CASCADE;
-- DROP TABLE IF EXISTS luggage_packages CASCADE;
-- DROP TABLE IF EXISTS passenger_requests CASCADE;
-- DROP TABLE IF EXISTS bookings CASCADE;
-- DROP TABLE IF EXISTS trip_seats CASCADE;
-- DROP TABLE IF EXISTS trips CASCADE;
-- DROP TABLE IF EXISTS vehicles CASCADE;
-- DROP TABLE IF EXISTS preferences CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- 3. PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    initials TEXT DEFAULT 'TR',
    rating NUMERIC(3,2) DEFAULT 5.0,
    trips_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_student_verified BOOLEAN DEFAULT FALSE,
    student_university TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    available_payout NUMERIC(10,2) DEFAULT 0,
    joined_date TEXT DEFAULT TO_CHAR(NOW(), 'Month YYYY'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. PREFERENCES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    chattiness BOOLEAN DEFAULT TRUE,
    air_conditioning BOOLEAN DEFAULT TRUE,
    music BOOLEAN DEFAULT TRUE,
    pets BOOLEAN DEFAULT FALSE,
    smoking BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. VEHICLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    color TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON public.vehicles(user_id);

-- ============================================================
-- 6. TRIPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    origin TEXT NOT NULL,
    origin_detail TEXT DEFAULT '',
    destination TEXT NOT NULL,
    destination_detail TEXT DEFAULT '',
    date TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    arrival_time TEXT DEFAULT '',
    duration TEXT DEFAULT '',
    total_seats INTEGER NOT NULL CHECK (total_seats > 0),
    available_seats INTEGER NOT NULL CHECK (available_seats >= 0),
    price_per_seat NUMERIC(10,2) NOT NULL CHECK (price_per_seat >= 0),
    currency TEXT DEFAULT '₹',
    luggage_allowed TEXT DEFAULT 'Medium',
    luggage_details TEXT DEFAULT '',
    instant_booking BOOLEAN DEFAULT TRUE,
    trip_rules JSONB DEFAULT '[]'::jsonb,
    stops JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in-progress', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_seats_valid CHECK (available_seats <= total_seats)
);

CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON public.trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_origin ON public.trips(origin);
CREATE INDEX IF NOT EXISTS idx_trips_destination ON public.trips(destination);
CREATE INDEX IF NOT EXISTS idx_trips_date ON public.trips(date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips(status);

-- ============================================================
-- 7. TRIP SEATS TABLE (Atomic seat reservation ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trip_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    seat_number INTEGER NOT NULL,
    booking_id UUID,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'booked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_trip_seats_trip ON public.trip_seats(trip_id);

-- ============================================================
-- 8. BOOKINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_ref TEXT NOT NULL UNIQUE,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seats_count INTEGER NOT NULL CHECK (seats_count > 0),
    luggage_tier TEXT DEFAULT 'small',
    passenger_notes TEXT DEFAULT '',
    total_paid NUMERIC(10,2) NOT NULL,
    payment_status TEXT DEFAULT 'completed',
    booking_status TEXT DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON public.bookings(passenger_id);

-- ============================================================
-- 9. PASSENGER REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.passenger_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    date TEXT NOT NULL,
    time_window TEXT DEFAULT '',
    seats_needed INTEGER NOT NULL DEFAULT 1 CHECK (seats_needed > 0),
    budget_per_seat NUMERIC(10,2) NOT NULL,
    preferences JSONB DEFAULT '[]'::jsonb,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'matched', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passenger_requests_passenger ON public.passenger_requests(passenger_id);

-- ============================================================
-- 10. LUGGAGE PACKAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.luggage_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_initials TEXT DEFAULT 'SK',
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    date TEXT NOT NULL,
    size TEXT NOT NULL,
    dimensions TEXT DEFAULT '',
    description TEXT NOT NULL,
    price_offer NUMERIC(10,2) NOT NULL,
    receiver_name TEXT DEFAULT '',
    receiver_phone TEXT DEFAULT '',
    traveler_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'in-transit', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_luggage_sender ON public.luggage_packages(sender_id);

-- ============================================================
-- 11. CONVERSATIONS & MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    trip_route TEXT DEFAULT '',
    participant1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_message TEXT DEFAULT '',
    last_message_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_part1 ON public.conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conv_part2 ON public.conversations(participant2_id);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- ============================================================
-- 12. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    type TEXT NOT NULL CHECK (type IN ('booking', 'trip', 'chat', 'payment', 'system')),
    target_screen TEXT DEFAULT '',
    target_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);

-- ============================================================
-- 13. UNIVERSITIES & STUDENT VERIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    city TEXT NOT NULL,
    verified_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.student_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    university_id TEXT NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    student_email TEXT NOT NULL,
    status TEXT DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. GOVERNMENT ID VERIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_url TEXT DEFAULT '',
    status TEXT DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_ref TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. PAYOUT RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payout_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('bank', 'upi')),
    destination_detail TEXT DEFAULT '',
    status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. REVIEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, reviewer_id, reviewee_id)
);

-- ============================================================
-- 18. CONCURRENCY-SAFE SEAT BOOKING FUNCTION (TRANSACTIONAL)
-- ============================================================
-- Uses SELECT ... FOR UPDATE row-level lock on the trip to prevent overbooking
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
AS $$
DECLARE
    v_trip RECORD;
    v_booking_id UUID;
    v_new_available INT;
BEGIN
    -- 1. Lock the specific trip row for this transaction
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip not found' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Check if trip is still upcoming
    IF v_trip.status != 'upcoming' THEN
        RAISE EXCEPTION 'Trip is no longer open for booking' USING ERRCODE = 'P0003';
    END IF;

    -- 3. Check seat availability
    IF v_trip.available_seats < p_seats_count THEN
        RAISE EXCEPTION 'Not enough seats available. Requested: %, Available: %', p_seats_count, v_trip.available_seats USING ERRCODE = 'P0004';
    END IF;

    -- 4. Decrement available seats
    v_new_available := v_trip.available_seats - p_seats_count;
    UPDATE public.trips
    SET available_seats = v_new_available,
        updated_at = NOW()
    WHERE id = p_trip_id;

    -- 5. Insert Booking
    INSERT INTO public.bookings (
        booking_ref,
        trip_id,
        passenger_id,
        seats_count,
        luggage_tier,
        passenger_notes,
        total_paid,
        payment_status,
        booking_status
    )
    VALUES (
        p_booking_ref,
        p_trip_id,
        p_passenger_id,
        p_seats_count,
        p_luggage_tier,
        p_notes,
        p_total_paid,
        'completed',
        'confirmed'
    )
    RETURNING id INTO v_booking_id;

    -- 6. Insert Confirmation Notification for Passenger
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
        'Booking Confirmed!',
        v_trip.origin || ' → ' || v_trip.destination || ' (' || p_seats_count || ' seat) confirmed. ' || v_trip.currency || p_total_paid || ' paid.',
        FALSE,
        'booking',
        'trips',
        v_trip.id::TEXT
    );

    -- 7. Insert Notification for Driver
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

-- ============================================================
-- 19. CANCEL BOOKING FUNCTION (TRANSACTIONAL)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_booking(
    p_booking_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_booking.booking_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', TRUE, 'message', 'Booking already cancelled');
    END IF;

    -- Update booking status
    UPDATE public.bookings
    SET booking_status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_booking_id;

    -- Restore seats to trip
    UPDATE public.trips
    SET available_seats = available_seats + v_booking.seats_count,
        updated_at = NOW()
    WHERE id = v_booking.trip_id;

    -- Send notification
    INSERT INTO public.notifications (
        user_id,
        title,
        description,
        read,
        type,
        target_screen
    )
    VALUES (
        v_booking.passenger_id,
        'Trip Cancelled',
        'Reservation cancelled. Refund has been initiated. Reason: ' || p_reason,
        FALSE,
        'payment',
        'trips'
    );

    RETURN jsonb_build_object('success', TRUE, 'message', 'Booking cancelled and seats restored');
END;
$$;

-- ============================================================
-- 19B. ATOMIC TRIP & SEAT CREATION (TRANSACTIONAL RPC & TRIGGER)
-- ============================================================

-- Database Trigger on trips: guarantees seats are created inside the same transaction
CREATE OR REPLACE FUNCTION public.handle_trip_seats_generation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    s INT;
BEGIN
    FOR s IN 1..NEW.total_seats LOOP
        INSERT INTO public.trip_seats (trip_id, seat_number, status)
        VALUES (NEW.id, s, 'available')
        ON CONFLICT (trip_id, seat_number) DO NOTHING;
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_trip_seats ON public.trips;
CREATE TRIGGER trigger_generate_trip_seats
    AFTER INSERT ON public.trips
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_trip_seats_generation();

-- Transactional RPC function for atomic trip + seat creation
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
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_trip_id UUID;
    s INT;
BEGIN
    -- Ensure driver ownership if auth context is present
    IF auth.uid() IS NOT NULL AND auth.uid() != p_driver_id THEN
        RAISE EXCEPTION 'Unauthorized: driver_id must match authenticated user' USING ERRCODE = '42501';
    END IF;

    -- 1. Insert Trip row
    INSERT INTO public.trips (
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
        p_driver_id,
        p_vehicle_id,
        p_origin,
        COALESCE(p_origin_detail, ''),
        p_destination,
        COALESCE(p_destination_detail, ''),
        p_date,
        p_departure_time,
        COALESCE(p_arrival_time, ''),
        COALESCE(p_duration, ''),
        p_total_seats,
        p_total_seats,
        p_price_per_seat,
        COALESCE(p_currency, '₹'),
        COALESCE(p_luggage_allowed, 'Medium'),
        COALESCE(p_luggage_details, ''),
        COALESCE(p_instant_booking, TRUE),
        COALESCE(p_trip_rules, '[]'::jsonb),
        COALESCE(p_stops, '[]'::jsonb),
        'upcoming'
    )
    RETURNING id INTO v_trip_id;

    -- 2. Insert Seats atomically
    FOR s IN 1..p_total_seats LOOP
        INSERT INTO public.trip_seats (trip_id, seat_number, status)
        VALUES (v_trip_id, s, 'available')
        ON CONFLICT (trip_id, seat_number) DO NOTHING;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'trip_id', v_trip_id
    );
END;
$$;

-- ============================================================
-- 20. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.luggage_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view profiles (to see driver/passenger info); users can only update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Preferences: user only
CREATE POLICY "Users can view own preferences" ON public.preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.preferences FOR ALL USING (auth.uid() = user_id);

-- Vehicles: visible to all for trips; manage own
CREATE POLICY "Vehicles viewable by everyone" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Users can insert own vehicles" ON public.vehicles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own vehicles" ON public.vehicles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vehicles" ON public.vehicles FOR DELETE USING (auth.uid() = user_id);

-- Trips: visible to all; drivers manage own
CREATE POLICY "Trips viewable by everyone" ON public.trips FOR SELECT USING (true);
CREATE POLICY "Drivers can insert own trips" ON public.trips FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Drivers can update own trips" ON public.trips FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can delete own trips" ON public.trips FOR DELETE USING (auth.uid() = driver_id);

-- Trip Seats: visible to all; drivers manage seats for trips they own
ALTER TABLE public.trip_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trip seats viewable by everyone" ON public.trip_seats FOR SELECT USING (true);
CREATE POLICY "Drivers can insert seats for own trips" ON public.trip_seats FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_seats.trip_id AND trips.driver_id = auth.uid())
);
CREATE POLICY "Drivers can update seats for own trips" ON public.trip_seats FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_seats.trip_id AND trips.driver_id = auth.uid())
);

-- Bookings: passengers can view own; drivers can view trips' bookings
CREATE POLICY "Bookings viewable by passenger or trip driver" ON public.bookings FOR SELECT USING (
    auth.uid() = passenger_id OR 
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = bookings.trip_id AND trips.driver_id = auth.uid())
);
CREATE POLICY "Passengers can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Passengers can update own bookings" ON public.bookings FOR UPDATE USING (auth.uid() = passenger_id);

-- Passenger Requests: visible to all; user manages own
CREATE POLICY "Requests viewable by everyone" ON public.passenger_requests FOR SELECT USING (true);
CREATE POLICY "Passengers can insert own requests" ON public.passenger_requests FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Passengers can update own requests" ON public.passenger_requests FOR UPDATE USING (auth.uid() = passenger_id);

-- Luggage: visible to all; senders manage own
CREATE POLICY "Luggage viewable by everyone" ON public.luggage_packages FOR SELECT USING (true);
CREATE POLICY "Senders can insert luggage" ON public.luggage_packages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Senders can update luggage" ON public.luggage_packages FOR UPDATE USING (auth.uid() = sender_id);

-- Conversations & Messages: only participants
CREATE POLICY "Conversations viewable by participants" ON public.conversations FOR SELECT USING (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);
CREATE POLICY "Conversations insertable by participants" ON public.conversations FOR INSERT WITH CHECK (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);

CREATE POLICY "Messages viewable by conversation participants" ON public.messages FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);
CREATE POLICY "Messages insertable by conversation participants" ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);
CREATE POLICY "Messages updatable by conversation participants" ON public.messages FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.conversations 
        WHERE conversations.id = messages.conversation_id 
        AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
    )
);

CREATE POLICY "Conversations updatable by participants" ON public.conversations FOR UPDATE USING (
    auth.uid() = participant1_id OR auth.uid() = participant2_id
);

-- Notifications: user only
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Universities: viewable by everyone
CREATE POLICY "Universities viewable by everyone" ON public.universities FOR SELECT USING (true);

-- Student & ID Verifications: user only
CREATE POLICY "Users can view own student verification" ON public.student_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own student verification" ON public.student_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own id verification" ON public.verification_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own id verification" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Support Tickets: user only
CREATE POLICY "Users can view own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payouts: user only
CREATE POLICY "Users can view own payouts" ON public.payout_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert payouts" ON public.payout_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reviews: visible to everyone; only completed participants can review
CREATE POLICY "Reviews viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert reviews" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- ============================================================
-- 21. SEED DATA (Universities)
-- ============================================================
INSERT INTO public.universities (id, name, domain, city, verified_count)
VALUES
    ('uni_algoma', 'Algoma University', 'algomau.ca', 'Sault Ste. Marie / Brampton', 380),
    ('uni_iisc', 'Indian Institute of Science (IISc)', 'iisc.ac.in', 'Bengaluru', 920),
    ('uni_iitb', 'IIT Bombay', 'iitb.ac.in', 'Mumbai', 1450),
    ('uni_iitd', 'IIT Delhi', 'iitd.ac.in', 'New Delhi', 1280),
    ('uni_bits', 'BITS Pilani (Hyderabad Campus)', 'hyderabad.bits-pilani.ac.in', 'Hyderabad', 840),
    ('uni_iiith', 'IIIT Hyderabad', 'iiit.ac.in', 'Hyderabad', 610),
    ('uni_pes', 'PES University', 'pes.edu', 'Bengaluru', 1100)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 22. REALTIME REPLICATION ENABLEMENT
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- ============================================================
-- 23. AUTOMATIC PROFILE CREATION TRIGGER (AUTH.USERS -> PROFILES)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        name,
        email,
        phone,
        initials,
        rating,
        trips_count,
        is_verified,
        is_student_verified,
        student_university,
        bio,
        available_payout,
        joined_date
    )
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.email,
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        UPPER(SUBSTRING(COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)) FROM 1 FOR 2)),
        5.0,
        0,
        FALSE,
        FALSE,
        '',
        'Member on TopRide.',
        0.0,
        TO_CHAR(NOW(), 'Month YYYY')
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = CASE WHEN EXCLUDED.phone != '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
        updated_at = NOW();

    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 24. MESSAGE SYNC TRIGGER (UPDATES LAST_MESSAGE ON CONVERSATIONS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations
    SET last_message = new.text,
        last_message_time = new.created_at
    WHERE id = new.conversation_id;
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_message();

-- ============================================================
-- 25. HELPER FUNCTION: ENSURE USER PROFILE
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_user_profile(
    p_id UUID,
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT DEFAULT '',
    p_bio TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
BEGIN
    INSERT INTO public.profiles (
        id, name, email, phone, initials, bio
    )
    VALUES (
        p_id,
        p_name,
        p_email,
        p_phone,
        UPPER(SUBSTRING(p_name FROM 1 FOR 2)),
        COALESCE(NULLIF(p_bio, ''), 'Member on TopRide.')
    )
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = CASE WHEN EXCLUDED.phone != '' THEN EXCLUDED.phone ELSE public.profiles.phone END,
        bio = CASE WHEN EXCLUDED.bio != '' THEN EXCLUDED.bio ELSE public.profiles.bio END,
        updated_at = NOW()
    RETURNING * INTO v_profile;

    RETURN to_jsonb(v_profile);
END;
$$;

-- ============================================================
-- 26. ATOMIC TRIP SEAT INITIALIZATION TRIGGER & RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_trip_seats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    FOR s IN 1..NEW.total_seats LOOP
        INSERT INTO public.trip_seats (trip_id, seat_number, status)
        VALUES (NEW.id, s, 'available')
        ON CONFLICT (trip_id, seat_number) DO NOTHING;
    END LOOP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_created ON public.trips;
CREATE TRIGGER on_trip_created
    AFTER INSERT ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_trip_seats();

ALTER TABLE public.trip_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip seats viewable by everyone" ON public.trip_seats;
CREATE POLICY "Trip seats viewable by everyone" 
    ON public.trip_seats FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can insert seats for own trips" ON public.trip_seats;
CREATE POLICY "Drivers can insert seats for own trips" 
    ON public.trip_seats FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.trips 
            WHERE trips.id = trip_seats.trip_id AND trips.driver_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Drivers can update seats for own trips" ON public.trip_seats;
CREATE POLICY "Drivers can update seats for own trips" 
    ON public.trip_seats FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.trips 
            WHERE trips.id = trip_seats.trip_id AND trips.driver_id = auth.uid()
        )
    );

