import { Channel, updateGlobalAzamToken } from '../data/channels.ts';
import { getAppAuthHeaders } from './apiAuth.ts';

export interface CdnTokenData {
  token: string;
  cdnHost: string;
  exp: number | null;
  source?: string;
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

async function fetchFromLocalApi(forceRefresh: boolean): Promise<CdnTokenData | null> {
  try {
    const url = forceRefresh
      ? `/baynithalex/api/cdn-token?refresh=true&_t=${Date.now()}`
      : `/baynithalex/api/cdn-token`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200);

    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: getAppAuthHeaders(),
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.token) return null;

    const exp = Number(data.exp) || decodeJwtExp(data.token);
    return {
      token: data.token,
      cdnHost: data.cdnHost || FALLBACK_CDN_HOST,
      exp,
      source: data.source || 'server_api',
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchFromStreamzone(forceRefresh: boolean): Promise<CdnTokenData | null> {
  try {
    const url = forceRefresh
      ? `https://streamzone.fun/api/cdn-token?refresh=true&_t=${Date.now()}`
      : `https://streamzone.fun/api/cdn-token`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.token) return null;

    const exp = Number(data.exp) || decodeJwtExp(data.token);
    return {
      token: data.token,
      cdnHost: data.cdnHost || FALLBACK_CDN_HOST,
      exp,
      source: data.source || 'direct_streamzone',
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.warn('Direct streamzone token fetch fallback note:', err);
    return null;
  }
}

// Fetch latest valid token from server or direct live CDN endpoint
export async function getLiveCdnToken(forceRefresh = false): Promise<CdnTokenData> {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // Return short-lived in-memory live token if still fresh and valid
  if (
    !forceRefresh &&
    inMemoryToken &&
    nowMs - lastFetchTime < TOKEN_CACHE_DURATION &&
    (!inMemoryToken.exp || inMemoryToken.exp > nowSec + 60)
  ) {
    return inMemoryToken;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  const runFetch = async (): Promise<CdnTokenData> => {
    // Query direct streamzone endpoint and local backend in parallel, picking freshest token
    const [directCandidate, localCandidate] = await Promise.all([
      fetchFromStreamzone(forceRefresh),
      fetchFromLocalApi(forceRefresh),
    ]);

    const candidates = [directCandidate, localCandidate].filter(
      (c): c is CdnTokenData => Boolean(c && c.token)
    );

    // Filter out tokens clearly expired by >30s if we have an alternative
    const validCandidates = candidates.filter(
      (c) => !c.exp || c.exp > nowSec + 30
    );
    const pool = validCandidates.length > 0 ? validCandidates : candidates;

    if (pool.length > 0) {
      pool.sort((a, b) => (b.exp || 0) - (a.exp || 0));
      const best = pool[0];
      inMemoryToken = best;
      lastFetchTime = Date.now();
      updateGlobalAzamToken(best.token, best.cdnHost);
      return best;
    }

    // Fallback to latest active token provided by streamzone
    const fallback: CdnTokenData = {
      token: FALLBACK_TOKEN,
      cdnHost: FALLBACK_CDN_HOST,
      exp: FALLBACK_EXP,
      source: "static_active",
      fetchedAt: Date.now(),
    };
    inMemoryToken = fallback;
    lastFetchTime = Date.now();
    updateGlobalAzamToken(fallback.token, fallback.cdnHost);
    return fallback;
  };

  inFlightPromise = runFetch().finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
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
    // Remove any existing /tok_... prefix if present
    path = parsed.pathname.replace(/^\/tok_[^/]+/, '');
  } catch {
    // If relative or raw path
    const match = channel.streamUrl.match(/\/live\/eds\/.+$/);
    path = match ? match[0] : channel.streamUrl;
  }

  const host = tokenData.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz';
  const cleanHost = host.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Preferred Azam path-tokenized URL with dual auth (path token + cdntoken param for edge nodes)
  return `${cleanHost}/tok_${tokenData.token}${cleanPath}?cdntoken=${encodeURIComponent(tokenData.token)}`;
}

