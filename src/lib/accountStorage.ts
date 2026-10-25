/**
 * Account-Isolated Browser Cache Storage for NeliTv Subscriptions
 * 
 * Ensures:
 * 1. Payments are cached locally per account identifier (phone number or email).
 * 2. When a user logs out, the active session is cleared.
 * 3. If a different account logs in, it does NOT inherit the previous user's payment.
 * 4. When the paid account logs back in, its cached payment is instantly recognized and restored.
 */

const ACCOUNT_SUB_CACHE_PREFIX = 'nelitv_acc_sub_';

export interface AccountSubscriptionRecord {
  identifier: string; // normalized phone (e.g. 0712345678) or lowercased email
  isSubscribed: boolean;
  hasActiveSubscription: boolean;
  subscriptionPlan: string;
  subscriptionExpiresAt: string;
  savedAt: string;
  orderId?: string;
  amount?: number;
}

/**
 * Normalizes identifier (phone or email) for cache indexing
 */
export function normalizeAccountKey(identifier?: string | null): string {
  if (!identifier) return '';
  const clean = identifier.trim().toLowerCase();
  // If phone, strip non-digits and normalize 255/0
  if (!clean.includes('@') && /\d/.test(clean)) {
    let digits = clean.replace(/\D/g, '');
    if (digits.startsWith('255') && digits.length === 12) {
      digits = '0' + digits.slice(3);
    }
    return digits;
  }
  return clean;
}

/**
 * Save paid subscription to browser localStorage for this specific account
 */
export function saveAccountSubscriptionCache(
  identifier: string,
  data: {
    planName: string;
    expiresAt: string;
    orderId?: string;
    amount?: number;
  }
): void {
  const key = normalizeAccountKey(identifier);
  if (!key) return;

  const record: AccountSubscriptionRecord = {
    identifier: key,
    isSubscribed: true,
    hasActiveSubscription: true,
    subscriptionPlan: data.planName || 'Kifurushi Hai',
    subscriptionExpiresAt: data.expiresAt,
    savedAt: new Date().toISOString(),
    orderId: data.orderId,
    amount: data.amount
  };

  try {
    localStorage.setItem(`${ACCOUNT_SUB_CACHE_PREFIX}${key}`, JSON.stringify(record));
  } catch (err) {
    console.warn('[AccountCache] save error:', err);
  }
}

/**
 * Get active cached subscription for this specific account (if still valid and not expired)
 */
export function getAccountSubscriptionCache(identifier?: string | null): AccountSubscriptionRecord | null {
  const key = normalizeAccountKey(identifier);
  if (!key) return null;

  try {
    const raw = localStorage.getItem(`${ACCOUNT_SUB_CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const record: AccountSubscriptionRecord = JSON.parse(raw);
    const expTime = new Date(record.subscriptionExpiresAt).getTime();

    // Check if subscription has not expired
    if (!isNaN(expTime) && expTime > Date.now()) {
      return record;
    }

    // Expired
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear cached subscription for a specific account (e.g. if revoked or expired)
 */
export function removeAccountSubscriptionCache(identifier: string): void {
  const key = normalizeAccountKey(identifier);
  if (!key) return;
  try {
    localStorage.removeItem(`${ACCOUNT_SUB_CACHE_PREFIX}${key}`);
  } catch {}
}
