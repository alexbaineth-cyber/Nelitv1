import { Channel, updateGlobalAzamToken } from '../data/channels.ts';
import { getAppAuthHeaders } from './apiAuth.ts';

export interface CdnTokenData {
  token: string;
  cdnHost: string;
  exp: number | null;
  source?: string;
  provider?: string;
  fetchedAt?: number;
}

export const PERMANENT_CDN_HOST = "https://1445733302.rsc.cdn77.org";
const PERMANENT_EXP_UNIX = 2524608000;
const PERMANENT_TOKEN =
  "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6IjEifQ.eyJleHAiOiIyNTI0NjA4MDAwIiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoibmVsaXR2LXBlcm1hbmVudCIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiJuZWxpdHYiLCJkZXZpY2VfaWQiOiIiLCJtYXhfc2Vzc2lvbnMiOjAsInVybCI6Imh0dHBzOi8vMTQ0NTczMzMwMi5yc2MuY2RuNzcub3JnIiwic2Vzc2lvbl90aW1lb3V0IjowLCJhdWQiOiI3Iiwic291cmNlcyI6WzNdfQ.nelitv_permanent_cdn77";

function createPermanentCdnRecord(): CdnTokenData {
  return {
    token: PERMANENT_TOKEN,
    cdnHost: PERMANENT_CDN_HOST,
    exp: PERMANENT_EXP_UNIX,
    source: "cdn77-permanent",
    provider: "cdn77",
    fetchedAt: Date.now(),
  };
}

let inMemoryToken: CdnTokenData = createPermanentCdnRecord();
let lastFetchTime = 0;
let inFlightPromise: Promise<CdnTokenData> | null = null;
let keeperStarted = false;
const TOKEN_CACHE_DURATION = 45 * 1000;
const prewarmedOrigins = new Set<string>();

function cleanTokenValue(token: string): string {
  return String(token || '').trim().replace(/^(?:tok_)+/, '');
}

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp : null;
  } catch {
    return null;
  }
}

function isValidCandidatePayload(
  rawData: any,
  nowSec: number,
  excludeProvider?: string
): CdnTokenData | null {
  if (!rawData || !rawData.token) return null;

  const cleanTok = cleanTokenValue(rawData.token);
  const cdnHost = (typeof rawData.cdnHost === 'string' && rawData.cdnHost.trim())
    ? rawData.cdnHost.trim().replace(/\/+$/, '')
    : PERMANENT_CDN_HOST;
  const source = String(rawData.source || '');
  const provider = rawData.upstreamProvider || (rawData.provider !== 'NeliTv Server' ? rawData.provider : undefined) || (cdnHost.includes('cdn77.org') ? 'cdn77' : 'aztv');

  if (excludeProvider && provider === excludeProvider) {
    return null;
  }

  // Permanent cdn77 host does not expire
  if (cdnHost.includes('cdn77.org') && !cdnHost.includes('azamtvltd')) {
    return {
      token: cleanTok || PERMANENT_TOKEN,
      cdnHost,
      exp: null,
      source: source || 'cdn77-permanent',
      provider: 'cdn77',
      fetchedAt: Date.now(),
    };
  }

  // Reject stale db-fallback / unavailable responses
  if (source === 'db-fallback' || source === 'unavailable') {
    return null;
  }

  const outerExp = Number(rawData.exp);
  const jwtExp = decodeJwtExp(cleanTok);

  // Reject explicit exp: 0 or expired outer/inner JWT timestamps
  if (outerExp === 0) return null;
  if (jwtExp !== null && jwtExp <= nowSec + 60) return null;
  const effectiveExp = jwtExp || (Number.isFinite(outerExp) && outerExp > 0 ? outerExp : null);
  if (!effectiveExp || effectiveExp <= nowSec + 60) {
    return null;
  }

  return {
    token: cleanTok,
    cdnHost,
    exp: effectiveExp,
    source: source || 'live',
    provider,
    fetchedAt: Date.now(),
  };
}

async function fetchFromLocalApi(forceRefresh: boolean, excludeProvider?: string): Promise<CdnTokenData | null> {
  try {
    const params = new URLSearchParams();
    if (forceRefresh) {
      params.set('refresh', 'true');
      params.set('_t', String(Date.now()));
    }
    if (excludeProvider) {
      params.set('excludeProvider', excludeProvider);
      params.set('fresh', '1');
    }
    const qs = params.toString();
    const url = qs ? `/baynithalex/api/cdn-token?${qs}` : `/baynithalex/api/cdn-token`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1600);

    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: getAppAuthHeaders(),
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const nowSec = Math.floor(Date.now() / 1000);
    return isValidCandidatePayload(data, nowSec, excludeProvider);
  } catch {
    return null;
  }
}

async function fetchFromStreamzone(forceRefresh: boolean, excludeProvider?: string): Promise<CdnTokenData | null> {
  try {
    const params = new URLSearchParams();
    if (forceRefresh) {
      params.set('fresh', '1');
      params.set('_t', String(Date.now()));
    }
    if (excludeProvider) {
      params.set('excludeProvider', excludeProvider);
      params.set('fresh', '1');
    }
    const qs = params.toString();
    const url = qs ? `https://streamzone.fun/api/cdn-token?${qs}` : `https://streamzone.fun/api/cdn-token`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    const nowSec = Math.floor(Date.now() / 1000);
    return isValidCandidatePayload(data, nowSec, excludeProvider);
  } catch {
    return null;
  }
}

/** Synchronous 0ms getter so video player starts immediately on permanent CDN */
export function getInstantCdnToken(): CdnTokenData {
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    inMemoryToken &&
    (inMemoryToken.cdnHost.includes('cdn77.org') || (inMemoryToken.exp && inMemoryToken.exp > nowSec + 30))
  ) {
    return inMemoryToken;
  }
  return createPermanentCdnRecord();
}

export async function getLiveCdnToken(forceRefresh = false, excludeProvider?: string): Promise<CdnTokenData> {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  if (
    !forceRefresh &&
    !excludeProvider &&
    inMemoryToken &&
    lastFetchTime > 0 &&
    nowMs - lastFetchTime < TOKEN_CACHE_DURATION &&
    (inMemoryToken.cdnHost.includes('cdn77.org') || (inMemoryToken.exp && inMemoryToken.exp > nowSec + 300))
  ) {
    return inMemoryToken;
  }

  if (!forceRefresh && !excludeProvider && inFlightPromise) {
    return inFlightPromise;
  }

  const runFetch = async (): Promise<CdnTokenData> => {
    // Ask our NeliTv server first (which serves permanent cdn77 or verified live backup)
    const localResult = await fetchFromLocalApi(forceRefresh, excludeProvider);
    if (localResult) {
      inMemoryToken = localResult;
      lastFetchTime = Date.now();
      updateGlobalAzamToken(localResult.token, localResult.cdnHost);
      return localResult;
    }

    // Only query streamzone directly if requesting an alternate provider failover away from cdn77
    if (excludeProvider === 'cdn77') {
      const sz = await fetchFromStreamzone(true);
      if (sz) {
        inMemoryToken = sz;
        lastFetchTime = Date.now();
        updateGlobalAzamToken(sz.token, sz.cdnHost);
        return sz;
      }
    }

    const permanent = createPermanentCdnRecord();
    inMemoryToken = permanent;
    lastFetchTime = Date.now();
    updateGlobalAzamToken(permanent.token, permanent.cdnHost);
    return permanent;
  };

  if (excludeProvider) {
    return runFetch();
  }

  inFlightPromise = runFetch().finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}

/** Failover between permanent cdn77 and verified upstream azamtvltd providers if needed */
export async function recoverAlternateCdnToken(failedProvider?: string): Promise<CdnTokenData> {
  const currentHost = inMemoryToken?.cdnHost || '';
  if (!currentHost.includes('cdn77.org')) {
    const permanent = createPermanentCdnRecord();
    inMemoryToken = permanent;
    lastFetchTime = Date.now();
    updateGlobalAzamToken(permanent.token, permanent.cdnHost);
    return permanent;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const sz = await fetchFromStreamzone(true, failedProvider === 'cdn77' ? undefined : failedProvider);
  if (sz && (!sz.exp || sz.exp > nowSec + 60)) {
    inMemoryToken = sz;
    lastFetchTime = Date.now();
    updateGlobalAzamToken(sz.token, sz.cdnHost);
    return sz;
  }

  return createPermanentCdnRecord();
}

/** Quietly preconnect to channel CDN origin & warm token in background on hover/focus */
export function prewarmChannelConnection(channel: Channel): void {
  warmLiveCdnToken();
  if (typeof document === 'undefined' || !channel?.streamUrl) return;
  try {
    const origins = new Set<string>([PERMANENT_CDN_HOST, new URL(channel.streamUrl).origin]);
    origins.forEach((origin) => {
      if (!prewarmedOrigins.has(origin)) {
        prewarmedOrigins.add(origin);
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });
  } catch {}
}

/** Keep CDN token/host state synced in background */
export function warmLiveCdnToken(): void {
  getLiveCdnToken(false).catch(() => {});
  if (!keeperStarted && typeof window !== 'undefined') {
    keeperStarted = true;
    setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const nearExpiry = Boolean(inMemoryToken?.exp && inMemoryToken.exp - nowSec < 300);
      getLiveCdnToken(nearExpiry).catch(() => {});
    }, 45 * 1000);
  }
}

// Generate the exact playable URL for any channel
export function buildPlayableStreamUrl(channel: Channel, tokenData: CdnTokenData): string {
  const isAzamStream =
    channel.isAzam ||
    channel.streamUrl.includes('azamtvltd.co.tz') ||
    channel.streamUrl.includes('1445733302.rsc.cdn77.org');

  if (!isAzamStream) {
    return channel.streamUrl;
  }

  let path = '';
  try {
    const parsed = new URL(channel.streamUrl);
    path = parsed.pathname.replace(/^\/tok_[^/]+/, '');
  } catch {
    const match = channel.streamUrl.match(/\/live\/eds\/.+$/);
    path = match ? match[0] : channel.streamUrl.split('?')[0];
  }

  const cleanToken = cleanTokenValue(tokenData.token);
  const host = (tokenData.cdnHost || PERMANENT_CDN_HOST).replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const nowSec = Math.floor(Date.now() / 1000);

  if (
    host.includes('azamtvltd') &&
    cleanToken.includes('.') &&
    (!tokenData.exp || tokenData.exp > nowSec + 15)
  ) {
    return `${host}/tok_${cleanToken}${cleanPath}`;
  }

  const permanentHost = host.includes('azamtvltd') ? PERMANENT_CDN_HOST : host;
  return `${permanentHost}${cleanPath}`;
}
