import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { CHANNELS_DATA, VIFURUSHI_PLANS } from './src/data/channels.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HARAKAPAY_API_KEY = process.env.HARAKAPAY_API_KEY || 'hpk_93b63ba05db51f1963b174570c71762a73541195bdbc5538';
const HARAKAPAY_BASE_URL = 'https://harakapay.net';

// Supabase client configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qqwlekumeltrdfvutmmt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_secret_0DIu1uze15Fo1K8D4KtO5w__XNiQqYh';

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (supabase) {
  console.log('[Supabase] Initialized client successfully with URL:', SUPABASE_URL);
} else {
  console.log('[Supabase] Running with persistent file-backed store until SUPABASE_URL & SUPABASE_KEY are provided.');
}

app.use(express.json());

// In-memory + file-backed storage for users & payments
const DATA_DIR = path.join(__dirname, '.data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

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

        // Check if latest was active but expired
        const latest = data[0];
        if (latest && (latest.premium_status || '').toLowerCase() === 'active' && new Date(latest.expires_at).getTime() <= now) {
          try {
            await supabase
              .from(tbl)
              .update({ premium_status: 'expired' })
              .eq('id', latest.id);
          } catch {}
        }
        return latest;
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
  let baseDate = now;
  let existingRecord: any = null;

  // 1. Check Supabase
  if (supabase) {
    try {
      const existing = await querySupabaseSubscription(clean0);
      if (existing) {
        existingRecord = existing;
        if (existingRecord.expires_at) {
          const expTime = new Date(existingRecord.expires_at).getTime();
          if (expTime > now.getTime()) {
            baseDate = new Date(expTime);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Supabase Check Existing]', e.message);
    }
  }

  // 2. Fallback to local usersStore if no Supabase record
  const localUser = usersStore[clean0];
  if (!existingRecord && localUser?.subscriptionExpiresAt) {
    const localExp = new Date(localUser.subscriptionExpiresAt).getTime();
    if (localExp > now.getTime()) {
      baseDate = new Date(localExp);
    }
  }

  const calculatedExpiry = calculateSubscriptionExpiration(amount, baseDate);
  // Ensure we never overwrite a longer, still-valid expiration with a shorter one
  let finalExpiry = calculatedExpiry;
  if (existingRecord?.expires_at) {
    const existingExp = new Date(existingRecord.expires_at);
    if (existingExp.getTime() > finalExpiry.getTime()) {
      finalExpiry = existingExp;
    }
  }

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
          user_email: email || existingRecord?.user_email || null,
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

      // 2. Payments table: public.nelitv_payments
      const orderIdToRecord = orderId || `HP-${Date.now()}`;
      try {
        await supabase
          .from('nelitv_payments')
          .upsert({
            order_id: orderIdToRecord,
            phone_number: clean0,
            user_email: email || null,
            amount: amount,
            plan_id: planId,
            status: 'completed',
            payment_method: 'harakapay',
            completed_at: now.toISOString()
          }, { onConflict: 'order_id' });
      } catch {}

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

  // Determine plan label
  let planName = 'Kifurushi cha Siku 2';
  if (amount >= 10000) planName = 'Kifurushi cha Mwezi 1';
  else if (amount >= 3000) planName = 'Kifurushi cha Wiki 1';

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

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Live CDN token cache
let cachedCdnToken: { token: string; cdnHost: string; exp: number | null; source: string } | null = null;
let lastCdnTokenFetch = 0;

async function getOrFetchCdnToken(force = false) {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  // If cached and has more than 90 seconds before expiry
  if (!force && cachedCdnToken && (now - lastCdnTokenFetch < 3 * 60 * 1000) && (!cachedCdnToken.exp || cachedCdnToken.exp > nowSec + 90)) {
    return cachedCdnToken;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch('https://streamzone.fun/api/cdn-token', {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.token && (!data.exp || data.exp > nowSec + 30)) {
        cachedCdnToken = {
          token: data.token,
          cdnHost: data.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz',
          exp: data.exp || null,
          source: 'streamzone'
        };
        lastCdnTokenFetch = now;
        console.log('[CDN Token] Fresh token fetched successfully, length:', data.token.length, 'exp:', data.exp);
        return cachedCdnToken;
      }
    }
  } catch (err: any) {
    console.warn('[CDN Token] Error fetching from streamzone.fun:', err.message);
  }

  if (cachedCdnToken && (!cachedCdnToken.exp || cachedCdnToken.exp > nowSec + 30)) {
    return cachedCdnToken;
  }

  cachedCdnToken = {
    token: "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOiIxNzkyMzQ5OTAzIiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoiYjA1ZGQxNjY1NWVlMDE2YSIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiI0ODQwODMyIiwiZGV2aWNlX2lkIjoiIiwibWF4X3Nlc3Npb25zIjowLCJzZXNzaW9uX2R1cmF0aW9uIjowLCJ1cmwiOiJodHRwczovLzEwMi4yMDguMjQ0LjkiLCJzZXNzaW9uX3RpbWVvdXQiOjAsImF1ZCI6IjciLCJzb3VyY2VzIjpbM119.x54TtA7qL3fXQ81oZ4V57xLVROztNUdkbPg39O7F5mzTur3bniWhL2hfQ68rsfz-8PZjrmDQOptCG8dneFjjhQ==",
    exp: 1792349903,
    cdnHost: "https://cdnedgch2.azamtvltd.co.tz",
    source: "static_active"
  };
  return cachedCdnToken;
}

// Background auto-refresh every 3 minutes
setInterval(() => {
  getOrFetchCdnToken(true).catch(() => {});
}, 3 * 60 * 1000);

// 1. Channels list with dynamic active tokens
app.get('/api/channels', async (_req: Request, res: Response) => {
  const tokenData = await getOrFetchCdnToken();
  const host = tokenData.cdnHost.replace(/\/+$/, '');

  const liveChannels = CHANNELS_DATA.map(ch => {
    const isAzam = ch.isAzam || ch.streamUrl.includes('azamtvltd.co.tz');
    if (!isAzam) return ch;

    // Extract path e.g. /live/eds/AzamSport1/DASH/AzamSport1.mpd
    let p = ch.streamUrl;
    try {
      const u = new URL(ch.streamUrl);
      p = u.pathname.replace(/^\/tok_[^/]+/, '');
    } catch {}
    if (!p.startsWith('/')) p = `/${p}`;

    const freshUrl = `${host}/tok_${tokenData.token}${p}`;
    return {
      ...ch,
      streamUrl: freshUrl,
      tokenizedUrl: freshUrl
    };
  });

  res.json({
    success: true,
    total: liveChannels.length,
    data: liveChannels,
    cdnTokenInfo: {
      host: tokenData.cdnHost,
      source: tokenData.source
    }
  });
});

// 2. Pricing Plans (Vifurushi)
app.get('/api/vifurushi', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: VIFURUSHI_PLANS
  });
});

// 2.5 Secure Subscription Check for Client (Uses service_role key to bypass RLS)
app.get('/api/subscription/check', async (req: Request, res: Response) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : '';
  const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
  const identifier = phone || email;

  if (!identifier) {
    return res.json({ success: true, active: false, subscription: null });
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
      subscription: activeSub || null
    });
  } catch (err: any) {
    return res.json({ success: false, active: false, error: err.message });
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

  const userPayments = Object.values(paymentsStore)
    .filter(p => p.phone === cleanPhone)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    success: true,
    user: {
      ...user,
      hasActiveSubscription: isSubscriptionValid(user),
      payments: userPayments
    }
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

// 5. CDN Token provider
app.get('/api/cdn-token', async (req: Request, res: Response) => {
  const force = req.query.refresh === 'true' || req.query.fresh === '1';
  const tokenData = await getOrFetchCdnToken(force);
  res.json(tokenData);
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

    const description = `Your Max TV: ${plan.name} (${plan.durationText}) kwa namba ${cleanPhone}`;

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

      return res.json({
        success: true,
        orderId: data.order_id,
        amount: data.amount || plan.priceTsh,
        message: data.message || 'USSD push imetumwa kwenye simu yako. Tafadhali ingiza PIN kuthibitisha.',
        phone: cleanPhone,
        plan: plan
      });
    } else {
      return res.status(400).json({
        success: false,
        error: data.message || data.error || 'Imeshindikana kutuma ombi la malipo. Hakikisha namba yako ina salio au imesajiliwa na huduma za kifedha (M-Pesa, Tigo Pesa, Airtel Money, Halopesa).'
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

    const description = `Your Max TV (Tuma Tena): ${plan.name} kwa namba ${cleanPhone}`;
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
      return res.status(400).json({
        success: false,
        error: data.message || 'Haikuweza kutuma ombi jipya la USSD. Hakikisha simu iko hewani na ina salio.'
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

// 7. HarakaPay Check Payment Status
app.get('/api/harakapay/status/:orderId', async (req: Request, res: Response) => {
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
  const { orderId, phone, amount } = req.body;
  const cleanPhone = normalizePhone(phone || '');
  const numAmount = Number(amount) || 1000;

  // 1. If orderId is provided, query HarakaPay server in real-time
  if (orderId) {
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
          const subInfo = await saveOrExtendSupabaseSubscription(targetPhone, verifiedAmount);

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
        } else if (paymentStatus === 'pending') {
          return res.json({
            success: true,
            verified: false,
            status: 'pending',
            message: 'Ujumbe wa USSD umetumwa kwenye simu yako. Tafadhali kamilisha kuweka PIN kisha ubonyeze Nimelipa tena.'
          });
        }
      }
    } catch (err: any) {
      console.warn('[HarakaPay verify error]', err.message);
    }
  }

  // 2. Check local payments record
  const local = orderId ? paymentsStore[orderId] : null;
  if (local && local.status === 'completed') {
    const subInfo = await saveOrExtendSupabaseSubscription(local.phone, local.amount);
    return res.json({
      success: true,
      verified: true,
      status: 'completed',
      message: 'Malipo yamethibitishwa kikamilifu!',
      subscription: subInfo,
      user: usersStore[cleanPhone || local.phone]
    });
  }

  // 3. Fallback check Supabase directly in case webhook already updated it
  if (cleanPhone) {
    const existing = await querySupabaseSubscription(cleanPhone);
    if (existing && existing.premium_status === 'active' && new Date(existing.expires_at).getTime() > Date.now()) {
      return res.json({
        success: true,
        verified: true,
        status: 'completed',
        message: 'Kifurushi chako kipo hai kwenye Supabase!',
        user: usersStore[cleanPhone]
      });
    }
  }

  res.json({
    success: true,
    verified: false,
    status: 'pending',
    message: 'Tafadhali kamilisha kuweka PIN kwenye simu yako, kisha bonyeza Nimelipa tena.'
  });
});

// 9. Manual / Demo Verification Fallback
app.post('/api/harakapay/verify-manual', async (req: Request, res: Response) => {
  const { orderId, phone, amount } = req.body;
  const cleanPhone = normalizePhone(phone || '0700000000');
  const numAmount = Number(amount) || 1000;

  const subInfo = await saveOrExtendSupabaseSubscription(cleanPhone, numAmount);

  if (orderId && paymentsStore[orderId]) {
    paymentsStore[orderId].status = 'completed';
    paymentsStore[orderId].completedAt = new Date().toISOString();
    persistData();
  }

  return res.json({
    success: true,
    message: 'Malipo yamethibitishwa na kuhifadhiwa kwenye Supabase!',
    subscription: subInfo,
    user: usersStore[cleanPhone]
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
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Your Max TV] Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  setupApp().catch((err) => {
    console.error('Server failed to start:', err);
  });
}
