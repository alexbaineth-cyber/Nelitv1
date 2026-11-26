import type { Express, Request, Response, NextFunction } from 'express';
import { Readable } from 'stream';
import {
  DEFAULT_STREAM_TTL_SECONDS,
  StreamGeneratorStore,
  StreamStorageError,
  TempStreamRecord,
  inspectStorageStatus,
  streamGeneratorStore
} from './streamGeneratorStore.ts';
import {
  decryptRelayTarget,
  encryptRelayTarget,
  generatePlaybackToken,
  generateUnpredictableStreamId,
  maskHostForDisplay,
  maskSourceUrlForDisplay,
  verifyPlaybackTokenConstantTime
} from './streamRelayCrypto.ts';
import {
  isPrivateOrReservedIp,
  safeFetchWithRedirectValidation,
  validateExternalStreamUrl
} from './ssrfGuard.ts';
import { manifestEdgeCache } from './streamResilience.ts';

interface StreamGeneratorRouteDeps {
  verifyClientToken: (token: string) => Record<string, any> | null;
  extractPortalTokenFromReq: (req: Request) => string;
  publicSiteUrl: string;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

function createIpRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, RateBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const forwarded = (req.get('x-forwarded-for') || '').split(',')[0].trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';

    if (buckets.size > 5000) {
      for (const [k, v] of buckets.entries()) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }

    const existing = buckets.get(ip);
    if (!existing || existing.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        error: 'Maombi mengi mno kwa muda mfupi. Tafadhali subiri kidogo.'
      });
    }

    existing.count += 1;
    return next();
  };
}

function resolveRelayBaseUrl(req: Request, publicSiteUrl: string): string {
  const dedicated = (process.env.STREAM_RELAY_BASE_URL || '').trim().replace(/\/+$/, '');
  if (dedicated) {
    try {
      const parsed = new URL(dedicated);
      const h = parsed.hostname.toLowerCase();
      if (h !== 'localhost' && h !== '127.0.0.1' && h !== '::1' && parsed.protocol === 'http:') {
        parsed.protocol = 'https:';
        return parsed.toString().replace(/\/+$/, '');
      }
      return dedicated;
    } catch {
      return dedicated;
    }
  }

  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();

  if (host) {
    const hostnameOnly = host.split(':')[0].toLowerCase();
    const isLoopback = hostnameOnly === 'localhost' || hostnameOnly === '127.0.0.1' || hostnameOnly === '[::1]';
    const proto = !isLoopback ? 'https' : forwardedProto === 'https' ? 'https' : req.protocol || 'http';
    return `${proto}://${host}`;
  }
  return publicSiteUrl;
}

function buildPlaybackUrl(
  baseUrl: string,
  streamId: string,
  playbackToken: string
): string {
  return `${baseUrl}/stream/${encodeURIComponent(streamId)}/master.m3u8?token=${encodeURIComponent(playbackToken)}`;
}

function sanitizeStreamForAdmin(
  record: TempStreamRecord,
  baseUrl: string
) {
  let sourceHost = 'protected';
  try {
    sourceHost = maskHostForDisplay(new URL(record.source_url).hostname);
  } catch {}

  const nowMs = Date.now();
  const remainingSeconds = Math.max(0, Math.floor((record.expires_at_ms - nowMs) / 1000));

  return {
    stream_id: record.stream_id,
    stream_name: record.stream_name,
    description: record.description || '',
    category: record.category || 'Live TV',
    source_host: sourceHost,
    source_masked: maskSourceUrlForDisplay(record.source_url),
    created_at: record.created_at,
    expires_at: record.expires_at,
    expires_at_ms: record.expires_at_ms,
    ttl_seconds: record.ttl_seconds,
    remaining_seconds: remainingSeconds,
    status: remainingSeconds <= 0 ? 'expired' : record.status,
    playback_url: buildPlaybackUrl(baseUrl, record.stream_id, record.playback_token),
    playback_requests: record.playback_requests || 0,
    last_checked_at: record.last_checked_at,
    last_error: record.last_error,
    upstream_http_status: record.upstream_http_status,
    response_time_ms: record.response_time_ms
  };
}

function inferExtensionFromUrl(rawUrl: string, fallback: string): string {
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    const match = pathname.match(/\.(m3u8|m3u|ts|m4s|mp4|aac|vtt|key|webm)$/);
    if (match) return match[1];
  } catch {}
  return fallback;
}

function inferContentTypeFromExtOrHeader(ext: string, upstreamType: string | null): string {
  const cleanHeader = (upstreamType || '').split(';')[0].trim().toLowerCase();
  if (ext === 'm3u8' || ext === 'm3u' || cleanHeader.includes('mpegurl')) {
    return 'application/vnd.apple.mpegurl; charset=utf-8';
  }
  if (ext === 'ts') return 'video/mp2t';
  if (ext === 'm4s') return 'video/iso.segment';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'vtt') return 'text/vtt; charset=utf-8';
  if (ext === 'key') return 'application/octet-stream';
  if (cleanHeader && cleanHeader !== 'text/plain') return cleanHeader;
  return 'application/octet-stream';
}

function rewriteHlsPlaylist(
  playlistBody: string,
  basePlaylistUrl: string,
  relayBaseUrl: string,
  streamId: string,
  playbackToken: string,
  expiresAtMs: number
): string {
  const makeRelayUri = (rawUri: string, defaultExt = 'ts'): string => {
    const trimmed = rawUri.trim();
    if (!trimmed) return rawUri;
    let resolved: string;
    try {
      resolved = new URL(trimmed, basePlaylistUrl).toString();
    } catch {
      return rawUri;
    }

    const ext = inferExtensionFromUrl(resolved, defaultExt);
    const enc = encryptRelayTarget(streamId, resolved, expiresAtMs);
    return `${relayBaseUrl}/stream/${encodeURIComponent(streamId)}/media/${enc}.${ext}?token=${encodeURIComponent(playbackToken)}`;
  };

  const lines = playlistBody.split(/\r?\n/);
  let nextIsMediaPlaylistRef = false;

  const rewrittenLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      nextIsMediaPlaylistRef = trimmed.startsWith('#EXT-X-STREAM-INF');

      // Rewrite URI="..." inside HLS tags (#EXT-X-MEDIA, #EXT-X-MAP, #EXT-X-KEY, #EXT-X-I-FRAME-STREAM-INF, #EXT-X-PART, #EXT-X-PRELOAD-HINT)
      if (/URI="[^"]+"/i.test(line)) {
        const tagDefaultExt = trimmed.startsWith('#EXT-X-KEY')
          ? 'key'
          : trimmed.startsWith('#EXT-X-MAP')
          ? 'mp4'
          : trimmed.startsWith('#EXT-X-MEDIA') || trimmed.startsWith('#EXT-X-I-FRAME-STREAM-INF')
          ? 'm3u8'
          : 'ts';
        return line.replace(/URI="([^"]+)"/gi, (_m, uriValue: string) => {
          return `URI="${makeRelayUri(uriValue, tagDefaultExt)}"`;
        });
      }
      return line;
    }

    const defaultExt = nextIsMediaPlaylistRef ? 'm3u8' : 'ts';
    nextIsMediaPlaylistRef = false;
    return makeRelayUri(trimmed, defaultExt);
  });

  return rewrittenLines.join('\n');
}

async function probeUpstreamHls(
  sourceUrl: string,
  allowlist: string[]
): Promise<{
  status: 'online' | 'offline';
  httpStatus: number | null;
  responseTimeMs: number;
  error: string | null;
}> {
  const startedAt = Date.now();
  let sourceHost = '';
  try {
    sourceHost = new URL(sourceUrl).hostname;
  } catch {}

  try {
    const { response } = await safeFetchWithRedirectValidation(sourceUrl, {
      method: 'GET',
      timeoutMs: 8000,
      allowlist,
      enforceAllowlist: true,
      sameOriginHostOnly: sourceHost,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
      }
    });

    const elapsed = Math.max(1, Date.now() - startedAt);
    if (!response.ok) {
      return {
        status: 'offline',
        httpStatus: response.status,
        responseTimeMs: elapsed,
        error: `Upstream returned HTTP ${response.status}`
      };
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const preview = (await response.text()).slice(0, 8192);

    const looksLikeHls =
      preview.includes('#EXTM3U') ||
      contentType.includes('mpegurl') ||
      contentType.includes('vnd.apple');

    if (!looksLikeHls) {
      return {
        status: 'offline',
        httpStatus: response.status,
        responseTimeMs: elapsed,
        error: 'Upstream response is not a valid HLS (#EXTM3U) playlist'
      };
    }

    return {
      status: 'online',
      httpStatus: response.status,
      responseTimeMs: elapsed,
      error: null
    };
  } catch (err: any) {
    const elapsed = Math.max(1, Date.now() - startedAt);
    const msg =
      err?.name === 'AbortError'
        ? 'Upstream timeout after 8000ms'
        : String(err?.message || 'Upstream connection failed');
    return {
      status: 'offline',
      httpStatus: null,
      responseTimeMs: elapsed,
      error: msg
    };
  }
}

export function registerStreamGeneratorRoutes(
  app: Express,
  deps: StreamGeneratorRouteDeps,
  store: StreamGeneratorStore = streamGeneratorStore
) {
  const adminLimiter = createIpRateLimiter(90, 60_000);
  const playbackLimiter = createIpRateLimiter(6000, 60_000);

  const isAllowedAdminOrigin = (origin: string, req: Request): boolean => {
    try {
      const parsed = new URL(origin);
      const reqHost = (req.get('x-forwarded-host') || req.get('host') || '').toLowerCase();
      if (reqHost && parsed.host.toLowerCase() === reqHost) return true;
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'nelitv.online' ||
        host === 'www.nelitv.online' ||
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.run.app') ||
        host.endsWith('.vercel.app')
      );
    } catch {
      return false;
    }
  };

  const applyAdminHeaders = (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    const origin = req.get('origin');
    if (origin && isAllowedAdminOrigin(origin, req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.removeHeader('Access-Control-Allow-Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Portal-Token');
  };

  app.options('/api/stream-generator*', (req: Request, res: Response) => {
    applyAdminHeaders(req, res);
    return res.status(204).end();
  });

  const requireAdminPortal = (req: Request, res: Response, next: NextFunction) => {
    applyAdminHeaders(req, res);

    const origin = req.get('origin');
    if (origin && !isAllowedAdminOrigin(origin, req)) {
      return res.status(403).json({
        success: false,
        error: 'Origin not allowed for administrative actions.'
      });
    }

    const token = deps.extractPortalTokenFromReq(req);
    const verified = token ? deps.verifyClientToken(token) : null;
    if (!verified || verified.scope !== 'nelitv-portal') {
      return res.status(401).json({
        success: false,
        error: 'Admin authorization required. Unlock NeliTv Server first.'
      });
    }

    return next();
  };

  const handleRouteError = (res: Response, err: any) => {
    if (err instanceof StreamStorageError) {
      return res.status(err.statusCode).json({
        success: false,
        code: err.code,
        error: err.message
      });
    }
    return res.status(500).json({
      success: false,
      error: err?.message || 'Unexpected stream generator server error.'
    });
  };

  // ============================================================
  // 1. ADMIN API ENDPOINTS (/api/stream-generator/*)
  // ============================================================

  app.get('/api/stream-generator/status', adminLimiter, requireAdminPortal, async (_req: Request, res: Response) => {
    try {
      const storage = await inspectStorageStatus(store.getFallbackSupabase());
      const allowlist = await store.getAllowlist();
      return res.json({
        success: true,
        storage,
        allowlist,
        ttlSeconds: DEFAULT_STREAM_TTL_SECONDS
      });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.get('/api/stream-generator/list', adminLimiter, requireAdminPortal, async (req: Request, res: Response) => {
    try {
      const baseUrl = resolveRelayBaseUrl(req, deps.publicSiteUrl);
      const storage = await inspectStorageStatus(store.getFallbackSupabase());
      const allowlist = await store.getAllowlist();

      if (!storage.configured) {
        return res.json({
          success: true,
          storage,
          allowlist,
          streams: [],
          stats: {
            totalGenerated: 0,
            activeStreams: 0,
            expiredStreams: 0,
            offlineStreams: 0,
            totalPlaybackRequests: 0
          }
        });
      }

      const { streams, stats } = await store.listActiveStreamsAndStats();
      return res.json({
        success: true,
        storage,
        allowlist,
        streams: streams.map((s) => sanitizeStreamForAdmin(s, baseUrl)),
        stats
      });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.post('/api/stream-generator/create', adminLimiter, requireAdminPortal, async (req: Request, res: Response) => {
    try {
      const streamName = typeof req.body?.streamName === 'string' ? req.body.streamName.trim() : '';
      const sourceUrl = typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl.trim() : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 300) : '';
      const category = typeof req.body?.category === 'string' ? req.body.category.trim().slice(0, 60) : 'Live TV';
      const authorizeHost = Boolean(req.body?.authorizeHost);
      const requestedTtl = Number(req.body?.ttlSeconds);
      const ttlSeconds =
        Number.isFinite(requestedTtl) && requestedTtl >= 10 && requestedTtl <= DEFAULT_STREAM_TTL_SECONDS
          ? Math.floor(requestedTtl)
          : DEFAULT_STREAM_TTL_SECONDS;

      if (!streamName || streamName.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Jina la stream (Stream Name) linahitajika (herufi 1 - 100).'
        });
      }

      let allowlist = await store.getAllowlist();
      const preCheck = await validateExternalStreamUrl(sourceUrl, {
        allowlist,
        enforceAllowlist: !authorizeHost
      });

      if (!preCheck.valid || !preCheck.normalizedUrl || !preCheck.hostname) {
        return res.status(preCheck.requiresAllowlistApproval ? 422 : 400).json({
          success: false,
          requiresAllowlistApproval: Boolean(preCheck.requiresAllowlistApproval),
          hostname: preCheck.hostname,
          error: preCheck.error || 'Source URL si sahihi.'
        });
      }

      if (authorizeHost) {
        allowlist = await store.addAllowlistHost(preCheck.hostname);
      }

      // Generate unpredictable non-colliding ID
      let streamId = generateUnpredictableStreamId();
      for (let attempt = 0; attempt < 5; attempt++) {
        const tomb = await store.isTombstoned(streamId);
        if (!tomb) break;
        streamId = generateUnpredictableStreamId();
      }

      const nowMs = Date.now();
      const expiresAtMs = nowMs + ttlSeconds * 1000;
      const playbackToken = generatePlaybackToken();

      // Real server-side initial probe so status is never falsely marked online
      const probe = await probeUpstreamHls(preCheck.normalizedUrl, allowlist);

      const record: TempStreamRecord = {
        stream_id: streamId,
        stream_name: streamName,
        description,
        category: category || 'Live TV',
        source_url: preCheck.normalizedUrl,
        created_at: new Date(nowMs).toISOString(),
        expires_at: new Date(expiresAtMs).toISOString(),
        expires_at_ms: expiresAtMs,
        ttl_seconds: ttlSeconds,
        status: probe.status,
        playback_token: playbackToken,
        playback_requests: 0,
        last_checked_at: new Date().toISOString(),
        last_error: probe.error,
        upstream_http_status: probe.httpStatus,
        response_time_ms: probe.responseTimeMs
      };

      await store.createStream(record);

      const baseUrl = resolveRelayBaseUrl(req, deps.publicSiteUrl);
      const sanitized = sanitizeStreamForAdmin(record, baseUrl);

      return res.status(201).json({
        success: true,
        stream: sanitized,
        playback_url: sanitized.playback_url,
        allowlist
      });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.patch('/api/stream-generator/:id', adminLimiter, requireAdminPortal, async (req: Request, res: Response) => {
    try {
      const streamId = req.params.id;
      const lookup = await store.getStreamForPlayback(streamId);
      if (lookup.state === 'expired') {
        return res.status(410).json({
          success: false,
          error: 'Link hii imekwisha muda wake (masaa 5) na imeondolewa.'
        });
      }
      if (lookup.state === 'not_found') {
        return res.status(404).json({ success: false, error: 'Stream haikupatikana.' });
      }

      const record = lookup.record;
      let allowlist = await store.getAllowlist();

      if (typeof req.body?.streamName === 'string') {
        const nextName = req.body.streamName.trim();
        if (!nextName || nextName.length > 100) {
          return res.status(400).json({ success: false, error: 'Stream Name si sahihi.' });
        }
        record.stream_name = nextName;
      }

      if (typeof req.body?.description === 'string') {
        record.description = req.body.description.trim().slice(0, 300);
      }

      if (typeof req.body?.category === 'string') {
        record.category = req.body.category.trim().slice(0, 60) || 'Live TV';
      }

      if (typeof req.body?.sourceUrl === 'string' && req.body.sourceUrl.trim()) {
        const authorizeHost = Boolean(req.body?.authorizeHost);
        const urlCheck = await validateExternalStreamUrl(req.body.sourceUrl.trim(), {
          allowlist,
          enforceAllowlist: !authorizeHost
        });
        if (!urlCheck.valid || !urlCheck.normalizedUrl || !urlCheck.hostname) {
          return res.status(urlCheck.requiresAllowlistApproval ? 422 : 400).json({
            success: false,
            requiresAllowlistApproval: Boolean(urlCheck.requiresAllowlistApproval),
            hostname: urlCheck.hostname,
            error: urlCheck.error || 'Source URL mpya si sahihi.'
          });
        }
        if (authorizeHost) {
          allowlist = await store.addAllowlistHost(urlCheck.hostname);
        }
        record.source_url = urlCheck.normalizedUrl;

        const probe = await probeUpstreamHls(record.source_url, allowlist);
        record.status = probe.status;
        record.upstream_http_status = probe.httpStatus;
        record.response_time_ms = probe.responseTimeMs;
        record.last_checked_at = new Date().toISOString();
        record.last_error = probe.error;
      }

      await store.saveUpdatedStream(record);
      const baseUrl = resolveRelayBaseUrl(req, deps.publicSiteUrl);
      return res.json({
        success: true,
        stream: sanitizeStreamForAdmin(record, baseUrl),
        allowlist
      });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.post('/api/stream-generator/:id/health', adminLimiter, requireAdminPortal, async (req: Request, res: Response) => {
    try {
      const streamId = req.params.id;
      const lookup = await store.getStreamForPlayback(streamId);
      if (lookup.state === 'expired') {
        return res.status(410).json({
          success: false,
          error: 'Link hii imekwisha muda wake (masaa 5) na imeondolewa.'
        });
      }
      if (lookup.state === 'not_found') {
        return res.status(404).json({ success: false, error: 'Stream haikupatikana.' });
      }

      const record = lookup.record;
      const allowlist = await store.getAllowlist();
      const probe = await probeUpstreamHls(record.source_url, allowlist);

      record.status = probe.status;
      record.upstream_http_status = probe.httpStatus;
      record.response_time_ms = probe.responseTimeMs;
      record.last_checked_at = new Date().toISOString();
      record.last_error = probe.error;

      await store.saveUpdatedStream(record);
      const baseUrl = resolveRelayBaseUrl(req, deps.publicSiteUrl);
      return res.json({
        success: true,
        stream: sanitizeStreamForAdmin(record, baseUrl)
      });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.delete('/api/stream-generator/:id', adminLimiter, requireAdminPortal, async (req: Request, res: Response) => {
    try {
      const streamId = req.params.id;
      const deleted = await store.deleteStreamImmediately(streamId);
      return res.json({
        success: true,
        deleted,
        stream_id: streamId
      });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.post('/api/stream-generator/allowlist', adminLimiter, requireAdminPortal, async (req: Request, res: Response) => {
    try {
      const rawHost = typeof req.body?.host === 'string' ? req.body.host.trim().toLowerCase() : '';
      if (!rawHost) {
        return res.status(400).json({ success: false, error: 'Ingiza domain au IP sahihi.' });
      }
      const cleanHost = rawHost.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      const probeUrl = `https://${cleanHost}/stream.m3u8`;
      const check = await validateExternalStreamUrl(probeUrl, { enforceAllowlist: false });
      if (!check.valid || !check.hostname || (check.hostname && isPrivateOrReservedIp(check.hostname))) {
        return res.status(400).json({
          success: false,
          error: check.error || 'Domain au IP hiyo haiwezi kuongezwa kwenye allowlist.'
        });
      }
      const allowlist = await store.addAllowlistHost(check.hostname);
      return res.json({ success: true, allowlist });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.delete('/api/stream-generator/allowlist', adminLimiter, requireAdminPortal, async (req: Request, res: Response) => {
    try {
      const host = typeof req.body?.host === 'string' ? req.body.host.trim().toLowerCase() : '';
      if (!host) {
        return res.status(400).json({ success: false, error: 'Host inahitajika.' });
      }
      const allowlist = await store.removeAllowlistHost(host);
      return res.json({ success: true, allowlist });
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  // ============================================================
  // 2. PUBLIC HLS RELAY PLAYBACK GATEWAY (/stream/:id/*)
  // ============================================================

  const setRelayCorsHeaders = (res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
  };

  const setNoCachePlaylistHeaders = (res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  };

  const fetchUpstreamWithRetry = async (
    targetUrl: string,
    opts: Parameters<typeof safeFetchWithRedirectValidation>[1],
    retries = 1
  ): Promise<{ response: globalThis.Response; finalUrl: string }> => {
    let lastErr: any = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await safeFetchWithRedirectValidation(targetUrl, opts);
        if (result.response.status >= 500 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        return result;
      } catch (err: any) {
        lastErr = err;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
      }
    }
    throw lastErr;
  };

  app.options('/stream/:id/*', (_req: Request, res: Response) => {
    setRelayCorsHeaders(res);
    return res.status(204).end();
  });

  app.all(['/stream/:id/master.m3u8', '/stream/:id/master.m3u8/*'], playbackLimiter, async (req: Request, res: Response) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    setRelayCorsHeaders(res);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    const streamId = req.params.id;
    const providedToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    try {
      const lookup = await store.getStreamForPlayback(streamId);
      if (lookup.state === 'expired') {
        return res.status(410).json({
          success: false,
          code: 'STREAM_EXPIRED',
          error: 'Link hii ya stream imeisha muda wake wa masaa 5 (HTTP 410 Gone).'
        });
      }
      if (lookup.state === 'not_found') {
        return res.status(404).json({
          success: false,
          code: 'STREAM_NOT_FOUND',
          error: 'Stream link haikupatikana.'
        });
      }

      const record = lookup.record;

      // Explicit second guard against expiration
      if (record.expires_at_ms <= Date.now()) {
        await store.markExpiredAndPurge(streamId);
        return res.status(410).json({
          success: false,
          code: 'STREAM_EXPIRED',
          error: 'Link hii ya stream imeisha muda wake wa masaa 5 (HTTP 410 Gone).'
        });
      }

      if (!verifyPlaybackTokenConstantTime(record.playback_token, providedToken)) {
        return res.status(403).json({
          success: false,
          code: 'INVALID_PLAYBACK_TOKEN',
          error: 'Token ya uchezaji si sahihi au haipo.'
        });
      }

      const allowlist = await store.getAllowlist();
      const sourceHost = new URL(record.source_url).hostname;
      const startedAt = Date.now();
      const relayBaseUrl = resolveRelayBaseUrl(req, deps.publicSiteUrl);
      const masterCacheKey = `gen:master:${streamId}:${relayBaseUrl}`;

      const serveMasterStaleIfAvailable = (reason: string): boolean => {
        if (req.method !== 'GET') return false;
        const stale = manifestEdgeCache.getStaleFallback(masterCacheKey);
        if (!stale) return false;
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        setNoCachePlaylistHeaders(res);
        res.setHeader('X-Neli-Cache', 'stale-fallback');
        res.setHeader('X-Neli-Fallback-Reason', reason);
        res.status(200).send(stale.body);
        return true;
      };

      try {
        const { response, finalUrl } = await fetchUpstreamWithRetry(
          record.source_url,
          {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            timeoutMs: 9000,
            allowlist,
            enforceAllowlist: true,
            sameOriginHostOnly: sourceHost,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
            }
          },
          2
        );

        const elapsed = Math.max(1, Date.now() - startedAt);
        if (!response.ok) {
          if (serveMasterStaleIfAvailable(`http-${response.status}`)) {
            return;
          }
          record.status = 'offline';
          record.upstream_http_status = response.status;
          record.response_time_ms = elapsed;
          record.last_checked_at = new Date().toISOString();
          record.last_error = `Upstream playlist HTTP ${response.status}`;
          await store.saveUpdatedStream(record);
          return res.status(502).json({
            success: false,
            upstreamStatus: response.status,
            error: `Chanzo cha stream kimerudisha HTTP ${response.status} (hakiruhusu au hakipo hewani).`
          });
        }

        record.status = 'online';
        record.upstream_http_status = response.status;
        record.response_time_ms = elapsed;
        record.last_checked_at = new Date().toISOString();
        record.last_error = null;
        if (req.method === 'GET') {
          record.playback_requests = (record.playback_requests || 0) + 1;
        }
        await store.saveUpdatedStream(record);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        setNoCachePlaylistHeaders(res);
        if (req.method === 'HEAD') {
          return res.status(200).end();
        }

        const playlistText = await response.text();
        if (!playlistText.includes('#EXTM3U')) {
          if (serveMasterStaleIfAvailable('invalid-m3u8')) {
            return;
          }
          record.status = 'offline';
          record.last_error = 'Upstream response missing #EXTM3U header';
          await store.saveUpdatedStream(record);
          return res.status(502).json({
            success: false,
            error: 'Chanzo hakikurejesha orodha sahihi ya HLS.'
          });
        }

        const rewritten = rewriteHlsPlaylist(
          playlistText,
          finalUrl,
          relayBaseUrl,
          record.stream_id,
          record.playback_token,
          record.expires_at_ms
        );
        manifestEdgeCache.set(
          masterCacheKey,
          rewritten,
          'application/vnd.apple.mpegurl; charset=utf-8'
        );
        res.setHeader('X-Neli-Cache', 'live');
        return res.status(200).send(rewritten);
      } catch (fetchErr: any) {
        if (serveMasterStaleIfAvailable(fetchErr?.name === 'AbortError' ? 'timeout' : 'network-blip')) {
          return;
        }
        const elapsed = Math.max(1, Date.now() - startedAt);
        const isTimeout = fetchErr?.name === 'AbortError';
        record.status = 'offline';
        record.upstream_http_status = null;
        record.response_time_ms = elapsed;
        record.last_checked_at = new Date().toISOString();
        record.last_error = isTimeout ? 'Upstream timeout' : 'Upstream relay error';
        await store.saveUpdatedStream(record);

        return res.status(isTimeout ? 504 : 502).json({
          success: false,
          error: isTimeout
            ? 'Chanzo cha stream kimechelewa kujibu (timeout).'
            : 'Imeshindikana kuwasiliana na chanzo cha stream kwa sasa.'
        });
      }
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });

  app.all('/stream/:id/media/:resource', playbackLimiter, async (req: Request, res: Response) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    setRelayCorsHeaders(res);

    const streamId = req.params.id;
    const resourceToken = req.params.resource;
    const providedToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    try {
      const lookup = await store.getStreamForPlayback(streamId, { useCache: true });
      if (lookup.state === 'expired') {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(410).json({
          success: false,
          code: 'STREAM_EXPIRED',
          error: 'Link hii ya stream imeisha muda wake wa masaa 5 (HTTP 410 Gone).'
        });
      }
      if (lookup.state === 'not_found') {
        return res.status(404).json({
          success: false,
          code: 'STREAM_NOT_FOUND',
          error: 'Stream haijapatikana.'
        });
      }

      const record = lookup.record;
      if (record.expires_at_ms <= Date.now()) {
        await store.markExpiredAndPurge(streamId);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(410).json({
          success: false,
          code: 'STREAM_EXPIRED',
          error: 'Link hii ya stream imeisha muda wake wa masaa 5 (HTTP 410 Gone).'
        });
      }

      if (!verifyPlaybackTokenConstantTime(record.playback_token, providedToken)) {
        return res.status(403).json({
          success: false,
          code: 'INVALID_PLAYBACK_TOKEN',
          error: 'Token ya uchezaji si sahihi.'
        });
      }

      const decodedTarget = decryptRelayTarget(streamId, resourceToken);
      if (!decodedTarget) {
        return res.status(403).json({
          success: false,
          error: 'Anwani ya kipande hiki cha stream si halali au imeisha muda wake.'
        });
      }

      if (decodedTarget.expiresAtMs <= Date.now()) {
        return res.status(410).json({
          success: false,
          code: 'STREAM_EXPIRED',
          error: 'Muda wa uchezaji umeisha (HTTP 410 Gone).'
        });
      }

      const upstreamHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: '*/*'
      };
      const rangeHeader = req.get('range');
      if (rangeHeader) {
        upstreamHeaders['Range'] = rangeHeader;
      }

      const ext = inferExtensionFromUrl(decodedTarget.url, 'ts');
      const isPlaylistExt = ext === 'm3u8' || ext === 'm3u';
      const relayBaseUrl = resolveRelayBaseUrl(req, deps.publicSiteUrl);
      const subPlaylistCacheKey = `gen:media:${streamId}:${decodedTarget.url}:${relayBaseUrl}`;

      const serveSubStaleIfAvailable = (): boolean => {
        if (!isPlaylistExt || req.method !== 'GET') return false;
        const stale = manifestEdgeCache.getStaleFallback(subPlaylistCacheKey);
        if (!stale) return false;
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        setNoCachePlaylistHeaders(res);
        res.setHeader('X-Neli-Cache', 'stale-fallback');
        res.status(200).send(stale.body);
        return true;
      };

      try {
        let { response, finalUrl } = await fetchUpstreamWithRetry(
          decodedTarget.url,
          {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            timeoutMs: 12000,
            enforceAllowlist: false,
            headers: upstreamHeaders
          },
          isPlaylistExt ? 2 : 1
        );

        // Self-healing live playlist refresh: if an upstream CDN rotated its session/media playlist URL,
        // re-fetch record.source_url once and extract a fresh active media playlist transparently.
        if (
          !response.ok &&
          isPlaylistExt &&
          req.method === 'GET' &&
          (response.status === 403 || response.status === 404 || response.status === 410 || response.status >= 500)
        ) {
          try {
            const masterFetch = await fetchUpstreamWithRetry(
              record.source_url,
              {
                method: 'GET',
                timeoutMs: 9000,
                enforceAllowlist: false,
                headers: {
                  'User-Agent': upstreamHeaders['User-Agent'],
                  Accept: 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
                }
              },
              1
            );
            if (masterFetch.response.ok) {
              const masterBody = await masterFetch.response.text();
              if (masterBody.includes('#EXTM3U')) {
                const variantLine = masterBody
                  .split(/\r?\n/)
                  .map((l) => l.trim())
                  .find((l) => l && !l.startsWith('#'));
                if (masterBody.includes('#EXT-X-STREAM-INF') && variantLine) {
                  const freshVariantUrl = new URL(variantLine, masterFetch.finalUrl).toString();
                  const freshMediaFetch = await fetchUpstreamWithRetry(
                    freshVariantUrl,
                    {
                      method: 'GET',
                      timeoutMs: 12000,
                      enforceAllowlist: false,
                      headers: upstreamHeaders
                    },
                    1
                  );
                  if (freshMediaFetch.response.ok) {
                    response = freshMediaFetch.response;
                    finalUrl = freshMediaFetch.finalUrl;
                  }
                } else {
                  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
                  setNoCachePlaylistHeaders(res);
                  const rewrittenFresh = rewriteHlsPlaylist(
                    masterBody,
                    masterFetch.finalUrl,
                    relayBaseUrl,
                    record.stream_id,
                    record.playback_token,
                    record.expires_at_ms
                  );
                  manifestEdgeCache.set(
                    subPlaylistCacheKey,
                    rewrittenFresh,
                    'application/vnd.apple.mpegurl; charset=utf-8'
                  );
                  return res.status(200).send(rewrittenFresh);
                }
              }
            }
          } catch {}
        }

        if (!response.ok && response.status !== 206) {
          if (serveSubStaleIfAvailable()) return;
          return res.status(502).json({
            success: false,
            upstreamStatus: response.status,
            error: `Hitilafu ya upstream (${response.status}).`
          });
        }

        const upstreamType = response.headers.get('content-type');
        const resolvedContentType = inferContentTypeFromExtOrHeader(ext, upstreamType);
        const isPlaylist =
          isPlaylistExt ||
          resolvedContentType.includes('mpegurl');

        if (isPlaylist) {
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          setNoCachePlaylistHeaders(res);
          if (req.method === 'HEAD') {
            return res.status(200).end();
          }
          const subPlaylistText = await response.text();
          if (!subPlaylistText.includes('#EXTM3U') && serveSubStaleIfAvailable()) {
            return;
          }
          const rewrittenSub = rewriteHlsPlaylist(
            subPlaylistText,
            finalUrl,
            relayBaseUrl,
            record.stream_id,
            record.playback_token,
            record.expires_at_ms
          );
          manifestEdgeCache.set(
            subPlaylistCacheKey,
            rewrittenSub,
            'application/vnd.apple.mpegurl; charset=utf-8'
          );
          res.setHeader('X-Neli-Cache', 'live');
          return res.status(200).send(rewrittenSub);
        }

        // Binary segment / init / key relay
        res.status(response.status);
        res.setHeader('Content-Type', resolvedContentType);
        res.setHeader(
          'Cache-Control',
          ext === 'key' ? 'no-store, no-cache, must-revalidate, max-age=0' : 'private, max-age=30'
        );

        const contentLength = response.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);
        const acceptRanges = response.headers.get('accept-ranges');
        if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
        const contentRange = response.headers.get('content-range');
        if (contentRange) res.setHeader('Content-Range', contentRange);

        if (req.method === 'HEAD' || !response.body) {
          return res.end();
        }

        const nodeStream = Readable.fromWeb(response.body as any);
        nodeStream.on('error', () => {
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.end();
          }
        });
        req.on('close', () => {
          try {
            nodeStream.destroy();
          } catch {}
        });
        return nodeStream.pipe(res);
      } catch (segErr: any) {
        if (serveSubStaleIfAvailable()) return;
        const isTimeout = segErr?.name === 'AbortError';
        if (!res.headersSent) {
          return res.status(isTimeout ? 504 : 502).json({
            success: false,
            error: isTimeout ? 'Upstream segment timeout.' : 'Imeshindikana kupakia kipande cha stream.'
          });
        }
        return res.end();
      }
    } catch (err: any) {
      return handleRouteError(res, err);
    }
  });
}
