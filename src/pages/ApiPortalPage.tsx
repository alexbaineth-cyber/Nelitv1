import React, { useState, useEffect } from 'react';
import {
  Code, Key, ShieldCheck, Copy, Check, Terminal,
  ArrowLeft, RefreshCw, AlertTriangle, Play, Layers,
  LogOut, CheckCircle2, Eye, EyeOff, Tv, Server
} from 'lucide-react';
import { CHANNELS_DATA } from '../data/channels.ts';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { NeliTvServerPanel } from '../components/NeliTvServerPanel.tsx';

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
  initialView?: 'server' | 'api';
  onBack?: () => void;
  onNavigateToEmbed?: () => void;
  onChangeRouteTab?: (tab: 'server' | 'api') => void;
}

const BASE_LINK = 'https://nelitv.online';

export const ApiPortalPage: React.FC<ApiPortalPageProps> = ({
  initialView = 'server',
  onBack,
  onNavigateToEmbed,
  onChangeRouteTab
}) => {
  const { user: appUser, loginWithGoogle } = useAuth();

  const [workspaceView, setWorkspaceView] = useState<'server' | 'api'>(initialView);

  useEffect(() => {
    setWorkspaceView(initialView);
  }, [initialView]);

  const handleSwitchView = (nextView: 'server' | 'api') => {
    setWorkspaceView(nextView);
    if (onChangeRouteTab) {
      onChangeRouteTab(nextView);
    }
  };

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
    <div className="min-h-screen bg-[#0b0e14] text-slate-200 py-8 px-4 sm:px-8 pb-24 md:pb-14">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Console Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="flex items-start sm:items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2.5 rounded-lg bg-[#141923] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 hover:text-white transition cursor-pointer shrink-0"
                aria-label="Rudi Nyuma"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {workspaceView === 'server'
                  ? 'NeliTv App Server'
                  : 'NeliTv Content & Player API'}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                {workspaceView === 'server'
                  ? `Unganisha NeliTv App yako na token hai, orodha ya vituo, na ClearKeys kutoka ${BASE_LINK}`
                  : `Content API, Official Player API & SDK (${BASE_LINK}) — 100% bure`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Workspace Segmented Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#141923] border border-white/[0.08]">
              <button
                onClick={() => handleSwitchView('server')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                  workspaceView === 'server'
                    ? 'bg-[#1ce783] text-[#04120b] font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>NeliTv App Server</span>
              </button>

              <button
                onClick={() => handleSwitchView('api')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                  workspaceView === 'api'
                    ? 'bg-[#1ce783] text-[#04120b] font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Public Player API</span>
              </button>
            </div>

            {onNavigateToEmbed && (
              <button
                onClick={onNavigateToEmbed}
                className="px-3.5 py-2 rounded-lg bg-[#141923] hover:bg-white/[0.08] border border-white/[0.08] text-white font-semibold text-xs flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-[#1ce783]" />
                <span>Embed Studio</span>
              </button>
            )}

            {session && workspaceView === 'api' && (
              <button
                onClick={() => updateSession(null)}
                className="px-3.5 py-2 rounded-lg bg-[#141923] hover:bg-rose-950/60 border border-white/[0.08] text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Toka</span>
              </button>
            )}
          </div>
        </div>

        {/* Active View: NeliTv App Server Console OR Public Content & Player API */}
        {workspaceView === 'server' ? (
          <NeliTvServerPanel />
        ) : (
          <div className="space-y-6">
            {/* Security & Free Access Banner */}
            <div className="p-5 rounded-xl bg-[#141923] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-lg bg-[#1ce783]/10 border border-[#1ce783]/25 text-[#1ce783] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Public API ni Bure — Stream za Watu Wengine Zinachezwa Kupitia NeliTv Player
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                    Kwa tovuti za nje au blog, tumia <strong>Content API</strong> na <strong>Player API / SDK</strong>.
                    Kama unaunganisha <strong>NeliTv App</strong> yako binafsi kupata live token na streams, fungua tab ya{' '}
                    <button
                      onClick={() => handleSwitchView('server')}
                      className="text-[#1ce783] hover:underline font-semibold cursor-pointer"
                    >
                      NeliTv App Server
                    </button>
                    .
                  </p>
                </div>
              </div>

              <button
                onClick={handleInstantFreeKey}
                disabled={isGeneratingKey}
                className="px-4 py-2.5 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs flex items-center justify-center gap-2 transition shrink-0 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{session ? 'Tengeneza API Key Mpya' : 'Pata Free API Key'}</span>
              </button>
            </div>

            {/* API Key + Developer Account */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 p-6 rounded-xl bg-[#141923] border border-white/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#1ce783]" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      {session ? `API Key Yako (${session.email})` : 'API Key ya Bure (Public / Developer)'}
                    </h3>
                  </div>

                  <button
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    {showKeySecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showKeySecret ? 'Ficha' : 'Onyesha'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#090c11] border border-white/[0.08] font-mono text-xs sm:text-sm text-[#1ce783] overflow-x-auto select-all">
                    {showKeySecret ? activeApiKey : '••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                  <button
                    onClick={copyKeyToClipboard}
                    className="px-4 py-2.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.08] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Imenakiliwa' : 'Nakili'}</span>
                  </button>
                </div>

                {keySuccessMsg && (
                  <div className="text-xs text-[#1ce783] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{keySuccessMsg}</span>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <div className="text-xs font-semibold text-slate-400">
                    Endpoints za Public API ({BASE_LINK})
                  </div>
                  <div className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-[#090c11] text-xs font-mono">
                    {[
                      { tag: 'INDEX', url: `${BASE_LINK}/api/v1` },
                      { tag: 'CONTENT', url: `${BASE_LINK}/api/v1/content` },
                      { tag: 'PLAYER', url: `${BASE_LINK}/api/v1/player/${sandboxChannelSlug}` },
                      { tag: 'SDK.JS', url: `${BASE_LINK}/api/v1/player/sdk.js` },
                      { tag: 'EMBED', url: `${BASE_LINK}/embed/${sandboxChannelSlug}` }
                    ].map((ep) => (
                      <div key={ep.tag} className="flex items-center gap-3 px-3 py-2.5 overflow-x-auto">
                        <span className="text-[11px] font-bold text-[#1ce783] w-16 shrink-0">{ep.tag}</span>
                        <code className="text-xs text-slate-200 truncate">{ep.url}</code>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 p-6 rounded-xl bg-[#141923] border border-white/[0.08] flex flex-col justify-between space-y-4">
                {session ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1ce783] flex items-center justify-center text-[#04120b] font-bold text-base shrink-0">
                        {(session.name || session.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{session.name || session.email}</h3>
                        <p className="text-xs text-slate-400 truncate">{session.email}</p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#090c11] border border-white/[0.08] text-xs text-slate-300 space-y-1">
                      <div className="font-semibold text-[#1ce783] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Akaunti ya Bure (Unlimited Free API)</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Una ufikiaji kamili wa Content API na Player API bila kikomo.
                      </p>
                    </div>

                    <button
                      onClick={handleInstantFreeKey}
                      disabled={isGeneratingKey}
                      className="w-full py-2.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.08] text-white font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
                      <span>Badilisha / Zalisha Key Mpya</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Hifadhi API Key Yako (Hiari)</h3>
                      <p className="text-xs text-slate-400">
                        Ingia kwa Google au barua pepe ili kuhifadhi API Key yako binafsi bure.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isAuthLoading}
                      className="w-full py-2.5 px-4 rounded-lg bg-white hover:bg-slate-100 text-neutral-900 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <span>Ingia kwa Google</span>
                    </button>

                    <form onSubmit={handleAuthSubmit} className="space-y-2.5">
                      <div className="flex rounded-lg bg-[#090c11] p-1 border border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => setAuthMode('login')}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                            authMode === 'login' ? 'bg-[#1ce783] text-[#04120b] font-bold' : 'text-slate-400'
                          }`}
                        >
                          Ingia
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMode('register')}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                            authMode === 'register' ? 'bg-[#1ce783] text-[#04120b] font-bold' : 'text-slate-400'
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
                          className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.08] focus:border-[#1ce783] focus:outline-none text-white text-xs"
                        />
                      )}

                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="developer@example.com"
                        className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.08] focus:border-[#1ce783] focus:outline-none text-white text-xs"
                      />

                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Nenosiri"
                        className="w-full px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.08] focus:border-[#1ce783] focus:outline-none text-white text-xs"
                      />

                      {authError && (
                        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/35 text-rose-300 text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{authError}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isAuthLoading}
                        className="w-full py-2.5 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isAuthLoading ? 'Inapakia...' : authMode === 'login' ? 'Ingia & Pata Key' : 'Jisajili Bure'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* Sandbox + NeliTv Player Preview */}
            <div className="p-6 rounded-xl bg-[#141923] border border-white/[0.08] space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-[#1ce783]" />
                    <span>Jaribu Content API, Player API &amp; NeliTv Player</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chagua kituo kupima majibu ya JSON na preview ya player.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={sandboxChannelSlug}
                    onChange={(e) => setSandboxChannelSlug(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#090c11] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#1ce783] cursor-pointer"
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
                    className="px-3.5 py-2 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Test Content API
                  </button>

                  <button
                    onClick={() => handleTestSandbox('player')}
                    disabled={isSandboxTesting}
                    className="px-3.5 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.08] text-white font-semibold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Test Player API
                  </button>

                  <button
                    onClick={() => setShowPlayerPreview((p) => !p)}
                    className="px-3.5 py-2 rounded-lg bg-[#090c11] border border-white/[0.08] text-slate-300 hover:text-white font-semibold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {showPlayerPreview ? 'Ficha Player' : 'Onyesha Player'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {showPlayerPreview && (
                  <div className="lg:col-span-6 space-y-2">
                    <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-[#1ce783]" />
                      <span>NeliTv Player Preview ({BASE_LINK}/embed/{sandboxChannelSlug})</span>
                    </div>
                    <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/[0.08] bg-black">
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
                  <div className="text-xs font-semibold text-slate-300 font-mono">
                    {BASE_LINK}/api/v1/{sandboxEndpoint === 'player' ? `player/${sandboxChannelSlug}` : `content/${sandboxChannelSlug}`}
                  </div>
                  <pre className="p-4 rounded-lg bg-[#090c11] border border-white/[0.08] text-xs font-mono text-slate-200 overflow-x-auto max-h-72 leading-relaxed">
                    {sandboxResult
                      ? JSON.stringify(sandboxResult, null, 2)
                      : `Bofya "Test Content API" au "Test Player API" kuona majibu halisi ya JSON yenye link za ${BASE_LINK}.`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Docs: Content API & Player API */}
            <div className="p-6 rounded-xl bg-[#141923] border border-white/[0.08] space-y-5">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#1ce783]" />
                  <span>Nyaraka za Content API &amp; Player API</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Miongozo ya kuunganisha vituo vya NeliTv kwenye tovuti au blog yako.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="font-bold text-[#1ce783]">GET</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <code className="text-white break-all">{BASE_LINK}/api/v1/content</code>
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#090c11] border border-white/[0.08] w-fit text-xs font-semibold">
                  {(['curl', 'js', 'python', 'php'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveCodeTab(tab)}
                      className={`px-3 py-1 rounded-md transition cursor-pointer ${
                        activeCodeTab === tab ? 'bg-[#1ce783] text-[#04120b] font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>

                <pre className="p-4 rounded-lg bg-[#090c11] border border-white/[0.08] text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed select-all">
                  {activeCodeTab === 'curl' && `curl -X GET "${BASE_LINK}/api/v1/content" \\\n  -H "X-Neli-Api-Key: ${activeApiKey}"`}
                  {activeCodeTab === 'js' && `const res = await fetch("${BASE_LINK}/api/v1/content", {\n  headers: { "X-Neli-Api-Key": "${activeApiKey}" }\n});\nconst { channels } = await res.json();`}
                  {activeCodeTab === 'python' && `import requests\n\nr = requests.get("${BASE_LINK}/api/v1/content", headers={"X-Neli-Api-Key": "${activeApiKey}"})\nprint(r.json()["channels"])`}
                  {activeCodeTab === 'php' && `<?php\n$ch = curl_init("${BASE_LINK}/api/v1/content");\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["X-Neli-Api-Key: ${activeApiKey}"]);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$data = json_decode(curl_exec($ch), true);`}
                </pre>
              </div>

              <div className="pt-4 border-t border-white/[0.08] space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="font-bold text-[#1ce783]">PLAYER SDK</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <code className="text-white break-all">{BASE_LINK}/api/v1/player/{'{slug}'}</code>
                </div>

                <pre className="p-4 rounded-lg bg-[#090c11] border border-white/[0.08] text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed select-all">
{`<script src="${BASE_LINK}/api/v1/player/sdk.js"></script>
<div id="nelitv-player"></div>
<script>
  new NeliTvPlayer('#nelitv-player', {
    channel: '${sandboxChannelSlug}',
    width: '100%',
    height: '480px',
    apiKey: '${activeApiKey}'
  });
</script>`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiPortalPage;
