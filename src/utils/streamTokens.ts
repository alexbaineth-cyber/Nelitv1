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

const FALLBACK_TOKEN =
  "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6IjEifQ.eyJleHAiOiIxNzk1NTY5MjI1Iiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoiMzhiMDE4NjVlZWJhZmY5YyIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiI1MTE1MzU4IiwiZGV2aWNlX2lkIjoiZjcxOWRiMzMtNWNkMC00NTE3LTg5MDItM2UwYjA0Zjc5OWU4IiwibWF4X3Nlc3Npb25zIjoxLCJ1cmwiOiJodHRwczovLzEwLjY0LjEzMi4xNDYiLCJzZXNzaW9uX3RpbWVvdXQiOjEyMDAsImF1ZCI6IjciLCJzb3VyY2VzIjpbM119.rBkGXRbBeo9FSAdBlncN3knjV0ozvFFCM1R4U-ic8lr4xEcdaKzwinfFTr5REAe941tNJpVR5z8Op237dp7p9g";
const FALLBACK_CDN_HOST = "https://cdnedgch2.azamtvltd.co.tz";
const FALLBACK_EXP = 1795569225;

let inMemoryToken: CdnTokenData | null =
  FALLBACK_EXP > Math.floor(Date.now() / 1000) + 30
    ? {
        token: FALLBACK_TOKEN,
        cdnHost: FALLBACK_CDN_HOST,
        exp: FALLBACK_EXP,
        source: "aztv-service",
        provider: "aztv",
        fetchedAt: 0,
      }
    : null;
let lastFetchTime = 0;
let inFlightPromise: Promise<CdnTokenData> | null = null;
let keeperStarted = false;
const TOKEN_CACHE_DURATION = 45 * 1000; // 45 seconds fresh cache
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
    if (!data?.token) return null;

    const cleanTok = cleanTokenValue(data.token);
    const provider = data.upstreamProvider || (data.provider !== 'NeliTv Server' ? data.provider : undefined) || 'aztv';
    if (excludeProvider && provider === excludeProvider) {
      return null;
    }

    const exp = Number(data.exp) || decodeJwtExp(cleanTok);
    return {
      token: cleanTok,
      cdnHost: data.cdnHost || FALLBACK_CDN_HOST,
      exp,
      source: data.source || 'server_api',
      provider,
      fetchedAt: Date.now(),
    };
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
    if (!data?.token) return null;

    const cleanTok = cleanTokenValue(data.token);
    const provider = data.provider || 'aztv';
    if (excludeProvider && provider === excludeProvider) {
      return null;
    }

    const exp = Number(data.exp) || decodeJwtExp(cleanTok);
    return {
      token: cleanTok,
      cdnHost: data.cdnHost || FALLBACK_CDN_HOST,
      exp,
      source: data.source || 'direct_streamzone',
      provider,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function firstValidToken(
  promises: Promise<CdnTokenData | null>[],
  nowSec: number
): Promise<CdnTokenData | null> {
  return new Promise((resolve) => {
    let remaining = promises.length;
    let settled = false;
    let firstExpiredCandidate: CdnTokenData | null = null;

    promises.forEach((p) => {
      p.then((res) => {
        if (settled) return;
        if (res && res.token) {
          if (!res.exp || res.exp > nowSec + 60) {
            settled = true;
            resolve(res);
            return;
          }
          if (!firstExpiredCandidate) firstExpiredCandidate = res;
        }
        remaining -= 1;
        if (remaining === 0 && !settled) {
          resolve(firstExpiredCandidate);
        }
      }).catch(() => {
        remaining -= 1;
        if (remaining === 0 && !settled) {
          resolve(firstExpiredCandidate);
        }
      });
    });
  });
}

/** Synchronous 0ms token getter so video player starts immediately while refreshing in background */
export function getInstantCdnToken(): CdnTokenData {
  const nowSec = Math.floor(Date.now() / 1000);
  if (inMemoryToken && (!inMemoryToken.exp || inMemoryToken.exp > nowSec + 30)) {
    return inMemoryToken;
  }
  return {
    token: FALLBACK_TOKEN,
    cdnHost: FALLBACK_CDN_HOST,
    exp: FALLBACK_EXP,
    source: "aztv-service",
    provider: "aztv",
    fetchedAt: Date.now(),
  };
}

// Fetch latest valid token from server or direct live CDN endpoint (never returns stale expired cache if live available)
export async function getLiveCdnToken(forceRefresh = false, excludeProvider?: string): Promise<CdnTokenData> {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // Return short-lived in-memory live token if still fresh and has >10 minutes before expiry
  if (
    !forceRefresh &&
    !excludeProvider &&
    inMemoryToken &&
    lastFetchTime > 0 &&
    nowMs - lastFetchTime < TOKEN_CACHE_DURATION &&
    (!inMemoryToken.exp || inMemoryToken.exp > nowSec + 600)
  ) {
    return inMemoryToken;
  }

  if (!forceRefresh && !excludeProvider && inFlightPromise) {
    return inFlightPromise;
  }

  const runFetch = async (): Promise<CdnTokenData> => {
    const winner = await firstValidToken(
      [
        fetchFromLocalApi(forceRefresh, excludeProvider),
        fetchFromStreamzone(forceRefresh, excludeProvider),
      ],
      nowSec
    );

    if (winner) {
      inMemoryToken = winner;
      lastFetchTime = Date.now();
      updateGlobalAzamToken(winner.token, winner.cdnHost);
      return winner;
    }

    // Keep last inMemoryToken if still valid in future
    if (inMemoryToken && (!inMemoryToken.exp || inMemoryToken.exp > nowSec + 30)) {
      return inMemoryToken;
    }

    const fallback: CdnTokenData = {
      token: FALLBACK_TOKEN,
      cdnHost: FALLBACK_CDN_HOST,
      exp: FALLBACK_EXP,
      source: "aztv-service",
      provider: "aztv",
      fetchedAt: Date.now(),
    };
    inMemoryToken = fallback;
    lastFetchTime = Date.now();
    updateGlobalAzamToken(fallback.token, fallback.cdnHost);
    return fallback;
  };

  if (excludeProvider) {
    return runFetch();
  }

  inFlightPromise = runFetch().finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}

/** Switch to alternate upstream CDN token provider (mpingo <-> aztv) on 429/403 errors */
export async function recoverAlternateCdnToken(failedProvider?: string): Promise<CdnTokenData> {
  const targetExclude = failedProvider || inMemoryToken?.provider || 'mpingo';
  const nowSec = Math.floor(Date.now() / 1000);
  const alt = await firstValidToken(
    [
      fetchFromLocalApi(true, targetExclude),
      fetchFromStreamzone(true, targetExclude),
    ],
    nowSec
  );

  if (alt && alt.token) {
    inMemoryToken = alt;
    lastFetchTime = Date.now();
    updateGlobalAzamToken(alt.token, alt.cdnHost);
    return alt;
  }

  return getLiveCdnToken(true);
}

/** Quietly preconnect to channel CDN origin & warm token in background on hover/focus */
export function prewarmChannelConnection(channel: Channel): void {
  warmLiveCdnToken();
  if (typeof document === 'undefined' || !channel?.streamUrl) return;
  try {
    const origin = new URL(channel.streamUrl).origin;
    if (!prewarmedOrigins.has(origin)) {
      prewarmedOrigins.add(origin);
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  } catch {}
}

/** Pre-warm CDN token and keep background auto-refresh active so tokens never expire */
export function warmLiveCdnToken(): void {
  getLiveCdnToken(false).catch(() => {});
  if (!keeperStarted && typeof window !== 'undefined') {
    keeperStarted = true;
    setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const nearExpiry = Boolean(inMemoryToken?.exp && inMemoryToken.exp - nowSec < 600);
      getLiveCdnToken(nearExpiry).catch(() => {});
    }, 45 * 1000);
  }
}

// Generate the exact playable URL for any channel
export function buildPlayableStreamUrl(channel: Channel, tokenData: CdnTokenData): string {
  const isAzamStream = channel.isAzam || channel.streamUrl.includes('azamtvltd.co.tz');

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
  const host = tokenData.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz';
  const cleanHost = host.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${cleanHost}/tok_${cleanToken}${cleanPath}`;
}
