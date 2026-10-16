import { createClient } from '@supabase/supabase-js';

// Configuration from environment variables
// Supports both Vite client prefix (VITE_) and standard server/Node environment
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
  phone_number: string;
  premium_status: 'active' | 'Active' | 'expired' | string;
  expires_at: string;
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
 * Calculates exact subscription expiration date:
 * - TSh 1,000 = exactly 2 days
 * - TSh 3,000 = exactly 7 days
 * - TSh 10,000 = exactly 1 calendar month, preserving time of day
 *   Handles months with 28, 29, 30, or 31 days correctly.
 *   If the target month has no corresponding day (e.g. Jan 31 -> Feb 28/29), uses its last day.
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
    // 1 calendar month, preserving time of day where possible
    const currentDay = result.getDate();
    const currentMonth = result.getMonth();
    const currentYear = result.getFullYear();

    const targetMonth = (currentMonth + 1) % 12;
    const targetYear = currentMonth === 11 ? currentYear + 1 : currentYear;

    // Get total days in the target month (e.g. 28, 29, 30, 31)
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
    // Exactly 7 days
    result.setTime(result.getTime() + 7 * 24 * 60 * 60 * 1000);
    return result;
  } else {
    // Exactly 2 days
    result.setTime(result.getTime() + 2 * 24 * 60 * 60 * 1000);
    return result;
  }
}

/**
 * Checks if a subscription record is currently active
 */
export function isSubscriptionActive(sub?: SubscriptionRecord | null): boolean {
  if (!sub || !sub.expires_at) return false;
  const statusLower = (sub.premium_status || '').toLowerCase();
  if (statusLower !== 'active') return false;
  return new Date(sub.expires_at).getTime() > Date.now();
}

/**
 * Query customer subscription directly from Supabase (checks 'Subscription' first, then 'subscriptions')
 */
export async function fetchCustomerSubscriptionFromSupabase(
  rawPhone: string
): Promise<SubscriptionRecord | null> {
  if (!supabase) return null;

  try {
    const clean0 = normalizePhoneNumber(rawPhone);
    const clean255 = '255' + clean0.replace(/^0+/, '');
    const phoneVariants = [clean0, clean255, '+' + clean255];

    // Try 'Subscription' table first, then 'subscriptions'
    const tableNames = ['Subscription', 'subscriptions'];
    for (const tbl of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tbl)
          .select('*')
          .in('phone_number', phoneVariants)
          .order('expires_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const now = Date.now();
          // Check if any record is still active
          const activeSub = data.find((sub: SubscriptionRecord) => {
            const st = (sub.premium_status || '').toLowerCase();
            return st === 'active' && sub.expires_at && new Date(sub.expires_at).getTime() > now;
          });

          if (activeSub) {
            return activeSub;
          }

          return data[0]; // Return most recent record
        }
      } catch (tableErr) {
        // Continue to fallback table
      }
    }
    return null;
  } catch (err) {
    console.warn('[Supabase] fetch error:', err);
    return null;
  }
}
