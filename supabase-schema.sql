-- ==============================================================================
-- NELITV / YOUR MAX TV - SUPABASE SUBSCRIPTION TABLE SETUP
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/qqwlekumeltrdfvutmmt/sql)
-- ==============================================================================

-- 1. Create table "Subscription"
CREATE TABLE IF NOT EXISTS public."Subscription" (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    phone_number TEXT,
    email TEXT,
    user_id TEXT,
    premium_status TEXT DEFAULT 'active' NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    plan_name TEXT DEFAULT 'Kifurushi',
    amount NUMERIC DEFAULT 1000
);

-- 2. Create index on phone_number and email for ultra-fast lookups
CREATE INDEX IF NOT EXISTS idx_subscription_phone ON public."Subscription" (phone_number);
CREATE INDEX IF NOT EXISTS idx_subscription_email ON public."Subscription" (email);
CREATE INDEX IF NOT EXISTS idx_subscription_expires ON public."Subscription" (expires_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public."Subscription" ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies: Allow everyone (anon and authenticated) to SELECT subscriptions so the app can verify active status
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

-- 5. Create a view / alias "subscriptions" so queries for lowercase work seamlessly
CREATE OR REPLACE VIEW public.subscriptions AS
SELECT * FROM public."Subscription";

-- 6. Insert a test active demo member (optional test)
INSERT INTO public."Subscription" (phone_number, email, premium_status, expires_at, plan_name, amount)
VALUES 
    ('0712000000', 'demo@nelitv.app', 'active', NOW() + INTERVAL '30 days', 'Kifurushi cha Mwezi', 10000)
ON CONFLICT DO NOTHING;
