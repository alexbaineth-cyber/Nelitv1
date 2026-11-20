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
  "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6IjEifQ.eyJleHAiOiIxNzk1MTcyNjMxIiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoiZTZjOTExNDJjYWVkZjJkMiIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiI0ODUxNDgzIiwiZGV2aWNlX2lkIjoiIiwibWF4X3Nlc3Npb25zIjowLCJ1cmwiOiJodHRwczovLzEwLjY0LjEzMi4xNDYiLCJzZXNzaW9uX3RpbWVvdXQiOjAsImF1ZCI6IjciLCJzb3VyY2VzIjpbM119.M0qxGnpi1jmW_zSFwxhs2YUIvf7kgQuLRb3frhOzWiYEA1gZRTpEntZeuDCDQVzwSQ993Uk_t3kLuZp3MwD-jA";
const FALLBACK_CDN_HOST = "https://cdnedgch2.azamtvltd.co.tz";
const FALLBACK_EXP = 1795172631;

let inMemoryToken: CdnTokenData | null = null;
let lastFetchTime = 0;
let inFlightPromise: Promise<CdnTokenData> | null = null;
const TOKEN_CACHE_DURATION = 90 * 1000; // 90 seconds live cache

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
    const timeoutId = setTimeout(() => controller.abort(), 2400);

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
    const provider = data.upstreamProvider || (data.provider !== 'NeliTv Server' ? data.provider : undefined) || 'mpingo';
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
    const timeoutId = setTimeout(() => controller.abort(), 3200);

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
    const provider = data.provider || 'mpingo';
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
  } catch (err) {
    console.warn('Direct streamzone token fetch fallback note:', err);
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
          if (!res.exp || res.exp > nowSec + 30) {
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

// Fetch latest valid token from server or direct live CDN endpoint (returns fastest valid response)
export async function getLiveCdnToken(forceRefresh = false, excludeProvider?: string): Promise<CdnTokenData> {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // Return short-lived in-memory live token if still fresh and valid
  if (
    !forceRefresh &&
    !excludeProvider &&
    inMemoryToken &&
    nowMs - lastFetchTime < TOKEN_CACHE_DURATION &&
    (!inMemoryToken.exp || inMemoryToken.exp > nowSec + 60)
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

    // Fallback to latest active token provided by streamzone
    const fallback: CdnTokenData = {
      token: FALLBACK_TOKEN,
      cdnHost: FALLBACK_CDN_HOST,
      exp: FALLBACK_EXP,
      source: "static_active",
      provider: "mpingo",
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

/** Switch to alternate upstream CDN token provider (e.g. mpingo <-> aztv) on 429/403 errors */
export async function recoverAlternateCdnToken(failedProvider?: string): Promise<CdnTokenData> {
  const targetExclude = failedProvider || inMemoryToken?.provider || 'mpingo';
  const nowSec = Math.floor(Date.now() / 1000);
  const alt = await firstValidToken(
    [
      fetchFromStreamzone(true, targetExclude),
      fetchFromLocalApi(true, targetExclude),
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

/** Silently pre-warm CDN token in the background on app mount for 0ms playback startup */
export function warmLiveCdnToken(): void {
  getLiveCdnToken(false).catch(() => {});
}

// Generate the exact playable URL for any channel
export function buildPlayableStreamUrl(channel: Channel, tokenData: CdnTokenData): string {
  const isAzamStream = channel.isAzam || channel.streamUrl.includes('azamtvltd.co.tz');

  if (!isAzamStream) {
    return channel.streamUrl;
  }

  // Extract the live path (e.g. /live/eds/AzamSport1/DASH/AzamSport1.mpd)
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

  // Clean path-tokenized URL (matches streamzone working format without duplicate ?cdntoken=)
  return `${cleanHost}/tok_${cleanToken}${cleanPath}`;
}
