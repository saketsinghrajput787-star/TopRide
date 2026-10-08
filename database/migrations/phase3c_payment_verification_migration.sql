-- ============================================================
-- TOPRIDE SUPABASE POSTGRESQL SCHEMA — PHASE 3C
-- RAZORPAY PAYMENT VERIFICATION, WEBHOOK IDEMPOTENCY & RLS HARDENING
-- ============================================================

-- 1. Add optional signature column to payment_orders if not already present
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;

-- 2. Indexes for fast payment & webhook lookups
CREATE INDEX IF NOT EXISTS idx_payment_orders_rzp_payment_id ON public.payment_orders(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_bookings_rzp_order_id ON public.bookings(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_rzp_payment_id ON public.bookings(razorpay_payment_id);

-- 3. RLS Security Hardening
-- Revoke all table-level access from anonymous users to protect payment data
REVOKE ALL ON TABLE public.payment_orders FROM anon;

-- Grant minimal necessary table privileges to authenticated and service_role
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_orders TO authenticated;
GRANT ALL ON TABLE public.payment_orders TO service_role;

-- 4. Re-verify user-scoped RLS policies (guaranteeing auth.uid() = user_id)
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
