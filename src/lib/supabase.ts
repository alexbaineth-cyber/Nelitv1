/**
 * NeliTv Subscription & Account Sync Service
 * 
 * Secure Client Proxy:
 * Database requests are routed strictly through server-side proxy endpoints (/api/subscription/*)
 * to prevent exposing database URLs, anon keys, or REST API endpoints (/rest/v1)
 * in the public browser network tab or client bundle.
 */

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

  return expTime > Date.now();
}

/**
 * Query customer subscription securely via backend proxy endpoint.
 * Zero client-side Supabase credentials or /rest/v1 exposure.
 */
export async function fetchCustomerSubscriptionFromSupabase(
  identifier: string
): Promise<SubscriptionRecord | null> {
  const clean = identifier.trim();
  if (!clean) return null;
  const isEmail = clean.includes('@');

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
    return null;
  } catch (err) {
    console.warn('[Subscription Check Notice]', err);
    return null;
  }
}

/**
 * Synchronize subscription and payment via secure backend endpoint.
 * Executes on Node.js server with privileged database credentials;
 * zero database keys or /rest/v1 network calls in the browser.
 */
export async function syncSubscriptionToSupabaseClientSide(
  phone: string,
  amount: number,
  planId?: string,
  orderId?: string,
  email?: string
): Promise<boolean> {
  try {
    const clean0 = normalizePhoneNumber(phone);
    const res = await fetch('/api/subscription/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: clean0,
        amount,
        planId,
        orderId,
        email
      })
    });

    if (res.ok) {
      const data = await res.json();
      return Boolean(data && data.success);
    }
    return false;
  } catch (err: any) {
    console.warn('[Subscription Sync Notice]', err?.message || err);
    return false;
  }
}
