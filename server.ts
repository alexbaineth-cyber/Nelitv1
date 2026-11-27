import express, { Request, Response, NextFunction } from 'express';
import nodeCrypto from 'crypto';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { ALL_KNOWN_CLEAR_KEYS, CHANNELS_DATA, VIFURUSHI_PLANS } from './src/data/channels.ts';
import { getChannelRouteSlug, findChannelFromRoute } from './src/utils/channelRoute.ts';
import { NELI_API_KEY, signClientToken, verifyClientToken } from './src/server/authMiddleware.ts';
import { registerStreamGeneratorRoutes } from './src/server/streamGeneratorRoutes.ts';
import { StreamGeneratorStore } from './src/server/streamGeneratorStore.ts';
import { isFreeAccountEmail, FREE_ACCOUNTS, FREE_PLAN_NAME, FREE_EXPIRATION_LIFETIME } from './src/data/freeAccounts.ts';
import {
  channelHealthGuardian,
  manifestEdgeCache,
  segmentEdgeCache
} from './src/server/streamResilience.ts';
import {
  neliAiKnowledge,
  processNeliVoiceCommand
} from './src/server/neliAiBrain.ts';

const PUBLIC_SITE_URL = (process.env.NELITV_PUBLIC_URL || 'https://nelitv.online').replace(/\/+$/, '');

dotenv.config();

// Global Crash Shield: prevent transient upstream socket resets or rejected promises from killing the server
process.on('uncaughtException', (err) => {
  console.error('[NeliTv CrashShield uncaughtException]:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.error('[NeliTv CrashShield unhandledRejection]:', reason?.message || reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', true);
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? process.argv[portArgIndex + 1] : undefined;
const PORT = process.env.PORT || cliPort || 3000;
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY || 'hpk_93b63ba05db51f1963b174570c71762a73541195bdbc5538';
const HARAKAPAY_BASE_URL = 'https://harakapay.net';

// Supabase client configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qqwlekumeltrdfvutmmt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_RU9QIfJMuQzk_w4eJRGiKA_akpI_o7S';

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (supabase) {
  console.log('[Supabase] Initialized client successfully with URL:', SUPABASE_URL);
} else {
  console.log('[Supabase] Running with persistent file-backed store until SUPABASE_URL & SUPABASE_KEY are provided.');
}

app.use(express.json());

// Global Security Headers for Browser Safety, Certificate Compliance & Anti-Scam Protection
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Allow framing for /embed and external website embeds
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors * 'self';"
  );
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// In-memory + file-backed storage for users & payments
const DATA_DIR = path.join(__dirname, '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const DEVELOPER_USERS_FILE = path.join(DATA_DIR, 'developerUsers.json');

export interface DeveloperUser {
  id: string;
  email: string;
  password?: string;
  name?: string;
  phone?: string;
  apiKey: string;
  isSubscribed: boolean;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
}

let developerUsersStore: Record<string, DeveloperUser> = {};

interface UserProfile {
  phone: string;
  createdDate: string;
  lastActive: string;
  trialSecondsUsed: number;
  trialCompleted: boolean;
  isSubscribed: boolean;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  deviceInfo?: string;
}

interface PaymentRecord {
  orderId: string;
  phone: string;
  amount: number;
  planId: string;
  planName: string;
  durationDays: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  network?: string;
  rawResponse?: any;
}

let usersStore: Record<string, UserProfile> = {};
let paymentsStore: Record<string, PaymentRecord> = {};

function initDataStorage() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      usersStore = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
    if (fs.existsSync(PAYMENTS_FILE)) {
      paymentsStore = JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf-8'));
    }
    if (fs.existsSync(DEVELOPER_USERS_FILE)) {
      developerUsersStore = JSON.parse(fs.readFileSync(DEVELOPER_USERS_FILE, 'utf-8'));
    }
    // Always seed and guarantee the free developer test account:
    // Email: adminapi@login.com | Password: 123Free | Lifetime VIP
    developerUsersStore['adminapi@login.com'] = {
      id: 'dev_admin_api_vip',
      email: 'adminapi@login.com',
      password: '123Free',
      name: 'Admin API Developer (Free Lifetime VIP)',
      phone: '0700000000',
      apiKey: 'neli_live_sk_admin_api_vip_001',
      isSubscribed: true,
      subscriptionPlan: 'plan_api_yearly',
      subscriptionExpiresAt: '2099-12-31T23:59:59.000Z',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
  } catch (err) {
    console.error('Data storage initialization warning:', err);
  }
}

function persistData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersStore, null, 2));
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(paymentsStore, null, 2));
    fs.writeFileSync(DEVELOPER_USERS_FILE, JSON.stringify(developerUsersStore, null, 2));
  } catch (err) {
    console.error('Failed to persist data:', err);
  }
}

initDataStorage();

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('255')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (!cleaned.startsWith('0') && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

// Check subscription validity
function isSubscriptionValid(user?: UserProfile): boolean {
  if (!user || !user.isSubscribed || !user.subscriptionExpiresAt) return false;
  const expiry = new Date(user.subscriptionExpiresAt).getTime();
  return expiry > Date.now();
}

/**
 * Calculates exact subscription expiration date:
 * - TSh 1,000 = exactly 2 days
 * - TSh 3,000 = exactly 7 days
 * - TSh 10,000 = exactly 1 calendar month, preserving time of day
 *   Handles months with 28, 29, 30, or 31 days correctly.
 *   If the target month has no corresponding day (e.g. Jan 31 -> Feb 28/29), uses its last day.
 */
function calculateSubscriptionExpiration(
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

function getPhoneVariants(phone: string): string[] {
  const clean0 = normalizePhone(phone);
  const withoutZero = clean0.replace(/^0+/, '');
  const clean255 = '255' + withoutZero;
  return Array.from(new Set([
    clean0,
    clean255,
    '+' + clean255,
    withoutZero,
    phone.trim(),
    phone.replace(/\s+/g, '')
  ])).filter(Boolean);
}

/**
 * Query customer subscription directly from Supabase (checks 'nelitv_subscriptions' first, then 'Subscription' / 'subscriptions')
 * Supports both phone numbers and emails
 */
async function querySupabaseSubscription(identifier: string) {
  if (!supabase) return null;
  try {
    const isEmail = identifier.includes('@');
    const tableNames = ['nelitv_subscriptions', 'Subscription', 'subscriptions'];

    for (const tbl of tableNames) {
      try {
        let data: any[] | null = null;
        let queryError: any = null;

        if (tbl === 'nelitv_subscriptions') {
          if (isEmail) {
            const res = await supabase
              .from('nelitv_subscriptions')
              .select('*')
              .ilike('user_email', identifier.trim())
              .order('expires_at', { ascending: false });
            data = res.data;
            queryError = res.error;
          } else {
            const phoneVariants = getPhoneVariants(identifier);
            const res = await supabase
              .from('nelitv_subscriptions')
              .select('*')
              .in('phone_number', phoneVariants)
              .order('expires_at', { ascending: false });
            data = res.data;
            queryError = res.error;
          }
        } else {
          if (isEmail) {
            try {
              const res = await supabase
                .from(tbl)
                .select('*')
                .ilike('email', identifier.trim())
                .order('expires_at', { ascending: false });
              data = res.data;
              queryError = res.error;
            } catch {
              // Email column may not exist yet
            }
          } else {
            const phoneVariants = getPhoneVariants(identifier);
            const res = await supabase
              .from(tbl)
              .select('*')
              .in('phone_number', phoneVariants)
              .order('expires_at', { ascending: false });
            data = res.data;
            queryError = res.error;
          }
        }

        if (queryError || !data || data.length === 0) continue;

        const now = Date.now();
        // Check if any record is still active (flexible check)
        const activeSub = data.find((sub: any) => {
          if (!sub.expires_at) return false;
          const st = (sub.premium_status || '').trim().toLowerCase();
          const isNotExpired = st !== 'expired' && st !== 'cancelled' && st !== 'inactive';
          return isNotExpired && new Date(sub.expires_at).getTime() > now;
        });

        if (activeSub) return activeSub;

        // Check if latest was active but expired - update in background if needed
        const latest = data[0];
        if (latest && (latest.premium_status || '').toLowerCase() === 'active' && new Date(latest.expires_at).getTime() <= now) {
          try {
            await supabase
              .from(tbl)
              .update({ premium_status: 'expired' })
              .eq('id', latest.id);
          } catch {}
        }
        // Do NOT return expired or unpaid records - return null!
        continue;
      } catch {
        // try next table
      }
    }
    return null;
  } catch (err: any) {
    console.warn('[Supabase Exception]', err.message);
    return null;
  }
}

/**
 * Saves or extends a subscription in Supabase (nelitv_subscriptions & nelitv_payments) and local store:
 * - If the same phone number or email purchases another subscription, extends the existing expiration
 */
async function saveOrExtendSupabaseSubscription(phone: string, amount: number, email?: string, orderId?: string) {
  const clean0 = normalizePhone(phone);
  const now = new Date();

  // Check if user has an existing active subscription in the future to extend it!
  // E.g. If user has 30 days and buys another 30 days = 60 days total.
  // E.g. If user has 1 day or a few hours remaining and buys 2 days = remaining + 48 hours.
  let baseDate = now;
  let existingExpiryTime = 0;

  const existingLocal = usersStore[clean0];
  if (existingLocal?.subscriptionExpiresAt) {
    const t = new Date(existingLocal.subscriptionExpiresAt).getTime();
    if (t > existingExpiryTime) existingExpiryTime = t;
  }

  if (supabase) {
    try {
      const existingSub = await querySupabaseSubscription(clean0);
      if (existingSub?.expires_at) {
        const t = new Date(existingSub.expires_at).getTime();
        if (t > existingExpiryTime) existingExpiryTime = t;
      }
    } catch {}
  }

  if (existingExpiryTime > now.getTime()) {
    baseDate = new Date(existingExpiryTime);
    console.log(`[Subscription Stacking] User ${clean0} has active subscription until ${baseDate.toISOString()}. Adding new plan on top of existing remaining time!`);
  }

  // Exactly 48 hours for 2 days, 7 days for 1 week, or calendar month for 1 month
  const finalExpiry = calculateSubscriptionExpiration(amount, baseDate);
  const expiryIso = finalExpiry.toISOString();
  const planId = amount >= 10000 ? 'plan_30days' : (amount >= 3000 ? 'plan_7days' : 'plan_2days');

  // Save to Supabase (nelitv_subscriptions & nelitv_payments)
  if (supabase) {
    try {
      // 1. Primary table: public.nelitv_subscriptions
      const { error: subErr } = await supabase
        .from('nelitv_subscriptions')
        .upsert({
          phone_number: clean0,
          user_email: email || null,
          plan_id: planId,
          premium_status: 'active',
          amount_paid: amount,
          activated_at: now.toISOString(),
          expires_at: expiryIso,
          updated_at: now.toISOString()
        }, { onConflict: 'phone_number' });

      if (subErr) {
        console.warn('[Supabase nelitv_subscriptions Error]', subErr.message);
      } else {
        console.log(`[Supabase nelitv_subscriptions] Saved subscription for ${clean0}: expires_at=${expiryIso}`);
      }

      // 2. Payments table: public.nelitv_payments (Exact match to user's schema)
      const orderIdToRecord = orderId || `HP-${Date.now()}`;
      try {
        const { error: payErr } = await supabase
          .from('nelitv_payments')
          .upsert({
            order_id: orderIdToRecord,
            phone_number: clean0,
            amount: amount,
            plan_id: planId,
            status: 'completed',
            payment_method: 'harakapay',
            completed_at: now.toISOString()
          }, { onConflict: 'order_id' });

        if (payErr) {
          console.warn('[Supabase nelitv_payments Error]', payErr.message);
        } else {
          console.log(`[Supabase nelitv_payments] Saved completed payment for order ${orderIdToRecord}`);
        }
      } catch (e: any) {
        console.warn('[Supabase nelitv_payments exception]', e.message);
      }

      // 3. Fallback to legacy Subscription table if present
      try {
        await supabase
          .from('Subscription')
          .upsert({
            phone_number: clean0,
            email: email || null,
            premium_status: 'active',
            expires_at: expiryIso,
            plan_name: planId,
            amount: amount
          }, { onConflict: 'phone_number' });
      } catch {}
    } catch (err: any) {
      console.warn('[Supabase Save Exception]', err.message);
    }
  }

  // Determine plan label & duration
  let planName = 'Kifurushi cha Siku 2';
  let durationDays = 2;
  if (amount >= 10000) {
    planName = 'Kifurushi cha Mwezi 1';
    durationDays = 30;
  } else if (amount >= 3000) {
    planName = 'Kifurushi cha Wiki 1';
    durationDays = 7;
  }

  // Update payment record in local paymentsStore
  const recordedOrderId = orderId || `HP-${Date.now()}`;
  paymentsStore[recordedOrderId] = {
    orderId: recordedOrderId,
    phone: clean0,
    amount,
    planId,
    planName,
    durationDays,
    status: 'completed',
    createdAt: now.toISOString(),
    completedAt: now.toISOString(),
    network: 'HarakaPay'
  };

  // Update local memory & file-backed store
  let user = usersStore[clean0];
  if (!user) {
    user = {
      phone: clean0,
      createdDate: now.toISOString(),
      lastActive: now.toISOString(),
      trialSecondsUsed: 60,
      trialCompleted: true,
      isSubscribed: true,
      subscriptionPlan: planName,
      subscriptionExpiresAt: expiryIso
    };
    usersStore[clean0] = user;
  } else {
    user.isSubscribed = true;
    user.subscriptionPlan = planName;
    user.subscriptionExpiresAt = expiryIso;
    user.trialCompleted = true;
    user.lastActive = now.toISOString();
  }
  persistData();

  return {
    phone: clean0,
    status: 'active',
    expiresAt: expiryIso,
    planName
  };
}

/**
 * Fetch unified payment transactions from local store and Supabase (nelitv_payments & subscriptions)
 */
async function fetchUserPayments(identifier: string): Promise<PaymentRecord[]> {
  if (!identifier) return [];
  const cleanPhone = normalizePhone(identifier);
  const isEmail = identifier.includes('@');
  const paymentsMap: Record<string, PaymentRecord> = {};

  // 1. Gather from local memory paymentsStore
  Object.values(paymentsStore).forEach(p => {
    const matchesPhone = p.phone && (normalizePhone(p.phone) === cleanPhone || p.phone === identifier);
    if (matchesPhone) {
      paymentsMap[p.orderId] = p;
    }
  });

  // 2. Query Supabase nelitv_payments table
  if (supabase) {
    try {
      const phoneVariants = isEmail ? [] : getPhoneVariants(identifier);
      let query = supabase.from('nelitv_payments').select('*');
      if (!isEmail && phoneVariants.length > 0) {
        query = query.in('phone_number', phoneVariants);
      }
      const { data, error } = await query.order('completed_at', { ascending: false });
      if (!error && Array.isArray(data)) {
        data.forEach((row: any) => {
          const oid = row.order_id || `HP-${row.id}`;
          if (!paymentsMap[oid]) {
            let planName = 'Kifurushi cha Siku 2';
            let durationDays = 2;
            const amt = Number(row.amount) || 1000;
            if (amt >= 10000 || (row.plan_id && row.plan_id.includes('30'))) {
              planName = 'Kifurushi cha Mwezi 1';
              durationDays = 30;
            } else if (amt >= 3000 || (row.plan_id && row.plan_id.includes('7'))) {
              planName = 'Kifurushi cha Wiki 1';
              durationDays = 7;
            }
            paymentsMap[oid] = {
              orderId: oid,
              phone: row.phone_number || cleanPhone,
              amount: amt,
              planId: row.plan_id || (durationDays === 30 ? 'plan_30days' : durationDays === 7 ? 'plan_7days' : 'plan_2days'),
              planName,
              durationDays,
              status: row.status === 'failed' ? 'failed' : (row.status === 'pending' ? 'pending' : 'completed'),
              createdAt: row.created_at || row.completed_at || new Date().toISOString(),
              completedAt: row.completed_at || row.created_at || new Date().toISOString(),
              network: row.payment_method || 'HarakaPay'
            };
            paymentsStore[oid] = paymentsMap[oid];
          }
        });
      }
    } catch (e: any) {
      console.warn('[Supabase payments query exception]', e?.message);
    }

    // 3. Fallback check: Supabase nelitv_subscriptions
    try {
      const phoneVariants = isEmail ? [] : getPhoneVariants(identifier);
      let query = supabase.from('nelitv_subscriptions').select('*');
      if (isEmail) {
        query = query.ilike('user_email', identifier.trim());
      } else if (phoneVariants.length > 0) {
        query = query.in('phone_number', phoneVariants);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        data.forEach((sub: any) => {
          const subOrderId = `SUB-${sub.id || sub.phone_number}`;
          const hasExisting = Object.values(paymentsMap).some(p => 
            p.phone === normalizePhone(sub.phone_number)
          );
          if (!hasExisting && !paymentsMap[subOrderId]) {
            const amt = Number(sub.amount_paid) || 1000;
            let planName = 'Kifurushi cha Siku 2';
            let durationDays = 2;
            if (amt >= 10000 || (sub.plan_id && sub.plan_id.includes('30'))) {
              planName = 'Kifurushi cha Mwezi 1';
              durationDays = 30;
            } else if (amt >= 3000 || (sub.plan_id && sub.plan_id.includes('7'))) {
              planName = 'Kifurushi cha Wiki 1';
              durationDays = 7;
            }
            paymentsMap[subOrderId] = {
              orderId: subOrderId,
              phone: sub.phone_number || cleanPhone,
              amount: amt,
              planId: sub.plan_id || (durationDays === 30 ? 'plan_30days' : durationDays === 7 ? 'plan_7days' : 'plan_2days'),
              planName,
              durationDays,
              status: 'completed',
              createdAt: sub.activated_at || sub.created_at || sub.updated_at || new Date().toISOString(),
              completedAt: sub.activated_at || sub.created_at || sub.updated_at || new Date().toISOString(),
              network: 'HarakaPay'
            };
            paymentsStore[subOrderId] = paymentsMap[subOrderId];
          }
        });
      }
    } catch {}
  }

  return Object.values(paymentsMap).sort((a, b) => 
    new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime()
  );
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Live CDN host & token manager (Permanent non-expiring cdn77 primary + strictly verified backup)
interface CdnTokenRecord {
  token: string;
  cdnHost: string;
  exp: number | null;
  source: string;
  upstreamProvider: string;
}

const PERMANENT_CDN77_HOST = "https://1445733302.rsc.cdn77.org";
const PERMANENT_EXP_UNIX = 2524608000; // 2050-01-01T00:00:00.000Z (Permanent / Never expires)
const PERMANENT_CDN_JWT =
  Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT', kid: '1' })).toString('base64url') +
  '.' +
  Buffer.from(
    JSON.stringify({
      exp: String(PERMANENT_EXP_UNIX),
      sip: '',
      path: '',
      session_cdn_id: 'nelitv-permanent',
      session_id: '',
      client_id: 'nelitv',
      device_id: '',
      max_sessions: 0,
      url: PERMANENT_CDN77_HOST,
      session_timeout: 0,
      aud: '7',
      sources: [3]
    })
  ).toString('base64url') +
  '.nelitv_permanent_cdn77';

const PERMANENT_CDN77_RECORD: CdnTokenRecord = {
  token: PERMANENT_CDN_JWT,
  cdnHost: PERMANENT_CDN77_HOST,
  exp: PERMANENT_EXP_UNIX, // Year 2050 permanent exp
  source: "cdn77-permanent",
  upstreamProvider: "cdn77"
};

let cachedCdnToken: CdnTokenRecord = { ...PERMANENT_CDN77_RECORD };
let lastCdnTokenFetch = 0;
let inFlightTokenFetch: Promise<CdnTokenRecord> | null = null;
const TOKEN_SOFT_TTL_MS = 45 * 1000;
const TOKEN_PRE_EXPIRY_SEC = 900;

function decodeJwtExpSeconds(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp : null;
  } catch {
    return null;
  }
}

async function probeStreamUrl200(url: string, timeoutMs = 2200): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

async function fetchFromStreamzoneCandidate(endpoint: string, nowSec: number): Promise<CdnTokenRecord | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const resp = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NeliTv-Server/2.0'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const data = await resp.json();
    const source = String(data?.source || '');
    if (source === 'db-fallback' || source === 'unavailable') {
      return null;
    }

    const rawToken = typeof data?.token === 'string' ? data.token.trim().replace(/^(?:tok_)+/, '') : '';
    const outerExp = typeof data?.exp === 'number' ? data.exp : (data?.exp ? Number(data.exp) : 0);
    const jwtExp = decodeJwtExpSeconds(rawToken);
    if (outerExp === 0 || (jwtExp !== null && jwtExp <= nowSec + 60)) {
      return null;
    }
    const effectiveExp = jwtExp || (Number.isFinite(outerExp) && outerExp > 0 ? outerExp : 0);
    if (rawToken.length > 20 && effectiveExp > nowSec + 60) {
      const cdnHost = (typeof data?.cdnHost === 'string' && data.cdnHost.trim())
        ? data.cdnHost.trim().replace(/\/+$/, '')
        : 'https://cdnedgch2.azamtvltd.co.tz';
      const probeOk = await probeStreamUrl200(
        `${cdnHost}/tok_${rawToken}/live/eds/AzamSport1/DASH/AzamSport1.mpd`,
        2000
      );
      if (!probeOk) return null;

      return {
        token: rawToken,
        cdnHost,
        exp: effectiveExp,
        source: source || 'streamzone',
        upstreamProvider: String(data?.provider || 'aztv')
      };
    }
  } catch {
    // Ignore candidate timeout/error and continue fallback chain
  }
  return null;
}

async function fetchFreshCdnTokenUpstream(cleanExclude = ''): Promise<CdnTokenRecord> {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  // If not explicitly excluding cdn77, verify permanent cdn77 origin first (zero expiry, zero 429)
  if (cleanExclude !== 'cdn77') {
    const cdn77Healthy = await probeStreamUrl200(
      `${PERMANENT_CDN77_HOST}/live/eds/AzamSport1/DASH/AzamSport1.mpd`,
      2200
    );
    if (cdn77Healthy) {
      cachedCdnToken = { ...PERMANENT_CDN77_RECORD };
      lastCdnTokenFetch = Date.now();
      return cachedCdnToken;
    }
  }

  const candidates = cleanExclude && cleanExclude !== 'cdn77'
    ? [`https://streamzone.fun/api/cdn-token?fresh=1&excludeProvider=${encodeURIComponent(cleanExclude)}&_t=${now}`]
    : [
        `https://streamzone.fun/api/cdn-token?_t=${now}`,
        `https://streamzone.fun/api/cdn-token?excludeProvider=mpingo&fresh=1&_t=${now}`,
        `https://streamzone.fun/api/cdn-token?excludeProvider=aztv&fresh=1&_t=${now}`
      ];

  for (const endpoint of candidates) {
    const record = await fetchFromStreamzoneCandidate(endpoint, nowSec);
    if (record) {
      cachedCdnToken = record;
      lastCdnTokenFetch = Date.now();
      console.log('[CDN Token] Refreshed backup provider:', record.upstreamProvider, 'exp:', record.exp);
      return record;
    }
  }

  // Fallback to permanent cdn77 record (never return an expired 403 token)
  cachedCdnToken = { ...PERMANENT_CDN77_RECORD };
  lastCdnTokenFetch = Date.now();
  return cachedCdnToken;
}

function triggerBackgroundTokenRefresh(cleanExclude = ''): Promise<CdnTokenRecord> {
  if (!inFlightTokenFetch) {
    inFlightTokenFetch = fetchFreshCdnTokenUpstream(cleanExclude).finally(() => {
      inFlightTokenFetch = null;
    });
  }
  return inFlightTokenFetch;
}

const FORCE_REFRESH_COOLDOWN_MS = 15 * 1000;

async function getOrFetchCdnToken(force = false, excludeProvider = ''): Promise<CdnTokenRecord> {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const cleanExclude = String(excludeProvider || '').trim();
  const isPermanent = cachedCdnToken.cdnHost.includes('cdn77.org');
  const currentValid = isPermanent || (cachedCdnToken.exp !== null && cachedCdnToken.exp > nowSec + 60);
  const nearExpiry = !isPermanent && Boolean(cachedCdnToken.exp && cachedCdnToken.exp <= nowSec + TOKEN_PRE_EXPIRY_SEC);
  const sinceLastFetch = now - lastCdnTokenFetch;
  const isStale = sinceLastFetch >= TOKEN_SOFT_TTL_MS || nearExpiry;

  // Prevent stampeding upstream when hundreds of APK users click channels concurrently
  if (!cleanExclude && currentValid && sinceLastFetch < FORCE_REFRESH_COOLDOWN_MS) {
    return cachedCdnToken;
  }

  if (!force && !cleanExclude && currentValid) {
    if (isStale) {
      void triggerBackgroundTokenRefresh('');
    }
    return cachedCdnToken;
  }

  if (force || cleanExclude || !currentValid) {
    if (cleanExclude) {
      return await fetchFreshCdnTokenUpstream(cleanExclude);
    }
    return await triggerBackgroundTokenRefresh('');
  }

  return cachedCdnToken;
}

function getSerializedExp(tokenData: CdnTokenRecord): number {
  if (tokenData.exp && tokenData.exp > Math.floor(Date.now() / 1000)) {
    return tokenData.exp;
  }
  return PERMANENT_EXP_UNIX;
}

// Warm immediately on server start and monitor health every 45s
void triggerBackgroundTokenRefresh('').catch(() => {});
setInterval(() => {
  void triggerBackgroundTokenRefresh('').catch(() => {});
}, TOKEN_SOFT_TTL_MS);

// Start 24/7 Channel Health Guardian & Neli AI Knowledge Sync (Channels + Firebase Movies)
channelHealthGuardian.start();
neliAiKnowledge.start();

// InMobi authorized digital sellers (ads.txt) endpoint
const INMOBI_ADS_TXT_FALLBACK = `inmobi.com, 6db4aff5416d4bb7b0ba0b274749cc7c, DIRECT, 83e75a7ae333ca9d
rubiconproject.com, 12266, RESELLER, 0bfd66d529a55807
rubiconproject.com, 11726, RESELLER, 0bfd66d529a55807
conversantmedia.com, 40881, RESELLER, 03113cd04947736d
pubmatic.com, 157097, RESELLER, 5d62403b186f2ace
opera.com, pub6871903319744, RESELLER, 55a0c5fd61378de3
smaato.com, 1100053415, RESELLER, 07bcf65f187117b4
blis.com, 33, RESELLER, 61453ae19a4b73f4
mintegral.com, 10003, RESELLER
loopme.com, 9724, RESELLER, 6c8d5f95897a5a3b
lijit.com, 502742, RESELLER, fafdf38b16bf6b2b
admanmedia.com, 2063, RESELLER
eskimi.com, 2020000030, RESELLER
appnexus.com, 15670, RESELLER
pubmatic.com, 156931, RESELLER, 5d62403b186f2ace
pubmatic.com, 159035, RESELLER, 5d62403b186f2ace
smartyads.com, 478, RESELLER, fd2bde0ff2e62c5d
se7en.es, 212430, RESELLER, 064bc410192443d8
themediagrid.com, B8N9YH, RESELLER, 35d5010d7789b49d
Trustedstack.com, TSP4UUFB8, RESELLER
thebrave.io, 1234568, RESELLER, c25b2154543746ac
axonix.com, 57716, RESELLER
smartadserver.com, 3232, RESELLER, 060d053dcf45cbf3
risecodes.com, 662a26f1f3d42a00015ffbad, RESELLER
ssp.e-volution.ai, AJxF6R378a9M6CaTvK, RESELLER
apester.com, 2212, RESELLER
zmaticoo.com, 5135082, RESELLER
playdigo.com, 2010, RESELLER
e-volution.ai, AJxF6R378a9M6CaTvK, RESELLER
conversantmedia.com, 100357, RESELLER, 03113cd04947736d
selectmedia.asia, 645b5a31e427dc0a87094fc4, RESELLER, e365c871a27c655d
smartbid.ai, SMB30004, RESELLER, 98eb473904e71631
adagio.io, 1618, RESELLER
lijit.com, 571745, RESELLER
thunder-monetize.com, 3905806597, RESELLER
triplelift.com, 14851, RESELLER, 6c33edb13117fd86
`;

app.get('/ads.txt', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const publicAdsPath = path.join(__dirname, 'public', 'ads.txt');
  if (fs.existsSync(publicAdsPath)) {
    return res.sendFile(publicAdsPath);
  }
  return res.send(INMOBI_ADS_TXT_FALLBACK);
});

// Portal Access Protection (+255Tanzania password lock for /api and /server pages)
const NELI_PORTAL_PASSWORD = process.env.NELI_PORTAL_PASSWORD || '+255Tanzania';

function verifyExactPortalPassword(input: string): boolean {
  const expectedBuf = Buffer.from(NELI_PORTAL_PASSWORD, 'utf8');
  const providedBuf = Buffer.from(input, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return nodeCrypto.timingSafeEqual(expectedBuf, providedBuf);
}

function extractPortalTokenFromReq(req: Request): string {
  const auth = req.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const headerToken = req.get('X-Portal-Token') || '';
  if (headerToken.trim()) return headerToken.trim();
  return typeof req.query.token === 'string' ? req.query.token.trim() : '';
}

app.post('/api/portal/unlock', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const provided = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!provided || !verifyExactPortalPassword(provided)) {
    return res.status(401).json({
      success: false,
      unlocked: false,
      error: 'Nenosiri si sahihi. Tafadhali jaribu tena.'
    });
  }

  const portalToken = signClientToken({ scope: 'nelitv-portal' }, 12 * 3600);
  return res.json({
    success: true,
    unlocked: true,
    portalToken,
    expiresInSeconds: 12 * 3600
  });
});

app.get('/api/portal/verify', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const token = extractPortalTokenFromReq(req);
  const verified = token ? verifyClientToken(token) : null;
  const unlocked = Boolean(verified && verified.scope === 'nelitv-portal');
  return res.json({
    success: true,
    unlocked
  });
});

registerStreamGeneratorRoutes(
  app,
  {
    verifyClientToken,
    extractPortalTokenFromReq,
    publicSiteUrl: PUBLIC_SITE_URL
  },
  new StreamGeneratorStore(supabase)
);

// Block all direct / public exposure of /api/channels and /api/cdn-token (except /api/channels/health status)
app.all([
  '/api/channels', '/api/channels/*',
  '/api/cdn-token', '/api/cdn-token/*',
  '/cdn-token', '/channels'
], (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/channels/health') {
    return next();
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const isDirectBrowserVisit =
    req.get('sec-fetch-mode') === 'navigate' ||
    req.get('sec-fetch-dest') === 'document' ||
    Boolean(req.headers.accept && req.headers.accept.includes('text/html'));

  if (isDirectBrowserVisit) {
    return res.redirect(302, '/');
  }
  return res.status(404).send('Not Found');
});

function buildLiveAzamChannelForApp(
  ch: typeof CHANNELS_DATA[number],
  tokenData: CdnTokenRecord,
  proxyTicket: string
) {
  const slug = getChannelRouteSlug(ch);
  const host = tokenData.cdnHost.replace(/\/+$/, '');
  const isAzam = Boolean(
    ch.isAzam ||
    ch.streamUrl.includes('azamtvltd.co.tz') ||
    ch.streamUrl.includes('cdn77.org')
  );

  const healthRec = channelHealthGuardian.getRecord(ch.id);
  const isOnline = healthRec ? healthRec.online : ch.isActive !== false;
  const preferProxy = healthRec ? healthRec.needsProxy : false;
  const latencyMs = healthRec ? healthRec.latencyMs : null;

  if (!isAzam) {
    const proxyStreamUrl = `${PUBLIC_SITE_URL}/api/proxy-stream?url=${encodeURIComponent(ch.streamUrl)}&pt=${encodeURIComponent(proxyTicket)}`;
    return {
      ...ch,
      slug,
      isOnline,
      preferProxy,
      latencyMs,
      drmScheme: ch.clearKeys ? 'clearkey' : 'none',
      drmInfo: ch.clearKeys
        ? {
            scheme: 'clearkey',
            preferredKeySystem: 'org.w3.clearkey',
            schemeUuid: 'e2719d58-a985-b3c9-781a-b030af78d30e',
            keys: ch.clearKeys
          }
        : null,
      proxyStreamUrl
    };
  }

  let p = ch.streamUrl;
  try {
    const u = new URL(ch.streamUrl);
    p = u.pathname.replace(/^\/tok_[^/]+/, '');
  } catch {}
  if (!p.startsWith('/')) p = `/${p}`;

  const freshUrl =
    host.includes('azamtvltd') && tokenData.token.includes('.')
      ? `${host}/tok_${tokenData.token}${p}`
      : `${host}${p}`;

  return {
    ...ch,
    slug,
    isOnline,
    preferProxy: false,
    latencyMs,
    streamUrl: freshUrl,
    tokenizedUrl: freshUrl,
    drmScheme: ch.clearKeys ? 'clearkey' : 'none',
    drmInfo: ch.clearKeys
      ? {
          scheme: 'clearkey',
          preferredKeySystem: 'org.w3.clearkey',
          schemeUuid: 'e2719d58-a985-b3c9-781a-b030af78d30e',
          keys: ch.clearKeys
        }
      : null,
    codecProfile: 'avc1+mp4a',
    proxyStreamUrl: `${PUBLIC_SITE_URL}/api/proxy-stream?url=${encodeURIComponent(freshUrl)}&pt=${encodeURIComponent(proxyTicket)}`
  };
}

// Fast pre-serialized cache for /baynithalex/api/app & /baynithalex/api/channels (<1ms response under heavy load)
let cachedLiveChannelsMemo: {
  key: string;
  builtAt: number;
  proxyTicket: string;
  liveChannels: ReturnType<typeof buildLiveAzamChannelForApp>[];
  appJson: string;
  channelsJson: string;
} | null = null;

function getMemoizedLiveChannels(tokenData: CdnTokenRecord, includeOffline = false) {
  const now = Date.now();
  const exposedExp = getSerializedExp(tokenData);
  const isPermanent = tokenData.cdnHost.includes('cdn77.org');
  const healthSnap = channelHealthGuardian.getSnapshot();
  const key = `${tokenData.token}|${tokenData.cdnHost}|${exposedExp}|${includeOffline ? 'all' : 'live'}|${healthSnap.onlineCount}`;
  if (
    cachedLiveChannelsMemo &&
    cachedLiveChannelsMemo.key === key &&
    (now - cachedLiveChannelsMemo.builtAt) < 30 * 1000
  ) {
    return cachedLiveChannelsMemo;
  }

  const proxyTicket = signClientToken({ scope: 'player-proxy', client: 'nelitv-app' }, 12 * 3600);
  const builtAll = CHANNELS_DATA.map((ch) => buildLiveAzamChannelForApp(ch, tokenData, proxyTicket));
  const liveChannels = includeOffline ? builtAll : builtAll.filter((c) => c.isOnline !== false);

  const playerConfig = {
    preferDirectCdnForNativeApp: true,
    avoidProxyBottleneckOnNative: true,
    abr: {
      mode: 'youtube-stable',
      initialQualityTarget: '480p',
      initialBandwidthEstimateBps: 950000,
      switchIntervalMs: 18000,
      upgradeBandwidthFraction: 0.55,
      downgradeBandwidthFraction: 0.90,
      minBufferMs: 18000,
      maxBufferMs: 36000,
      bufferForPlaybackMs: 1800,
      bufferForPlaybackAfterRebufferMs: 3500,
      backgroundSilentSwitch: true,
      hideSpinnerDuringAbrSwitch: true
    },
    networkStability: {
      hysteresisWindowMs: 18000,
      avoidSuddenSourceSwitchOnSlowNetwork: true,
      slowNetworkHoldQualityFloor: '360p',
      maxDirectRetryBeforeProxyFallback: 2
    }
  };

  const channelsJson = JSON.stringify({
    success: true,
    server: 'NeliTv App Server',
    token: tokenData.token,
    cdnHost: tokenData.cdnHost,
    exp: exposedExp,
    expiresAt: new Date(exposedExp * 1000).toISOString(),
    neverExpires: isPermanent,
    source: tokenData.source,
    playerConfig,
    total: liveChannels.length,
    offlineFilteredCount: builtAll.length - liveChannels.length,
    data: liveChannels,
    channels: liveChannels
  });

  const appJson = JSON.stringify({
    success: true,
    server: 'NeliTv App Server',
    version: '2.0',
    baseUrl: PUBLIC_SITE_URL,
    token: tokenData.token,
    cdnHost: tokenData.cdnHost,
    exp: exposedExp,
    expiresAt: new Date(exposedExp * 1000).toISOString(),
    neverExpires: isPermanent,
    source: tokenData.source,
    provider: 'NeliTv Server',
    refreshIntervalSeconds: isPermanent ? 3600 : 45,
    playerConfig,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': `${PUBLIC_SITE_URL}/`
    },
    clearKeys: ALL_KNOWN_CLEAR_KEYS,
    totalChannels: liveChannels.length,
    offlineFilteredCount: builtAll.length - liveChannels.length,
    channels: liveChannels,
    data: liveChannels,
    endpoints: {
      cdnToken: `${PUBLIC_SITE_URL}/baynithalex/api/cdn-token`,
      channels: `${PUBLIC_SITE_URL}/baynithalex/api/channels`,
      appSync: `${PUBLIC_SITE_URL}/baynithalex/api/app`,
      proxyStream: `${PUBLIC_SITE_URL}/api/proxy-stream`,
      healthCheck: `${PUBLIC_SITE_URL}/api/channels/health`,
      playerEmbed: `${PUBLIC_SITE_URL}/embed/{slug}`
    }
  });

  cachedLiveChannelsMemo = {
    key,
    builtAt: now,
    proxyTicket,
    liveChannels,
    appJson,
    channelsJson
  };
  return cachedLiveChannelsMemo;
}

// 0.0 High-Availability Server Health & Live Channel Guardian Endpoints
app.get(['/api/health', '/healthz'], (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const snap = channelHealthGuardian.getSnapshot();
  res.json({
    ok: true,
    status: 'healthy',
    server: 'NeliTv High-Availability Relay',
    uptimeSeconds: Math.round(process.uptime()),
    memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    cdnHost: cachedCdnToken.cdnHost,
    manifestCache: manifestEdgeCache.getStats(),
    segmentCache: segmentEdgeCache.getStats(),
    channels: {
      total: snap.total,
      onlineCount: snap.onlineCount,
      offlineCount: snap.offlineCount,
      lastSweepAt: snap.lastSweepAt
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/channels/health', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  const snap = channelHealthGuardian.getSnapshot();
  res.json({
    success: true,
    total: snap.total,
    onlineCount: snap.onlineCount,
    offlineCount: snap.offlineCount,
    lastSweepAt: snap.lastSweepAt,
    isScanning: snap.isScanning,
    onlineIds: snap.onlineIds,
    offlineIds: snap.offlineIds,
    proxyPreferredIds: snap.proxyPreferredIds
  });
});

// 0.1 Central NeliTv Voice AI Brain API (Zero external LLM; shared by Web, Android App, Smart TV & Neli Company)
app.options(['/api/ai/command', '/api/ai/voice', '/api/ai/knowledge', '/api/ai/movies'], (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-App-Id');
  return res.status(204).end();
});

app.post(['/api/ai/command', '/api/ai/voice'], async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const transcript = typeof req.body?.transcript === 'string'
      ? req.body.transcript
      : typeof req.body?.query === 'string'
      ? req.body.query
      : '';
    if (!transcript.trim()) {
      return res.status(400).json({
        success: false,
        error: 'transcript is required'
      });
    }
    const result = await processNeliVoiceCommand({
      transcript,
      appId: typeof req.body?.appId === 'string' ? req.body.appId : req.get('x-app-id') || 'nelitv-web',
      currentChannelId: typeof req.body?.currentChannelId === 'string' ? req.body.currentChannelId : undefined,
      currentQuality: typeof req.body?.currentQuality === 'string' ? req.body.currentQuality : undefined,
      volume: typeof req.body?.volume === 'number' ? req.body.volume : undefined,
      brightness: typeof req.body?.brightness === 'number' ? req.body.brightness : undefined,
      isFullscreen: typeof req.body?.isFullscreen === 'boolean' ? req.body.isFullscreen : undefined,
      locale: req.body?.locale === 'sw' || req.body?.locale === 'en' ? req.body.locale : 'auto'
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Neli AI Brain error'
    });
  }
});

app.get('/api/ai/movies', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  await neliAiKnowledge.syncFirebaseCatalog(req.query.refresh === '1');
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const genre = typeof req.query.genre === 'string' ? req.query.genre.trim().toLowerCase() : '';
  const narratedOnly = req.query.narrated === '1' || req.query.narrated === 'true';

  const all = [...neliAiKnowledge.getMovies(), ...neliAiKnowledge.getSeries()];
  const filtered = all.filter((m) => {
    if (narratedOnly && !m.narrated) return false;
    if (genre && !m.genres.some((g) => g.toLowerCase().includes(genre))) return false;
    if (q) {
      const hay = `${m.title} ${m.originalTitle || ''} ${m.overview} ${m.genres.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  res.json({
    success: true,
    source: 'firebase-firestore-neliplay',
    stats: neliAiKnowledge.getStats(),
    total: filtered.length,
    movies: filtered.slice(0, 120)
  });
});

app.get('/api/ai/knowledge', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  await neliAiKnowledge.syncFirebaseCatalog(req.query.refresh === '1');

  const onlineChannels = CHANNELS_DATA.filter((ch) => channelHealthGuardian.isChannelOnline(ch.id)).map((ch) => ({
    id: ch.id,
    slug: getChannelRouteSlug(ch),
    name: ch.name,
    category: ch.category,
    language: ch.language,
    currentProgram: ch.currentProgram || '',
    nextProgram: ch.nextProgram || '',
    keywords: ch.searchKeywords || []
  }));

  res.json({
    success: true,
    engine: 'nelitv-brain-v1',
    zeroExternalLlm: true,
    voiceOnlyAssistant: true,
    supportedApps: ['nelitv-web', 'nelitv-android', 'nelitv-tv', 'neli-company'],
    stats: neliAiKnowledge.getStats(),
    supportedVoiceIntents: [
      'OPEN_CHANNEL (e.g. Neli open Azam Two / fungua Sinema Zetu)',
      'NEXT_CHANNEL / PREV_CHANNEL (change channel / badili kituo)',
      'OPEN_MOVIE (Firebase movies/series search & play)',
      'SET_VOLUME / STEP_VOLUME / MUTE / UNMUTE',
      'SET_BRIGHTNESS / STEP_BRIGHTNESS',
      'SET_QUALITY / STEP_QUALITY (auto, 1080p, 720p, 480p, 360p, 240p, saver)',
      'SET_LANGUAGE (sw / en)',
      'SET_FULLSCREEN / PAUSE / PLAY / GO_HOME / OPEN_DOWNLOAD'
    ],
    channels: onlineChannels,
    movies: neliAiKnowledge.getMovies(),
    series: neliAiKnowledge.getSeries(),
    endpoints: {
      voiceCommand: `${PUBLIC_SITE_URL}/api/ai/command`,
      moviesCatalog: `${PUBLIC_SITE_URL}/api/ai/movies`,
      knowledgeExport: `${PUBLIC_SITE_URL}/api/ai/knowledge`
    }
  });
});

// 0. NeliTv App Server Index
app.get(['/baynithalex/api', '/baynithalex/api/'], async (req: Request, res: Response) => {
  const force = req.query.refresh === 'true' || req.query.fresh === '1';
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  const tokenData = await getOrFetchCdnToken(force);
  const exposedExp = getSerializedExp(tokenData);
  const isPermanent = tokenData.cdnHost.includes('cdn77.org');
  res.json({
    success: true,
    name: 'NeliTv App Server',
    status: 'online',
    pricing: 'free',
    baseUrl: PUBLIC_SITE_URL,
    token: tokenData.token,
    cdnHost: tokenData.cdnHost,
    exp: exposedExp,
    expiresAt: new Date(exposedExp * 1000).toISOString(),
    neverExpires: isPermanent,
    endpoints: {
      cdnToken: `${PUBLIC_SITE_URL}/baynithalex/api/cdn-token`,
      channels: `${PUBLIC_SITE_URL}/baynithalex/api/channels`,
      appSync: `${PUBLIC_SITE_URL}/baynithalex/api/app`,
      proxyStream: `${PUBLIC_SITE_URL}/api/proxy-stream`,
      apiIndex: `${PUBLIC_SITE_URL}/api/v1`,
      contentApi: `${PUBLIC_SITE_URL}/api/v1/content`,
      playerApi: `${PUBLIC_SITE_URL}/api/v1/player/azam-sports-1-hd`,
      playerSdk: `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`
    },
    totalChannels: CHANNELS_DATA.length,
    timestamp: new Date().toISOString()
  });
});

// 1. NeliTv App Server Channels Endpoint (Pre-serialized <1ms response + ClearKeys + Proxy URLs)
app.get('/baynithalex/api/channels', async (req: Request, res: Response) => {
  const force = req.query.refresh === 'true' || req.query.fresh === '1';
  const includeOffline = req.query.includeOffline === '1' || req.query.all === '1';
  const tokenData = await getOrFetchCdnToken(force);
  const { channelsJson } = getMemoizedLiveChannels(tokenData, includeOffline);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  res.send(channelsJson);
});

// 1.1 Dedicated NeliTv App Server All-in-One Bootstrap / Sync Endpoint
app.get(['/baynithalex/api/app', '/baynithalex/api/bootstrap'], async (req: Request, res: Response) => {
  const force = req.query.refresh === 'true' || req.query.fresh === '1';
  const includeOffline = req.query.includeOffline === '1' || req.query.all === '1';
  const tokenData = await getOrFetchCdnToken(force);
  const { appJson } = getMemoizedLiveChannels(tokenData, includeOffline);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  res.send(appJson);
});

// 1.2 Fast Live CDN Token Endpoint (Direct access for NeliTv App, Client VideoPlayer & Browser Verification)
app.get(['/baynithalex/api/cdn-token', '/baynithalex/api/token'], async (req: Request, res: Response) => {
  const force = req.query.refresh === 'true' || req.query.fresh === '1';
  const excludeProvider = typeof req.query.excludeProvider === 'string' ? req.query.excludeProvider.trim() : '';
  const tokenData = await getOrFetchCdnToken(force, excludeProvider);
  const exposedExp = getSerializedExp(tokenData);
  const isPermanent = tokenData.cdnHost.includes('cdn77.org');
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  res.json({
    success: true,
    server: 'NeliTv Server',
    token: tokenData.token,
    cdnHost: tokenData.cdnHost,
    exp: exposedExp,
    expiresAt: new Date(exposedExp * 1000).toISOString(),
    neverExpires: isPermanent,
    source: tokenData.source,
    upstreamProvider: tokenData.upstreamProvider,
    provider: 'NeliTv Server',
    refreshIntervalSeconds: isPermanent ? 3600 : 45
  });
});

// Dynamic allowlist covering every channel CDN host in CHANNELS_DATA + permanent DASH origins
const ALLOWED_PROXY_DOMAINS = Array.from(
  new Set([
    'cdn77.org',
    'azamtvltd.co.tz',
    'streamzone.fun',
    'zapitv.com',
    'skygo.mn',
    'cloudfront.net',
    'akamaized.net',
    'warnermediacdn.com',
    'castr.net',
    'amagi.tv',
    'wurl.com',
    'amazonaws.com',
    'brightcove.com',
    'persiana.live',
    'bozztv.com',
    'smartplaytv.in',
    'aynaott.com',
    'cinerama.uz',
    'mangomolo.com',
    'freevisiontv.co.za',
    'wowza.com',
    'srvif.com',
    'boldmss.com',
    'wns.live',
    ...CHANNELS_DATA.flatMap((c) => {
      try {
        return c.streamUrl ? [new URL(c.streamUrl).hostname] : [];
      } catch {
        return [];
      }
    })
  ])
);

// Proxy relay signing & codec/DRM normalization helpers for Web, Android App & Android TV
const PROXY_RELAY_HMAC_SECRET = process.env.NELI_PROXY_SECRET || NELI_API_KEY;

function resolveProxyPublicOrigin(req: Request): string {
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  if (host) {
    const hostOnly = host.split(':')[0].toLowerCase();
    const isLoopback = hostOnly === 'localhost' || hostOnly === '127.0.0.1' || hostOnly === '[::1]';
    const proto = !isLoopback ? 'https' : forwardedProto === 'https' ? 'https' : req.protocol || 'http';
    return `${proto}://${host}`;
  }
  return PUBLIC_SITE_URL;
}

function createSignedProxyDirToken(baseDir: string, pt?: string): string {
  const payload = JSON.stringify({ d: baseDir, pt: pt || '' });
  const encoded = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = nodeCrypto
    .createHmac('sha256', PROXY_RELAY_HMAC_SECRET)
    .update(encoded)
    .digest('base64url')
    .slice(0, 16);
  return `${encoded}.${sig}`;
}

function verifySignedProxyDirToken(token: string): { dir: string; pt: string } | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = nodeCrypto
      .createHmac('sha256', PROXY_RELAY_HMAC_SECRET)
      .update(encoded)
      .digest('base64url')
      .slice(0, 16);
    if (sig.length !== expectedSig.length) return null;
    if (!nodeCrypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!decoded?.d || typeof decoded.d !== 'string') return null;
    return { dir: decoded.d, pt: typeof decoded.pt === 'string' ? decoded.pt : '' };
  } catch {
    return null;
  }
}

function isAllowedUpstreamHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return ALLOWED_PROXY_DOMAINS.some(
    (domain) => lower === domain || lower.endsWith('.' + domain) || lower.includes(domain)
  );
}

function isProxyRequestAuthorized(req: Request, hasValidRelayToken = false): boolean {
  const isBrowserAddressBarNav =
    req.get('sec-fetch-mode') === 'navigate' &&
    req.get('sec-fetch-dest') === 'document';
  if (isBrowserAddressBarNav) return false;

  const secFetchSite = req.get('sec-fetch-site') || '';
  const referer = req.get('referer') || req.get('origin') || '';
  const host = req.get('host') || '';
  const pt = typeof req.query.pt === 'string' ? req.query.pt : '';
  const validTicket = pt ? verifyClientToken(pt) : null;
  const reqApiKey = extractApiKeyFromReq(req);
  const clientHeader = (req.get('X-Neli-Client') || '').toLowerCase();
  const userAgent = (req.get('user-agent') || '').toLowerCase();
  const isNeliAppClient =
    clientHeader === 'nelitv-app' ||
    clientHeader === 'nelitv-web' ||
    req.query.app === 'nelitv' ||
    reqApiKey === NELI_API_KEY ||
    Boolean(reqApiKey && getDeveloperByApiKey(reqApiKey)) ||
    /nelitv|exoplayer|media3|dalvik|okhttp|cronet|dart|flutter|android|ktor|retrofit|lavf|vlc|applecoremedia|tizen|webos|smarttv|googletv|bravia/i.test(userAgent);

  return Boolean(
    hasValidRelayToken ||
    (validTicket && validTicket.scope === 'player-proxy') ||
    isNeliAppClient ||
    secFetchSite === 'same-origin' ||
    secFetchSite === 'same-site' ||
    referer.includes('nelitv.online') ||
    referer.includes('.run.app') ||
    referer.includes('.vercel.app') ||
    referer.includes('localhost') ||
    (host && referer.includes(host)) ||
    !req.headers.accept?.includes('text/html')
  );
}

async function fetchUpstreamWithAutoHeal(
  targetUrl: string,
  method: string,
  rangeHeader?: string
): Promise<{ response: globalThis.Response; activeUrl: string }> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': '*/*'
  };
  if (rangeHeader) {
    headers['Range'] = rangeHeader;
  }

  const doFetchOnce = async (urlToFetch: string, timeoutMs = 8500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(urlToFetch, {
        method: method === 'HEAD' ? 'HEAD' : 'GET',
        headers,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const doFetchWithRetries = async (urlToFetch: string): Promise<globalThis.Response> => {
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const resp = await doFetchOnce(urlToFetch, attempt === 0 ? 8000 : 9500);
        if (resp.ok || (resp.status >= 400 && resp.status < 500 && resp.status !== 429 && resp.status !== 408)) {
          return resp;
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, attempt === 0 ? 180 : 420));
          continue;
        }
        return resp;
      } catch (err: any) {
        lastErr = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, attempt === 0 ? 180 : 420));
        }
      }
    }
    throw lastErr || new Error('Upstream fetch failed');
  };

  let activeUrl = targetUrl;
  let response: globalThis.Response | null = null;
  let initialErr: any = null;

  try {
    response = await doFetchWithRetries(activeUrl);
  } catch (err: any) {
    initialErr = err;
  }

  const parsed = new URL(targetUrl);
  const failedStatus = !response || response.status === 401 || response.status === 403 || response.status === 429 || response.status >= 500;

  // Bidirectional Azam Failover: azamtvltd <-> cdn77.org
  if (failedStatus && parsed.hostname.includes('azamtvltd.co.tz')) {
    try {
      const cleanPath = parsed.pathname.replace(/^\/tok_[^/]+/, '');
      const cdn77Url = `${PERMANENT_CDN77_HOST}${cleanPath}${parsed.search}`;
      const r2 = await doFetchWithRetries(cdn77Url);
      if (r2.ok || !response) {
        activeUrl = cdn77Url;
        response = r2;
      }
    } catch {}
  } else if (failedStatus && parsed.hostname.includes('cdn77.org')) {
    try {
      const backupData = await getOrFetchCdnToken(true, 'cdn77');
      if (backupData.cdnHost.includes('azamtvltd') && backupData.token.includes('.')) {
        const cleanPath = parsed.pathname.replace(/^\/tok_[^/]+/, '');
        const backupUrl = `${backupData.cdnHost.replace(/\/+$/, '')}/tok_${backupData.token}${cleanPath}${parsed.search}`;
        const r2 = await doFetchWithRetries(backupUrl);
        if (r2.ok || !response) {
          activeUrl = backupUrl;
          response = r2;
        }
      }
    } catch {}
  }

  if (!response) {
    throw initialErr || new Error('All upstream origins unavailable');
  }

  return { response, activeUrl };
}

/**
 * Normalizes ClearKey-backed DASH MPDs for maximum compatibility across Web (Shaka),
 * Android App (ExoPlayer / Media3), and Android TV:
 * - Removes unlicensed Microsoft PlayReady / Nagra PRM / Widevine ContentProtection nodes
 *   while preserving standard MPEG-DASH cenc + injecting W3C ClearKey UUID.
 * - Strips fragmented wvtt MP4 subtitle AdaptationSets (which cause 96% / MediaCodec stalls on AzamOne & AzamTwo).
 * - Injects clean path-based HTTPS <BaseURL> so relative segment templates work seamlessly.
 */
function normalizeDashMpdForPlayback(
  rawXml: string,
  baseUrlForSegments: string,
  options: { raw?: boolean; keepSubtitles?: boolean } = {}
): string {
  let xml = rawXml;

  if (!options.raw && /cenc:default_KID=/i.test(xml)) {
    // Strip unlicensed PlayReady (9a04f079...), Nagra PRM (adb41c24...), and Widevine (edef8ba9...) blocks
    xml = xml
      .replace(
        /<ContentProtection\b[^>]*schemeIdUri="urn:uuid:(?:9a04f079-9840-4286-ab92-e65be0885f95|adb41c24-2dbf-4a6d-958b-4457c0d27b95|edef8ba9-79d6-4ace-a3c8-27dcd51d21ed)"[^>]*>[\s\S]*?<\/ContentProtection>/gi,
        ''
      )
      .replace(
        /<ContentProtection\b[^>]*schemeIdUri="urn:uuid:(?:9a04f079-9840-4286-ab92-e65be0885f95|adb41c24-2dbf-4a6d-958b-4457c0d27b95|edef8ba9-79d6-4ace-a3c8-27dcd51d21ed)"[^>]*\/>/gi,
        ''
      );

    // Ensure standard W3C ClearKey ContentProtection UUID is present alongside cenc
    if (!xml.includes('e2719d58-a985-b3c9-781a-b030af78d30e')) {
      xml = xml.replace(
        /(<ContentProtection\b[^>]*schemeIdUri="urn:mpeg:dash:mp4protection:2011"[^>]*\/>)/gi,
        '$1<ContentProtection schemeIdUri="urn:uuid:e2719d58-a985-b3c9-781a-b030af78d30e" value="ClearKey"/>'
      );
    }
  }

  // Strip wvtt MP4 subtitle AdaptationSet (known stall/codec issue on AzamOne & AzamTwo in ExoPlayer/WebView)
  if (!options.raw && !options.keepSubtitles) {
    xml = xml.replace(
      /<AdaptationSet\b[^>]*\bcontentType="text"[^>]*>[\s\S]*?<\/AdaptationSet>/gi,
      (block) => (/codecs="wvtt"|dfxp_/i.test(block) ? '' : block)
    );
  }

  // Replace or inject <BaseURL> cleanly under <MPD>
  if (/<BaseURL>[\s\S]*?<\/BaseURL>/i.test(xml)) {
    xml = xml.replace(/<BaseURL>[\s\S]*?<\/BaseURL>/i, `<BaseURL>${baseUrlForSegments}</BaseURL>`);
  } else {
    xml = xml.replace(/<MPD([^>]*)>/i, `<MPD$1>\n  <BaseURL>${baseUrlForSegments}</BaseURL>`);
  }

  return xml;
}

// 1.5a Path-based DASH/Media Segment Relay (Used by normalized <BaseURL> for Web, Android App & TV)
app.all('/api/proxy-relay/:dirToken/*', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Neli-Cache');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const parsedToken = verifySignedProxyDirToken(req.params.dirToken);
  if (!parsedToken) {
    return res.status(403).json({ error: 'Invalid proxy relay token' });
  }

  if (!isProxyRequestAuthorized(req, true)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const relPath = req.params[0] || '';
    const qsIdx = req.originalUrl.indexOf('?');
    const qs = qsIdx !== -1 ? req.originalUrl.slice(qsIdx) : '';
    const targetUrl = new URL(relPath + qs, parsedToken.dir).toString();
    const parsedTarget = new URL(targetUrl);

    if (!isAllowedUpstreamHost(parsedTarget.hostname)) {
      return res.status(403).json({ error: 'Host not allowed' });
    }

    const rangeHeader = req.headers.range as string | undefined;
    if (req.method === 'GET' && !rangeHeader) {
      const segKey = `relay:${targetUrl}`;
      const cachedEntry = segmentEdgeCache.get(segKey);
      if (cachedEntry) {
        res.status(cachedEntry.status);
        if (cachedEntry.contentType) res.setHeader('Content-Type', cachedEntry.contentType);
        res.setHeader('Content-Length', String(cachedEntry.bytes));
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=15');
        res.setHeader('X-Neli-Cache', 'hit');
        return res.send(cachedEntry.buffer);
      }

      segmentEdgeCache.misses += 1;
      const { response } = await fetchUpstreamWithAutoHeal(targetUrl, 'GET');
      if (!response.ok) {
        return res.status(response.status).json({ error: `Proxy relay failed: Upstream segment HTTP ${response.status}` });
      }
      res.status(response.status);
      const ctype = response.headers.get('content-type') || 'video/mp4';
      res.setHeader('Content-Type', ctype);
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      res.setHeader('Cache-Control', 'public, max-age=15');
      res.setHeader('X-Neli-Cache', 'miss');

      if (!response.body) {
        return res.end();
      }
      // Stream immediately byte-for-byte (zero buffering wait) while teeing chunks <= 2.5MB into edge cache
      // @ts-ignore
      const nodeStream = Readable.fromWeb(response.body);
      const chunks: Buffer[] = [];
      let totalTeeBytes = 0;
      let abortTee = false;
      nodeStream.on('data', (chunk: Buffer) => {
        if (abortTee) return;
        totalTeeBytes += chunk.length;
        if (totalTeeBytes > 2.5 * 1024 * 1024) {
          abortTee = true;
          chunks.length = 0;
        } else {
          chunks.push(chunk);
        }
      });
      nodeStream.on('end', () => {
        if (!abortTee && totalTeeBytes > 0) {
          segmentEdgeCache.set(segKey, Buffer.concat(chunks), ctype, response.status);
        }
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      req.on('close', () => {
        try { nodeStream.destroy(); } catch {}
      });
      return nodeStream.pipe(res);
    }

    const { response } = await fetchUpstreamWithAutoHeal(targetUrl, req.method, rangeHeader);

    res.status(response.status);
    const contentType = response.headers.get('content-type') || '';
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = response.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = response.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    if (req.method === 'HEAD') {
      return res.end();
    }

    if (response.body) {
      // @ts-ignore
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    console.warn('[Proxy relay error]:', err.message);
    if (!res.headersSent) {
      res.status(err?.upstreamStatus || 502).json({ error: 'Proxy relay failed: ' + err.message });
    }
  }
});

// 1.5 Streaming Proxy (Supports NeliTv Web Player, Official NeliTv APK & ExoPlayer/Media3/Android TV)
app.all('/api/proxy-stream', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type, X-Neli-Cache');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!isProxyRequestAuthorized(req, false)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Media streams are only accessible inside the official NeliTv Player or NeliTv App.',
      playerUrl: `${PUBLIC_SITE_URL}/`
    });
  }

  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  try {
    const parsed = new URL(targetUrl);
    if (!isAllowedUpstreamHost(parsed.hostname)) {
      return res.status(403).json({ error: 'Host not allowed' });
    }

    const proxyOrigin = resolveProxyPublicOrigin(req);
    const pt = typeof req.query.pt === 'string' ? req.query.pt : '';
    const ptParam = pt ? `&pt=${encodeURIComponent(pt)}` : '&app=nelitv';
    const lowerUrl = targetUrl.toLowerCase();
    const looksLikeMpd = lowerUrl.includes('.mpd');
    const looksLikeHls = lowerUrl.includes('.m3u8');
    const manifestCacheKey = `${proxyOrigin}|${ptParam}|${req.query.directSegments === '1' ? 'ds1' : 'ds0'}|${req.query.raw === '1' ? 'raw1' : 'raw0'}|${targetUrl}`;

    if (req.method === 'GET' && (looksLikeMpd || looksLikeHls)) {
      const cachedFresh = manifestEdgeCache.getFresh(manifestCacheKey);
      if (cachedFresh) {
        res.setHeader('Content-Type', cachedFresh.contentType);
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('X-Neli-Cache', 'hit');
        return res.status(200).send(cachedFresh.body);
      }

      try {
        const entry = await manifestEdgeCache.coalesce(manifestCacheKey, async () => {
          const { response, activeUrl: activeTargetUrl } = await fetchUpstreamWithAutoHeal(targetUrl, 'GET');
          if (!response.ok) {
            throw Object.assign(new Error(`Upstream manifest HTTP ${response.status}`), { upstreamStatus: response.status });
          }
          const contentType = response.headers.get('content-type') || '';
          const isMpdManifest = contentType.includes('dash+xml') || activeTargetUrl.toLowerCase().includes('.mpd');
          const isHlsManifest =
            contentType.includes('mpegurl') ||
            contentType.includes('x-mpegurl') ||
            activeTargetUrl.toLowerCase().includes('.m3u8');

          const rawText = await response.text();
          if (isMpdManifest) {
            const baseDir = activeTargetUrl.substring(0, activeTargetUrl.lastIndexOf('/') + 1);
            const useDirectSegments = req.query.directSegments === '1';
            const segmentBaseUrl = useDirectSegments
              ? baseDir
              : `${proxyOrigin}/api/proxy-relay/${createSignedProxyDirToken(baseDir, pt)}/`;
            const normalized = normalizeDashMpdForPlayback(rawText, segmentBaseUrl, {
              raw: req.query.raw === '1',
              keepSubtitles: req.query.keepSubtitles === '1'
            });
            return manifestEdgeCache.set(manifestCacheKey, normalized, 'application/dash+xml; charset=utf-8');
          }

          if (isHlsManifest || rawText.includes('#EXTM3U')) {
            const baseOriginUrl = response.url || activeTargetUrl;
            const makeProxyUrl = (absOrRel: string): string => {
              try {
                const resolved = new URL(absOrRel, baseOriginUrl).toString();
                return `${proxyOrigin}/api/proxy-stream?url=${encodeURIComponent(resolved)}${ptParam}`;
              } catch {
                return absOrRel;
              }
            };
            const rewritten = rawText
              .split(/\r?\n/)
              .map((line) => {
                const trimmed = line.trim();
                if (!trimmed) return line;
                if (trimmed.startsWith('#')) {
                  return line.replace(/URI="([^"]+)"/gi, (_m, rel) => `URI="${makeProxyUrl(rel)}"`);
                }
                return makeProxyUrl(trimmed);
              })
              .join('\n');
            return manifestEdgeCache.set(manifestCacheKey, rewritten, 'application/vnd.apple.mpegurl; charset=utf-8');
          }

          return null;
        });

        if (entry) {
          res.setHeader('Content-Type', entry.contentType);
          res.setHeader('Cache-Control', 'no-store, max-age=0');
          res.setHeader('X-Neli-Cache', 'miss');
          return res.status(200).send(entry.body);
        }
      } catch (manifestErr: any) {
        const staleFallback = manifestEdgeCache.getStaleFallback(manifestCacheKey);
        if (staleFallback) {
          res.setHeader('Content-Type', staleFallback.contentType);
          res.setHeader('Cache-Control', 'no-store, max-age=0');
          res.setHeader('X-Neli-Cache', 'stale-fallback');
          return res.status(200).send(staleFallback.body);
        }
        throw manifestErr;
      }
    }

    const rangeHeader = req.headers.range as string | undefined;
    if (req.method === 'GET' && !rangeHeader && !looksLikeMpd && !looksLikeHls) {
      const segKey = `seg:${targetUrl}`;
      const cachedSeg = segmentEdgeCache.get(segKey);
      if (cachedSeg) {
        res.status(cachedSeg.status);
        if (cachedSeg.contentType) res.setHeader('Content-Type', cachedSeg.contentType);
        res.setHeader('Content-Length', String(cachedSeg.bytes));
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=15');
        res.setHeader('X-Neli-Cache', 'hit');
        return res.send(cachedSeg.buffer);
      }

      segmentEdgeCache.misses += 1;
      const { response } = await fetchUpstreamWithAutoHeal(targetUrl, 'GET');
      if (!response.ok) {
        return res.status(response.status).json({ error: `Upstream segment HTTP ${response.status}` });
      }
      res.status(response.status);
      const ctype = response.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', ctype);
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const acceptRanges = response.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      res.setHeader('Cache-Control', 'public, max-age=15');
      res.setHeader('X-Neli-Cache', 'miss');

      if (!response.body) {
        return res.end();
      }
      // @ts-ignore
      const nodeStream = Readable.fromWeb(response.body);
      const chunks: Buffer[] = [];
      let totalTeeBytes = 0;
      let abortTee = false;
      nodeStream.on('data', (chunk: Buffer) => {
        if (abortTee) return;
        totalTeeBytes += chunk.length;
        if (totalTeeBytes > 2.5 * 1024 * 1024) {
          abortTee = true;
          chunks.length = 0;
        } else {
          chunks.push(chunk);
        }
      });
      nodeStream.on('end', () => {
        if (!abortTee && totalTeeBytes > 0) {
          segmentEdgeCache.set(segKey, Buffer.concat(chunks), ctype, response.status);
        }
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      req.on('close', () => {
        try { nodeStream.destroy(); } catch {}
      });
      return nodeStream.pipe(res);
    }

    const { response, activeUrl: activeTargetUrl } = await fetchUpstreamWithAutoHeal(
      targetUrl,
      req.method,
      rangeHeader
    );

    res.status(response.status);

    const contentType = response.headers.get('content-type') || '';
    const isMpdManifest = contentType.includes('dash+xml') || activeTargetUrl.toLowerCase().includes('.mpd');
    const isHlsManifest =
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl') ||
      activeTargetUrl.toLowerCase().includes('.m3u8');

    if (isMpdManifest) {
      res.setHeader('Content-Type', 'application/dash+xml; charset=utf-8');
    } else if (isHlsManifest) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
    } else if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    if (!isMpdManifest && !isHlsManifest) {
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
    }
    const contentRange = response.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    if (req.method === 'HEAD') {
      return res.end();
    }

    if (isMpdManifest) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      const rawText = await response.text();
      const baseDir = activeTargetUrl.substring(0, activeTargetUrl.lastIndexOf('/') + 1);
      const useDirectSegments = req.query.directSegments === '1';
      const segmentBaseUrl = useDirectSegments
        ? baseDir
        : `${proxyOrigin}/api/proxy-relay/${createSignedProxyDirToken(baseDir, pt)}/`;

      const normalized = normalizeDashMpdForPlayback(rawText, segmentBaseUrl, {
        raw: req.query.raw === '1',
        keepSubtitles: req.query.keepSubtitles === '1'
      });
      return res.send(normalized);
    }

    if (isHlsManifest) {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      const rawText = await response.text();
      const baseOriginUrl = response.url || activeTargetUrl;
      const makeProxyUrl = (absOrRel: string): string => {
        try {
          const resolved = new URL(absOrRel, baseOriginUrl).toString();
          return `${proxyOrigin}/api/proxy-stream?url=${encodeURIComponent(resolved)}${ptParam}`;
        } catch {
          return absOrRel;
        }
      };

      const rewritten = rawText
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/gi, (_m, rel) => `URI="${makeProxyUrl(rel)}"`);
          }
          return makeProxyUrl(trimmed);
        })
        .join('\n');
      return res.send(rewritten);
    }

    if (response.body) {
      // @ts-ignore
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    console.warn('[Proxy stream error]:', err.message);
    if (!res.headersSent) {
      res.status(err?.upstreamStatus || 502).json({ error: 'Proxy failed: ' + err.message });
    }
  }
});

// 2. Pricing Plans (Vifurushi)
app.get('/api/vifurushi', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: VIFURUSHI_PLANS
  });
});

// 2.5 Secure Subscription Check for Client (Supports both /check and /status)
app.get(['/api/subscription/check', '/api/subscription/status'], async (req: Request, res: Response) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  const identifier = phone || email;

  if (!identifier) {
    return res.json({ success: true, active: false, subscription: null });
  }

  // Support 10 Free VIP Accounts (user1@login.com to user10@login.com)
  if (isFreeAccountEmail(identifier)) {
    return res.json({
      success: true,
      active: true,
      subscription: {
        email: identifier,
        phone_number: identifier,
        plan_id: 'free_vip_lifetime',
        plan_name: FREE_PLAN_NAME,
        premium_status: 'active',
        expires_at: FREE_EXPIRATION_LIFETIME
      }
    });
  }

  try {
    let activeSub = await querySupabaseSubscription(identifier);
    const now = Date.now();

    if (!activeSub && phone) {
      const cleanP = normalizePhone(phone);
      const local = usersStore[cleanP];
      if (local && local.isSubscribed && local.subscriptionExpiresAt && new Date(local.subscriptionExpiresAt).getTime() > now) {
        activeSub = {
          phone_number: cleanP,
          user_email: email || undefined,
          plan_id: local.subscriptionPlan || 'plan_2days',
          premium_status: 'active',
          expires_at: local.subscriptionExpiresAt
        };
      }
    }

    const isActive = Boolean(
      activeSub &&
      activeSub.expires_at &&
      (activeSub.premium_status === 'active' || (activeSub.premium_status && activeSub.premium_status.toLowerCase() !== 'expired')) &&
      new Date(activeSub.expires_at).getTime() > now
    );

    return res.json({
      success: true,
      active: isActive,
      subscription: isActive ? activeSub : null
    });
  } catch (err: any) {
    return res.json({ success: false, active: false, subscription: null, error: err.message });
  }
});

// 2.6 Secure Subscription Save / Sync for Client (Executes on server; zero client exposure of DB credentials)
app.post('/api/subscription/save', async (req: Request, res: Response) => {
  const { phone, amount, email, orderId } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Namba ya simu inahitajika' });
  }

  try {
    const cleanPhone = normalizePhone(phone);
    const numAmount = Number(amount) || 1000;
    const subInfo = await saveOrExtendSupabaseSubscription(cleanPhone, numAmount, email, orderId);
    return res.json({
      success: true,
      subscription: subInfo,
      user: usersStore[cleanPhone]
    });
  } catch (err: any) {
    console.warn('[Subscription Save API Error]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2.7 Payments History for User (Retrieves unified payments from Supabase and local store)
app.get('/api/payments/history', async (req: Request, res: Response) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  const identifier = phone || email;

  if (!identifier) {
    return res.json({ success: true, payments: [] });
  }

  try {
    const payments = await fetchUserPayments(identifier);
    return res.json({
      success: true,
      payments
    });
  } catch (err: any) {
    console.warn('[Payments History Error]', err.message);
    return res.json({ success: false, payments: [], error: err.message });
  }
});

// 3. User Authentication / Profile with Supabase Cross-Device Sync
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { phone, deviceInfo } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ success: false, error: 'Tafadhali weka namba sahihi ya simu' });
  }

  const cleanPhone = normalizePhone(phone);
  if (cleanPhone.length < 10) {
    return res.status(400).json({ success: false, error: 'Namba ya simu lazima iwe na tarakimu 10 (mfano: 0712345678 au 0655...)' });
  }

  // 1. Query Supabase subscriptions table first for cross-device synchronization
  const sub = await querySupabaseSubscription(cleanPhone);
  const now = Date.now();
  const hasActiveSupabaseSub = Boolean(
    sub && sub.premium_status === 'active' && sub.expires_at && new Date(sub.expires_at).getTime() > now
  );

  let user = usersStore[cleanPhone];
  if (!user) {
    user = {
      phone: cleanPhone,
      createdDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      trialSecondsUsed: hasActiveSupabaseSub ? 60 : 0,
      trialCompleted: hasActiveSupabaseSub,
      isSubscribed: hasActiveSupabaseSub,
      subscriptionExpiresAt: hasActiveSupabaseSub ? sub!.expires_at : undefined,
      deviceInfo: deviceInfo || 'Web Browser'
    };
    usersStore[cleanPhone] = user;
    persistData();
  } else {
    user.lastActive = new Date().toISOString();
    if (hasActiveSupabaseSub) {
      user.isSubscribed = true;
      user.subscriptionExpiresAt = sub!.expires_at;
      user.trialCompleted = true;
    } else if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt).getTime() <= now) {
      user.isSubscribed = false;
    }
    persistData();
  }

  const userPayments = await fetchUserPayments(cleanPhone);

  res.json({
    success: true,
    user: {
      ...user,
      hasActiveSubscription: isSubscriptionValid(user),
      payments: userPayments
    }
  });
});

// 3.5 Link Phone Number to Account / Email with Supabase Sync
app.post('/api/auth/link-phone', async (req: Request, res: Response) => {
  const { phone, email } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ success: false, error: 'Namba ya simu inahitajika' });
  }

  const cleanPhone = normalizePhone(phone);
  const cleanEmail = email && typeof email === 'string' ? email.trim().toLowerCase() : '';

  // Update or create user in usersStore
  let user = usersStore[cleanPhone];
  if (!user) {
    user = {
      phone: cleanPhone,
      createdDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      trialSecondsUsed: 60,
      trialCompleted: true,
      isSubscribed: false,
      deviceInfo: 'Web / Cross-Device Link'
    };
    usersStore[cleanPhone] = user;
  }
  user.lastActive = new Date().toISOString();
  persistData();

  let activeSub: any = null;

  // Supabase linking
  if (supabase) {
    try {
      // 1. Check if phone has active subscription in nelitv_subscriptions
      const phoneSub = await querySupabaseSubscription(cleanPhone);
      if (phoneSub && cleanEmail) {
        // Link email into this subscription row!
        await supabase
          .from('nelitv_subscriptions')
          .update({ user_email: cleanEmail, updated_at: new Date().toISOString() })
          .in('phone_number', getPhoneVariants(cleanPhone));
        activeSub = phoneSub;
        activeSub.user_email = cleanEmail;
      }

      // 2. Also check if email has an active subscription in nelitv_subscriptions
      if (!activeSub && cleanEmail) {
        const emailSub = await querySupabaseSubscription(cleanEmail);
        if (emailSub) {
          // Link phone into this subscription row!
          await supabase
            .from('nelitv_subscriptions')
            .update({ phone_number: cleanPhone, updated_at: new Date().toISOString() })
            .ilike('user_email', cleanEmail);
          activeSub = emailSub;
          activeSub.phone_number = cleanPhone;
        }
      }
    } catch (e: any) {
      console.warn('[Link-Phone Supabase error]', e.message);
    }
  }

  // Update local user subscription ONLY if genuinely active and paid (not expired or unpaid)
  const now = Date.now();
  const isReallyActive = Boolean(
    activeSub &&
    activeSub.expires_at &&
    (activeSub.premium_status === 'active' || (activeSub.premium_status && activeSub.premium_status.toLowerCase() !== 'expired')) &&
    new Date(activeSub.expires_at).getTime() > now
  );

  if (isReallyActive) {
    user.isSubscribed = true;
    user.subscriptionPlan = activeSub.plan_id || activeSub.plan_name || 'Kifurushi Hai';
    user.subscriptionExpiresAt = activeSub.expires_at;
  } else {
    // Unpaid numbers must never pass or become active
    user.isSubscribed = false;
    user.subscriptionExpiresAt = undefined;
  }
  persistData();

  res.json({
    success: true,
    hasActiveSubscription: isReallyActive,
    phone: cleanPhone,
    email: cleanEmail,
    user,
    subscription: isReallyActive ? activeSub : null
  });
});

// 4. Update trial seconds
app.post('/api/auth/update-trial', (req: Request, res: Response) => {
  const { phone, secondsWatched } = req.body;
  if (!phone) return res.status(400).json({ success: false, error: 'Phone missing' });

  const cleanPhone = normalizePhone(phone);
  const user = usersStore[cleanPhone];

  if (!user) {
    return res.status(404).json({ success: false, error: 'Mtumiaji hajapatikana' });
  }

  // If already subscribed, trial is irrelevant
  if (isSubscriptionValid(user)) {
    return res.json({
      success: true,
      hasActiveSubscription: true,
      trialRemainingSeconds: 0,
      trialCompleted: true
    });
  }

  user.trialSecondsUsed = Math.min(60, (user.trialSecondsUsed || 0) + (Number(secondsWatched) || 1));
  if (user.trialSecondsUsed >= 60) {
    user.trialCompleted = true;
  }
  persistData();

  res.json({
    success: true,
    hasActiveSubscription: false,
    trialSecondsUsed: user.trialSecondsUsed,
    trialRemainingSeconds: Math.max(0, 60 - user.trialSecondsUsed),
    trialCompleted: user.trialCompleted
  });
});


// ==========================================
// 5. FREE NELITV CONTENT API & PLAYER API (v1 + Developer Portal)
// All endpoints anchored to PUBLIC_SITE_URL (https://nelitv.online)
// Raw streams & DRM keys are strictly NOT accessible outside NeliTv Player/API.
// ==========================================

export const DEVELOPER_API_PLANS = [
  {
    id: 'plan_api_free',
    name: 'NeliTv Free Content & Player API',
    priceTsh: 0,
    durationDays: 36500,
    bonusAppDays: 36500,
    description: '100% Bure: Content API + Official NeliTv Player API & SDK (zote zikicheza kupitia NeliTv Player pekee)'
  }
];

function generateDeveloperApiKey(): string {
  return 'neli_free_' + nodeCrypto.randomBytes(16).toString('hex');
}

function getDeveloperByApiKey(apiKey?: string): DeveloperUser | null {
  if (!apiKey) return null;
  const cleanKey = apiKey.trim();
  if (cleanKey === 'neli_live_sk_admin_api_vip_001' || cleanKey === 'neli_free_public_demo') {
    return developerUsersStore['adminapi@login.com'] || {
      id: 'dev_free_public',
      email: 'free@nelitv.online',
      name: 'NeliTv Free API Developer',
      apiKey: cleanKey,
      isSubscribed: true,
      subscriptionPlan: 'plan_api_free',
      subscriptionExpiresAt: '2099-12-31T23:59:59.000Z',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
  }
  const found = Object.values(developerUsersStore).find(u => u.apiKey === cleanKey);
  if (found) {
    // API is 100% FREE now: every valid key stays active without payment
    found.isSubscribed = true;
    if (!found.subscriptionPlan) found.subscriptionPlan = 'plan_api_free';
    if (!found.subscriptionExpiresAt) found.subscriptionExpiresAt = '2099-12-31T23:59:59.000Z';
    return found;
  }
  return null;
}

function extractApiKeyFromReq(req: Request): string {
  const auth = req.headers['authorization'];
  const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return String(
    req.headers['x-neli-api-key'] ||
    req.headers['x-api-key'] ||
    bearer ||
    req.query.api_key ||
    ''
  ).trim();
}

/**
 * Formats a channel for the public Content API.
 * STRICTLY omits raw streamUrl, tokenizedUrl, audioUrl, clearKeys, and upstream embedUrl
 * so streams are NEVER accessible outside NeliTv's own Player.
 */
function toSafeContentItem(ch: typeof CHANNELS_DATA[number], apiKey?: string) {
  const slug = getChannelRouteSlug(ch);
  const keyParam = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : '';
  const embedParams = new URLSearchParams({ autoplay: '1' });
  if (apiKey) embedParams.set('api_key', apiKey);

  return {
    id: ch.id,
    slug,
    name: ch.name,
    description: ch.description,
    category: ch.category,
    language: ch.language,
    thumbnailUrl: ch.thumbnailUrl,
    viewerCount: ch.viewerCount,
    totalViews: ch.totalViews,
    currentProgram: ch.currentProgram || 'Matangazo ya Moja kwa Moja',
    nextProgram: ch.nextProgram || 'Kipindi Kinachofuata',
    isLive: true,
    playbackEngine: 'nelitv-player-only',
    endpoints: {
      self: `${PUBLIC_SITE_URL}/api/v1/content/${slug}${keyParam}`,
      playerApi: `${PUBLIC_SITE_URL}/api/v1/player/${slug}${keyParam}`,
      playerEmbed: `${PUBLIC_SITE_URL}/embed/${slug}?${embedParams.toString()}`,
      watchPage: `${PUBLIC_SITE_URL}/${slug}`
    }
  };
}

function buildPlayerApiPayload(ch: typeof CHANNELS_DATA[number], opts: { autoplay: boolean; muted: boolean; width: string; height: string; apiKey?: string }) {
  const slug = getChannelRouteSlug(ch);
  const embedQuery = new URLSearchParams({
    autoplay: opts.autoplay ? '1' : '0'
  });
  if (opts.muted) embedQuery.set('muted', '1');
  if (opts.apiKey) embedQuery.set('api_key', opts.apiKey);

  const embedUrl = `${PUBLIC_SITE_URL}/embed/${slug}?${embedQuery.toString()}`;
  const sdkUrl = `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`;

  // Short-lived opaque ticket proving caller obtained playback config via Player API (contains zero raw stream data)
  const playerTicket = signClientToken({
    scope: 'nelitv-player-embed',
    channelId: ch.id,
    slug,
    apiKey: opts.apiKey || 'free'
  }, 4 * 3600);

  const iframeHtml = `<iframe src="${embedUrl}" width="${opts.width}" height="${opts.height}" frameborder="0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen title="${ch.name} | NeliTv Player"></iframe>`;

  const sdkCode = `<script src="${sdkUrl}"></script>\n<div id="nelitv-player"></div>\n<script>\n  new NeliTvPlayer('#nelitv-player', {\n    channel: '${slug}',\n    width: '${opts.width}',\n    height: '${opts.height}',\n    autoplay: ${opts.autoplay}${opts.apiKey ? `,\n    apiKey: '${opts.apiKey}'` : ''}\n  });\n</script>`;

  return {
    success: true,
    pricing: 'free',
    provider: 'NeliTv',
    baseUrl: PUBLIC_SITE_URL,
    playbackRestriction: 'Streams play exclusively inside NeliTv Official Player and are not accessible outside the Player/API.',
    channel: {
      id: ch.id,
      slug,
      name: ch.name,
      description: ch.description,
      thumbnailUrl: ch.thumbnailUrl,
      category: ch.category,
      language: ch.language,
      currentProgram: ch.currentProgram || 'Matangazo ya Moja kwa Moja',
      nextProgram: ch.nextProgram || 'Kipindi Kinachofuata',
      isLive: true
    },
    player: {
      type: 'nelitv-official-player',
      embedUrl,
      sdkUrl,
      contentUrl: `${PUBLIC_SITE_URL}/api/v1/content/${slug}`,
      playerApiUrl: `${PUBLIC_SITE_URL}/api/v1/player/${slug}`,
      playerTicket,
      width: opts.width,
      height: opts.height,
      autoplay: opts.autoplay,
      abrProfile: {
        mode: 'youtube-stable',
        initialQualityTarget: '480p',
        switchIntervalMs: 18000,
        backgroundSilentSwitch: true,
        hideSpinnerDuringAbrSwitch: true
      },
      iframeHtml,
      sdkCode
    }
  };
}

// 5.0 Public v1 API Discovery Index (https://nelitv.online/api/v1)
app.get(['/api/v1', '/api/v1/'], (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    success: true,
    name: 'NeliTv Free Content & Player API',
    version: '1.0.0',
    pricing: '100% Free',
    baseUrl: PUBLIC_SITE_URL,
    securityPolicy: 'Raw stream URLs and DRM keys are strictly locked inside the NeliTv Player and cannot be accessed outside the Player/API.',
    endpoints: {
      root: `${PUBLIC_SITE_URL}/api/v1`,
      freeApiKey: `${PUBLIC_SITE_URL}/api/v1/keys/free`,
      contentList: `${PUBLIC_SITE_URL}/api/v1/content`,
      contentCategories: `${PUBLIC_SITE_URL}/api/v1/content/categories`,
      contentByChannel: `${PUBLIC_SITE_URL}/api/v1/content/{slug}`,
      playerIndex: `${PUBLIC_SITE_URL}/api/v1/player`,
      playerByChannel: `${PUBLIC_SITE_URL}/api/v1/player/{slug}`,
      playerSdkJs: `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`,
      playerEmbedIframe: `${PUBLIC_SITE_URL}/embed/{slug}`
    },
    totalChannels: CHANNELS_DATA.length
  });
});

// 5.0b Instant Free API Key Issuance (POST /api/v1/keys/free)
app.post('/api/v1/keys/free', (req: Request, res: Response) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const cleanEmail = rawEmail || `dev_${Date.now()}@nelitv.online`;

  let devUser = developerUsersStore[cleanEmail];
  if (!devUser) {
    devUser = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      name: rawName || cleanEmail.split('@')[0],
      apiKey: generateDeveloperApiKey(),
      isSubscribed: true,
      subscriptionPlan: 'plan_api_free',
      subscriptionExpiresAt: '2099-12-31T23:59:59.000Z',
      createdAt: new Date().toISOString()
    };
    developerUsersStore[cleanEmail] = devUser;
  } else {
    devUser.isSubscribed = true;
    devUser.subscriptionPlan = 'plan_api_free';
    devUser.subscriptionExpiresAt = '2099-12-31T23:59:59.000Z';
    if (!devUser.apiKey || req.body?.regenerate) {
      devUser.apiKey = generateDeveloperApiKey();
    }
  }
  persistData();

  res.json({
    success: true,
    pricing: 'free',
    message: 'API Key yako ya bure iko tayari kutumika!',
    apiKey: devUser.apiKey,
    user: devUser,
    endpoints: {
      contentApi: `${PUBLIC_SITE_URL}/api/v1/content?api_key=${devUser.apiKey}`,
      playerApi: `${PUBLIC_SITE_URL}/api/v1/player/azam-sports-1-hd?api_key=${devUser.apiKey}`,
      playerSdk: `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`
    }
  });
});

// 5.0c CONTENT API: List Categories
app.get('/api/v1/content/categories', (_req: Request, res: Response) => {
  const counts: Record<string, number> = {};
  CHANNELS_DATA.forEach((ch) => {
    ch.category.forEach((cat) => {
      counts[cat] = (counts[cat] || 0) + 1;
    });
  });

  const categories = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      count,
      url: `${PUBLIC_SITE_URL}/api/v1/content?category=${encodeURIComponent(id)}`
    }));

  res.json({
    success: true,
    pricing: 'free',
    baseUrl: PUBLIC_SITE_URL,
    totalCategories: categories.length,
    categories
  });
});

// 5.0d CONTENT API: List Channels (Safe metadata + NeliTv Player/API links ONLY)
app.get(['/api/v1/content', '/api/v1/content/channels'], (req: Request, res: Response) => {
  const apiKey = extractApiKeyFromReq(req);
  const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
  const language = typeof req.query.language === 'string' ? req.query.language.trim().toLowerCase() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const limit = req.query.limit ? Math.max(1, Math.min(200, Number(req.query.limit) || 200)) : 200;

  let filtered = CHANNELS_DATA.filter((ch) => ch.isActive !== false);

  if (category && category !== 'all') {
    filtered = filtered.filter((ch) =>
      category === 'azam'
        ? Boolean(ch.isAzam || ch.name.toLowerCase().includes('azam'))
        : ch.category.some((c) => c.toLowerCase() === category)
    );
  }
  if (language && language !== 'all') {
    filtered = filtered.filter((ch) => ch.language.toLowerCase() === language);
  }
  if (q) {
    filtered = filtered.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.description.toLowerCase().includes(q) ||
        (ch.currentProgram && ch.currentProgram.toLowerCase().includes(q))
    );
  }

  const items = filtered.slice(0, limit).map((ch) => toSafeContentItem(ch, apiKey || undefined));

  res.json({
    success: true,
    pricing: 'free',
    provider: 'NeliTv',
    baseUrl: PUBLIC_SITE_URL,
    playbackPolicy: 'nelitv-player-only',
    total: items.length,
    endpoints: {
      sdk: `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`,
      categories: `${PUBLIC_SITE_URL}/api/v1/content/categories`
    },
    channels: items
  });
});

// 5.0e CONTENT API: Single Channel Detail + Player Links
app.get('/api/v1/content/:slug', (req: Request, res: Response) => {
  const apiKey = extractApiKeyFromReq(req);
  const channel = findChannelFromRoute(req.params.slug, CHANNELS_DATA);
  if (!channel) {
    return res.status(404).json({
      success: false,
      error: 'Kituo hakijapatikana',
      contentApi: `${PUBLIC_SITE_URL}/api/v1/content`
    });
  }

  const item = toSafeContentItem(channel, apiKey || undefined);
  const playerPayload = buildPlayerApiPayload(channel, {
    autoplay: true,
    muted: false,
    width: '100%',
    height: '480px',
    apiKey: apiKey || undefined
  });

  res.json({
    success: true,
    pricing: 'free',
    baseUrl: PUBLIC_SITE_URL,
    playbackPolicy: 'nelitv-player-only',
    channel: item,
    player: playerPayload.player
  });
});

// 5.0f PLAYER API SDK Distribution (Registered BEFORE /api/v1/player/:slug!)
function servePlayerSdk(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=1800');

  const sdkCode = `/**
 * NeliTv Official Player SDK v2.0 (100% Free)
 * Streams play exclusively inside NeliTv Player.
 * ${PUBLIC_SITE_URL}/api
 */
(function(window, document) {
  var DEFAULT_BASE_URL = "${PUBLIC_SITE_URL}";

  function resolveBaseUrl(options) {
    if (options && options.baseUrl) {
      return String(options.baseUrl).replace(/\\/+$/, "");
    }
    return DEFAULT_BASE_URL;
  }

  function NeliTvPlayer(target, options) {
    options = options || {};
    var baseUrl = resolveBaseUrl(options);
    var channel = options.channel || options.slug || "azam-sports-1-hd";
    var width = options.width || "100%";
    var height = options.height || "480px";
    var autoplay = options.autoplay !== false;
    var muted = options.muted === true;
    var apiKey = options.apiKey || "";

    var el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) {
      console.error("[NeliTvPlayer] Target element not found:", target);
      return;
    }

    function buildEmbedSrc(chSlug) {
      var url = baseUrl + "/embed/" + encodeURIComponent(chSlug) + "?autoplay=" + (autoplay ? "1" : "0");
      if (muted) url += "&muted=1";
      if (apiKey) url += "&api_key=" + encodeURIComponent(apiKey);
      return url;
    }

    var iframe = document.createElement("iframe");
    iframe.src = buildEmbedSrc(channel);
    iframe.style.width = width;
    iframe.style.height = height;
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.style.borderRadius = options.borderRadius || "16px";
    iframe.style.backgroundColor = "#050611";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
    iframe.setAttribute("title", "NeliTv Player - " + channel);

    el.innerHTML = "";
    el.appendChild(iframe);

    this.iframe = iframe;
    this.channel = channel;
    this.baseUrl = baseUrl;
    this.reload = function() {
      iframe.src = iframe.src;
    };
    this.changeChannel = function(newChannel) {
      channel = newChannel;
      this.channel = newChannel;
      iframe.src = buildEmbedSrc(newChannel);
    };
    this.destroy = function() {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  }

  window.NeliTvPlayer = NeliTvPlayer;
})(window, document);
`;
  res.send(sdkCode);
}

app.get('/api/v1/player/sdk.js', servePlayerSdk);
app.get('/api/developer/player-sdk.js', servePlayerSdk);

// 5.0g PLAYER API Index
app.get(['/api/v1/player', '/api/v1/player/'], (req: Request, res: Response) => {
  const apiKey = extractApiKeyFromReq(req);
  const keyParam = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : '';

  res.json({
    success: true,
    pricing: 'free',
    provider: 'NeliTv',
    baseUrl: PUBLIC_SITE_URL,
    sdkUrl: `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`,
    playbackRestriction: 'Direct raw stream URLs are disabled. All playback must run through the NeliTv Player API / Embed.',
    exampleUsage: `${PUBLIC_SITE_URL}/api/v1/player/azam-sports-1-hd${keyParam}`,
    players: CHANNELS_DATA.slice(0, 20).map((ch) => {
      const slug = getChannelRouteSlug(ch);
      return {
        id: ch.id,
        slug,
        name: ch.name,
        playerApiUrl: `${PUBLIC_SITE_URL}/api/v1/player/${slug}${keyParam}`,
        embedUrl: `${PUBLIC_SITE_URL}/embed/${slug}${keyParam}`
      };
    })
  });
});

// 5.0h PLAYER API Single Channel Embed & Player Config
app.get('/api/v1/player/:slug', (req: Request, res: Response) => {
  const apiKey = extractApiKeyFromReq(req);
  const channel = findChannelFromRoute(req.params.slug, CHANNELS_DATA);
  if (!channel) {
    return res.status(404).json({
      success: false,
      error: 'Kituo hakijapatikana kwenye Player API',
      playerIndex: `${PUBLIC_SITE_URL}/api/v1/player`
    });
  }

  const autoplay = req.query.autoplay !== '0' && req.query.autoplay !== 'false';
  const muted = req.query.muted === '1' || req.query.muted === 'true';
  const width = typeof req.query.width === 'string' ? req.query.width : '100%';
  const height = typeof req.query.height === 'string' ? req.query.height : '480px';

  res.json(
    buildPlayerApiPayload(channel, {
      autoplay,
      muted,
      width,
      height,
      apiKey: apiKey || undefined
    })
  );
});

// Block any attempt to access raw streams outside NeliTv Player / API
app.all(['/api/v1/stream', '/api/v1/stream/*', '/api/stream', '/api/stream/*'], (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: 'Streams are not accessible outside the official NeliTv Player & API.',
    playerApi: `${PUBLIC_SITE_URL}/api/v1/player/azam-sports-1-hd`,
    contentApi: `${PUBLIC_SITE_URL}/api/v1/content`
  });
});

// 5.1 Developer Plans (100% Free Now)
app.get('/api/developer/plans', (_req: Request, res: Response) => {
  res.json({ success: true, pricing: 'free', plans: DEVELOPER_API_PLANS });
});

// 5.2 Developer Auth / Sign-in (Free Unlimited API Access automatically)
app.post('/api/developer/auth/login', (req: Request, res: Response) => {
  const { email, password, googleUser } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, error: 'Barua pepe (email) inahitajika' });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (cleanEmail === 'adminapi@login.com') {
    if (password && password !== '123Free') {
      return res.status(401).json({ success: false, error: 'Nenosiri la akaunti ya adminapi si sahihi. Tumia: 123Free' });
    }
    const adminDev = developerUsersStore['adminapi@login.com'];
    return res.json({
      success: true,
      message: 'Umeingia kama Admin API Developer (Free Unlimited)!',
      user: adminDev
    });
  }

  let devUser = developerUsersStore[cleanEmail];
  if (!devUser) {
    devUser = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      password: password || 'oauth_google',
      name: googleUser?.displayName || cleanEmail.split('@')[0],
      apiKey: generateDeveloperApiKey(),
      isSubscribed: true,
      subscriptionPlan: 'plan_api_free',
      subscriptionExpiresAt: '2099-12-31T23:59:59.000Z',
      createdAt: new Date().toISOString()
    };
    developerUsersStore[cleanEmail] = devUser;
    persistData();
  } else {
    if (password && devUser.password && devUser.password !== 'oauth_google' && devUser.password !== password) {
      return res.status(401).json({ success: false, error: 'Nenosiri si sahihi' });
    }
    devUser.isSubscribed = true;
    devUser.subscriptionPlan = 'plan_api_free';
    devUser.subscriptionExpiresAt = '2099-12-31T23:59:59.000Z';
    if (!devUser.apiKey) devUser.apiKey = generateDeveloperApiKey();
    persistData();
  }

  res.json({
    success: true,
    message: 'Umeingia kikamilifu — API ni 100% Bure!',
    user: devUser
  });
});

// 5.3 Developer Profile & Key Query
app.get('/api/developer/profile', (req: Request, res: Response) => {
  const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  const apiKey = typeof req.query.api_key === 'string' ? req.query.api_key.trim() : '';

  let devUser: DeveloperUser | null = null;
  if (email && developerUsersStore[email]) {
    devUser = developerUsersStore[email];
  } else if (apiKey) {
    devUser = getDeveloperByApiKey(apiKey);
  }

  if (!devUser) {
    return res.status(404).json({ success: false, error: 'Mtumiaji wa API hajapatikana' });
  }

  devUser.isSubscribed = true;
  res.json({
    success: true,
    user: devUser,
    isActive: true,
    pricing: 'free'
  });
});

// 5.4 Generate or Regenerate Free API Key (No payment required!)
app.post('/api/developer/keys/generate', (req: Request, res: Response) => {
  const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const cleanEmail = rawEmail || `dev_${Date.now()}@nelitv.online`;

  let devUser = developerUsersStore[cleanEmail];
  if (!devUser) {
    devUser = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      apiKey: generateDeveloperApiKey(),
      isSubscribed: true,
      subscriptionPlan: 'plan_api_free',
      subscriptionExpiresAt: '2099-12-31T23:59:59.000Z',
      createdAt: new Date().toISOString()
    };
    developerUsersStore[cleanEmail] = devUser;
  } else {
    devUser.isSubscribed = true;
    devUser.subscriptionPlan = 'plan_api_free';
    devUser.subscriptionExpiresAt = '2099-12-31T23:59:59.000Z';
    devUser.apiKey = generateDeveloperApiKey();
  }
  persistData();

  res.json({
    success: true,
    pricing: 'free',
    message: 'API Key mpya ya bure imezalishwa kikamilifu!',
    apiKey: devUser.apiKey,
    user: devUser
  });
});

// 5.7 Developer Content API Alias (Safe metadata + NeliTv Player URLs ONLY — no raw stream leaks!)
app.get('/api/developer/channels', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  const apiKey = extractApiKeyFromReq(req);
  const devUser = apiKey ? getDeveloperByApiKey(apiKey) : null;

  const safeChannels = CHANNELS_DATA.map((ch) => toSafeContentItem(ch, apiKey || undefined));

  res.json({
    success: true,
    status: 'online',
    pricing: 'free',
    baseUrl: PUBLIC_SITE_URL,
    playbackPolicy: 'nelitv-player-only',
    developer: devUser
      ? {
          email: devUser.email,
          plan: 'NeliTv Free API'
        }
      : { plan: 'NeliTv Free Public API' },
    totalChannels: safeChannels.length,
    endpoints: {
      contentApi: `${PUBLIC_SITE_URL}/api/v1/content`,
      playerApi: `${PUBLIC_SITE_URL}/api/v1/player/azam-sports-1-hd`,
      playerSdk: `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`
    },
    channels: safeChannels
  });
});

// 5.8 Block Raw CDN Token Endpoint outside NeliTv Player
app.get('/api/developer/cdn-token', (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: 'Raw CDN tokens are restricted and not accessible outside NeliTv Player. Use NeliTv Player API or SDK instead.',
    playerApi: `${PUBLIC_SITE_URL}/api/v1/player/azam-sports-1-hd`,
    playerSdk: `${PUBLIC_SITE_URL}/api/v1/player/sdk.js`
  });
});

// 6. HarakaPay Collect Payment (USSD Push)
app.post('/api/harakapay/collect', async (req: Request, res: Response) => {
  try {
    const { phone, planId } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Namba ya simu inahitajika' });
    }

    const cleanPhone = normalizePhone(phone);
    const plan = VIFURUSHI_PLANS.find(p => p.id === planId) || VIFURUSHI_PLANS[0];

    const description = `NeliTv: ${plan.name} (${plan.durationText}) kwa namba ${cleanPhone}`;

    // Get current host for webhook if available
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const webhookUrl = `${protocol}://${host}/api/harakapay/webhook`;

    console.log(`[HarakaPay] Sending collect request: phone=${cleanPhone}, amount=${plan.priceTsh}`);

    const response = await fetch(`${HARAKAPAY_BASE_URL}/api/v1/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HARAKAPAY_API_KEY
      },
      body: JSON.stringify({
        phone: cleanPhone,
        amount: plan.priceTsh,
        description: description,
        webhook_url: webhookUrl
      })
    });

    const data: any = await response.json();
    console.log('[HarakaPay Response]', data);

    if (data.success && data.order_id) {
      const record: PaymentRecord = {
        orderId: data.order_id,
        phone: cleanPhone,
        amount: data.amount || plan.priceTsh,
        planId: plan.id,
        planName: plan.name,
        durationDays: plan.durationDays,
        status: 'pending',
        createdAt: new Date().toISOString(),
        rawResponse: data
      };

      paymentsStore[data.order_id] = record;
      persistData();

      // Log pending payment into Supabase nelitv_payments table
      if (supabase) {
        try {
          const { error: insErr } = await supabase
            .from('nelitv_payments')
            .upsert({
              order_id: data.order_id,
              phone_number: cleanPhone,
              amount: data.amount || plan.priceTsh,
              plan_id: plan.id,
              status: 'pending',
              payment_method: 'harakapay',
              created_at: new Date().toISOString()
            }, { onConflict: 'order_id' });
          if (insErr) console.warn('[Supabase nelitv_payments pending log err]', insErr.message);
          else console.log(`[Supabase nelitv_payments] Logged pending order ${data.order_id}`);
        } catch (e: any) {
          console.warn('[Supabase nelitv_payments pending exception]', e.message);
        }
      }

      return res.json({
        success: true,
        orderId: data.order_id,
        amount: data.amount || plan.priceTsh,
        message: data.message || 'USSD push imetumwa kwenye simu yako. Tafadhali ingiza PIN kuthibitisha.',
        phone: cleanPhone,
        plan: plan
      });
    } else {
      const rawErr = String(data.message || data.error || '');
      const isOngoingUssd = /on\s*going\s*ussd|ongoing\s*ussd|another\s*on\s*going/i.test(rawErr);

      if (isOngoingUssd) {
        // User's phone already received a USSD prompt and the session is waiting for PIN
        const existingPending = Object.values(paymentsStore)
          .filter(p => p.phone === cleanPhone && (p.status === 'pending' || (Date.now() - new Date(p.createdAt).getTime()) < 10 * 60 * 1000))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        const orderIdToUse = existingPending ? existingPending.orderId : `HP-ACTIVE-${Date.now()}`;
        if (!existingPending) {
          paymentsStore[orderIdToUse] = {
            orderId: orderIdToUse,
            phone: cleanPhone,
            amount: plan.priceTsh,
            planId: plan.id,
            planName: plan.name,
            durationDays: plan.durationDays,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          persistData();
        }

        console.log(`[HarakaPay] Ongoing USSD session for ${cleanPhone}. Routing to order ${orderIdToUse}`);
        return res.json({
          success: true,
          orderId: orderIdToUse,
          amount: (existingPending && existingPending.amount) || plan.priceTsh,
          message: 'Kuna ombi la USSD ambalo tayari lipo wazi kwenye simu yako! Tafadhali fungua simu yako uweke PIN ya malipo.',
          phone: cleanPhone,
          plan: plan,
          isOngoingSession: true
        });
      }

      return res.status(400).json({
        success: false,
        error: rawErr || 'Imeshindikana kutuma ombi la malipo. Hakikisha namba yako ina salio au imesajiliwa na huduma za kifedha (M-Pesa, Tigo Pesa, Airtel Money, Halopesa).'
      });
    }
  } catch (error: any) {
    console.error('[HarakaPay Error]', error);
    res.status(500).json({
      success: false,
      error: 'Hitilafu ya mtandao wakati wa kuwasiliana na HarakaPay: ' + (error.message || 'Jaribu tena.')
    });
  }
});

// 6b. HarakaPay Resend USSD Push (Multi USSD Push support)
app.post('/api/harakapay/resend-push', async (req: Request, res: Response) => {
  try {
    const { phone, planId, amount } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Namba ya simu inahitajika' });
    }

    const cleanPhone = normalizePhone(phone);
    let plan = VIFURUSHI_PLANS.find(p => p.id === planId);
    if (!plan && amount) {
      plan = VIFURUSHI_PLANS.find(p => p.priceTsh === Number(amount));
    }
    if (!plan) plan = VIFURUSHI_PLANS[0];

    const description = `NeliTv (Tuma Tena): ${plan.name} kwa namba ${cleanPhone}`;
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const webhookUrl = `${protocol}://${host}/api/harakapay/webhook`;

    console.log(`[HarakaPay Resend Push] Phone=${cleanPhone}, Amount=${plan.priceTsh}`);

    const response = await fetch(`${HARAKAPAY_BASE_URL}/api/v1/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': HARAKAPAY_API_KEY
      },
      body: JSON.stringify({
        phone: cleanPhone,
        amount: plan.priceTsh,
        description: description,
        webhook_url: webhookUrl
      })
    });

    const data: any = await response.json();
    console.log('[HarakaPay Resend Response]', data);

    if (data.success && data.order_id) {
      const record: PaymentRecord = {
        orderId: data.order_id,
        phone: cleanPhone,
        amount: data.amount || plan.priceTsh,
        planId: plan.id,
        planName: plan.name,
        durationDays: plan.durationDays,
        status: 'pending',
        createdAt: new Date().toISOString(),
        rawResponse: data
      };

      paymentsStore[data.order_id] = record;
      persistData();

      return res.json({
        success: true,
        orderId: data.order_id,
        amount: data.amount || plan.priceTsh,
        message: 'Ombi jipya la USSD limetumwa kwenye simu yako! Tafadhali weka PIN sasa.',
        phone: cleanPhone,
        plan: plan
      });
    } else {
      const rawErr = String(data.message || data.error || '');
      const isOngoingUssd = /on\s*going\s*ussd|ongoing\s*ussd|another\s*on\s*going/i.test(rawErr);

      if (isOngoingUssd) {
        return res.json({
          success: true,
          orderId: `HP-RESEND-${Date.now()}`,
          amount: plan.priceTsh,
          message: 'Ombi la USSD bado lipo wazi kwenye simu yako! Tafadhali angalia skrini ya simu yako na uweke PIN ya malipo, au subiri sekunde 30 kabla ya kutuma tena.',
          phone: cleanPhone,
          plan: plan,
          isOngoingSession: true
        });
      }

      return res.status(400).json({
        success: false,
        error: rawErr || 'Haikuweza kutuma ombi jipya la USSD. Hakikisha simu iko hewani na ina salio.'
      });
    }
  } catch (error: any) {
    console.error('[HarakaPay Resend Error]', error);
    res.status(500).json({
      success: false,
      error: 'Hitilafu ya mtandao: ' + (error.message || 'Jaribu tena.')
    });
  }
});

// 7. HarakaPay Check Payment Status (supports both /status and /check-status)
app.get(['/api/harakapay/status/:orderId', '/api/harakapay/check-status/:orderId'], async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID inahitajika' });
    }

    console.log(`[HarakaPay] Checking status for order ${orderId}`);

    const response = await fetch(`${HARAKAPAY_BASE_URL}/api/v1/status/${orderId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': HARAKAPAY_API_KEY
      }
    });

    const data: any = await response.json();
    console.log(`[HarakaPay Status Result for ${orderId}]`, data);

    const paymentInfo = data.payment || {};
    const status = paymentInfo.status || 'pending';

    let localRecord = paymentsStore[orderId];
    if (localRecord) {
      localRecord.status = status;
      if (status === 'completed') {
        localRecord.completedAt = paymentInfo.completed_at || new Date().toISOString();
        // Activate and save/extend subscription in Supabase and local store
        await saveOrExtendSupabaseSubscription(localRecord.phone, localRecord.amount);
        console.log(`[Subscription Activated via HarakaPay] User: ${localRecord.phone}, Amount: ${localRecord.amount}`);
      }
      persistData();
    }

    const createdTime = paymentInfo.created_at || (localRecord ? localRecord.createdAt : null);
    const elapsedSeconds = createdTime ? Math.max(0, Math.floor((Date.now() - new Date(createdTime).getTime()) / 1000)) : 0;

    res.json({
      success: true,
      orderId: orderId,
      status: status,
      payment: paymentInfo,
      elapsedSeconds: elapsedSeconds,
      userUpdated: localRecord && usersStore[localRecord.phone]
    });
  } catch (error: any) {
    console.error('[HarakaPay Status Check Error]', error);
    // If external check fails, check local record
    const local = paymentsStore[req.params.orderId];
    if (local) {
      return res.json({
        success: true,
        orderId: req.params.orderId,
        status: local.status,
        fromLocal: true
      });
    }
    res.status(500).json({
      success: false,
      error: 'Imeshindikana kuangalia hali ya malipo kwa sasa.'
    });
  }
});

// 8. One-Click Verification Endpoint for "Nimelipa" button
// Checks HarakaPay, activates & extends subscription in Supabase, and syncs across devices
app.post('/api/harakapay/verify-payment', async (req: Request, res: Response) => {
  const { orderId, phone, amount, email } = req.body;
  const cleanPhone = normalizePhone(phone || '');
  const numAmount = Number(amount) || 1000;
  const cleanEmail = email && typeof email === 'string' ? email.trim().toLowerCase() : undefined;

  if (!orderId) {
    return res.json({
      success: true,
      verified: false,
      status: 'pending',
      message: 'Muamala haujakamilika. Tafadhali ingiza namba ya siri (PIN) kwenye simu yako kisha bonyeza Nimelipa tena.'
    });
  }

  // 1. Query HarakaPay status API in real-time for THIS EXACT orderId
  try {
    console.log(`[Verify-Payment] Checking real HarakaPay status for order ${orderId}`);
    const response = await fetch(`${HARAKAPAY_BASE_URL}/api/v1/status/${orderId}`, {
      headers: { 'X-API-Key': HARAKAPAY_API_KEY }
    });
    const data: any = await response.json();
    console.log(`[Verify-Payment Result for ${orderId}]`, data);

    if (data && data.success && data.payment) {
      const paymentStatus = data.payment.status;
      if (paymentStatus === 'completed') {
        const verifiedAmount = data.payment.amount || numAmount;
        const targetPhone = cleanPhone || normalizePhone(data.payment.phone || '');
        const subInfo = await saveOrExtendSupabaseSubscription(targetPhone, verifiedAmount, cleanEmail, orderId);

        if (paymentsStore[orderId]) {
          paymentsStore[orderId].status = 'completed';
          paymentsStore[orderId].completedAt = data.payment.completed_at || new Date().toISOString();
          persistData();
        }

        return res.json({
          success: true,
          verified: true,
          status: 'completed',
          message: 'Malipo yako yamethibitishwa kikamilifu! Kifurushi chako kimewashwa.',
          subscription: subInfo,
          user: usersStore[targetPhone]
        });
      } else if (paymentStatus === 'failed') {
        if (paymentsStore[orderId]) {
          paymentsStore[orderId].status = 'failed';
          persistData();
        }
        return res.json({
          success: true,
          verified: false,
          status: 'failed',
          message: 'Malipo yameshindikana au yamekataliwa. Tafadhali jaribu tena au tuma ombi jipya la USSD.'
        });
      } else {
        // Still pending / user hasn't entered PIN yet
        return res.json({
          success: true,
          verified: false,
          status: 'pending',
          message: 'Tafadhali ingiza namba yako ya siri (PIN) kwenye simu yako kukamilisha malipo, kisha bonyeza Nimelipa tena.'
        });
      }
    }
  } catch (err: any) {
    console.warn('[HarakaPay verify error]', err.message);
  }

  // 2. Check local payments record strictly for THIS orderId
  const local = paymentsStore[orderId];
  if (local && local.status === 'completed') {
    return res.json({
      success: true,
      verified: true,
      status: 'completed',
      message: 'Malipo yamethibitishwa kikamilifu!',
      user: usersStore[cleanPhone || local.phone]
    });
  }

  // 3. Check Supabase nelitv_payments table strictly for THIS order_id
  if (supabase) {
    try {
      const { data: payRow } = await supabase
        .from('nelitv_payments')
        .select('*')
        .eq('order_id', orderId)
        .eq('status', 'completed')
        .maybeSingle();

      if (payRow) {
        return res.json({
          success: true,
          verified: true,
          status: 'completed',
          message: 'Malipo yamethibitishwa kikamilifu!',
          user: usersStore[cleanPhone]
        });
      }
    } catch {}
  }

  // STRICTLY NOT VERIFIED: If user did not put PIN, it stays pending and never passes!
  return res.json({
    success: true,
    verified: false,
    status: 'pending',
    message: 'Bado hujaweka namba ya siri (PIN) au muamala bado haujathibitishwa na mtandao wako wa simu. Tafadhali ingiza PIN kwenye simu yako kisha bonyeza Nimelipa tena.'
  });
});

// 9. HarakaPay Webhook callback receiver
app.post('/api/harakapay/webhook', (req: Request, res: Response) => {
  const { order_id, status, amount } = req.body;
  console.log('[HarakaPay Webhook received]', req.body);

  if (order_id && status) {
    const record = paymentsStore[order_id];
    if (record) {
      record.status = status;
      if (status === 'completed') {
        record.completedAt = new Date().toISOString();
        saveOrExtendSupabaseSubscription(record.phone, record.amount).catch(e => {
          console.warn('[Webhook Supabase sync err]', e);
        });
      }
      persistData();
    }
  }

  res.json({ success: true, received: true });
});

// 10. HarakaPay Balance endpoint
app.get('/api/harakapay/balance', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${HARAKAPAY_BASE_URL}/api/v1/balance`, {
      headers: { 'X-API-Key': HARAKAPAY_API_KEY }
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Dynamic Sitemap Generator for Google Search Console & SEO
app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const baseUrl = 'https://nelitv.online';
  const today = new Date().toISOString().split('T')[0];

  const channelUrls = CHANNELS_DATA.map((ch) => {
    const slug = getChannelRouteSlug(ch);
    return `  <url>
    <loc>${baseUrl}/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
  }).join('\n');

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/download</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
${channelUrls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.send(sitemapXml);
});

// 12. Robots.txt (Crawler compliance)
app.get('/robots.txt', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\n\nSitemap: https://nelitv.online/sitemap.xml\n`);
});

// 13. Ensure /api and /server routes open the NeliTv Portal SPA in production / Vercel
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  app.get(['/api', '/api/', '/server', '/server/', '/server/stream-generator', '/server/stream-generator/', '/nelitv-server', '/nelitv-server/'], (req: Request, res: Response) => {
    const candidates = [
      path.join(__dirname, 'dist', 'index.html'),
      path.join(process.cwd(), 'dist', 'index.html')
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return res.sendFile(candidate);
      }
    }
    const targetView = req.path.toLowerCase().includes('stream-generator')
      ? 'stream-generator'
      : req.path.toLowerCase().includes('server')
      ? 'server'
      : 'api';
    return res.redirect(302, `/?view=${targetView}`);
  });
}

// -------------------------------------------------------------
// Vite middleware in dev or static files in production
// -------------------------------------------------------------
async function setupApp() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get(['/server.ts', '/api/index', '/api/index.ts'], (_req: Request, res: Response) => {
      res.status(404).send('Not Found');
    });

    app.get(['/api', '/api/', '/server', '/server/', '/server/stream-generator', '/server/stream-generator/', '/nelitv-server', '/nelitv-server/'], async (req: Request, res: Response, next) => {
      try {
        const indexPath = path.join(__dirname, 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[NeliTv] Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  setupApp().catch((err) => {
    console.error('Server failed to start:', err);
  });
}
