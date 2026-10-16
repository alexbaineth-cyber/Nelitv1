-- ==============================================================================
-- NELITV / YOUR MAX TV - SUPABASE SUBSCRIPTION TABLE FIX & MIGRATION
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/qqwlekumeltrdfvutmmt/sql
-- ==============================================================================

-- 1. Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public."Subscription" (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    phone_number TEXT,
    premium_status TEXT DEFAULT 'active' NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 2. Safely add missing columns (handles "column email does not exist" error)
ALTER TABLE public."Subscription" ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public."Subscription" ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public."Subscription" ADD COLUMN IF NOT EXISTS plan_name TEXT DEFAULT 'Kifurushi';
ALTER TABLE public."Subscription" ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 1000;

-- 3. Create indexes for high performance lookups
CREATE INDEX IF NOT EXISTS idx_subscription_phone ON public."Subscription" (phone_number);
CREATE INDEX IF NOT EXISTS idx_subscription_expires ON public."Subscription" (expires_at);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;

-- 5. CRITICAL: Allow public SELECT so the app can check active subscriptions
DROP POLICY IF EXISTS "Allow public read" ON public."Subscription";
CREATE POLICY "Allow public read" ON public."Subscription"
    FOR SELECT
    USING (true);

-- Allow service_role full read and write
DROP POLICY IF EXISTS "Allow service_role all" ON public."Subscription";
CREATE POLICY "Allow service_role all" ON public."Subscription"
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. Alias view for lowercase 'subscriptions'
CREATE OR REPLACE VIEW public.subscriptions AS
SELECT * FROM public."Subscription";

-- 7. Insert or update demo active member for testing
INSERT INTO public."Subscription" (phone_number, premium_status, expires_at, plan_name, amount)
VALUES 
    ('0712000000', 'active', NOW() + INTERVAL '30 days', 'Kifurushi cha Mwezi', 10000)
ON CONFLICT DO NOTHING;
