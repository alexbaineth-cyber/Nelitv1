-- ==============================================================================
-- NELITV SUBSCRIPTIONS & PAYMENTS
-- Production Supabase Database Schema with Full Access Policies
-- Run this in Supabase SQL Editor: Dashboard -> SQL Editor -> New query -> Run
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.nelitv_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_email TEXT,
    phone_number TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL DEFAULT 'plan_2days',
    premium_status TEXT NOT NULL DEFAULT 'active',
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
    activated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_device_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.nelitv_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    user_id TEXT,
    user_email TEXT,
    amount NUMERIC(12,2) NOT NULL,
    plan_id TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    payment_method TEXT NOT NULL DEFAULT 'harakapay',
    provider_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ENSURE ALL COMPATIBILITY COLUMNS EXIST SAFELY
ALTER TABLE public.nelitv_subscriptions
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'plan_2days',
ADD COLUMN IF NOT EXISTS premium_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_device_type TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.nelitv_payments
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS plan_id TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'harakapay',
ADD COLUMN IF NOT EXISTS provider_reference TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT now();

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_nelitv_sub_phone ON public.nelitv_subscriptions(phone_number);
CREATE INDEX IF NOT EXISTS idx_nelitv_sub_email ON public.nelitv_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_nelitv_sub_expires ON public.nelitv_subscriptions(expires_at, premium_status);
CREATE INDEX IF NOT EXISTS idx_nelitv_pay_order ON public.nelitv_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_nelitv_pay_phone ON public.nelitv_payments(phone_number);

-- 5. ENABLE ROW LEVEL SECURITY & PERMISSIVE POLICIES
ALTER TABLE public.nelitv_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nelitv_payments ENABLE ROW LEVEL SECURITY;

-- Drop previous restrictive policies if they existed
DROP POLICY IF EXISTS "Public read access for subscriptions" ON public.nelitv_subscriptions;
DROP POLICY IF EXISTS "Public write access for subscriptions" ON public.nelitv_subscriptions;
DROP POLICY IF EXISTS "Public read access for payments" ON public.nelitv_payments;
DROP POLICY IF EXISTS "Public write access for payments" ON public.nelitv_payments;

-- Create permissive policies allowing web app & server to sync records seamlessly
CREATE POLICY "Public read access for subscriptions" 
ON public.nelitv_subscriptions FOR SELECT 
TO public, anon, authenticated 
USING (true);

CREATE POLICY "Public write access for subscriptions" 
ON public.nelitv_subscriptions FOR ALL 
TO public, anon, authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Public read access for payments" 
ON public.nelitv_payments FOR SELECT 
TO public, anon, authenticated 
USING (true);

CREATE POLICY "Public write access for payments" 
ON public.nelitv_payments FOR ALL 
TO public, anon, authenticated 
USING (true) 
WITH CHECK (true);

-- Grant permissions to public, anon, authenticated, and service_role
GRANT ALL ON TABLE public.nelitv_subscriptions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.nelitv_payments TO anon, authenticated, service_role;

-- 6. SEED DEMO ACTIVE TEST USER (Valid for 30 Days)
INSERT INTO public.nelitv_subscriptions (
    phone_number,
    user_email,
    plan_id,
    premium_status,
    amount_paid,
    activated_at,
    expires_at
) VALUES (
    '0712000000',
    'mwanachama@nelitv.com',
    'plan_30days',
    'active',
    10000.00,
    now(),
    now() + INTERVAL '30 days'
) ON CONFLICT (phone_number) DO UPDATE SET
    premium_status = 'active',
    expires_at = now() + INTERVAL '30 days';

-- ==============================================================================
-- DONE! Tables are now live, indexed, and fully synchronized with NeliTv.
-- ==============================================================================
