import { Channel, updateGlobalAzamToken } from '../data/channels.ts';
import { getAppAuthHeaders } from './apiAuth.ts';

export interface CdnTokenData {
  token: string;
  cdnHost: string;
  exp: number | null;
  source?: string;
  fetchedAt?: number;
}

const FALLBACK_TOKEN = "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOiIxNzkzMzM5NjIwIiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoiMGM5MzI1NTExZmRlYjE2MyIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiI0ODQwODMyIiwiZGV2aWNlX2lkIjoiIiwibWF4X3Nlc3Npb25zIjowLCJzZXNzaW9uX2R1cmF0aW9uIjowLCJ1cmwiOiJodHRwczovLzEwLjY0LjEzMi4xNDciLCJzZXNzaW9uX3RpbWVvdXQiOjAsImF1ZCI6IjciLCJzb3VyY2VzIjpbM119.V72IVAu-hcQN1a6onYrH7eHY8ACNdEibg7w2c_q1JVaAl-kZxrjCTKVOu07UOP9C2W0a6NmjO3TTWB7lKgNyUA==";

let inMemoryToken: CdnTokenData | null = {
  token: FALLBACK_TOKEN,
  cdnHost: "https://cdnedgch2.azamtvltd.co.tz",
  exp: 1793339620,
  source: "prewarmed_instant",
  fetchedAt: Date.now()
};
let lastFetchTime = Date.now();
const TOKEN_CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

// Fetch latest valid token from server or direct live CDN endpoint
export async function getLiveCdnToken(forceRefresh = false): Promise<CdnTokenData> {
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  // If we already have a valid in-memory token that is NOT expired (keep at least 90s buffer)
  if (
    !forceRefresh &&
    inMemoryToken &&
    (!inMemoryToken.exp || inMemoryToken.exp > nowSec + 90)
  ) {
    // If cache is older than 3 minutes, refresh silently in background without blocking player
    if (nowMs - lastFetchTime > TOKEN_CACHE_DURATION) {
      setTimeout(() => {
        fetch('/baynithalex/api/cdn-token', { headers: getAppAuthHeaders() })
          .then(r => r.json())
          .then(d => {
            if (d?.token) {
              inMemoryToken = {
                token: d.token,
                cdnHost: d.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz',
                exp: d.exp || null,
                source: 'server_api_bg',
                fetchedAt: Date.now()
              };
              lastFetchTime = Date.now();
              updateGlobalAzamToken(d.token);
            }
          })
          .catch(() => {});
      }, 0);
    }
    return inMemoryToken;
  }

  // 1. Try local server API endpoint (/baynithalex/api/cdn-token) - fast 1.5s timeout
  try {
    const url = forceRefresh ? '/baynithalex/api/cdn-token?refresh=true' : '/baynithalex/api/cdn-token';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: getAppAuthHeaders()
    });
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

