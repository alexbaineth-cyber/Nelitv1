import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Copy, Check, Server, Key, Play, AlertCircle,
  CheckCircle2, Clock, Radio, ShieldCheck, ExternalLink
} from 'lucide-react';
import { ALL_KNOWN_CLEAR_KEYS, CHANNELS_DATA } from '../data/channels.ts';

interface LiveTokenState {
  token: string;
  cdnHost: string;
  exp: number | null;
  expiresAt: string | null;
  source: string;
  provider: string;
  refreshIntervalSeconds?: number;
}

const BASE_URL = 'https://nelitv.online';
const APP_AUTH_KEY = 'neli_sec_9971ab4f7831d8e0e5c9429b9f71c';

function formatCountdown(expSeconds: number | null, nowSec: number): string {
  if (!expSeconds) return 'Bila kikomo';
  const diff = expSeconds - nowSec;
  if (diff <= 0) return 'Imekwisha (Refresh)';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export const NeliTvServerPanel: React.FC = () => {
  const [tokenInfo, setTokenInfo] = useState<LiveTokenState | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live endpoint tester state
  const [activeTestEndpoint, setActiveTestEndpoint] = useState<'cdn-token' | 'app' | 'channels'>('cdn-token');
  const [testJson, setTestJson] = useState<any | null>(null);
  const [testMeta, setTestMeta] = useState<{ status: number; ms: number; path: string } | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // App integration code tab
  const [codeLang, setCodeLang] = useState<'kotlin' | 'flutter' | 'js' | 'curl'>('kotlin');

  const copyValue = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
  };

  const fetchTokenStatus = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingToken(true);
    }
    setTokenError(null);

    try {
      const endpoint = forceRefresh
        ? `/baynithalex/api/cdn-token?refresh=true&_t=${Date.now()}`
        : `/baynithalex/api/cdn-token?_t=${Date.now()}`;
      const res = await fetch(endpoint, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data?.token) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setTokenInfo({
        token: data.token,
        cdnHost: data.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz',
        exp: data.exp || null,
        expiresAt: data.expiresAt || null,
        source: data.source || 'live',
        provider: data.provider || 'NeliTv Server',
        refreshIntervalSeconds: data.refreshIntervalSeconds || 90
      });
    } catch (err: any) {
      setTokenError(err?.message || 'Imeshindikana kupata token kutoka server.');
    } finally {
      setIsLoadingToken(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenStatus(false);
  }, [fetchTokenStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const runEndpointTest = async (mode: 'cdn-token' | 'app' | 'channels') => {
    setActiveTestEndpoint(mode);
    setIsTesting(true);
    const path =
      mode === 'app'
        ? '/baynithalex/api/app'
        : mode === 'channels'
        ? '/baynithalex/api/channels'
        : '/baynithalex/api/cdn-token';

    const start = performance.now();
    try {
      const res = await fetch(`${path}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'X-Neli-Client': 'nelitv-app',
          'X-Neli-Api-Key': APP_AUTH_KEY
        }
      });
      const elapsed = Math.round(performance.now() - start);
      const data = await res.json();

      // Summarize long arrays nicely for the live JSON preview if needed while preserving full fields
      setTestJson(data);
      setTestMeta({ status: res.status, ms: elapsed, path });
    } catch (err: any) {
      setTestJson({ success: false, error: err?.message || 'Network error' });
      setTestMeta({ status: 0, ms: Math.round(performance.now() - start), path });
    } finally {
      setIsTesting(false);
    }
  };

  const clearKeyCount = Math.floor(Object.keys(ALL_KNOWN_CLEAR_KEYS).length / 2);

  const serverEndpoints = [
    {
      id: 'ep-token',
      method: 'GET',
      label: 'Live CDN Token',
      desc: 'Inarudisha token mpya ya Azam, cdnHost, na exp moja kwa moja (inafunguka kwenye App na Browser).',
      url: `${BASE_URL}/baynithalex/api/cdn-token`
    },
    {
      id: 'ep-app',
      method: 'GET',
      label: 'NeliTv App Bootstrap (All-in-One)',
      desc: 'Inapakia token, cdnHost, ClearKeys zote, na orodha kamili ya vituo vilivyotengenezewa token na proxy URL.',
      url: `${BASE_URL}/baynithalex/api/app`
    },
    {
      id: 'ep-channels',
      method: 'GET',
      label: 'Vituo + Tokenized URLs',
      desc: 'Inarudisha vituo vyote na streamUrl mpya yenye token tayari kwa kucheza.',
      url: `${BASE_URL}/baynithalex/api/channels`
    },
    {
      id: 'ep-proxy',
      method: 'GET',
      label: 'NeliTv Stream Proxy',
      desc: 'Njia mbadala ya kucheza stream kupitia server ya NeliTv endapo kifaa kinazuia CDN moja kwa moja.',
      url: `${BASE_URL}/api/proxy-stream?url={encodedStreamUrl}&app=nelitv`
    }
  ];

  const integrationSnippets = {
    kotlin: `// Android (Kotlin + OkHttp + Media3 ExoPlayer)
// 1. Vuta taarifa zote za NeliTv App Server kwa ombi moja:
val request = Request.Builder()
    .url("${BASE_URL}/baynithalex/api/app")
    .addHeader("X-Neli-Client", "nelitv-app")
    .addHeader("X-Neli-Api-Key", "${APP_AUTH_KEY}")
    .build()

// JSON response inakupa:
// - token & cdnHost (kwa auto-refresh kila sekunde 90 via /baynithalex/api/cdn-token)
// - clearKeys (ramani ya KID -> KEY kwa Azam Sports, Sinema Zetu, n.k.)
// - channels[].streamUrl (DASH/HLS tayari na token)
// - channels[].proxyStreamUrl (backup kupitia NeliTv Server)

// Mfano wa kujenga URL ya kituo ukiwa na token mpya:
val streamUrl = "$cdnHost/tok_$token/live/eds/AzamSport1/DASH/AzamSport1.mpd?cdntoken=$token"`,

    flutter: `// Flutter / Dart (http + video_player / better_player)
import 'dart:convert';
import 'package:http/http.dart' as http;

class NeliTvServerClient {
  static const String baseUrl = '${BASE_URL}';
  static const String appKey = '${APP_AUTH_KEY}';

  static Future<Map<String, dynamic>> fetchAppConfig() async {
    final res = await http.get(
      Uri.parse('$baseUrl/baynithalex/api/app'),
      headers: {
        'X-Neli-Client': 'nelitv-app',
        'X-Neli-Api-Key': appKey,
      },
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  static Future<Map<String, dynamic>> fetchLiveToken({bool refresh = false}) async {
    final res = await http.get(
      Uri.parse('$baseUrl/baynithalex/api/cdn-token\${refresh ? "?refresh=true" : ""}'),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}`,

    js: `// React Native / JavaScript / Capacitor App
const BASE_URL = '${BASE_URL}';

export async function syncNeliTvAppServer() {
  const res = await fetch(\`\${BASE_URL}/baynithalex/api/app\`, {
    headers: {
      'X-Neli-Client': 'nelitv-app',
      'X-Neli-Api-Key': '${APP_AUTH_KEY}'
    }
  });
  const data = await res.json();
  // data.token, data.cdnHost, data.clearKeys, data.channels
  return data;
}

export async function refreshNeliTvToken() {
  const res = await fetch(\`\${BASE_URL}/baynithalex/api/cdn-token?refresh=true\`);
  return await res.json();
}`,

    curl: `# Angalia Live Token moja kwa moja
curl -s "${BASE_URL}/baynithalex/api/cdn-token"

# Vuta Bootstrap yote ya NeliTv App (Token + Channels + ClearKeys)
curl -s "${BASE_URL}/baynithalex/api/app" \\
  -H "X-Neli-Client: nelitv-app" \\
  -H "X-Neli-Api-Key: ${APP_AUTH_KEY}"`
  };

  return (
    <div className="space-y-8">
      {/* Live Server Status Strip (Tabular 4-column overview) */}
      <section className="rounded-xl bg-[#141923] border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#1ce783]" />
              <h2 className="text-base font-bold text-white tracking-tight">
                NeliTv App Server &amp; Live CDN Token
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Unganisha NeliTv App yako na server hii kupata live Azam CDN tokens, orodha ya vituo, na ClearKeys moja kwa moja.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="/baynithalex/api/cdn-token"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Fungua Token JSON</span>
            </a>

            <button
              onClick={() => fetchTokenStatus(true)}
              disabled={isRefreshing}
              className="px-4 py-2 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Inasasisha...' : 'Refresh Token Sasa'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
          <div className="p-4 space-y-1">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#1ce783]" />
              <span>Hali ya Server</span>
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-1.5">
              {tokenError ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-rose-300">Hitilafu</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#1ce783] shrink-0" />
                  <span>Inafanya Kazi · {tokenInfo?.source || 'live'}</span>
                </>
              )}
            </div>
          </div>

          <div className="p-4 space-y-1">
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Muda wa Token (Exp)</span>
            </div>
            <div className="text-sm font-bold text-white font-mono tabular-nums">
              {isLoadingToken ? 'Inapakia...' : formatCountdown(tokenInfo?.exp ?? null, nowSec)}
            </div>
          </div>

          <div className="p-4 space-y-1">
            <div className="text-xs text-slate-400">CDN Host Active</div>
            <div className="text-xs sm:text-sm font-semibold text-slate-200 font-mono truncate" title={tokenInfo?.cdnHost || ''}>
              {isLoadingToken ? '...' : tokenInfo?.cdnHost || 'https://cdnedgch2.azamtvltd.co.tz'}
            </div>
          </div>

          <div className="p-4 space-y-1">
            <div className="text-xs text-slate-400">Vituo &amp; ClearKeys</div>
            <div className="text-sm font-bold text-white tabular-nums">
              {CHANNELS_DATA.length} Vituo · {clearKeyCount} ClearKeys
            </div>
          </div>
        </div>

        {/* Live JWT Token Readout */}
        <div className="px-5 py-4 bg-[#0b0e14]/70 border-t border-white/[0.08] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Active Azam CDN Token (Auto-refresh kila sekunde 90)
            </span>
            {tokenInfo?.exp && (
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                Exp Unix: {tokenInfo.exp}
              </span>
            )}
          </div>

          {tokenError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{tokenError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#090c11] border border-white/[0.08] font-mono text-xs text-[#1ce783] overflow-x-auto select-all whitespace-nowrap">
              {isLoadingToken
                ? 'Inavuta live token kutoka NeliTv Server...'
                : tokenInfo?.token || 'Hakuna token'}
            </div>
            <button
              onClick={() => tokenInfo?.token && copyValue('live-token', tokenInfo.token)}
              disabled={!tokenInfo?.token}
              className="px-4 py-2.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.08] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {copiedId === 'live-token' ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'live-token' ? 'Imenakiliwa' : 'Nakili Token'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Endpoints & App Auth Key Table */}
      <section className="rounded-xl bg-[#141923] border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Endpoints za NeliTv App Server</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Nakili link hizi kuweka kwenye mipangilio ya NeliTv App yako.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-[#1ce783] shrink-0" />
            <code className="text-xs font-mono text-slate-300 bg-[#0b0e14] px-2.5 py-1.5 rounded-lg border border-white/[0.08]">
              {APP_AUTH_KEY}
            </code>
            <button
              onClick={() => copyValue('app-auth-key', APP_AUTH_KEY)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.08] text-xs font-semibold text-white flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedId === 'app-auth-key' ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === 'app-auth-key' ? 'Nakiliwa' : 'Nakili Key'}</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {serverEndpoints.map((ep) => (
            <div
              key={ep.id}
              className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-[#1ce783]">{ep.method}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="font-semibold text-white">{ep.label}</span>
                </div>
                <p className="text-xs text-slate-400">{ep.desc}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0 max-w-full">
                <code className="px-3 py-1.5 rounded-lg bg-[#0b0e14] border border-white/[0.08] font-mono text-xs text-slate-200 truncate max-w-[260px] sm:max-w-[360px]">
                  {ep.url}
                </code>
                <button
                  onClick={() => copyValue(ep.id, ep.url)}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.08] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedId === ep.id ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === ep.id ? 'Imenakiliwa' : 'Nakili'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live App Server Tester */}
      <section className="rounded-xl bg-[#141923] border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-[#1ce783]" />
              <span>Pima Majibu ya NeliTv Server Moja kwa Moja</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hakiki kuwa token, ClearKeys, na vituo vinatoka kikamilifu kabla ya kuweka kwenye app yako.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => runEndpointTest('cdn-token')}
              disabled={isTesting}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTestEndpoint === 'cdn-token' && testJson
                  ? 'bg-[#1ce783] text-[#04120b] font-bold'
                  : 'bg-white/[0.07] hover:bg-white/[0.13] text-white border border-white/[0.08]'
              }`}
            >
              Test /baynithalex/api/cdn-token
            </button>
            <button
              onClick={() => runEndpointTest('app')}
              disabled={isTesting}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTestEndpoint === 'app' && testJson
                  ? 'bg-[#1ce783] text-[#04120b] font-bold'
                  : 'bg-white/[0.07] hover:bg-white/[0.13] text-white border border-white/[0.08]'
              }`}
            >
              Test /baynithalex/api/app
            </button>
            <button
              onClick={() => runEndpointTest('channels')}
              disabled={isTesting}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeTestEndpoint === 'channels' && testJson
                  ? 'bg-[#1ce783] text-[#04120b] font-bold'
                  : 'bg-white/[0.07] hover:bg-white/[0.13] text-white border border-white/[0.08]'
              }`}
            >
              Test /baynithalex/api/channels
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <div className="font-mono">
              {testMeta ? (
                <span className="flex items-center gap-2 tabular-nums">
                  <span className={testMeta.status >= 200 && testMeta.status < 300 ? 'text-[#1ce783] font-bold' : 'text-rose-400 font-bold'}>
                    HTTP {testMeta.status}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{testMeta.path}</span>
                  <span aria-hidden="true">·</span>
                  <span>{testMeta.ms} ms</span>
                </span>
              ) : (
                <span>Bofya kitufe hapo juu kujaribu endpoint ya NeliTv Server</span>
              )}
            </div>

            {testJson && (
              <button
                onClick={() => copyValue('test-json', JSON.stringify(testJson, null, 2))}
                className="text-xs text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedId === 'test-json' ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'test-json' ? 'Imenakiliwa' : 'Nakili JSON'}</span>
              </button>
            )}
          </div>

          <pre className="p-4 rounded-lg bg-[#090c11] border border-white/[0.08] font-mono text-xs text-slate-200 overflow-x-auto max-h-80 leading-relaxed">
            {isTesting
              ? 'Inajaribu muunganisho wa NeliTv App Server...'
              : testJson
              ? JSON.stringify(testJson, null, 2)
              : `{\n  "info": "Bofya Test /baynithalex/api/cdn-token au Test /baynithalex/api/app kuona majibu halisi ya JSON."\n}`}
          </pre>
        </div>
      </section>

      {/* Integration Snippets for NeliTv App */}
      <section className="rounded-xl bg-[#141923] border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1ce783]" />
              <span>Msimbo wa Kuunganisha NeliTv App</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tumia mfano huu kwenye app yako ili itumie live token na stream za tovuti ya NeliTv.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0b0e14] border border-white/[0.08]">
            {([
              { id: 'kotlin', label: 'Android Kotlin' },
              { id: 'flutter', label: 'Flutter' },
              { id: 'js', label: 'JS / RN' },
              { id: 'curl', label: 'cURL' }
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCodeLang(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  codeLang === tab.id
                    ? 'bg-[#1ce783] text-[#04120b] font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => copyValue(`code-${codeLang}`, integrationSnippets[codeLang])}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.08] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            {copiedId === `code-${codeLang}` ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === `code-${codeLang}` ? 'Imenakiliwa' : 'Nakili Msimbo'}</span>
          </button>

          <pre className="p-4 pt-12 sm:pt-4 sm:pr-36 rounded-lg bg-[#090c11] border border-white/[0.08] font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed select-all">
            {integrationSnippets[codeLang]}
          </pre>
        </div>
      </section>
    </div>
  );
};

export default NeliTvServerPanel;
