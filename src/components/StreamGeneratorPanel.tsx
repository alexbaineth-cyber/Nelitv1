import React, { useState, useEffect, useCallback, useRef } from 'react';
import Hls from 'hls.js';
import {
  Plus,
  Copy,
  Check,
  Play,
  RefreshCw,
  Trash2,
  Edit3,
  ShieldCheck,
  Activity,
  Clock,
  Link2,
  X,
  AlertTriangle,
  Database,
  Globe,
  Server,
  Search
} from 'lucide-react';

export interface GeneratedStreamItem {
  stream_id: string;
  stream_name: string;
  description: string;
  category: string;
  source_host: string;
  source_masked: string;
  created_at: string;
  expires_at: string;
  expires_at_ms: number;
  ttl_seconds: number;
  remaining_seconds: number;
  status: 'online' | 'offline' | 'checking' | 'expired';
  playback_url: string;
  playback_requests: number;
  last_checked_at: string | null;
  last_error: string | null;
  upstream_http_status: number | null;
  response_time_ms: number | null;
}

interface StorageStatusInfo {
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

interface StreamStats {
  totalGenerated: number;
  activeStreams: number;
  expiredStreams: number;
  offlineStreams: number;
  totalPlaybackRequests: number;
}

interface StreamGeneratorPanelProps {
  portalToken: string;
}

function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return iso;
  }
}

export const StreamGeneratorPanel: React.FC<StreamGeneratorPanelProps> = ({ portalToken }) => {
  const [streams, setStreams] = useState<GeneratedStreamItem[]>([]);
  const [stats, setStats] = useState<StreamStats>({
    totalGenerated: 0,
    activeStreams: 0,
    expiredStreams: 0,
    offlineStreams: 0,
    totalPlaybackRequests: 0
  });
  const [storage, setStorage] = useState<StorageStatusInfo | null>(null);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  // Add Stream Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newSourceUrl, setNewSourceUrl] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Live TV');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingAllowlistHost, setPendingAllowlistHost] = useState<string | null>(null);
  const [newlyCreatedStream, setNewlyCreatedStream] = useState<GeneratedStreamItem | null>(null);

  // Edit / Replace Source Modal
  const [editingStream, setEditingStream] = useState<GeneratedStreamItem | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Live TV');
  const [editSourceUrl, setEditSourceUrl] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editAllowlistHost, setEditAllowlistHost] = useState<string | null>(null);

  // Row Actions State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingHealthId, setCheckingHealthId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Allowlist & Infra Panels
  const [showAllowlistDrawer, setShowAllowlistDrawer] = useState<boolean>(false);
  const [allowlistInput, setAllowlistInput] = useState<string>('');
  const [allowlistMsg, setAllowlistMsg] = useState<string | null>(null);

  // Test Playback Modal (HLS.js)
  const [testingStream, setTestingStream] = useState<GeneratedStreamItem | null>(null);
  const [playerStatus, setPlayerStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [playerInfo, setPlayerInfo] = useState<string>('Inaunganisha HLS relay...');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<InstanceType<typeof Hls> | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (portalToken) {
      h['Authorization'] = `Bearer ${portalToken}`;
      h['X-Portal-Token'] = portalToken;
    }
    return h;
  }, [portalToken]);

  const loadStreams = useCallback(async () => {
    if (!portalToken) return;
    try {
      const res = await fetch('/api/stream-generator/list', {
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data?.error || 'Imeshindikana kupakia orodha ya streams.');
        return;
      }
      setFetchError(null);
      setStorage(data.storage || null);
      setAllowlist(Array.isArray(data.allowlist) ? data.allowlist : []);
      setStreams(Array.isArray(data.streams) ? data.streams : []);
      if (data.stats) setStats(data.stats);
    } catch {
      setFetchError('Hitilafu ya mtandao wakati wa kuwasiliana na server.');
    } finally {
      setIsLoading(false);
    }
  }, [portalToken, authHeaders]);

  useEffect(() => {
    void loadStreams();
  }, [loadStreams]);

  // 1-second live expiration countdown ticker + periodic server sync every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const syncTimer = setInterval(() => {
      void loadStreams();
    }, 30000);
    return () => {
      clearInterval(timer);
      clearInterval(syncTimer);
    };
  }, [loadStreams]);

  // HLS Test Playback lifecycle
  useEffect(() => {
    if (!testingStream || !videoRef.current) return;

    const videoEl = videoRef.current;
    setPlayerStatus('loading');
    setPlayerInfo('Inapakia master.m3u8 kutoka NeliTV Relay...');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt: unknown, data: { levels?: unknown[] }) => {
        setPlayerStatus('playing');
        setPlayerInfo(
          `Relay inafanya kazi • ${data.levels?.length || 1} quality level(s) • Segments zinapita kupitia NeliTV`
        );
        videoEl.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_evt: unknown, data: { fatal?: boolean; details?: string; response?: { code?: number } }) => {
        if (data.fatal) {
          setPlayerStatus('error');
          const code = data.response?.code;
          if (code === 410) {
            setPlayerInfo('HTTP 410 Gone: Link hii imeisha muda wake wa masaa 5.');
          } else {
            setPlayerInfo(
              `Hitilafu ya HLS relay (${code ? `HTTP ${code}` : data.details}). Kagua afya ya chanzo.`
            );
          }
        }
      });

      hls.loadSource(testingStream.playback_url);
      hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = testingStream.playback_url;
      videoEl.addEventListener('loadedmetadata', () => {
        setPlayerStatus('playing');
        setPlayerInfo('Native HLS player imeunganishwa.');
        videoEl.play().catch(() => {});
      });
    } else {
      setPlayerStatus('error');
      setPlayerInfo('Kivinjari hiki hakitumii HLS.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [testingStream]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const openAddModal = () => {
    setNewName('');
    setNewSourceUrl('');
    setNewDescription('');
    setNewCategory('Live TV');
    setCreateError(null);
    setPendingAllowlistHost(null);
    setNewlyCreatedStream(null);
    setIsAddModalOpen(true);
  };

  const submitCreateStream = async (authorizeHost = false) => {
    if (!newName.trim() || !newSourceUrl.trim()) {
      setCreateError('Jina la stream na Source URL vinahitajika.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/stream-generator/create', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          streamName: newName.trim(),
          sourceUrl: newSourceUrl.trim(),
          description: newDescription.trim(),
          category: newCategory.trim() || 'Live TV',
          authorizeHost
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && data?.requiresAllowlistApproval && data?.hostname) {
          setPendingAllowlistHost(data.hostname);
        }
        setCreateError(data?.error || 'Imeshindikana kutengeneza stream link.');
        return;
      }

      setPendingAllowlistHost(null);
      setNewlyCreatedStream(data.stream);
      if (Array.isArray(data.allowlist)) setAllowlist(data.allowlist);
      await loadStreams();
    } catch {
      setCreateError('Hitilafu ya mtandao wakati wa kutengeneza link.');
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (item: GeneratedStreamItem) => {
    setEditingStream(item);
    setEditName(item.stream_name);
    setEditDescription(item.description || '');
    setEditCategory(item.category || 'Live TV');
    setEditSourceUrl('');
    setEditError(null);
    setEditAllowlistHost(null);
  };

  const submitEditStream = async (authorizeHost = false) => {
    if (!editingStream) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/stream-generator/${encodeURIComponent(editingStream.stream_id)}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          streamName: editName.trim(),
          description: editDescription.trim(),
          category: editCategory.trim() || 'Live TV',
          sourceUrl: editSourceUrl.trim() || undefined,
          authorizeHost
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && data?.requiresAllowlistApproval && data?.hostname) {
          setEditAllowlistHost(data.hostname);
        }
        setEditError(data?.error || 'Imeshindikana kuhifadhi mabadiliko.');
        return;
      }
      setEditingStream(null);
      await loadStreams();
    } catch {
      setEditError('Hitilafu ya mtandao.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleHealthCheck = async (streamId: string) => {
    setCheckingHealthId(streamId);
    setStreams((prev) =>
      prev.map((s) => (s.stream_id === streamId ? { ...s, status: 'checking' } : s))
    );
    try {
      const res = await fetch(`/api/stream-generator/${encodeURIComponent(streamId)}/health`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (res.ok && data?.stream) {
        setStreams((prev) =>
          prev.map((s) => (s.stream_id === streamId ? data.stream : s))
        );
      } else {
        await loadStreams();
      }
    } catch {
      await loadStreams();
    } finally {
      setCheckingHealthId(null);
    }
  };

  const handleDeleteStream = async (streamId: string) => {
    setDeletingId(streamId);
    try {
      await fetch(`/api/stream-generator/${encodeURIComponent(streamId)}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      setConfirmDeleteId(null);
      await loadStreams();
    } catch {}
    finally {
      setDeletingId(null);
    }
  };

  const handleAddAllowlistHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowlistInput.trim()) return;
    setAllowlistMsg(null);
    try {
      const res = await fetch('/api/stream-generator/allowlist', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ host: allowlistInput.trim() })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.allowlist)) {
        setAllowlist(data.allowlist);
        setAllowlistInput('');
        setAllowlistMsg('Domain imeidhinishwa kwenye allowlist.');
      } else {
        setAllowlistMsg(data?.error || 'Imeshindikana kuongeza host.');
      }
    } catch {
      setAllowlistMsg('Hitilafu ya mtandao.');
    }
  };

  const handleRemoveAllowlistHost = async (host: string) => {
    try {
      const res = await fetch('/api/stream-generator/allowlist', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ host })
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.allowlist)) {
        setAllowlist(data.allowlist);
      }
    } catch {}
  };

  const filteredStreams = streams.filter((item) => {
    const remaining = Math.max(0, Math.floor((item.expires_at_ms - nowMs) / 1000));
    if (remaining <= 0) return false;
    if (statusFilter === 'online' && item.status !== 'online') return false;
    if (statusFilter === 'offline' && item.status !== 'offline') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        item.stream_name.toLowerCase().includes(q) ||
        item.stream_id.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.source_host.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const renderStatusBadge = (status: GeneratedStreamItem['status']) => {
    if (status === 'online') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[11px] font-semibold">
          Online
        </span>
      );
    }
    if (status === 'checking') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/35 text-sky-300 text-[11px] font-semibold">
          Checking
        </span>
      );
    }
    if (status === 'expired') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[11px] font-semibold">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] font-semibold">
        Offline
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header with Prominent Circular PLUS Button */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#141923] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              NeliTV Temporary Stream Generator
            </h2>
            <span className="px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-[11px] font-mono text-slate-300">
              TTL: 5H (18,000s)
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Tengeneza link ya muda ya HLS (<code className="text-slate-200">/stream/&lt;id&gt;/master.m3u8</code>) inayopitisha playlist na vipande vya video kupitia NeliTV relay bila kuonyesha anwani ya chanzo halisi.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setShowAllowlistDrawer((v) => !v)}
            className="px-3.5 py-2.5 rounded-xl bg-[#090c11] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition whitespace-nowrap cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#1ce783]" />
            <span>Allowlist ({allowlist.length})</span>
          </button>

          <button
            type="button"
            onClick={() => void loadStreams()}
            className="p-2.5 rounded-xl bg-[#090c11] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white transition cursor-pointer"
            title="Onyesha upya takwimu"
            aria-label="Refresh streams"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#1ce783]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="w-12 h-12 rounded-full bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] flex items-center justify-center shadow-lg shadow-[#1ce783]/20 transition transform hover:scale-105 cursor-pointer shrink-0"
            title="Add New Stream"
            aria-label="Add New Stream"
          >
            <Plus className="w-6 h-6 stroke-[2.6]" />
          </button>
        </div>
      </div>

      {/* Persistent Storage & Relay Bandwidth Status Notice */}
      {storage && (
        <div
          className={`p-4 rounded-xl border text-xs ${
            storage.configured
              ? 'bg-[#141923] border-white/[0.08] text-slate-300'
              : 'bg-amber-950/35 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Database className={`w-4 h-4 mt-0.5 shrink-0 ${storage.configured ? 'text-[#1ce783]' : 'text-amber-400'}`} />
              <div className="space-y-1">
                <div className="font-semibold text-white flex flex-wrap items-center gap-2">
                  <span>
                    Storage Engine:{' '}
                    {storage.provider === 'upstash-redis'
                      ? 'Upstash Redis (Native 18,000s TTL Connected)'
                      : storage.provider === 'supabase-postgres'
                      ? 'Supabase Postgres (Active)'
                      : 'Upstash Redis haijaunganishwa bado'}
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  {storage.configured
                    ? `Upstash Free Tier: ${storage.upstashFreeTier.maxStorage}, ${storage.upstashFreeTier.maxCommandsPerMonth}, ${storage.upstashFreeTier.maxBandwidthPerMonth} (${storage.upstashFreeTier.price}). Vercel Hobby: ${storage.vercelLimits.hobbyBandwidth}.`
                    : storage.reason}
                </p>
                {!storage.configured && (
                  <p className="text-amber-200/90 leading-relaxed pt-1">
                    <strong>Hatua ya Vercel Marketplace (Bure $0/mo):</strong> Fungua Vercel Dashboard → Project → <strong>Integrations / Storage</strong> → <strong>Upstash Redis</strong> → Create Database (Free Tier: 250MB / 500k commands/mo) → Unganisha na project kisha Redeploy.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-slate-400">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {storage.vercelLimits.dedicatedRelayConfigured
                  ? 'Dedicated Relay Active'
                  : 'Vercel Express Relay (/stream/*)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5 Dashboard Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-[#141923] border border-white/[0.08]">
          <div className="text-[11px] text-slate-400 font-medium">Total Generated Links</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            {stats.totalGenerated}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#141923] border border-white/[0.08]">
          <div className="text-[11px] text-slate-400 font-medium">Active Streams</div>
          <div className="text-2xl font-bold text-[#1ce783] font-mono tabular-nums mt-1">
            {stats.activeStreams}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#141923] border border-white/[0.08]">
          <div className="text-[11px] text-slate-400 font-medium">Expired Streams</div>
          <div className="text-2xl font-bold text-amber-300 font-mono tabular-nums mt-1">
            {stats.expiredStreams}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#141923] border border-white/[0.08]">
          <div className="text-[11px] text-slate-400 font-medium">Offline Streams</div>
          <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums mt-1">
            {stats.offlineStreams}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#141923] border border-white/[0.08] col-span-2 sm:col-span-1">
          <div className="text-[11px] text-slate-400 font-medium">Total Playback Requests</div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums mt-1">
            {stats.totalPlaybackRequests}
          </div>
        </div>
      </div>

      {/* Collapsible Allowlist Manager */}
      {showAllowlistDrawer && (
        <div className="p-5 rounded-xl bg-[#141923] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Authorized Source Allowlist</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Ni domain au IP za umma zilizoidhinishwa hapa pekee ndizo zinazoruhusiwa kuunda temporary relay links.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllowlistDrawer(false)}
              className="p-1.5 rounded-lg bg-[#090c11] text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddAllowlistHost} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={allowlistInput}
              onChange={(e) => setAllowlistInput(e.target.value)}
              placeholder="Mfano: 193.47.62.50 au stream.domain.com"
              className="flex-1 px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-xs text-white font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs whitespace-nowrap cursor-pointer"
            >
              Ongeza Host
            </button>
          </form>

          {allowlistMsg && (
            <div className="text-xs text-[#1ce783]">{allowlistMsg}</div>
          )}

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pt-1">
            {allowlist.map((host) => (
              <div
                key={host}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#090c11] border border-white/[0.08] text-[11px] font-mono text-slate-300"
              >
                <span>{host}</span>
                <button
                  type="button"
                  onClick={() => void handleRemoveAllowlistHost(host)}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  title="Ondoa"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta jina la stream, ID, au host..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#141923] border border-white/[0.08] focus:border-[#1ce783] focus:outline-none text-xs text-white"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141923] border border-white/[0.08] self-start">
          {(['all', 'online', 'offline'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#1ce783] text-[#04120b] font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Active Streams Management List */}
      <div className="rounded-2xl bg-[#141923] border border-white/[0.08] overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1ce783]" />
            <span>Inapakia streams za muda...</span>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="text-sm font-semibold text-white">
              Hakuna stream link hai kwa sasa
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Bonyeza kitufe cha duara cha <strong>+</strong> hapo juu kuweka original HLS source URL na kupata NeliTV relay URL inayodumu kwa masaa 5.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Stream Link</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredStreams.map((item) => {
              const remainingSec = Math.max(0, Math.floor((item.expires_at_ms - nowMs) / 1000));
              const isCopied = copiedId === item.stream_id;

              return (
                <div
                  key={item.stream_id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition"
                >
                  {/* Stream Meta & Masked Source */}
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-white">{item.stream_name}</span>
                      {renderStatusBadge(item.status)}
                      <span className="px-2 py-0.5 rounded bg-white/[0.05] text-[11px] text-slate-300">
                        {item.category || 'Live TV'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        ID: {item.stream_id}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-xs text-slate-400 truncate">{item.description}</p>
                    )}

                    {/* Playback URL preview bar */}
                    <div className="flex items-center gap-2 max-w-2xl">
                      <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#090c11] border border-white/[0.08] font-mono text-[11px] text-[#1ce783] truncate">
                        {item.playback_url}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(item.stream_id, item.playback_url)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#090c11] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-semibold text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#1ce783]" />
                            <span className="text-[#1ce783]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Monitoring, Timing & Requests Telemetry */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-mono tabular-nums">
                      <span title="Masked upstream origin">Origin: {item.source_masked}</span>
                      <span className="flex items-center gap-1 text-slate-200">
                        <Clock className="w-3 h-3 text-[#1ce783]" />
                        Zimebaki: {formatCountdown(remainingSec)}
                      </span>
                      <span>Undwa: {formatTimestamp(item.created_at)}</span>
                      <span>Mwisho: {formatTimestamp(item.expires_at)}</span>
                      <span>Requests: {item.playback_requests}</span>
                      {item.upstream_http_status !== null && (
                        <span>HTTP {item.upstream_http_status}</span>
                      )}
                      {item.response_time_ms !== null && (
                        <span>{item.response_time_ms}ms</span>
                      )}
                      {item.last_error && (
                        <span className="text-rose-300">Err: {item.last_error}</span>
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTestingStream(item)}
                      className="px-3 py-1.5 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Test Playback</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleHealthCheck(item.stream_id)}
                      disabled={checkingHealthId === item.stream_id}
                      className="px-3 py-1.5 rounded-lg bg-[#090c11] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Activity
                        className={`w-3.5 h-3.5 text-[#1ce783] ${
                          checkingHealthId === item.stream_id ? 'animate-pulse' : ''
                        }`}
                      />
                      <span>Check Health</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="px-3 py-1.5 rounded-lg bg-[#090c11] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit / Replace</span>
                    </button>

                    {confirmDeleteId === item.stream_id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleDeleteStream(item.stream_id)}
                          disabled={deletingId === item.stream_id}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                        >
                          {deletingId === item.stream_id ? 'Inafuta...' : 'Confirm Delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg bg-[#090c11] border border-white/[0.08] text-slate-300 text-xs cursor-pointer"
                        >
                          Ghairi
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.stream_id)}
                        className="p-1.5 rounded-lg bg-[#090c11] hover:bg-rose-950/60 border border-white/[0.08] text-slate-400 hover:text-rose-300 transition cursor-pointer"
                        title="Delete Immediately"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD NEW STREAM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141923] border border-white/[0.1] p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1ce783]/15 border border-[#1ce783]/30 flex items-center justify-center text-[#1ce783]">
                  <Link2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Add New Temporary Stream</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg bg-[#090c11] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newlyCreatedStream ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-[#1ce783]/35 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1ce783]">
                      Stream Link Imetengenezwa Kikamilifu
                    </span>
                    {renderStatusBadge(newlyCreatedStream.status)}
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400 mb-1">Generated Playback URL</div>
                    <div className="p-2.5 rounded-lg bg-[#090c11] border border-white/[0.1] font-mono text-xs text-white break-all">
                      {newlyCreatedStream.playback_url}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums text-slate-300">
                    <div>
                      <span className="text-slate-500 block">Created At</span>
                      {formatTimestamp(newlyCreatedStream.created_at)}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Expires At (5 Hours)</span>
                      {formatTimestamp(newlyCreatedStream.expires_at)}
                    </div>
                    <div>
                      <span className="text-slate-500 block">Countdown</span>
                      <span className="text-[#1ce783] font-bold">
                        {formatCountdown(Math.max(0, Math.floor((newlyCreatedStream.expires_at_ms - nowMs) / 1000)))}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Stream ID</span>
                      {newlyCreatedStream.stream_id}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopy('new_modal', newlyCreatedStream.playback_url)}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#090c11] hover:bg-white/[0.08] border border-white/[0.1] text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === 'new_modal' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#1ce783]" />
                          <span className="text-[#1ce783]">Copied URL</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddModalOpen(false);
                        setTestingStream(newlyCreatedStream);
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Test Stream</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Tengeneza Nyingine
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-white/[0.1] text-xs font-semibold text-white cursor-pointer"
                  >
                    Funga
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitCreateStream(false);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    1. Stream Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Mfano: DEEEE"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-sm text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    2. Original HLS Source URL *
                  </label>
                  <input
                    type="url"
                    required
                    value={newSourceUrl}
                    onChange={(e) => {
                      setNewSourceUrl(e.target.value);
                      setPendingAllowlistHost(null);
                      setCreateError(null);
                    }}
                    placeholder="http://193.47.62.50/hls/DEEEE.m3u8"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-sm text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      3. Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Mechi ya leo..."
                      className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      4. Category (Optional)
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-xs text-white"
                    >
                      <option value="Live TV">Live TV</option>
                      <option value="Sports">Sports</option>
                      <option value="News">News</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Movies">Movies</option>
                    </select>
                  </div>
                </div>

                {createError && (
                  <div className="p-3 rounded-lg bg-rose-950/45 border border-rose-500/35 text-rose-200 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{createError}</span>
                    </div>
                    {pendingAllowlistHost && (
                      <button
                        type="button"
                        onClick={() => void submitCreateStream(true)}
                        disabled={isCreating}
                        className="w-full py-2 px-3 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Idhinisha "{pendingAllowlistHost}" kwenye Allowlist na Tengeneza</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-3 px-4 rounded-xl bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Inakagua Chanzo na Kutengeneza...</span>
                    </>
                  ) : (
                    <span>GENERATE STREAM LINK</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT NAME / REPLACE SOURCE MODAL */}
      {editingStream && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141923] border border-white/[0.1] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Edit Stream / Replace Source URL</h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Stream ID ({editingStream.stream_id}) &amp; generated link will stay identical.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStream(null)}
                className="p-1.5 rounded-lg bg-[#090c11] text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitEditStream(false);
              }}
              className="space-y-3.5"
            >
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Stream Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Category</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Replace Original Source URL (Optional — acha wazi kubaki na chanzo cha sasa: {editingStream.source_masked})
                </label>
                <input
                  type="url"
                  value={editSourceUrl}
                  onChange={(e) => {
                    setEditSourceUrl(e.target.value);
                    setEditAllowlistHost(null);
                    setEditError(null);
                  }}
                  placeholder="https://new-origin.example.com/hls/stream.m3u8"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.1] focus:border-[#1ce783] focus:outline-none text-xs text-white font-mono"
                />
              </div>

              {editError && (
                <div className="p-3 rounded-lg bg-rose-950/45 border border-rose-500/35 text-rose-200 text-xs space-y-2">
                  <div>{editError}</div>
                  {editAllowlistHost && (
                    <button
                      type="button"
                      onClick={() => void submitEditStream(true)}
                      className="w-full py-1.5 px-3 rounded bg-[#1ce783] text-[#04120b] font-bold text-xs cursor-pointer"
                    >
                      Idhinisha "{editAllowlistHost}" na Hifadhi
                    </button>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStream(null)}
                  className="px-4 py-2 rounded-lg bg-[#090c11] border border-white/[0.08] text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST PLAYBACK MODAL (HLS.js Live Relay Verification) */}
      {testingStream && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#141923] border border-white/[0.1] overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  Test Relay Playback — {testingStream.stream_name}
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                  {testingStream.playback_url}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestingStream(null)}
                className="p-1.5 rounded-lg bg-[#090c11] text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black aspect-video relative">
              <video
                ref={videoRef}
                controls
                autoPlay
                playsInline
                className="w-full h-full"
              />
            </div>

            <div className="p-3.5 bg-[#090c11] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div
                className={`font-medium ${
                  playerStatus === 'playing'
                    ? 'text-[#1ce783]'
                    : playerStatus === 'error'
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {playerInfo}
              </div>
              <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                Stream ID: {testingStream.stream_id}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
