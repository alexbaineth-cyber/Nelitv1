import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CHANNELS_DATA } from '../data/channels.ts';

export type StreamHealthStatus = 'online' | 'offline' | 'checking' | 'expired';

export interface TempStreamRecord {
  stream_id: string;
  stream_name: string;
  description: string;
  category: string;
  source_url: string;
  created_at: string;
  expires_at: string;
  expires_at_ms: number;
  ttl_seconds: number;
  status: StreamHealthStatus;
  playback_token: string;
  playback_requests: number;
  last_checked_at: string | null;
  last_error: string | null;
  upstream_http_status: number | null;
  response_time_ms: number | null;
}

export interface StorageStatusInfo {
  provider: 'upstash-redis' | 'supabase-postgres' | 'unconfigured';
  persistent: boolean;
  configured: boolean;
  reason?: string;
  upstashFreeTier: {
    price: string;
    maxStorage: string;
    maxCommandsPerMonth: string;
    maxBandwidthPerMonth: string;
    paygCommandsRate: string;
  };
  vercelLimits: {
    hobbyBandwidth: string;
    proBandwidth: string;
    dedicatedRelayConfigured: boolean;
  };
}

export const DEFAULT_STREAM_TTL_SECONDS = 18000; // 5 hours exact TTL
const TOMBSTONE_TTL_SECONDS = 30 * 24 * 3600; // 30 days to block expired ID reuse & ensure HTTP 410

const KEY_PREFIX = 'nelitv:sg:';
const STREAM_KEY = (id: string) => `${KEY_PREFIX}stream:${id}`;
const TOMBSTONE_KEY = (id: string) => `${KEY_PREFIX}tombstone:${id}`;
const ACTIVE_IDS_KEY = `${KEY_PREFIX}active_ids`;
const ALLOWLIST_KEY = `${KEY_PREFIX}allowlist`;
const STATS_EXPIRED_KEY = `${KEY_PREFIX}stats:expired_count`;
const STATS_CREATED_KEY = `${KEY_PREFIX}stats:created_count`;

function getUpstashConfig(): { url: string; token: string } | null {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ''
  ).trim().replace(/\/+$/, '');
  const token = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ''
  ).trim();
  if (url && token) {
    return { url, token };
  }
  return null;
}

function getSupabaseClient(fallbackClient?: SupabaseClient | null): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    '';
  if (url && key) {
    return createClient(url, key);
  }
  return fallbackClient || null;
}

export function getBuiltinAllowlistHosts(): string[] {
  const envHosts = (process.env.STREAM_GENERATOR_ALLOWED_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  const channelHosts = CHANNELS_DATA.flatMap((c) => {
    try {
      return c.streamUrl && c.streamFormat === 'hls' ? [new URL(c.streamUrl).hostname.toLowerCase()] : [];
    } catch {
      return [];
    }
  });

  return Array.from(
    new Set([
      ...envHosts,
      ...channelHosts,
      'akamaized.net',
      'cloudfront.net',
      'castr.net',
      'cdn77.org',
      'brightcove.com',
      'amagi.tv'
    ])
  );
}

async function upstashPipeline(
  cfg: { url: string; token: string },
  commands: (string | number)[][]
): Promise<any[]> {
  const resp = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands)
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Upstash Redis HTTP ${resp.status}: ${errBody.slice(0, 180)}`);
  }

  const results = (await resp.json()) as Array<{ result?: any; error?: string }>;
  if (!Array.isArray(results)) {
    throw new Error('Unexpected Upstash Redis pipeline response');
  }
  for (const item of results) {
    if (item?.error) {
      throw new Error(`Upstash Redis error: ${item.error}`);
    }
  }
  return results.map((r) => r.result);
}

export async function inspectStorageStatus(
  fallbackSupabase?: SupabaseClient | null
): Promise<StorageStatusInfo> {
  const upstash = getUpstashConfig();
  const baseInfo = {
    upstashFreeTier: {
      price: '$0 / month (No credit card required)',
      maxStorage: '250 MB',
      maxCommandsPerMonth: '500,000 commands / month',
      maxBandwidthPerMonth: '10 GB / month',
      paygCommandsRate: '$0.20 per 100,000 commands after free tier'
    },
    vercelLimits: {
      hobbyBandwidth: '100 GB Fast Data Transfer / month ($0/mo)',
      proBandwidth: '1 TB Fast Data Transfer / month ($20/mo, then $0.15/GB)',
      dedicatedRelayConfigured: Boolean(process.env.STREAM_RELAY_BASE_URL)
    }
  };

  if (upstash) {
    try {
      await upstashPipeline(upstash, [['PING']]);
      return {
        provider: 'upstash-redis',
        persistent: true,
        configured: true,
        ...baseInfo
      };
    } catch (err: any) {
      return {
        provider: 'unconfigured',
        persistent: false,
        configured: false,
        reason: `Upstash Redis connection failed: ${err.message}`,
        ...baseInfo
      };
    }
  }

  const sb = getSupabaseClient(fallbackSupabase);
  if (sb) {
    try {
      const { error } = await sb.from('nelitv_temp_streams').select('stream_id').limit(1);
      if (!error) {
        return {
          provider: 'supabase-postgres',
          persistent: true,
          configured: true,
          reason: 'Supabase Postgres (nelitv_temp_streams) iko active na inafuta stream baada ya masaa 5 (auto-delete).',
          ...baseInfo
        };
      }
      return {
        provider: 'unconfigured',
        persistent: false,
        configured: false,
        reason:
          'Table ya nelitv_temp_streams bado haijawekwa kwenye Supabase SQL Editor. Weka SQL ya auto-delete (masaa 5) kwenye Supabase kisha refresh.',
        ...baseInfo
      };
    } catch {}
  }

  return {
    provider: 'unconfigured',
    persistent: false,
    configured: false,
    reason: 'Weka SQL schema ya nelitv_temp_streams kwenye Supabase ili kuwasha hifadhi inayojifuta yenyewe baada ya masaa 5.',
    ...baseInfo
  };
}

class StreamStorageError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 503, code = 'STORAGE_NOT_CONFIGURED') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export { StreamStorageError };

export class StreamGeneratorStore {
  private fallbackSupabase: SupabaseClient | null;

  constructor(fallbackSupabase?: SupabaseClient | null) {
    this.fallbackSupabase = fallbackSupabase || null;
  }

  getFallbackSupabase(): SupabaseClient | null {
    return this.fallbackSupabase;
  }

  private async resolveBackend(): Promise<
    | { kind: 'upstash'; cfg: { url: string; token: string } }
    | { kind: 'supabase'; sb: SupabaseClient }
  > {
    const upstash = getUpstashConfig();
    if (upstash) {
      return { kind: 'upstash', cfg: upstash };
    }
    const sb = getSupabaseClient(this.fallbackSupabase);
    if (sb) {
      const { error } = await sb.from('nelitv_temp_streams').select('stream_id').limit(1);
      if (!error) {
        return { kind: 'supabase', sb };
      }
    }
    throw new StreamStorageError(
      'Supabase table (nelitv_temp_streams) bado haijaanzishwa. Run SQL schema kwenye Supabase SQL Editor kwanza.',
      503,
      'STORAGE_NOT_CONFIGURED'
    );
  }

  async isTombstoned(streamId: string): Promise<boolean> {
    const backend = await this.resolveBackend();
    if (backend.kind === 'upstash') {
      const [val] = await upstashPipeline(backend.cfg, [['GET', TOMBSTONE_KEY(streamId)]]);
      return Boolean(val);
    }
    const { data } = await backend.sb
      .from('nelitv_stream_tombstones')
      .select('stream_id')
      .eq('stream_id', streamId)
      .maybeSingle();
    return Boolean(data);
  }

  async markExpiredAndPurge(streamId: string): Promise<void> {
    const backend = await this.resolveBackend();
    if (backend.kind === 'upstash') {
      const [removedFromSet] = await upstashPipeline(backend.cfg, [
        ['SREM', ACTIVE_IDS_KEY, streamId],
        ['DEL', STREAM_KEY(streamId)],
        ['SET', TOMBSTONE_KEY(streamId), '1', 'EX', TOMBSTONE_TTL_SECONDS]
      ]);
      if (Number(removedFromSet) > 0) {
        await upstashPipeline(backend.cfg, [['INCR', STATS_EXPIRED_KEY]]);
      }
      return;
    }

    const { data: deletedRows } = await backend.sb
      .from('nelitv_temp_streams')
      .delete()
      .eq('stream_id', streamId)
      .select('stream_id');

    await backend.sb.from('nelitv_stream_tombstones').upsert(
      {
        stream_id: streamId,
        expired_at: new Date().toISOString()
      },
      { onConflict: 'stream_id' }
    );

    if (deletedRows && deletedRows.length > 0) {
      try {
        const { data: statsRow } = await backend.sb
          .from('nelitv_stream_stats')
          .select('total_expired')
          .eq('id', 1)
          .maybeSingle();
        if (statsRow) {
          await backend.sb
            .from('nelitv_stream_stats')
            .update({
              total_expired: Number(statsRow.total_expired || 0) + deletedRows.length,
              updated_at: new Date().toISOString()
            })
            .eq('id', 1);
        }
      } catch {}
    }
  }

  async createStream(record: TempStreamRecord): Promise<TempStreamRecord> {
    const backend = await this.resolveBackend();
    const ttlSec = Math.max(10, Math.min(DEFAULT_STREAM_TTL_SECONDS, Math.floor(record.ttl_seconds || DEFAULT_STREAM_TTL_SECONDS)));

    if (backend.kind === 'upstash') {
      const [tomb, existing] = await upstashPipeline(backend.cfg, [
        ['GET', TOMBSTONE_KEY(record.stream_id)],
        ['GET', STREAM_KEY(record.stream_id)]
      ]);
      if (tomb || existing) {
        throw new Error('Stream ID collision or expired ID reuse blocked');
      }

      await upstashPipeline(backend.cfg, [
        ['SET', STREAM_KEY(record.stream_id), JSON.stringify(record), 'EX', ttlSec],
        ['SADD', ACTIVE_IDS_KEY, record.stream_id],
        ['INCR', STATS_CREATED_KEY]
      ]);
      return record;
    }

    if (await this.isTombstoned(record.stream_id)) {
      throw new Error('Expired stream ID reuse blocked');
    }

    const { error } = await backend.sb.from('nelitv_temp_streams').insert({
      stream_id: record.stream_id,
      stream_name: record.stream_name,
      description: record.description,
      category: record.category,
      source_url: record.source_url,
      created_at: record.created_at,
      expires_at: record.expires_at,
      expires_at_ms: record.expires_at_ms,
      ttl_seconds: ttlSec,
      status: record.status,
      playback_token: record.playback_token,
      playback_requests: record.playback_requests,
      last_checked_at: record.last_checked_at,
      last_error: record.last_error,
      upstream_http_status: record.upstream_http_status,
      response_time_ms: record.response_time_ms
    });
    if (error) throw new Error(error.message);

    try {
      const { data: statsRow } = await backend.sb
        .from('nelitv_stream_stats')
        .select('total_generated')
        .eq('id', 1)
        .maybeSingle();
      if (statsRow) {
        await backend.sb
          .from('nelitv_stream_stats')
          .update({
            total_generated: Number(statsRow.total_generated || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', 1);
      }
    } catch {}

    return record;
  }

  async getStreamForPlayback(
    streamId: string
  ): Promise<{ state: 'active'; record: TempStreamRecord } | { state: 'expired' } | { state: 'not_found' }> {
    const backend = await this.resolveBackend();
    const nowMs = Date.now();

    if (backend.kind === 'upstash') {
      const [raw, tomb] = await upstashPipeline(backend.cfg, [
        ['GET', STREAM_KEY(streamId)],
        ['GET', TOMBSTONE_KEY(streamId)]
      ]);

      if (!raw) {
        if (tomb) {
          return { state: 'expired' };
        }
        // Also check if it lingered in active_ids set after Redis TTL evicted it
        const [inSet] = await upstashPipeline(backend.cfg, [['SISMEMBER', ACTIVE_IDS_KEY, streamId]]);
        if (Number(inSet) === 1) {
          await this.markExpiredAndPurge(streamId);
          return { state: 'expired' };
        }
        return { state: 'not_found' };
      }

      const parsed = JSON.parse(raw) as TempStreamRecord;
      if (!parsed.expires_at_ms || parsed.expires_at_ms <= nowMs) {
        await this.markExpiredAndPurge(streamId);
        return { state: 'expired' };
      }

      return { state: 'active', record: parsed };
    }

    // Supabase Postgres path
    const { data: row } = await backend.sb
      .from('nelitv_temp_streams')
      .select('*')
      .eq('stream_id', streamId)
      .maybeSingle();

    if (!row) {
      const tomb = await this.isTombstoned(streamId);
      return tomb ? { state: 'expired' } : { state: 'not_found' };
    }

    const expMs = Number(row.expires_at_ms) || new Date(row.expires_at).getTime();
    if (!expMs || expMs <= nowMs) {
      await this.markExpiredAndPurge(streamId);
      return { state: 'expired' };
    }

    return {
      state: 'active',
      record: {
        ...(row as TempStreamRecord),
        expires_at_ms: expMs
      }
    };
  }

  async saveUpdatedStream(record: TempStreamRecord): Promise<void> {
    const backend = await this.resolveBackend();
    const remainingSec = Math.ceil((record.expires_at_ms - Date.now()) / 1000);
    if (remainingSec <= 0) {
      await this.markExpiredAndPurge(record.stream_id);
      return;
    }

    if (backend.kind === 'upstash') {
      await upstashPipeline(backend.cfg, [
        ['SET', STREAM_KEY(record.stream_id), JSON.stringify(record), 'EX', remainingSec]
      ]);
      return;
    }

    await backend.sb
      .from('nelitv_temp_streams')
      .update({
        stream_name: record.stream_name,
        description: record.description,
        category: record.category,
        source_url: record.source_url,
        status: record.status,
        playback_requests: record.playback_requests,
        last_checked_at: record.last_checked_at,
        last_error: record.last_error,
        upstream_http_status: record.upstream_http_status,
        response_time_ms: record.response_time_ms
      })
      .eq('stream_id', record.stream_id);
  }

  async incrementPlaybackCount(record: TempStreamRecord): Promise<number> {
    const updatedCount = (record.playback_requests || 0) + 1;
    record.playback_requests = updatedCount;
    await this.saveUpdatedStream(record);
    return updatedCount;
  }

  async deleteStreamImmediately(streamId: string): Promise<boolean> {
    const backend = await this.resolveBackend();
    if (backend.kind === 'upstash') {
      const [delCount, removedSet] = await upstashPipeline(backend.cfg, [
        ['DEL', STREAM_KEY(streamId)],
        ['SREM', ACTIVE_IDS_KEY, streamId],
        ['SET', TOMBSTONE_KEY(streamId), '1', 'EX', TOMBSTONE_TTL_SECONDS]
      ]);
      return Number(delCount) > 0 || Number(removedSet) > 0;
    }

    const { data: deleted } = await backend.sb
      .from('nelitv_temp_streams')
      .delete()
      .eq('stream_id', streamId)
      .select('stream_id');

    await backend.sb.from('nelitv_stream_tombstones').upsert(
      { stream_id: streamId, expired_at: new Date().toISOString() },
      { onConflict: 'stream_id' }
    );
    return Boolean(deleted && deleted.length > 0);
  }

  async listActiveStreamsAndStats(): Promise<{
    streams: TempStreamRecord[];
    stats: {
      totalGenerated: number;
      activeStreams: number;
      expiredStreams: number;
      offlineStreams: number;
      totalPlaybackRequests: number;
    };
  }> {
    const backend = await this.resolveBackend();
    const nowMs = Date.now();

    if (backend.kind === 'upstash') {
      const [idsRaw, expiredRaw, createdRaw] = await upstashPipeline(backend.cfg, [
        ['SMEMBERS', ACTIVE_IDS_KEY],
        ['GET', STATS_EXPIRED_KEY],
        ['GET', STATS_CREATED_KEY]
      ]);

      const ids: string[] = Array.isArray(idsRaw) ? idsRaw : [];
      let expiredStreams = Number(expiredRaw) || 0;
      const totalCreated = Number(createdRaw) || 0;

      if (ids.length === 0) {
        return {
          streams: [],
          stats: {
            totalGenerated: totalCreated,
            activeStreams: 0,
            expiredStreams,
            offlineStreams: 0,
            totalPlaybackRequests: 0
          }
        };
      }

      const rawRecords = await upstashPipeline(
        backend.cfg,
        ids.map((id) => ['GET', STREAM_KEY(id)])
      );

      const active: TempStreamRecord[] = [];
      const expiredIds: string[] = [];

      ids.forEach((id, idx) => {
        const raw = rawRecords[idx];
        if (!raw) {
          expiredIds.push(id);
          return;
        }
        try {
          const parsed = JSON.parse(raw) as TempStreamRecord;
          if (!parsed.expires_at_ms || parsed.expires_at_ms <= nowMs) {
            expiredIds.push(id);
            return;
          }
          active.push(parsed);
        } catch {
          expiredIds.push(id);
        }
      });

      if (expiredIds.length > 0) {
        const cleanupCmds: (string | number)[][] = [];
        for (const eid of expiredIds) {
          cleanupCmds.push(['SREM', ACTIVE_IDS_KEY, eid]);
          cleanupCmds.push(['DEL', STREAM_KEY(eid)]);
          cleanupCmds.push(['SET', TOMBSTONE_KEY(eid), '1', 'EX', TOMBSTONE_TTL_SECONDS]);
        }
        cleanupCmds.push(['INCRBY', STATS_EXPIRED_KEY, expiredIds.length]);
        await upstashPipeline(backend.cfg, cleanupCmds);
        expiredStreams += expiredIds.length;
      }

      active.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const offlineStreams = active.filter((s) => s.status === 'offline').length;
      const totalPlaybackRequests = active.reduce((acc, s) => acc + (s.playback_requests || 0), 0);

      return {
        streams: active,
        stats: {
          totalGenerated: Math.max(totalCreated, active.length + expiredStreams),
          activeStreams: active.length,
          expiredStreams,
          offlineStreams,
          totalPlaybackRequests
        }
      };
    }

    // Supabase Postgres path: purge expired rows strictly before returning
    const nowIso = new Date(nowMs).toISOString();
    let rpcSucceeded = false;
    try {
      const { error: rpcErr } = await backend.sb.rpc('cleanup_expired_nelitv_streams');
      if (!rpcErr) rpcSucceeded = true;
    } catch {}

    if (!rpcSucceeded) {
      const { data: expiredRows } = await backend.sb
        .from('nelitv_temp_streams')
        .delete()
        .lte('expires_at', nowIso)
        .select('stream_id');

      if (expiredRows && expiredRows.length > 0) {
        await backend.sb.from('nelitv_stream_tombstones').upsert(
          expiredRows.map((r: any) => ({ stream_id: r.stream_id, expired_at: nowIso })),
          { onConflict: 'stream_id' }
        );
        try {
          const { data: statsRow } = await backend.sb
            .from('nelitv_stream_stats')
            .select('total_expired')
            .eq('id', 1)
            .maybeSingle();
          if (statsRow) {
            await backend.sb
              .from('nelitv_stream_stats')
              .update({
                total_expired: Number(statsRow.total_expired || 0) + expiredRows.length,
                updated_at: nowIso
              })
              .eq('id', 1);
          }
        } catch {}
      }
    }

    const { data: activeRows } = await backend.sb
      .from('nelitv_temp_streams')
      .select('*')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false });

    let totalGeneratedCount = 0;
    let totalExpiredCount = 0;
    try {
      const { data: statsRow } = await backend.sb
        .from('nelitv_stream_stats')
        .select('total_generated, total_expired')
        .eq('id', 1)
        .maybeSingle();
      if (statsRow) {
        totalGeneratedCount = Number(statsRow.total_generated) || 0;
        totalExpiredCount = Number(statsRow.total_expired) || 0;
      }
    } catch {}

    if (totalExpiredCount === 0) {
      const { count: tombCount } = await backend.sb
        .from('nelitv_stream_tombstones')
        .select('stream_id', { count: 'exact', head: true });
      totalExpiredCount = tombCount || 0;
    }

    const active: TempStreamRecord[] = (activeRows || []).map((r: any) => ({
      ...r,
      expires_at_ms: Number(r.expires_at_ms) || new Date(r.expires_at).getTime()
    }));

    const offlineStreams = active.filter((s) => s.status === 'offline').length;
    const totalPlaybackRequests = active.reduce((acc, s) => acc + (s.playback_requests || 0), 0);

    return {
      streams: active,
      stats: {
        totalGenerated: Math.max(totalGeneratedCount, active.length + totalExpiredCount),
        activeStreams: active.length,
        expiredStreams: totalExpiredCount,
        offlineStreams,
        totalPlaybackRequests
      }
    };
  }

  async getAllowlist(): Promise<string[]> {
    const builtins = getBuiltinAllowlistHosts();
    try {
      const backend = await this.resolveBackend();
      if (backend.kind === 'upstash') {
        const [raw] = await upstashPipeline(backend.cfg, [['GET', ALLOWLIST_KEY]]);
        if (raw) {
          const custom = JSON.parse(raw);
          if (Array.isArray(custom)) {
            return Array.from(new Set([...builtins, ...custom.map((h: string) => String(h).toLowerCase())]));
          }
        }
        return builtins;
      }

      const { data } = await backend.sb.from('nelitv_stream_allowlist').select('host');
      const custom = (data || []).map((r: any) => String(r.host || '').toLowerCase()).filter(Boolean);
      return Array.from(new Set([...builtins, ...custom]));
    } catch {
      return builtins;
    }
  }

  async addAllowlistHost(host: string): Promise<string[]> {
    const clean = host.trim().toLowerCase();
    const backend = await this.resolveBackend();
    if (backend.kind === 'upstash') {
      const [raw] = await upstashPipeline(backend.cfg, [['GET', ALLOWLIST_KEY]]);
      const current: string[] = raw ? JSON.parse(raw) : [];
      const next = Array.from(new Set([...current, clean]));
      await upstashPipeline(backend.cfg, [['SET', ALLOWLIST_KEY, JSON.stringify(next)]]);
      return Array.from(new Set([...getBuiltinAllowlistHosts(), ...next]));
    }

    await backend.sb
      .from('nelitv_stream_allowlist')
      .upsert({ host: clean, created_at: new Date().toISOString() }, { onConflict: 'host' });
    return this.getAllowlist();
  }

  async removeAllowlistHost(host: string): Promise<string[]> {
    const clean = host.trim().toLowerCase();
    const backend = await this.resolveBackend();
    if (backend.kind === 'upstash') {
      const [raw] = await upstashPipeline(backend.cfg, [['GET', ALLOWLIST_KEY]]);
      const current: string[] = raw ? JSON.parse(raw) : [];
      const next = current.filter((h) => h.toLowerCase() !== clean);
      await upstashPipeline(backend.cfg, [['SET', ALLOWLIST_KEY, JSON.stringify(next)]]);
      return Array.from(new Set([...getBuiltinAllowlistHosts(), ...next]));
    }

    await backend.sb.from('nelitv_stream_allowlist').delete().eq('host', clean);
    return this.getAllowlist();
  }
}

export const streamGeneratorStore = new StreamGeneratorStore();
