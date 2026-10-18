import { createClient } from '@supabase/supabase-js';

// Configuration from environment variables
export const SUPABASE_URL =
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (import.meta as any)?.env?.VITE_SUPABASE_URL ||
  'https://qqwlekumeltrdfvutmmt.supabase.co';

export const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' && (process.env?.SUPABASE_ANON_KEY || process.env?.SUPABASE_KEY || process.env?.SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
  (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
  (import.meta as any)?.env?.VITE_SUPABASE_KEY ||
  (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_RU9QIfJMuQzk_w4eJRGiKA_akpI_o7S';

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export interface SubscriptionRecord {
  id?: string | number;
  created_at?: string;
  phone_number?: string;
  email?: string;
  user_id?: string;
  premium_status?: string;
  expires_at: string;
  plan_name?: string;
  amount?: number;
}

/**
 * Normalizes Tanzanian phone numbers to standard 10-digit format (07XXXXXXXX or 06XXXXXXXX)
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('255')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (!cleaned.startsWith('0') && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Generates all possible representation variants for a phone number
 */
export function getPhoneVariants(phone: string): string[] {
  const clean0 = normalizePhoneNumber(phone);
  const withoutLeadingZero = clean0.replace(/^0+/, '');
  const clean255 = '255' + withoutLeadingZero;
  return Array.from(new Set([
    clean0,
    clean255,
    '+' + clean255,
    withoutLeadingZero,
    phone.trim(),
    phone.replace(/\s+/g, '')
  ])).filter(Boolean);
}

/**
 * Calculates exact subscription expiration date:
 * - TSh 1,000 = exactly 2 days
 * - TSh 3,000 = exactly 7 days
 * - TSh 10,000 = exactly 1 calendar month
 */
export function calculateSubscriptionExpiration(
  amountOrPlan: number | string,
  baseDate: Date = new Date()
): Date {
  const result = new Date(baseDate.getTime());
  const amount = typeof amountOrPlan === 'number'
    ? amountOrPlan
    : (amountOrPlan === 'plan_30days' ? 10000 : (amountOrPlan === 'plan_7days' ? 3000 : 1000));

  if (amount >= 10000) {
    const currentMonth = result.getMonth();
    const currentYear = result.getFullYear();
    const targetMonth = (currentMonth + 1) % 12;
    const targetYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(result.getUTCDate(), daysInTargetMonth);

    return new Date(Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      result.getUTCHours(),
      result.getUTCMinutes(),
      result.getUTCSeconds(),
      result.getUTCMilliseconds()
    ));
  } else if (amount >= 3000) {
    result.setTime(result.getTime() + 7 * 24 * 60 * 60 * 1000);
    return result;
  } else {
    result.setTime(result.getTime() + 2 * 24 * 60 * 60 * 1000);
    return result;
  }
}

/**
 * Checks if a subscription record is currently active:
 * Flexible to match 'active', 'true', 'paid', or any future expires_at date.
 */
export function isSubscriptionActive(sub?: SubscriptionRecord | null): boolean {
  if (!sub || !sub.expires_at) return false;
  const statusLower = (sub.premium_status || '').trim().toLowerCase();
  
  // Explicitly cancelled or expired
  if (statusLower === 'expired' || statusLower === 'cancelled' || statusLower === 'inactive') {
    return false;
  }

  // Future timestamp check
  const expTime = new Date(sub.expires_at).getTime();
  if (isNaN(expTime)) return false;

  const isFuture = expTime > Date.now();
  if (isFuture) return true;

  // If status is affirmative and expTime is today or future
  return isFuture;
}

/**
 * Query customer subscription:
 * 1. Tries backend proxy /api/subscription/check (bypasses RLS safely with secret key)
 * 2. Fallbacks to direct Supabase query on 'nelitv_subscriptions', 'Subscription', 'subscriptions'
 */
export async function fetchCustomerSubscriptionFromSupabase(
  identifier: string
): Promise<SubscriptionRecord | null> {
  const clean = identifier.trim();
  if (!clean) return null;
  const isEmail = clean.includes('@');

  // 1. Primary: Backend endpoint with service_role privileges
  try {
    const param = isEmail ? `email=${encodeURIComponent(clean)}` : `phone=${encodeURIComponent(clean)}`;
    const res = await fetch(`/api/subscription/check?${param}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.subscription) {
        return {
          id: data.subscription.id,
          phone_number: data.subscription.phone_number || clean,
          email: data.subscription.user_email || data.subscription.email || (isEmail ? clean : undefined),
          premium_status: data.subscription.premium_status || (data.active ? 'active' : 'expired'),
          expires_at: data.subscription.expires_at,
          plan_name: data.subscription.plan_id || data.subscription.plan_name,
          amount: data.subscription.amount_paid || data.subscription.amount
        };
      }
    }
  } catch {
    // If backend endpoint fails (e.g. offline or client-only), proceed to direct check
  }

  // 2. Secondary direct Supabase query
  if (!supabase) return null;

  try {
    const tableNames = ['nelitv_subscriptions', 'Subscription', 'subscriptions'];

    for (const tbl of tableNames) {
      try {
        if (isEmail) {
          const colName = tbl === 'nelitv_subscriptions' ? 'user_email' : 'email';
          const { data, error } = await supabase
            .from(tbl)
            .select('*')
            .ilike(colName, clean)
            .order('expires_at', { ascending: false });

          if (!error && data && data.length > 0) {
            const activeSub = data.find((sub: any) => isSubscriptionActive(sub));
            const sub = activeSub || data[0];
            return {
              id: sub.id,
              phone_number: sub.phone_number || clean,
              email: sub.user_email || sub.email,
              premium_status: sub.premium_status,
              expires_at: sub.expires_at,
              plan_name: sub.plan_id || sub.plan_name,
              amount: sub.amount_paid || sub.amount
            };
          }
        } else {
          const variants = getPhoneVariants(clean);
          const { data, error } = await supabase
            .from(tbl)
            .select('*')
            .in('phone_number', variants)
            .order('expires_at', { ascending: false });

          if (!error && data && data.length > 0) {
            const activeSub = data.find((sub: any) => isSubscriptionActive(sub));
            const sub = activeSub || data[0];
            return {
              id: sub.id,
              phone_number: sub.phone_number || clean,
              email: sub.user_email || sub.email,
              premium_status: sub.premium_status,
              expires_at: sub.expires_at,
              plan_name: sub.plan_id || sub.plan_name,
              amount: sub.amount_paid || sub.amount
            };
          }
        }
      } catch {
        // Fallback to next table
      }
    }
    return null;
  } catch (err) {
    console.warn('[Supabase] fetch error:', err);
    return null;
  }
}
