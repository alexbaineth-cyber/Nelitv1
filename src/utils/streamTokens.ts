import { Channel, updateGlobalAzamToken } from '../data/channels.ts';

export interface CdnTokenData {
  token: string;
  cdnHost: string;
  exp: number | null;
  source?: string;
  fetchedAt?: number;
}

const FALLBACK_TOKEN = "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOiIxNzkyNTIxNTk3Iiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoiYzllODBkNTRjMjBjMzMwZiIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiI0ODQwODMyIiwiZGV2aWNlX2lkIjoiIiwibWF4X3Nlc3Npb25zIjowLCJzZXNzaW9uX2R1cmF0aW9uIjowLCJ1cmwiOiJodHRwczovLzEwMi4yMDguMjQ0LjkiLCJzZXNzaW9uX3RpbWVvdXQiOjAsImF1ZCI6IjciLCJzb3VyY2VzIjpbM119.8TkNI2HZfLClpNNOxnkqsbJpRtG7n7vXV7lxQqt96XD2zXpINzgBEqFhHTRegs3Voe22yHBC4R6CxvNAugs4ZQ==";

let inMemoryToken: CdnTokenData | null = null;
let lastFetchTime = 0;
const TOKEN_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

// Fetch latest valid token from server or direct live CDN endpoint
export async function getLiveCdnToken(forceRefresh = false): Promise<CdnTokenData> {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // If we already have a valid in-memory token that is NOT expired (keep at least 90s buffer)
  if (
    !forceRefresh &&
    inMemoryToken &&
    (nowMs - lastFetchTime < TOKEN_CACHE_DURATION) &&
    (!inMemoryToken.exp || inMemoryToken.exp > nowSec + 90)
  ) {
    return inMemoryToken;
  }

  // 1. Try local server API endpoint (/api/cdn-token)
  try {
    const url = forceRefresh ? '/api/cdn-token?refresh=true' : '/api/cdn-token';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.token && (!data.exp || data.exp > nowSec + 30)) {
        inMemoryToken = {
          token: data.token,
          cdnHost: data.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz',
          exp: data.exp || null,
          source: data.source || 'server_api',
          fetchedAt: nowMs
        };
        lastFetchTime = nowMs;
        updateGlobalAzamToken(data.token);
        return inMemoryToken;
      }
    }
  } catch {
    // Local endpoint unavailable (e.g. running statically or serverless cold start)
  }

  // 2. Direct fallback to streamzone.fun/api/cdn-token (supports CORS access-control-allow-origin: *)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const directRes = await fetch('https://streamzone.fun/api/cdn-token', {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (directRes.ok) {
      const data = await directRes.json();
      if (data && data.token && (!data.exp || data.exp > nowSec + 30)) {
        inMemoryToken = {
          token: data.token,
          cdnHost: data.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz',
          exp: data.exp || null,
          source: 'direct_streamzone',
          fetchedAt: nowMs
        };
        lastFetchTime = nowMs;
        updateGlobalAzamToken(data.token);
        return inMemoryToken;
      }
    }
  } catch (directErr) {
    console.warn('Direct streamzone token fetch fallback note:', directErr);
  }

  // 3. Fallback to active valid token
  inMemoryToken = {
    token: FALLBACK_TOKEN,
    cdnHost: "https://cdnedgch2.azamtvltd.co.tz",
    exp: 1792521597,
    source: "static_active",
    fetchedAt: nowMs
  };
  updateGlobalAzamToken(FALLBACK_TOKEN);
  return inMemoryToken;
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

