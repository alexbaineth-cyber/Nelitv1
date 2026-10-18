-- ==============================================================================
-- NELITV SUBSCRIPTIONS & PAYMENTS
-- Production Secure Supabase Database Schema
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/qqwlekumeltrdfvutmmt/sql
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.nelitv_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_email TEXT,
    phone_number TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL DEFAULT 'kila_siku',
    premium_status TEXT NOT NULL DEFAULT 'expired',
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
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL DEFAULT 'harakapay',
    provider_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 3. SUPPORT EXISTING / FUTURE COLUMNS SAFELY
ALTER TABLE public.nelitv_subscriptions
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS last_device_type TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.nelitv_payments
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS provider_reference TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. HIGH-PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_nelitv_user
ON public.nelitv_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_nelitv_status
ON public.nelitv_subscriptions(premium_status, expires_at);

CREATE INDEX IF NOT EXISTS idx_nelitv_payment_user
ON public.nelitv_payments(user_id);

CREATE INDEX IF NOT EXISTS idx_nelitv_payment_phone
ON public.nelitv_payments(phone_number);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.nelitv_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nelitv_payments ENABLE ROW LEVEL SECURITY;

-- 6. PROTECT PAYMENT DATA (Service Role retains full access via backend)
REVOKE ALL ON TABLE public.nelitv_subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.nelitv_payments FROM anon, authenticated;

-- 7. INSERT DEMO ACTIVE MEMBER FOR TESTING
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
    'demo@nelitv.com',
    'plan_30days',
    'active',
    10000.00,
    now(),
    now() + INTERVAL '30 days'
) ON CONFLICT (phone_number) DO UPDATE SET
    premium_status = 'active',
    expires_at = now() + INTERVAL '30 days';

-- END
