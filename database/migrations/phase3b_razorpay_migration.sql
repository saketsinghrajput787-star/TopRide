-- ============================================================
-- TOPRIDE SUPABASE POSTGRESQL SCHEMA — PHASE 3B
-- RAZORPAY TEST MODE PAYMENT INTEGRATION MIGRATION
-- ============================================================

-- 1. Create Payment Orders Table
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    razorpay_order_id TEXT NOT NULL UNIQUE,
    razorpay_payment_id TEXT,
    amount NUMERIC(10,2) NOT NULL,
    amount_paise BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    seats_count INTEGER NOT NULL DEFAULT 1 CHECK (seats_count > 0),
    luggage_tier TEXT DEFAULT 'small',
    receipt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'paid', 'failed', 'cancelled')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_trip_id ON public.payment_orders(trip_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_rzp_order_id ON public.payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- 4. Permissions & Grants for PostgREST
GRANT ALL ON TABLE public.payment_orders TO anon, authenticated, service_role;

-- 5. RLS Security Policies
DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders;
CREATE POLICY "Users can view own payment orders"
    ON public.payment_orders FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own payment orders" ON public.payment_orders;
CREATE POLICY "Users can insert own payment orders"
    ON public.payment_orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders;
CREATE POLICY "Users can update own payment orders"
    ON public.payment_orders FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on payment orders" ON public.payment_orders;
CREATE POLICY "Service role full access on payment orders"
    ON public.payment_orders FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- 6. Add columns to bookings if not present
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;

-- 7. Trigger to automatically refresh updated_at
CREATE OR REPLACE FUNCTION public.handle_payment_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_payment_order_updated_at ON public.payment_orders;
CREATE TRIGGER trigger_payment_order_updated_at
    BEFORE UPDATE ON public.payment_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payment_order_updated_at();
