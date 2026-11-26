import { CHANNELS_DATA, Channel } from '../data/channels.ts';

export interface ManifestCacheEntry {
  body: string;
  contentType: string;
  cachedAt: number;
  lastGoodAt: number;
}

export interface SegmentCacheEntry {
  buffer: Buffer;
  contentType: string;
  status: number;
  cachedAt: number;
  bytes: number;
}

export interface ChannelHealthRecord {
  id: string;
  name: string;
  online: boolean;
  needsProxy: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
}

const KNOWN_INITIALLY_OFFLINE_IDS = new Set<string>([
  'tbc-1-live',
  'tbc-2-live',
  'tanzania-safari-channel-live',
  'bein-sports',
  'espn-7',
  'nbc-sports-now',
  'fifa-plus-women',
  'red-bull-tv',
  'tom-and-jerry',
  'now-global',
  'movie-sphere'
]);

const KNOWN_PROXY_PREFERRED_IDS = new Set<string>([
  'pop-animation-network',
  'sony-movie-action',
  'ba2b232c-a79d-4130-b5d8-4883fbce7a1d', // TNT Sports 2 HD
  '82166c0a-4a51-4347-ae54-3c0f7363390e', // TNT Sports 1 HD
  'inter-tv',
  'bek-sports',
  'tinypop',
  'trace-latina',
  'wwe-network-tv'
]);

export class EdgeManifestCache {
  private cache = new Map<string, ManifestCacheEntry>();
  private inFlight = new Map<string, Promise<ManifestCacheEntry | null>>();
  private readonly freshTtlMs: number;
  private readonly staleFallbackTtlMs: number;
  private readonly maxEntries: number;
  public hits = 0;
  public staleServes = 0;
  public misses = 0;

  constructor(freshTtlMs = 1500, staleFallbackTtlMs = 25000, maxEntries = 250) {
    this.freshTtlMs = freshTtlMs;
    this.staleFallbackTtlMs = staleFallbackTtlMs;
    this.maxEntries = maxEntries;
  }

  getFresh(key: string): ManifestCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt <= this.freshTtlMs) {
      this.hits += 1;
      return entry;
    }
    return null;
  }

  getStaleFallback(key: string): ManifestCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.lastGoodAt <= this.staleFallbackTtlMs) {
      this.staleServes += 1;
      return entry;
    }
    this.cache.delete(key);
    return null;
  }

  set(key: string, body: string, contentType: string): ManifestCacheEntry {
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    const now = Date.now();
    const entry: ManifestCacheEntry = {
      body,
      contentType,
      cachedAt: now,
      lastGoodAt: now
    };
    this.cache.set(key, entry);
    return entry;
  }

  async coalesce(
    key: string,
    fetcher: () => Promise<ManifestCacheEntry | null>
  ): Promise<ManifestCacheEntry | null> {
    const fresh = this.getFresh(key);
    if (fresh) return fresh;

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    this.misses += 1;
    const pending = fetcher().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, pending);
    return pending;
  }

  getStats() {
    return {
      entries: this.cache.size,
      hits: this.hits,
      staleServes: this.staleServes,
      misses: this.misses
    };
  }
}

export class EdgeSegmentCache {
  private cache = new Map<string, SegmentCacheEntry>();
  private inFlight = new Map<string, Promise<SegmentCacheEntry | null>>();
  private totalBytes = 0;
  private readonly maxBytes: number;
  private readonly ttlMs: number;
  public hits = 0;
  public misses = 0;

  constructor(maxBytes = 40 * 1024 * 1024, ttlMs = 20000) {
    this.maxBytes = maxBytes;
    this.ttlMs = ttlMs;
  }

  get(key: string): SegmentCacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.totalBytes = Math.max(0, this.totalBytes - entry.bytes);
      this.cache.delete(key);
      return null;
    }
    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits += 1;
    return entry;
  }

  set(key: string, buffer: Buffer, contentType: string, status: number): SegmentCacheEntry {
    const bytes = buffer.byteLength;
    // Skip caching giant files > 4MB so memory stays bounded
    if (bytes > 4 * 1024 * 1024) {
      return { buffer, contentType, status, cachedAt: Date.now(), bytes };
    }

    const existing = this.cache.get(key);
    if (existing) {
      this.totalBytes = Math.max(0, this.totalBytes - existing.bytes);
      this.cache.delete(key);
    }

    while (this.totalBytes + bytes > this.maxBytes && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      const oldEntry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      if (oldEntry) {
        this.totalBytes = Math.max(0, this.totalBytes - oldEntry.bytes);
      }
    }

    const entry: SegmentCacheEntry = {
      buffer,
      contentType,
      status,
      cachedAt: Date.now(),
      bytes
    };
    this.cache.set(key, entry);
    this.totalBytes += bytes;
    return entry;
  }

  async coalesce(
    key: string,
    fetcher: () => Promise<SegmentCacheEntry | null>
  ): Promise<SegmentCacheEntry | null> {
    const cached = this.get(key);
    if (cached) return cached;

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    this.misses += 1;
    const pending = fetcher().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, pending);
    return pending;
  }

  getStats() {
    return {
      entries: this.cache.size,
      usedMb: Number((this.totalBytes / (1024 * 1024)).toFixed(2)),
      hits: this.hits,
      misses: this.misses
    };
  }
}

export class ChannelHealthGuardian {
  private records = new Map<string, ChannelHealthRecord>();
  private isScanning = false;
  private lastSweepAt: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly channels: Channel[]) {
    for (const ch of channels) {
      const isInitOffline = ch.isActive === false || KNOWN_INITIALLY_OFFLINE_IDS.has(ch.id);
      this.records.set(ch.id, {
        id: ch.id,
        name: ch.name,
        online: !isInitOffline,
        needsProxy: KNOWN_PROXY_PREFERRED_IDS.has(ch.id),
        statusCode: isInitOffline ? 404 : 200,
        latencyMs: null,
        consecutiveFailures: isInitOffline ? 2 : 0,
        lastCheckedAt: null,
        lastHealthyAt: isInitOffline ? null : new Date().toISOString()
      });
    }
  }

  start() {
    if (this.timer) return;
    // Initial non-blocking sweep 600ms after boot
    setTimeout(() => {
      void this.runSweep();
    }, 600);

    // Continuous health sweep every 2.5 minutes
    this.timer = setInterval(() => {
      void this.runSweep();
    }, 150_000);
  }

  private async probeOne(ch: Channel): Promise<void> {
    const existing = this.records.get(ch.id);
    if (!existing) return;

    const nowIso = new Date().toISOString();
    if (ch.streamFormat === 'embed' || ch.embedUrl) {
      existing.online = ch.isActive !== false;
      existing.statusCode = 200;
      existing.latencyMs = 1;
      existing.consecutiveFailures = 0;
      existing.lastCheckedAt = nowIso;
      existing.lastHealthyAt = nowIso;
      return;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);

    try {
      const resp = await fetch(ch.streamUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept: '*/*'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      const latencyMs = Math.max(1, Date.now() - startedAt);
      let isValidBody = resp.ok;
      if (resp.ok) {
        const preview = (await resp.text()).slice(0, 2048);
        if (ch.streamFormat === 'dash') {
          isValidBody = preview.includes('<MPD') || preview.includes('MPD');
        } else if (ch.streamFormat === 'hls') {
          isValidBody = preview.includes('#EXTM3U');
        }
      }

      const acao = resp.headers.get('access-control-allow-origin');
      const needsProxy =
        ch.streamFormat === 'hls' &&
        (!acao || (acao !== '*' && !acao.includes('nelitv.online')));

      existing.statusCode = resp.status;
      existing.latencyMs = latencyMs;
      existing.lastCheckedAt = nowIso;

      if (isValidBody) {
        existing.online = ch.isActive !== false;
        existing.needsProxy = needsProxy || KNOWN_PROXY_PREFERRED_IDS.has(ch.id);
        existing.consecutiveFailures = 0;
        existing.lastHealthyAt = nowIso;
      } else {
        existing.consecutiveFailures += 1;
        if (existing.consecutiveFailures >= 2 || resp.status === 404 || resp.status === 410) {
          existing.online = false;
        }
      }
    } catch {
      clearTimeout(timeout);
      existing.statusCode = null;
      existing.latencyMs = null;
      existing.lastCheckedAt = nowIso;
      existing.consecutiveFailures += 1;
      if (existing.consecutiveFailures >= 2) {
        existing.online = false;
      }
    }
  }

  async runSweep(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;
    try {
      const batchSize = 8;
      for (let i = 0; i < this.channels.length; i += batchSize) {
        const batch = this.channels.slice(i, i + batchSize);
        await Promise.all(batch.map((ch) => this.probeOne(ch)));
      }
      this.lastSweepAt = new Date().toISOString();
    } catch {
      // Never throw from background sweep
    } finally {
      this.isScanning = false;
    }
  }

  isChannelOnline(id: string): boolean {
    const rec = this.records.get(id);
    return rec ? rec.online : true;
  }

  isProxyPreferred(id: string): boolean {
    const rec = this.records.get(id);
    return rec ? rec.needsProxy : KNOWN_PROXY_PREFERRED_IDS.has(id);
  }

  getRecord(id: string): ChannelHealthRecord | undefined {
    return this.records.get(id);
  }

  getSnapshot() {
    const all = Array.from(this.records.values());
    const onlineIds = all.filter((r) => r.online).map((r) => r.id);
    const offlineIds = all.filter((r) => !r.online).map((r) => r.id);
    const proxyPreferredIds = all.filter((r) => r.needsProxy).map((r) => r.id);
    return {
      total: all.length,
      onlineCount: onlineIds.length,
      offlineCount: offlineIds.length,
      lastSweepAt: this.lastSweepAt,
      isScanning: this.isScanning,
      onlineIds,
      offlineIds,
      proxyPreferredIds,
      channels: all
    };
  }
}

export const manifestEdgeCache = new EdgeManifestCache(1500, 25000, 300);
export const segmentEdgeCache = new EdgeSegmentCache(40 * 1024 * 1024, 20000);
export const channelHealthGuardian = new ChannelHealthGuardian(CHANNELS_DATA);
