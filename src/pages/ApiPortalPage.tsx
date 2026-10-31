import React, { useState, useEffect } from 'react';
import {
  Code, Key, Lock, ShieldCheck, Zap, Copy, Check, Terminal,
  ExternalLink, ArrowLeft, RefreshCw, Smartphone, Mail, AlertTriangle,
  Play, Sparkles, Layers, Globe, LogOut, CheckCircle2, Eye, EyeOff
} from 'lucide-react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';

interface DeveloperSession {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  apiKey: string;
  isSubscribed: boolean;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  createdAt: string;
}

interface ApiPortalPageProps {
  onBack?: () => void;
  onNavigateToEmbed?: () => void;
}

export const ApiPortalPage: React.FC<ApiPortalPageProps> = ({
  onBack,
  onNavigateToEmbed
}) => {
  // Independent API Developer authentication state
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

  // Key & Payment state
  const [showKeySecret, setShowKeySecret] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState<boolean>(false);
  const [keySuccessMsg, setKeySuccessMsg] = useState<string | null>(null);

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<'plan_api_monthly' | 'plan_api_yearly'>('plan_api_monthly');
  const [paymentPhone, setPaymentPhone] = useState<string>('');
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  // Live API Sandbox state
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);
  const [isSandboxTesting, setIsSandboxTesting] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'js' | 'python' | 'php'>('curl');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nelitv.online';

  const isFreeAdmin = session?.email === 'adminapi@login.com';
  const hasActiveLicense = Boolean(
    session &&
    (isFreeAdmin || (session.isSubscribed && session.subscriptionExpiresAt && new Date(session.subscriptionExpiresAt).getTime() > Date.now()))
  );

  // Save session to localStorage
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

  // Login handler
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
        setAuthError(data.error || 'Imeshindikana kuingia. Tafadhali kagua barua pepe na nenosiri.');
      }
    } catch {
      setAuthError('Hitilafu ya mtandao. Tafadhali jaribu tena.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Quick Login as adminapi@login.com
  const handleQuickAdminLogin = () => {
    setEmailInput('adminapi@login.com');
    setPasswordInput('123Free');
    setIsAuthLoading(true);
    setAuthError(null);

    fetch('/api/developer/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'adminapi@login.com',
        password: '123Free'
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          updateSession(data.user);
        } else {
          setAuthError(data.error || 'Hitilafu ya kuingia');
        }
      })
      .catch(() => setAuthError('Hitilafu ya mtandao'))
      .finally(() => setIsAuthLoading(false));
  };

  // Generate or Regenerate API Key
  const handleGenerateKey = async () => {
    if (!session) return;
    if (!hasActiveLicense) {
      setShowPayModal(true);
      return;
    }

    setIsGeneratingKey(true);
    setKeySuccessMsg(null);

    try {
      const res = await fetch('/api/developer/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email })
      });
      const data = await res.json();
      if (data.success && data.user) {
        updateSession(data.user);
        setKeySuccessMsg('✓ API Key mpya imezalishwa kikamilifu!');
        setTimeout(() => setKeySuccessMsg(null), 4000);
      } else if (data.requirePayment) {
        setShowPayModal(true);
      }
    } catch {
      alert('Hitilafu ya mtandao');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  // Initiate HarakaPay API License Payment
  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPhone || paymentPhone.trim().length < 9 || !session) {
      setPayError('Tafadhali weka namba sahihi ya simu (mfano: 0712345678)');
      return;
    }

    setIsPaying(true);
    setPayError(null);
    setPaySuccessMsg(null);

    try {
      const res = await fetch('/api/developer/payment/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.email,
          phone: paymentPhone.trim(),
          planId: selectedPlanId
        })
      });
      const data = await res.json();
      if (data.success && data.orderId) {
        setActiveOrderId(data.orderId);
        setPaySuccessMsg(data.message || 'Ombi la USSD limetumwa kwenye simu yako! Tafadhali ingiza PIN sasa.');
      } else {
        setPayError(data.error || 'Imeshindikana kuanzisha malipo. Hakikisha simu ina salio na iko hewani.');
        setIsPaying(false);
      }
    } catch {
      setPayError('Hitilafu ya mtandao.');
      setIsPaying(false);
    }
  };

  // Poll status of payment order
  useEffect(() => {
    if (!activeOrderId || !session) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/developer/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: activeOrderId,
            email: session.email,
            phone: paymentPhone,
            planId: selectedPlanId
          })
        });
        const data = await res.json();
        if (data.success && data.verified && data.developer) {
          clearInterval(interval);
          updateSession(data.developer);
          setIsPaying(false);
          setActiveOrderId(null);
          setShowPayModal(false);
          alert(`Hongera! Malipo yako ya API yamethibitishwa kikamilifu.\n\nAPI Key yako sasa inafanya kazi na pia upewe ${data.bonusAppDays === 365 ? 'Mwaka 1 Mzima' : 'Miezi 3'} Bure ya VIP kwenye NeliTv App!`);
        }
      } catch (err) {
        console.warn('Status poll err', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeOrderId, session, paymentPhone, selectedPlanId]);

  // Test Live Sandbox
  const handleTestSandbox = async () => {
    if (!session?.apiKey) return;
    setIsSandboxTesting(true);
    try {
      const res = await fetch(`/api/developer/channels?api_key=${encodeURIComponent(session.apiKey)}`);
      const data = await res.json();
      setSandboxResult(data);
    } catch (err: any) {
      setSandboxResult({ error: err.message });
    } finally {
      setIsSandboxTesting(false);
    }
  };

  const copyKeyToClipboard = () => {
    if (!session?.apiKey) return;
    navigator.clipboard.writeText(session.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Expiry calculation
  const expiryDate = session?.subscriptionExpiresAt ? new Date(session.subscriptionExpiresAt) : null;
  const daysRemaining = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="min-h-screen bg-[#070A0F] text-neutral-200 py-8 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
                aria-label="Rudi Nyuma"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  NeliTv Developer Platform (API & SDK)
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Player API, Live Stream JSON APIs na DRM Token Decryption kwa ajili ya tovuti na mifumo ya nje
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onNavigateToEmbed && (
              <button
                onClick={onNavigateToEmbed}
                className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Code className="w-3.5 h-3.5 text-pink-400" />
                <span>Embed Studio →</span>
              </button>
            )}

            {session && (
              <button
                onClick={() => updateSession(null)}
                className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-red-950/60 border border-neutral-800 text-neutral-400 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Toka</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. AUTHENTICATION SECTION (If not logged in) */}
        {!session ? (
          <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
            {/* Hero Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-[#0A1020] border border-cyan-500/30 shadow-2xl text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 to-pink-500 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full rounded-[14px] bg-[#0A1020] flex items-center justify-center">
                  <Key className="w-7 h-7 text-cyan-400" />
                </div>
              </div>

              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
                  Karibu NeliTv API Developer Portal
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-md mx-auto">
                  Akaunti hii ni maalum kwa ajili ya Developers na wamiliki wa tovuti (haitumii data za app ya kawaida).
                </p>
              </div>

              {/* One-Click Quick Admin Test Account Button */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-pink-500/15 to-cyan-500/15 border border-amber-500/30 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Akaunti ya Jaribio ya Bure (Free Admin API):</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                    VIP Lifetime
                  </span>
                </div>
                <p className="text-[11px] text-neutral-300">
                  Email: <code className="text-cyan-300 font-bold">adminapi@login.com</code> • Password: <code className="text-cyan-300 font-bold">123Free</code>
                </p>
                <button
                  type="button"
                  onClick={handleQuickAdminLogin}
                  disabled={isAuthLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 text-black font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Ingia Moja kwa Moja kama Admin API (1-Click Test)</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-3.5 text-left pt-2">
                <div className="flex rounded-xl bg-neutral-950 p-1 border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      authMode === 'login' ? 'bg-cyan-600 text-white shadow' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Ingia (Sign In)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      authMode === 'register' ? 'bg-cyan-600 text-white shadow' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Jisajili Mpya (Register)
                  </button>
                </div>

                {authMode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-300">Jina Lako au Kampuni:</label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Mfano: Alex Tech Ltd"
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-300">Barua Pepe (Email):</label>
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="developer@gmail.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-300">Nenosiri (Password):</label>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Weka nenosiri..."
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs"
                  />
                </div>

                {authError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isAuthLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>{authMode === 'login' ? 'Ingia kwenye API Portal' : 'Kamilisha Usajili'}</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* 2. DEVELOPER DASHBOARD (When Logged In) */
          <div className="space-y-8 animate-fade-in">
            {/* Top Developer Status Bar */}
            <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white">{session.name || session.email}</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      {session.email}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                    {hasActiveLicense ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Kifurushi Kipo Hai {isFreeAdmin ? '(VIP Lifetime)' : `(${daysRemaining} Siku Zimebaki)`}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-[11px]">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Haijalipiwa (Bofya Kulipia kupata API Key)</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start md:self-auto">
                {!hasActiveLicense && (
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-pink-600/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Lipia Kifurushi cha API Sasa</span>
                  </button>
                )}

                <button
                  onClick={handleGenerateKey}
                  disabled={isGeneratingKey}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingKey ? 'animate-spin' : ''}`} />
                  <span>{session.apiKey ? 'Regenerate API Key' : 'Generate API Key'}</span>
                </button>
              </div>
            </div>

            {/* API Key Box */}
            <div className="p-6 rounded-3xl bg-[#090D18] border border-cyan-500/30 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    API Key Yako ya Siri (Secret API Key)
                  </h3>
                </div>

                {hasActiveLicense && (
                  <button
                    onClick={() => setShowKeySecret(!showKeySecret)}
                    className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {showKeySecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showKeySecret ? 'Ficha' : 'Onyesha'}</span>
                  </button>
                )}
              </div>

              {hasActiveLicense && session.apiKey ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-xs sm:text-sm text-cyan-300 overflow-x-auto select-all">
                    {showKeySecret ? session.apiKey : '••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                  <button
                    onClick={copyKeyToClipboard}
                    className="px-4 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey ? 'Imenakiliwa' : 'Nakili'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>
                    API Key yako haijaamilishwa. Unahitaji kulipia kifurushi cha API (50,000 Tsh/Mwezi au 1,000,000 Tsh/Mwaka) kupata ufikiaji.
                  </span>
                  <button
                    onClick={() => setShowPayModal(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 cursor-pointer shadow"
                  >
                    Lipia Sasa
                  </button>
                </div>
              )}

              {keySuccessMsg && (
                <p className="text-xs text-emerald-400 font-semibold">{keySuccessMsg}</p>
              )}
            </div>

            {/* Pricing / Plan Packages Card */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Vifurushi vya API & Ofa Maalum za NeliTv App</span>
                </h3>
                <span className="text-xs text-neutral-400">Lipia kwa Simu (M-Pesa / Tigo / Airtel)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Monthly Plan */}
                <div className="p-6 rounded-3xl bg-neutral-900 border border-cyan-800/40 hover:border-cyan-500 transition flex flex-col justify-between gap-5 relative overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-cyan-950 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-800">
                        Monthly Pass
                      </span>
                      <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                        + Miezi 3 Bure App VIP!
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white">Developer API Pro</h4>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black font-mono text-cyan-400">50,000</span>
                      <span className="text-xs text-neutral-400 font-bold">TZS / Mwezi</span>
                    </div>

                    <ul className="text-xs text-neutral-300 space-y-2 pt-2 border-t border-neutral-800">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Player API na NeliTv Web SDK</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Live Stream REST API ya Vituo 45+</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>Dynamic CDN DRM Token Decryption</span>
                      </li>
                      <li className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span><strong>Zawadi:</strong> Miezi 3 ya Bure ya VIP kwenye NeliTv App!</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlanId('plan_api_monthly');
                      setShowPayModal(true);
                    }}
                    className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
                  >
                    Lipia 50,000 TZS (Mwezi)
                  </button>
                </div>

                {/* 2. Yearly Enterprise Plan */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-neutral-900 via-[#120B20] to-[#0A1020] border-2 border-pink-500/60 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full bg-pink-950 text-pink-300 font-mono text-[11px] font-bold border border-pink-800">
                        Annual Enterprise
                      </span>
                      <span className="text-[11px] text-amber-300 font-bold bg-amber-950/80 border border-amber-600 px-2.5 py-0.5 rounded-full">
                        ★ Mwaka 1 Bure App VIP!
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white">Developer API Enterprise</h4>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black font-mono text-pink-400">1,000,000</span>
                      <span className="text-xs text-neutral-400 font-bold">TZS / Mwaka Mzima</span>
                    </div>

                    <ul className="text-xs text-neutral-300 space-y-2 pt-2 border-t border-neutral-800">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
                        <span>Ufikiaji wa Mwaka Mzima wa API & Streams</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
                        <span>Hakuna kikomo cha maombi ya API (Unlimited Requests)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-pink-400 shrink-0" />
                        <span>Support ya Kiufundi ya Moja kwa Moja 24/7</span>
                      </li>
                      <li className="flex items-center gap-2 text-amber-300 font-bold">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span><strong>Zawadi Kubwa:</strong> Mwaka 1 Mzima Bure wa VIP NeliTv App!</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPlanId('plan_api_yearly');
                      setShowPayModal(true);
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-pink-600/30 transition active:scale-95 cursor-pointer"
                  >
                    Lipia 1,000,000 TZS (Mwaka Mzima)
                  </button>
                </div>
              </div>
            </div>

            {/* 3. API Sandbox / Live Tester */}
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-cyan-400" />
                    <span>Jaribu API Yako Moja kwa Moja (Live Sandbox)</span>
                  </h3>
                  <p className="text-xs text-neutral-400">Pima muunganisho wa API Key yako kabla ya kuandika code.</p>
                </div>

                <button
                  onClick={handleTestSandbox}
                  disabled={isSandboxTesting || !session.apiKey}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSandboxTesting ? 'animate-spin' : ''}`} />
                  <span>{isSandboxTesting ? 'Inapima...' : 'Tuma Ombi la Jaribio'}</span>
                </button>
              </div>

              {sandboxResult && (
                <pre className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-cyan-300 overflow-x-auto max-h-72 leading-relaxed">
                  {JSON.stringify(sandboxResult, null, 2)}
                </pre>
              )}
            </div>

            {/* 4. API DOCUMENTATION & INTEGRATION GUIDE */}
            <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 space-y-6">
              <div>
                <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>Nyaraka za API (API Integration Documentation)</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Miongozo ya kuunganisha Player API na Stream API kwenye tovuti au mfumo wako.
                </p>
              </div>

              {/* Endpoint 1: Channels Stream API */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 font-mono text-xs font-black">
                    GET
                  </span>
                  <code className="text-xs font-mono text-white break-all">
                    /api/developer/channels
                  </code>
                </div>
                <p className="text-xs text-neutral-400">
                  Inaleta orodha kamili ya vituo vyote 45+ vya NeliTv vikiwa na Live Stream URLs zilizowekwa tokeni za kisasa za CDN token za DASH/HLS.
                </p>

                {/* Code Tabs */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-[11px] font-semibold">
                    <button
                      onClick={() => setActiveCodeTab('curl')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        activeCodeTab === 'curl' ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      onClick={() => setActiveCodeTab('js')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        activeCodeTab === 'js' ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      JavaScript / Node.js
                    </button>
                    <button
                      onClick={() => setActiveCodeTab('python')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        activeCodeTab === 'python' ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Python
                    </button>
                    <button
                      onClick={() => setActiveCodeTab('php')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        activeCodeTab === 'php' ? 'bg-cyan-600 text-white' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      PHP
                    </button>
                  </div>

                  <pre className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-200 overflow-x-auto leading-relaxed select-all">
                    {activeCodeTab === 'curl' && `curl -X GET "${origin}/api/developer/channels" \\
  -H "X-Neli-Api-Key: ${session.apiKey || 'YOUR_API_KEY'}"`}

                    {activeCodeTab === 'js' && `const response = await fetch("${origin}/api/developer/channels", {
  headers: {
    "X-Neli-Api-Key": "${session.apiKey || 'YOUR_API_KEY'}"
  }
});
const data = await response.json();
console.log(data.channels);`}

                    {activeCodeTab === 'python' && `import requests

headers = {
    "X-Neli-Api-Key": "${session.apiKey || 'YOUR_API_KEY'}"
}
response = requests.get("${origin}/api/developer/channels", headers=headers)
channels = response.json().get('channels', [])
print(channels)`}

                    {activeCodeTab === 'php' && `<?php
$ch = curl_init("${origin}/api/developer/channels");
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-Neli-Api-Key: ${session.apiKey || 'YOUR_API_KEY'}"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
$data = json_decode($response, true);
?>`}
                  </pre>
                </div>
              </div>

              {/* Endpoint 2: Web Player SDK */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-400 font-mono text-xs font-black">
                    SDK
                  </span>
                  <code className="text-xs font-mono text-white break-all">
                    NeliTv Web Player SDK (Kama YouTube Player)
                  </code>
                </div>
                <p className="text-xs text-neutral-400">
                  Weka kicheza video chetu chenye ulinzi wa DRM moja kwa moja kwenye kurasa za tovuti yako:
                </p>

                <pre className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-purple-300 overflow-x-auto select-all">
{`<!-- 1. Jumuisha Script ya SDK -->
<script src="${origin}/api/developer/player-sdk.js"></script>

<!-- 2. Sehemu ya Player itakapokaa -->
<div id="player-container"></div>

<!-- 3. Washa Player -->
<script>
  const player = new NeliTvPlayer('#player-container', {
    channel: 'azam-sports-1-hd',
    width: '100%',
    height: '480px',
    apiKey: '${session.apiKey || 'YOUR_API_KEY'}'
  });
</script>`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 5. PAYMENT MODAL FOR DEVELOPER API */}
        {showPayModal && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#0C101A] border border-cyan-500/40 rounded-3xl p-6 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <h3 className="text-base font-bold text-white">Lipia Kifurushi cha API</h3>
                </div>
                <button
                  onClick={() => setShowPayModal(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {/* Plan Choice in Modal */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlanId('plan_api_monthly')}
                  className={`p-3.5 rounded-2xl text-left border transition cursor-pointer ${
                    selectedPlanId === 'plan_api_monthly'
                      ? 'bg-gradient-to-b from-cyan-600/30 to-pink-600/20 border-cyan-400 shadow text-white'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold">Mwezi (Monthly)</div>
                  <div className="text-base font-black font-mono text-cyan-300 mt-1">50,000 TZS</div>
                  <div className="text-[10px] text-emerald-400 font-bold mt-1">+ Miezi 3 Bure App VIP!</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlanId('plan_api_yearly')}
                  className={`p-3.5 rounded-2xl text-left border transition cursor-pointer ${
                    selectedPlanId === 'plan_api_yearly'
                      ? 'bg-gradient-to-b from-pink-600/30 to-amber-600/20 border-pink-400 shadow text-white'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold">Mwaka (Annual)</div>
                  <div className="text-base font-black font-mono text-pink-300 mt-1">1,000,000 TZS</div>
                  <div className="text-[10px] text-amber-300 font-bold mt-1">★ Mwaka 1 Bure App VIP!</div>
                </button>
              </div>

              <form onSubmit={handleStartPayment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    <span>Namba ya Simu ya Malipo (M-Pesa / Tigo / Airtel / Halopesa):</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    placeholder="07XXXXXXXX au 06XXXXXXXX"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-sm font-mono"
                  />
                  <p className="text-[10px] text-neutral-400">
                    Namba hii itapokea USSD Push ya malipo, na pia ndiyo itakayopewa ufikiaji wa bure wa VIP kwenye NeliTv App!
                  </p>
                </div>

                {payError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs">
                    {payError}
                  </div>
                )}

                {paySuccessMsg && (
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800 text-cyan-300 text-xs flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>{paySuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPaying}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-black text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isPaying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Inasubiri PIN kwenye Simu yako...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>
                        Lipa TZS {selectedPlanId === 'plan_api_yearly' ? '1,000,000' : '50,000'} Sasa
                      </span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ulinzi thabiti wa malipo na uthibitishaji wa moja kwa moja kupitia HarakaPay</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiPortalPage;
