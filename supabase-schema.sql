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
-- 7. TEMPORARY STREAM GENERATOR (SUPABASE AUTO-DELETE AFTER 5 HOURS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.nelitv_temp_streams (
    stream_id TEXT PRIMARY KEY,
    stream_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    category TEXT DEFAULT 'Live TV',
    source_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 hours'),
    expires_at_ms BIGINT NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 18000,
    status TEXT NOT NULL DEFAULT 'checking',
    playback_token TEXT NOT NULL,
    playback_requests INTEGER NOT NULL DEFAULT 0,
    last_checked_at TIMESTAMPTZ,
    last_error TEXT,
    upstream_http_status INTEGER,
    response_time_ms INTEGER
);

CREATE TABLE IF NOT EXISTS public.nelitv_stream_tombstones (
    stream_id TEXT PRIMARY KEY,
    expired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nelitv_stream_allowlist (
    host TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nelitv_stream_stats (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    total_generated BIGINT NOT NULL DEFAULT 0,
    total_expired BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.nelitv_stream_stats (id, total_generated, total_expired)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_nelitv_temp_streams_expires ON public.nelitv_temp_streams(expires_at);
CREATE INDEX IF NOT EXISTS idx_nelitv_stream_tombstones_expired ON public.nelitv_stream_tombstones(expired_at);

ALTER TABLE public.nelitv_temp_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nelitv_stream_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nelitv_stream_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nelitv_stream_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service access temp streams" ON public.nelitv_temp_streams;
CREATE POLICY "Service access temp streams" ON public.nelitv_temp_streams FOR ALL TO service_role, authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service access stream tombstones" ON public.nelitv_stream_tombstones;
CREATE POLICY "Service access stream tombstones" ON public.nelitv_stream_tombstones FOR ALL TO service_role, authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service access stream allowlist" ON public.nelitv_stream_allowlist;
CREATE POLICY "Service access stream allowlist" ON public.nelitv_stream_allowlist FOR ALL TO service_role, authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service access stream stats" ON public.nelitv_stream_stats;
CREATE POLICY "Service access stream stats" ON public.nelitv_stream_stats FOR ALL TO service_role, authenticated, anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.nelitv_temp_streams TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.nelitv_stream_tombstones TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.nelitv_stream_allowlist TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.nelitv_stream_stats TO anon, authenticated, service_role;

-- Automatic 5-hour expiration & storage cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_nelitv_streams()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    WITH deleted AS (
        DELETE FROM public.nelitv_temp_streams
        WHERE expires_at <= now()
        RETURNING stream_id
    ),
    recorded AS (
        INSERT INTO public.nelitv_stream_tombstones (stream_id, expired_at)
        SELECT stream_id, now() FROM deleted
        ON CONFLICT (stream_id) DO NOTHING
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    IF deleted_count > 0 THEN
        UPDATE public.nelitv_stream_stats
        SET total_expired = total_expired + deleted_count,
            updated_at = now()
        WHERE id = 1;
    END IF;

    -- Keep tombstones table tiny by purging tombstones older than 7 days
    DELETE FROM public.nelitv_stream_tombstones
    WHERE expired_at < now() - INTERVAL '7 days';

    RETURN deleted_count;
END;
$$;

-- Statement-level trigger: auto-cleans expired >5h streams on every insert/update
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_nelitv_streams()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.cleanup_expired_nelitv_streams();
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_nelitv_auto_cleanup_expired_streams ON public.nelitv_temp_streams;
CREATE TRIGGER trg_nelitv_auto_cleanup_expired_streams
AFTER INSERT ON public.nelitv_temp_streams
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_cleanup_expired_nelitv_streams();

-- Optional background sweep every 5 minutes via pg_cron (runs automatically if pg_cron is enabled in Supabase)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('nelitv-cleanup-5h-streams');
        PERFORM cron.schedule(
            'nelitv-cleanup-5h-streams',
            '*/5 * * * *',
            'SELECT public.cleanup_expired_nelitv_streams();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;


