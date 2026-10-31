import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  User, Smartphone, Mail, Crown, LogOut, CheckCircle2,
  AlertTriangle, RefreshCw, Clock, ShieldCheck, Zap, Sparkles,
  BookOpen, FileText, Info, Shield, ChevronRight, ShieldAlert,
  Code2, Tv2
} from 'lucide-react';
import { fetchCustomerSubscriptionFromSupabase, normalizePhoneNumber, isSubscriptionActive } from '../lib/supabase.ts';
import { isFreeAccountEmail } from '../data/freeAccounts.ts';
import { DmcaPage } from './DmcaPage.tsx';
import { AboutPage } from './AboutPage.tsx';
import { TermsPage } from './TermsPage.tsx';
import { ContactPage } from './ContactPage.tsx';

interface AccountPageProps {
  onNavigateToPremium: () => void;
  onOpenLoginModal: () => void;
  onNavigateToPage?: (page: 'about' | 'dmca' | 'privacy' | 'terms' | 'contact' | 'api' | 'embed') => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  onNavigateToPremium,
  onOpenLoginModal,
  onNavigateToPage
}) => {
  const {
    user,
    phone,
    email,
    displayName,
    photoURL,
    isLoggedIn,
    hasActiveSubscription,
    trialRemainingSeconds,
    trialCompleted,
    logout,
    refreshProfile,
    linkPhoneToAccount
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'pages'>('profile');
  const [selectedSubpage, setSelectedSubpage] = useState<'about' | 'dmca' | 'privacy' | 'terms' | 'contact' | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Link Phone state (for users who logged in with Gmail/Email but paid with a phone)
  const [paymentPhoneInput, setPaymentPhoneInput] = useState<string>('');
  const [isLinkingPhone, setIsLinkingPhone] = useState<boolean>(false);
  const [linkPhoneSuccessMsg, setLinkPhoneSuccessMsg] = useState<string | null>(null);
  const [linkPhoneErrorMsg, setLinkPhoneErrorMsg] = useState<string | null>(null);

  const handleLinkPaymentPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPhoneInput.trim()) return;
    setIsLinkingPhone(true);
    setLinkPhoneSuccessMsg(null);
    setLinkPhoneErrorMsg(null);
    try {
      const res = await linkPhoneToAccount(paymentPhoneInput);
      if (res.success) {
        setLinkPhoneSuccessMsg(res.message || '✓ Namba ya simu imeunganishwa na kifurushi kimesawazishwa!');
        setPaymentPhoneInput('');
        setTimeout(() => setLinkPhoneSuccessMsg(null), 5000);
      } else {
        setLinkPhoneErrorMsg(res.error || 'Imeshindikana kuunganisha namba.');
      }
    } catch {
      setLinkPhoneErrorMsg('Hitilafu ya mtandao wakati wa kuunganisha.');
    } finally {
      setIsLinkingPhone(false);
    }
  };

  // 1-second real-time countdown ticker for Days, Hours, Minutes, Seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh subscription once on mount (prevents infinite re-render loop!)
  useEffect(() => {
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFreeVip = isFreeAccountEmail(user?.email);

  // Calculate live countdown breakdown
  const expiryTimestamp = user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() : 0;
  const timeDifferenceMs = Math.max(0, expiryTimestamp - now);
  const isSubscriptionExpired = !isFreeVip && expiryTimestamp > 0 && timeDifferenceMs <= 0;

  const daysLeft = Math.floor(timeDifferenceMs / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeDifferenceMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeDifferenceMs % (1000 * 60 * 60)) / (1000 * 60));
  const secondsLeft = Math.floor((timeDifferenceMs % (1000 * 60)) / 1000);

  // Manual direct sync with Supabase and server
  const handleDirectSyncWithSupabase = async () => {
    if (isFreeVip) {
      setSyncStatusMessage('✓ Akaunti yako ni Free VIP Lifetime - haina kikomo!');
      setTimeout(() => setSyncStatusMessage(null), 3000);
      return;
    }
    setIsSyncing(true);
    setSyncStatusMessage('Inatafuta rekodi kutoka Supabase na HarakaPay...');
    try {
      const targetPhone = phone || user?.phone;
      const targetEmail = email || user?.email;
      let foundActive = false;

      if (targetPhone) {
        const cleanPhone = normalizePhoneNumber(targetPhone);
        const sub = await fetchCustomerSubscriptionFromSupabase(cleanPhone);
        if (sub && isSubscriptionActive(sub)) {
          foundActive = true;
        }
      }
      if (!foundActive && targetEmail) {
        const sub = await fetchCustomerSubscriptionFromSupabase(targetEmail);
        if (sub && isSubscriptionActive(sub)) {
          foundActive = true;
        }
      }

      await refreshProfile();
      if (foundActive) {
        setSyncStatusMessage('✓ Kifurushi hai kimepatikana na kusawazishwa!');
      } else {
        setSyncStatusMessage('✓ Usawazishaji umekamilika.');
      }
      setTimeout(() => setSyncStatusMessage(null), 4000);
    } catch (err: any) {
      console.warn('Sync notice:', err);
      setSyncStatusMessage('✓ Usawazishaji umekamilika.');
      setTimeout(() => setSyncStatusMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen pb-32 sm:pb-20 bg-[#070A0F] text-neutral-100 touch-pan-y">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Akaunti Yangu
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono font-bold">
                NeliTv
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Simamia kifurushi chako, angalia muda uliobaki na historia ya malipo
            </p>
          </div>

          {isLoggedIn ? (
            <button
              onClick={logout}
              className="py-2 px-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-pink-500/40 text-neutral-300 hover:text-pink-400 text-xs font-semibold flex items-center gap-2 transition self-start sm:self-auto cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Ondoka kwenye Akaunti</span>
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-pink-600/25 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Ingia au Jisajili</span>
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-gradient-to-r from-pink-600 to-cyan-600 text-white font-bold shadow-md shadow-pink-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Taarifa za Kifurushi & Countdown</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('payments');
              setSelectedSubpage(null);
            }}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'payments' && !selectedSubpage
                ? 'bg-gradient-to-r from-pink-600 to-cyan-600 text-white font-bold shadow-md shadow-pink-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Historia ya Malipo</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('pages');
              setSelectedSubpage(null);
            }}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pages' && !selectedSubpage
                ? 'bg-gradient-to-r from-pink-600 to-cyan-600 text-white font-bold shadow-md shadow-pink-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Kurasa za Tovuti & DMCA</span>
          </button>
        </div>

        {/* SUBPAGE VIEWER (Lightweight, instant, blogger-style) */}
        {selectedSubpage === 'dmca' && (
          <DmcaPage onBack={() => setSelectedSubpage(null)} />
        )}
        {selectedSubpage === 'about' && (
          <AboutPage onBack={() => setSelectedSubpage(null)} />
        )}
        {selectedSubpage === 'terms' && (
          <TermsPage onBack={() => setSelectedSubpage(null)} />
        )}
        {selectedSubpage === 'contact' && (
          <ContactPage onBack={() => setSelectedSubpage(null)} />
        )}

        {/* TAB 1: PROFILE & LIVE COUNTDOWN */}
        {!selectedSubpage && activeTab === 'profile' && (
          <div className="space-y-6">
            {/* User Profile Card */}
            <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      className="w-14 h-14 rounded-2xl object-cover border border-neutral-700 shadow"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-cyan-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-black text-2xl">
                      {displayName.charAt(0).toUpperCase() || <User className="w-7 h-7" />}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>{displayName}</span>
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 mt-1">
                      {phone && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-cyan-300">
                          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{phone}</span>
                        </span>
                      )}
                      {email && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-pink-300">
                          <Mail className="w-3.5 h-3.5 text-pink-400" />
                          <span>{email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {hasActiveSubscription && !isSubscriptionExpired ? (
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Kifurushi Kipo Hai</span>
                    </span>
                  ) : (
                    <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>{isSubscriptionExpired ? 'Kimeisha Muda Wake' : 'Hakuna Kifurushi Hai'}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* REAL-TIME SUBSCRIPTION COUNTDOWN TICKER (Siku, Masaa, Dakika, Sekunde) */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-cyan-500/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 animate-spin-slow" />
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Muda Uliobaki wa Kifurushi (Live Countdown):
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-cyan-400">
                    {user?.subscriptionPlan || 'Kifurushi cha NeliTv'}
                  </span>
                </div>

                {isFreeVip ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-pink-500/15 to-cyan-500/15 border border-amber-500/30 text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <span>Uanachama wa Kudumu wa Bure (VIP Lifetime)</span>
                    </div>
                    <p className="text-xs text-neutral-300">
                      Akaunti yako imeunganishwa na <strong className="text-white">VIP Lifetime Pass</strong>. Una uwezo wa kutazama mechi na vituo vyote vya NeliTv moja kwa moja bila kikomo chochote cha muda.
                    </p>
                  </div>
                ) : hasActiveSubscription && !isSubscriptionExpired ? (
                  <div>
                    {/* 4 Neon Countdown Cards */}
                    <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
                      {/* Siku */}
                      <div className="p-3 rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 shadow-md">
                        <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
                          {String(daysLeft).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                          Siku
                        </div>
                      </div>

                      {/* Masaa */}
                      <div className="p-3 rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 shadow-md">
                        <div className="text-2xl sm:text-3xl font-black font-mono text-pink-400">
                          {String(hoursLeft).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                          Masaa
                        </div>
                      </div>

                      {/* Dakika */}
                      <div className="p-3 rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 shadow-md">
                        <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                          {String(minutesLeft).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                          Dakika
                        </div>
                      </div>

                      {/* Sekunde (Live ticking) */}
                      <div className="p-3 rounded-xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-pink-500/30 shadow-md shadow-pink-500/10">
                        <div className="text-2xl sm:text-3xl font-black font-mono text-white animate-pulse">
                          {String(secondsLeft).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] sm:text-xs text-pink-400 font-bold uppercase tracking-wider mt-0.5">
                          Sekunde
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-neutral-400 font-mono mt-2">
                      Muda utaisha: {new Date(user!.subscriptionExpiresAt!).toLocaleString('sw-TZ')}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 text-center space-y-2">
                    <p className="text-xs text-neutral-300">
                      {isSubscriptionExpired
                        ? 'Kifurushi chako kimemalizika muda wake. Lipia kifurushi kipya ili uendelee kutazama chaneli zote bila kikomo.'
                        : 'Bado hujaanza kifurushi rasmi au unatumia dakika 1 ya majaribio ya bure.'}
                    </p>
                    {!hasActiveSubscription && (
                      <div className="text-xs font-mono text-cyan-400">
                        {trialCompleted
                          ? 'Majaribio ya bure: Yamekwisha (Sekunde 0)'
                          : `Majaribio ya bure: ${trialRemainingSeconds} sekunde zimebaki`}
                      </div>
                    )}
                  </div>
                )}

                {/* Primary CTA button */}
                <button
                  onClick={onNavigateToPremium}
                  className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-pink-600 to-cyan-500 hover:from-amber-400 hover:via-pink-500 hover:to-cyan-400 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-pink-600/30 transition active:scale-95 cursor-pointer"
                >
                  <Crown className="w-4 h-4 text-amber-300" />
                  <span>
                    {hasActiveSubscription && !isSubscriptionExpired
                      ? 'Ongeza / Sasisha Kifurushi Chako'
                      : 'Nunua Kifurushi Sasa (Kuanzia TZS 1,000)'}
                  </span>
                </button>
              </div>

              {/* UNGANISHA NAMBA YA SIMU ULIYOLIPIA (Cross-Account Linking for Google / Email or Changing Phone) */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-cyan-500/30 space-y-3.5 shadow-md">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span>Unganisha Namba ya Simu Uliyolipia</span>
                      <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Umeingia kwa Gmail au Email lakini ulilipia kwa namba ya simu (M-Pesa, Tigo, Airtel, Halopesa)? Weka namba hiyo hapa chini kuunganisha kifurushi chako mara moja.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleLinkPaymentPhone} className="flex flex-col sm:flex-row gap-2 pt-1">
                  <div className="relative flex-1">
                    <Smartphone className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={paymentPhoneInput}
                      onChange={(e) => setPaymentPhoneInput(e.target.value)}
                      placeholder={phone ? `Namba ya sasa: ${phone} (Weka namba uliyolipia)` : "Weka namba ya simu uliyolipia (mfano: 07XXXXXXXX)"}
                      className="w-full pl-9 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLinkingPhone || !paymentPhoneInput.trim()}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-cyan-600 to-pink-600 hover:from-cyan-500 hover:to-pink-500 text-white text-xs font-bold shrink-0 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    {isLinkingPhone ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Unganisha Namba</span>
                      </>
                    )}
                  </button>
                </form>

                {linkPhoneSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{linkPhoneSuccessMsg}</span>
                  </div>
                )}

                {linkPhoneErrorMsg && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{linkPhoneErrorMsg}</span>
                  </div>
                )}
              </div>

              {/* Supabase & HarakaPay Instant Sync Tool */}
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Sawazisha na Supabase (Sync Live)</span>
                      <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Umelipa sasa hivi? Bofya hapa kusawazisha akaunti yako papo hapo.
                    </p>
                    {syncStatusMessage && (
                      <p className="text-xs text-cyan-300 font-semibold mt-1 animate-fade-in">
                        {syncStatusMessage}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  disabled={isSyncing}
                  onClick={handleDirectSyncWithSupabase}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-pink-600 hover:from-cyan-500 hover:to-pink-500 text-white text-xs font-bold shrink-0 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {isSyncing ? 'Inasawazisha...' : 'Sawazisha Sasa'}
                </button>
              </div>

              {/* Quick Links to Legal & Information Pages */}
              <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Kurasa za Tovuti & Kisheria (Pages)
                    </h4>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono">Blogger View</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedSubpage('dmca')}
                    className="p-3 rounded-xl bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800/80 text-left transition active:scale-95 cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-pink-400 group-hover:text-pink-300 flex items-center justify-between">
                      <span>DMCA Policy</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5 truncate">Hakimiliki & Takedown</p>
                  </button>

                  <button
                    onClick={() => setSelectedSubpage('about')}
                    className="p-3 rounded-xl bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800/80 text-left transition active:scale-95 cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-cyan-400 group-hover:text-cyan-300 flex items-center justify-between">
                      <span>About Us</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5 truncate">Kuhusu NeliTv</p>
                  </button>

                  <button
                    onClick={() => {
                      if (onNavigateToPage) onNavigateToPage('privacy');
                      else setSelectedSubpage('terms');
                    }}
                    className="p-3 rounded-xl bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800/80 text-left transition active:scale-95 cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-emerald-400 group-hover:text-emerald-300 flex items-center justify-between">
                      <span>Privacy Policy</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5 truncate">Sera ya Faragha & Ads</p>
                  </button>

                  <button
                    onClick={() => setSelectedSubpage('contact')}
                    className="p-3 rounded-xl bg-neutral-950 hover:bg-neutral-800/80 border border-neutral-800/80 text-left transition active:scale-95 cursor-pointer group"
                  >
                    <div className="text-[11px] font-bold text-amber-400 group-hover:text-amber-300 flex items-center justify-between">
                      <span>Contact Us</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5 truncate">Wasiliana Nasi 24/7</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENTS HISTORY */}
        {!selectedSubpage && activeTab === 'payments' && (
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Miamala ya Malipo</h3>
                <p className="text-xs text-neutral-400">Historia ya malipo kutoka Supabase na HarakaPay</p>
              </div>
              <button
                onClick={handleDirectSyncWithSupabase}
                className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
                title="Sawazisha Upya"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {(!user?.payments || user.payments.length === 0) ? (
              <div className="text-center py-12 text-neutral-500 text-xs sm:text-sm">
                Hakuna muamala uliorekodiwa hapa bado. Ukilipia kifurushi utaona rekodi yake hapa.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400 uppercase font-mono">
                      <th className="py-2.5 px-3">Kifurushi</th>
                      <th className="py-2.5 px-3">Kiasi</th>
                      <th className="py-2.5 px-3">Hali</th>
                      <th className="py-2.5 px-3">Tarehe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/80">
                    {user.payments.map((p, idx) => (
                      <tr key={idx} className="hover:bg-neutral-950/40 transition">
                        <td className="py-3 px-3 text-white font-medium">{p.planName}</td>
                        <td className="py-3 px-3 font-mono text-cyan-400 font-bold">
                          TZS {p.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            p.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {p.status === 'completed' ? 'Imekamilika' : 'Inasubiri'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-neutral-400 font-mono">
                          {new Date(p.createdAt).toLocaleDateString('sw-TZ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PAGES & LEGAL (Lightweight, Blogger-style) */}
        {!selectedSubpage && activeTab === 'pages' && (
          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 space-y-2">
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <span>Kurasa Rasmi na Sera za NeliTv</span>
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Kurasa zote zimebuniwa kuwa nyepesi, safi na zenye ufikiaji wa haraka bila kuchelewa, kufuata viwango vya Google AdSense na sheria za kidijitali.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. DMCA Card */}
              <div className="p-5 rounded-2xl bg-neutral-900 border border-pink-900/30 hover:border-pink-500/50 transition flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                      <ShieldAlert className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-800/40">
                      Hakimiliki
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">DMCA & Hakimiliki (Copyright)</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Digital Millennium Copyright Act Takedown Policy, anwani ya Copyright Agent na taratibu za kulinda haki miliki za maudhui.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubpage('dmca')}
                  className="w-full py-2.5 px-4 rounded-xl bg-pink-600/20 hover:bg-pink-600 text-pink-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <span>Fungua Ukurasa wa DMCA</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 2. About Us Card */}
              <div className="p-5 rounded-2xl bg-neutral-900 border border-cyan-900/30 hover:border-cyan-500/50 transition flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                      <Info className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                      Kuhusu Sisi
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Kuhusu NeliTv (About Us)</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Dhamira yetu, teknolojia ya kisasa ya video ya HLS/DASH, utangazaji wa ligi kuu ya NBC, na maono ya burudani Tanzania.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubpage('about')}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <span>Fungua Kuhusu NeliTv</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 3. Privacy Policy Card */}
              <div className="p-5 rounded-2xl bg-neutral-900 border border-emerald-900/30 hover:border-emerald-500/50 transition flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Shield className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                      Google AdSense
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Sera ya Faragha (Privacy Policy)</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Ulinzi wa data za kibinafsi, maelezo ya vidakuzi (Cookies & DART) kwa matangazo ya Google AdSense, na haki za mtumiaji.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (onNavigateToPage) onNavigateToPage('privacy');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <span>Fungua Sera ya Faragha</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 4. Terms of Service Card */}
              <div className="p-5 rounded-2xl bg-neutral-900 border border-amber-900/30 hover:border-amber-500/50 transition flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <FileText className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/40">
                      Sheria & Vigezo
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Masharti ya Huduma (Terms)</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Kanuni za matumizi, taratibu za vifurushi na malipo kupitia mitandao ya simu za mkononi, na haki za mtumiaji.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubpage('terms')}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <span>Fungua Masharti ya Huduma</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 5. Contact Us Card */}
              <div className="p-5 rounded-2xl bg-neutral-900 border border-blue-900/30 hover:border-blue-500/50 transition flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                      <Mail className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/40">
                      Msaada 24/7
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Wasiliana Nasi (Contact & Support)</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Una tatizo la kifurushi, swali au pendekezo? Tuma ujumbe sasa hivi au barua pepe kwa alexbaineth@gmail.com.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubpage('contact')}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Wasiliana na Msaada</span>
                </button>
              </div>

              {/* 6. Developer API Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-cyan-950/40 border border-cyan-800/40 hover:border-cyan-400/60 transition flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                      <Code2 className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-bold">
                      Kwa Watengenezaji
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>API ya Watengenezaji (Developer Portal)</span>
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Pata API Keys, Stream API tokens na Player API kuunganisha chaneli zetu kwenye programu au tovuti yako. Malipo ya API huja na miezi ya bure ya VIP kwenye NeliTv!
                  </p>
                </div>
                <button
                  onClick={() => onNavigateToPage && onNavigateToPage('api')}
                  className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Fungua API Portal (/api)</span>
                </button>
              </div>

              {/* 7. Embed Player Studio Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-pink-950/40 border border-pink-800/40 hover:border-pink-400/60 transition flex flex-col justify-between gap-4 md:col-span-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
                      <Tv2 className="w-5 h-5" />
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-800/40 font-bold">
                      Embed Studio
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">Embed Studio (/embed)</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Chagua chaneli yoyote na nakili msimbo wa &lt;iframe&gt; au JavaScript SDK ili kuweka player kwenye tovuti au blogu yako. Mtazamaji akitazama kwa dakika 1 atapewa fursa ya kulipia kifurushi moja kwa moja ndani ya player.
                  </p>
                </div>
                <button
                  onClick={() => onNavigateToPage && onNavigateToPage('embed')}
                  className="w-full sm:w-auto self-start py-2.5 px-6 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-pink-500/20"
                >
                  <Tv2 className="w-3.5 h-3.5" />
                  <span>Fungua Embed Studio (/embed)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
