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
 * Query customer subscription directly from Supabase by phone or email
 */
export async function fetchCustomerSubscriptionFromSupabase(
  identifier: string
): Promise<SubscriptionRecord | null> {
  if (!supabase) return null;

  try {
    const isEmail = identifier.includes('@');
    const tableNames = ['Subscription', 'subscriptions'];

    for (const tbl of tableNames) {
      try {
        let query = supabase.from(tbl).select('*');

        if (isEmail) {
          query = query.ilike('email', identifier.trim());
        } else {
          const variants = getPhoneVariants(identifier);
          query = query.in('phone_number', variants);
        }

        const { data, error } = await query.order('expires_at', { ascending: false });

        if (!error && data && data.length > 0) {
          // Check if any record is still active
          const activeSub = data.find((sub: SubscriptionRecord) => isSubscriptionActive(sub));
          if (activeSub) return activeSub;

          return data[0]; // Return most recent record
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
