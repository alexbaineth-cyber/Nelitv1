import React, { useState } from 'react';
import {
  Code, Key, ShieldCheck, Copy, Check, Terminal,
  ArrowLeft, RefreshCw, AlertTriangle, Play, Layers,
  LogOut, CheckCircle2, Eye, EyeOff, Tv, Sparkles
} from 'lucide-react';
import { CHANNELS_DATA } from '../data/channels.ts';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface DeveloperSession {
  id: string;
  email: string;
  name?: string;
  apiKey: string;
  isSubscribed: boolean;
  subscriptionPlan?: string;
  createdAt: string;
}

interface ApiPortalPageProps {
  onBack?: () => void;
  onNavigateToEmbed?: () => void;
}

const BASE_LINK = 'https://nelitv.online';

export const ApiPortalPage: React.FC<ApiPortalPageProps> = ({
  onBack,
  onNavigateToEmbed
}) => {
  const { user: appUser, loginWithGoogle } = useAuth();

  const [session, setSession] = useState<DeveloperSession | null>(() => {
    try {
      const saved = localStorage.getItem('nelitv_api_dev_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  const [showKeySecret, setShowKeySecret] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);
  const [keySuccessMsg, setKeySuccessMsg] = useState<string | null>(null);

  // Sandbox tester state
  const [sandboxChannelSlug, setSandboxChannelSlug] = useState<string>(
    getChannelRouteSlug(CHANNELS_DATA[0])
  );
  const [sandboxEndpoint, setSandboxEndpoint] = useState<'content' | 'player' | 'categories'>('content');
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);
  const [isSandboxTesting, setIsSandboxTesting] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'js' | 'python' | 'php'>('curl');
  const [showPlayerPreview, setShowPlayerPreview] = useState<boolean>(true);

  const activeApiKey = session?.apiKey || 'neli_free_public_demo';

  const updateSession = (newSession: DeveloperSession | null) => {
    setSession(newSession);
    try {
      if (newSession) {
        localStorage.setItem('nelitv_api_dev_session', JSON.stringify(newSession));
      } else {
        localStorage.removeItem('nelitv_api_dev_session');
      }
    } catch {}
  };

  // Sign in / Register developer (100% Free Unlimited)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/developer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
          googleUser: nameInput ? { displayName: nameInput } : undefined
        })
      });

      const data = await res.json();
      if (data.success && data.user) {
        updateSession(data.user);
        setEmailInput('');
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'Imeshindikana kuingia. Kagua barua pepe na nenosiri.');
      }
    } catch {
      setAuthError('Hitilafu ya mtandao. Tafadhali jaribu tena.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      if (appUser && appUser.email) {
        const res = await fetch('/api/developer/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: appUser.email,
            googleUser: { displayName: appUser.displayName || appUser.email.split('@')[0] }
          })
        });
        const data = await res.json();
        if (data.success && data.user) {
          updateSession(data.user);
          return;
        }
      }

      const gRes = await loginWithGoogle();
      if (gRes.success) {
        let loggedEmail = '';
        let loggedName = '';
        try {
          const profileStr = localStorage.getItem('nelitv_user_profile');
          if (profileStr) {
            const parsed = JSON.parse(profileStr);
            loggedEmail = parsed.email || '';
            loggedName = parsed.displayName || '';
          }
        } catch {}

        if (loggedEmail) {
          const res = await fetch('/api/developer/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: loggedEmail,
              googleUser: { displayName: loggedName || loggedEmail.split('@')[0] }
            })
          });
          const data = await res.json();
          if (data.success && data.user) {
            updateSession(data.user);
            return;
          }
        }
      } else if (gRes.error) {
        setAuthError(gRes.error);
      }
    } catch {
      setAuthError('Hitilafu ya mtandao wakati wa kuingia na Google.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Instant Free API Key generator (works even without logging in first!)
  const handleInstantFreeKey = async () => {
    setIsGeneratingKey(true);
    setKeySuccessMsg(null);
    setAuthError(null);
    try {
      const res = await fetch('/api/v1/keys/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session?.email || appUser?.email || emailInput.trim() || undefined,
          regenerate: Boolean(session)
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        updateSession(data.user);
        setKeySuccessMsg('API Key mpya ya bure imetengenezwa kikamilifu!');
        setTimeout(() => setKeySuccessMsg(null), 4000);
      }
    } catch {
      setAuthError('Hitilafu ya mtandao wakati wa kutengeneza API Key.');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleTestSandbox = async (mode: 'content' | 'player' | 'categories' = sandboxEndpoint) => {
    setSandboxEndpoint(mode);
    setIsSandboxTesting(true);
    try {
      const targetPath =
        mode === 'categories'
          ? '/api/v1/content/categories'
          : mode === 'player'
          ? `/api/v1/player/${encodeURIComponent(sandboxChannelSlug)}?api_key=${encodeURIComponent(activeApiKey)}`
          : `/api/v1/content/${encodeURIComponent(sandboxChannelSlug)}?api_key=${encodeURIComponent(activeApiKey)}`;

      const res = await fetch(targetPath, {
        headers: { 'X-Neli-Api-Key': activeApiKey }
      });
      const data = await res.json();
      setSandboxResult(data);
    } catch (err: any) {
      setSandboxResult({ error: err.message });
    } finally {
      setIsSandboxTesting(false);
    }
  };

  const copyKeyToClipboard = () => {
    navigator.clipboard.writeText(activeApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#050611] text-slate-200 py-8 px-4 sm:px-8 pb-24 md:pb-14">
      <div className="max-w-6xl mx-auto space-y-7">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2.5 rounded-xl bg-[#0b0e24] hover:bg-[#14183b] border border-purple-500/30 text-slate-200 hover:text-white transition cursor-pointer"
                aria-label="Rudi Nyuma"
              >
                <ArrowLeft className="w-5 h-5 text-cyan-400" />
              </button>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Terminal className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  NeliTv <span className="neli-gradient-text">Content &amp; Player API</span>
                </h1>
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold">
                  100% BURE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Content API, Official Player API &amp; SDK — endpoint zote zinatumia{' '}
                <strong className="text-cyan-300">{BASE_LINK}</strong> na stream zinacheza kupitia NeliTv Player pekee.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onNavigateToEmbed && (
              <button
                onClick={onNavigateToEmbed}
                className="px-4 py-2.5 rounded-xl bg-[#0b0e24] hover:bg-[#14183b] border border-purple-500/35 hover:border-cyan-400/60 text-white font-bold text-xs flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-[#ffb020]" />
                <span>Embed Studio →</span>
              </button>
            )}

            {session && (
              <button
                onClick={() => updateSession(null)}
                className="px-3.5 py-2.5 rounded-xl bg-[#0b0e24] hover:bg-rose-950/60 border border-purple-500/30 text-slate-300 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Toka</span>
              </button>
            )}
          </div>
        </div>

        {/* Security & Protection Rule Highlight */}
        <div className="relative overflow-hidden p-5 rounded-2xl neli-card-surface border border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[#ff1e8a]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-0 w-48 h-48 rounded-full bg-[#00d4ff]/15 blur-3xl" />

          <div className="relative z-10 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-black text-white">
                API ni Bure Sasa — Stream Zimefungwa Nje ya NeliTv Player
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                Unaweza kuchukua orodha yote ya vituo kupitia <strong>Content API</strong> na kupata{' '}
                <strong>Player API / SDK</strong> bila malipo yoyote. Viungo halisi vya video (<code>.mpd</code>,{' '}
                <code>.m3u8</code>, ClearKeys &amp; CDN tokens) havipo hadharani na havikubali kucheza nje ya NeliTv Player (<code>403 Forbidden</code>).
              </p>
            </div>
          </div>

          <button
            onClick={handleInstantFreeKey}
            disabled={isGeneratingKey}
            className="relative z-10 px-5 py-3 rounded-xl neli-gradient-bg text-white font-extrabold text-xs shadow-[0_0_24px_rgba(255,30,138,0.4)] hover:brightness-110 flex items-center justify-center gap-2 transition active:scale-95 shrink-0 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{session ? 'Tengeneza API Key Mpya' : 'Pata Free API Key Papo Hapo'}</span>
          </button>
        </div>

        {/* Free API Key Box + Optional Developer Account */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: API Key Display */}
          <div className="lg:col-span-7 p-6 rounded-3xl neli-card-surface border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                  {session ? `API Key Yako (${session.email})` : 'API Key ya Bure (Public / Developer)'}
                </h3>
              </div>

              <button
                onClick={() => setShowKeySecret(!showKeySecret)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                {showKeySecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showKeySecret ? 'Ficha' : 'Onyesha'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-[#04050e] border border-purple-500/25 font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto select-all">
                {showKeySecret ? activeApiKey : '••••••••••••••••••••••••••••••••••••••••'}
              </div>
              <button
                onClick={copyKeyToClipboard}
                className="px-4 py-3 rounded-xl bg-[#0b0e24] hover:bg-[#14183b] border border-purple-500/35 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey ? 'Imenakiliwa' : 'Nakili'}</span>
              </button>
            </div>

            {keySuccessMsg && (
              <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>{keySuccessMsg}</span>
              </div>
            )}

            {/* Endpoints Quick Table (All using https://nelitv.online) */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Endpoints Zote ({BASE_LINK})
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                {[
                  { tag: 'INDEX', color: 'text-slate-300 bg-white/5', url: `${BASE_LINK}/api/v1` },
                  { tag: 'CONTENT', color: 'text-emerald-300 bg-emerald-500/15', url: `${BASE_LINK}/api/v1/content` },
                  { tag: 'PLAYER', color: 'text-cyan-300 bg-cyan-500/15', url: `${BASE_LINK}/api/v1/player/${sandboxChannelSlug}` },
                  { tag: 'SDK.JS', color: 'text-purple-300 bg-purple-500/20', url: `${BASE_LINK}/api/v1/player/sdk.js` },
                  { tag: 'EMBED', color: 'text-[#ffb020] bg-amber-500/15', url: `${BASE_LINK}/embed/${sandboxChannelSlug}` },
                ].map((ep) => (
                  <div
                    key={ep.tag}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#04050e] border border-purple-500/20 overflow-x-auto"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${ep.color}`}>
                        {ep.tag}
                      </span>
                      <code className="text-[11px] text-slate-200 truncate">{ep.url}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Developer Account (Optional Sign-In for Saved Key) */}
          <div className="lg:col-span-5 p-6 rounded-3xl neli-card-surface border border-purple-500/30 flex flex-col justify-between space-y-4">
            {session ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl neli-gradient-bg flex items-center justify-center text-white font-black text-base">
                    {(session.name || session.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white truncate">{session.name || session.email}</h3>
                    <p className="text-xs text-slate-400 truncate">{session.email}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 text-xs text-emerald-300 space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Akaunti ya Bure (Unlimited Free API)</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Una ufikiaji kamili wa Content API na Player API bila kikomo cha muda wala maombi.
                  </p>
                </div>

                <button
                  onClick={handleInstantFreeKey}
                  disabled={isGeneratingKey}
                  className="w-full py-2.5 rounded-xl bg-[#0b0e24] hover:bg-[#14183b] border border-cyan-400/45 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
                  <span>Badilisha / Zalisha Key Mpya</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-black text-white">Hifadhi API Key Yako (Hiari)</h3>
                  <p className="text-[11px] text-slate-400">
                    Ingia kwa Google au barua pepe ili kuhifadhi API Key yako binafsi bure.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-neutral-900 font-bold text-xs flex items-center justify-center gap-2 shadow transition cursor-pointer disabled:opacity-50"
                >
                  <span>Ingia kwa Google</span>
                </button>

                <form onSubmit={handleAuthSubmit} className="space-y-2.5">
                  <div className="flex rounded-xl bg-[#04050e] p-1 border border-purple-500/20">
                    <button
                      type="button"
                      onClick={() => setAuthMode('login')}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        authMode === 'login' ? 'bg-[#5b21b6] text-white' : 'text-slate-400'
                      }`}
                    >
                      Ingia
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        authMode === 'register' ? 'bg-[#5b21b6] text-white' : 'text-slate-400'
                      }`}
                    >
                      Jisajili Bure
                    </button>
                  </div>

                  {authMode === 'register' && (
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Jina au Tovuti yako"
                      className="w-full px-3.5 py-2 rounded-xl bg-[#04050e] border border-purple-500/25 focus:border-cyan-400 focus:outline-none text-white text-xs"
                    />
                  )}

                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="developer@example.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#04050e] border border-purple-500/25 focus:border-cyan-400 focus:outline-none text-white text-xs"
                  />

                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Nenosiri"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#04050e] border border-purple-500/25 focus:border-cyan-400 focus:outline-none text-white text-xs"
                  />

                  {authError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#5b21b6] to-[#0891b2] hover:brightness-110 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isAuthLoading ? 'Inapakia...' : authMode === 'login' ? 'Ingia & Pata Key' : 'Jisajili Bure'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Live Sandbox + Live NeliTv Player Preview */}
        <div className="p-6 rounded-3xl neli-card-surface border border-purple-500/30 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" />
                <span>Jaribu Content API, Player API &amp; NeliTv Player Moja kwa Moja</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Chagua kituo kupima majibu ya API na kuona jinsi player inavyocheza kupitia mfumo wa NeliTv pekee.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sandboxChannelSlug}
                onChange={(e) => setSandboxChannelSlug(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#04050e] border border-purple-500/35 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {CHANNELS_DATA.map((ch) => {
                  const slug = getChannelRouteSlug(ch);
                  return (
                    <option key={ch.id} value={slug}>
                      {ch.name}
                    </option>
                  );
                })}
              </select>

              <button
                onClick={() => handleTestSandbox('content')}
                disabled={isSandboxTesting}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
              >
                Test Content API
              </button>

              <button
                onClick={() => handleTestSandbox('player')}
                disabled={isSandboxTesting}
                className="px-3.5 py-2 rounded-xl bg-[#5b21b6] hover:bg-[#6d28d9] text-white font-bold text-xs transition cursor-pointer"
              >
                Test Player API
              </button>

              <button
                onClick={() => setShowPlayerPreview((p) => !p)}
                className="px-3.5 py-2 rounded-xl bg-[#0b0e24] border border-cyan-400/40 text-cyan-300 font-bold text-xs transition cursor-pointer"
              >
                {showPlayerPreview ? 'Ficha Player' : 'Onyesha Player'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {showPlayerPreview && (
              <div className="lg:col-span-6 space-y-2">
                <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-[#ffb020]" />
                  <span>NeliTv Official Player Preview ({BASE_LINK}/embed/{sandboxChannelSlug})</span>
                </div>
                <div className="aspect-video w-full rounded-2xl overflow-hidden border border-purple-500/35 bg-black shadow-xl">
                  <iframe
                    key={sandboxChannelSlug}
                    src={`/embed/${sandboxChannelSlug}?autoplay=1`}
                    title={sandboxChannelSlug}
                    className="w-full h-full border-0"
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            <div className={showPlayerPreview ? 'lg:col-span-6 space-y-2' : 'lg:col-span-12 space-y-2'}>
              <div className="text-[11px] font-bold text-slate-300">
                API JSON Output ({BASE_LINK}/api/v1/{sandboxEndpoint === 'player' ? `player/${sandboxChannelSlug}` : `content/${sandboxChannelSlug}`})
              </div>
              <pre className="p-4 rounded-2xl bg-[#04050e] border border-purple-500/25 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-72 leading-relaxed">
                {sandboxResult
                  ? JSON.stringify(sandboxResult, null, 2)
                  : `Bofya "Test Content API" au "Test Player API" kuona majibu halisi ya JSON yenye link za ${BASE_LINK} (bila kufichua stream links).`}
              </pre>
            </div>
          </div>
        </div>

        {/* Documentation: Content API & Player API */}
        <div className="p-6 sm:p-8 rounded-3xl neli-card-surface border border-purple-500/30 space-y-6">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>Nyaraka za API (Content API &amp; Player API)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Miongozo ya kuunganisha vituo vya NeliTv kwenye tovuti au app yako kwa kutumia link ya{' '}
              <strong className="text-white">{BASE_LINK}</strong>.
            </p>
          </div>

          {/* 1. Content API */}
          <div className="p-5 rounded-2xl bg-[#04050e] border border-purple-500/20 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-xs font-black">
                GET
              </span>
              <code className="text-xs font-mono text-white break-all">
                {BASE_LINK}/api/v1/content
              </code>
            </div>
            <p className="text-xs text-slate-400">
              Inaleta orodha ya vituo vyote, picha (logo), kategoria, vipindi vya sasa, na viungo vya <strong>Player API</strong> na <strong>Embed URL</strong> (bila kutoa stream links nje).
            </p>

            <div className="flex flex-wrap items-center gap-2 border-b border-purple-500/20 pb-2 text-[11px] font-bold">
              {(['curl', 'js', 'python', 'php'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveCodeTab(tab)}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    activeCodeTab === tab ? 'bg-[#5b21b6] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <pre className="p-3.5 rounded-xl bg-[#070918] border border-purple-500/20 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed select-all">
              {activeCodeTab === 'curl' && `curl -X GET "${BASE_LINK}/api/v1/content" \\\n  -H "X-Neli-Api-Key: ${activeApiKey}"`}
              {activeCodeTab === 'js' && `const res = await fetch("${BASE_LINK}/api/v1/content", {\n  headers: { "X-Neli-Api-Key": "${activeApiKey}" }\n});\nconst { channels } = await res.json();\n// Kila kituo kina endpoints.playerApi na endpoints.playerEmbed`}
              {activeCodeTab === 'python' && `import requests\n\nr = requests.get("${BASE_LINK}/api/v1/content", headers={"X-Neli-Api-Key": "${activeApiKey}"})\nprint(r.json()["channels"])`}
              {activeCodeTab === 'php' && `<?php\n$ch = curl_init("${BASE_LINK}/api/v1/content");\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Neli-Api-Key: ${activeApiKey}"]);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$data = json_decode(curl_exec($ch), true);`}
            </pre>
          </div>

          {/* 2. Player API & SDK */}
          <div className="p-5 rounded-2xl bg-[#04050e] border border-purple-500/20 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-xs font-black">
                PLAYER API &amp; SDK
              </span>
              <code className="text-xs font-mono text-white break-all">
                {BASE_LINK}/api/v1/player/{'{slug}'}
              </code>
            </div>
            <p className="text-xs text-slate-400">
              Inarudisha msimbo wa NeliTv Player tayari kwa kucheza kwenye tovuti yako. Video zote zinachezwa moja kwa moja ndani ya NeliTv Player:
            </p>

            <pre className="p-3.5 rounded-xl bg-[#070918] border border-purple-500/20 text-[11px] font-mono text-purple-300 overflow-x-auto leading-relaxed select-all">
{`<!-- Njia 1: NeliTv Official Player SDK -->
<script src="${BASE_LINK}/api/v1/player/sdk.js"></script>
<div id="nelitv-player"></div>
<script>
  const player = new NeliTvPlayer('#nelitv-player', {
    channel: '${sandboxChannelSlug}',
    width: '100%',
    height: '480px',
    apiKey: '${activeApiKey}'
  });
</script>

<!-- Njia 2: iFrame ya Moja kwa Moja -->
<iframe src="${BASE_LINK}/embed/${sandboxChannelSlug}?autoplay=1" width="100%" height="480px" frameborder="0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiPortalPage;
