import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  User, Smartphone, Mail, Crown, LogOut, CheckCircle2,
  AlertTriangle, RefreshCw, Clock, ShieldCheck, Zap, Sparkles,
  BookOpen, FileText, Info, Shield, ChevronRight, ShieldAlert,
  Receipt, CheckCircle, XCircle
} from 'lucide-react';
import { fetchCustomerSubscriptionFromSupabase, normalizePhoneNumber, isSubscriptionActive } from '../lib/supabase.ts';
import { isFreeAccountEmail } from '../data/freeAccounts.ts';
import { DmcaPage } from './DmcaPage.tsx';
import { AboutPage } from './AboutPage.tsx';
import { TermsPage } from './TermsPage.tsx';
import { ContactPage } from './ContactPage.tsx';
import { AdBanner } from '../components/AdBanner';

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
    refreshPaymentHistory,
    linkPhoneToAccount
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'pages'>('profile');
  const [selectedSubpage, setSelectedSubpage] = useState<'about' | 'dmca' | 'privacy' | 'terms' | 'contact' | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
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

  // Auto-fetch payments history when payments tab is activated
  useEffect(() => {
    if (activeTab === 'payments') {
      setIsLoadingPayments(true);
      refreshPaymentHistory()
        .catch((err) => console.warn('Payment history refresh error:', err))
        .finally(() => setIsLoadingPayments(false));
    }
  }, [activeTab, refreshPaymentHistory]);

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

      await Promise.allSettled([
        refreshProfile(),
        refreshPaymentHistory()
      ]);

      if (foundActive) {
        setSyncStatusMessage('✓ Kifurushi na historia ya malipo vimesawazishwa!');
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

        {/* In-page Automatic Ad Unit */}
        <AdBanner className="my-2" />

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
                  <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>100% Bure Milele</span>
                  </span>
                </div>
              </div>

              {/* FREE FOREVER ANNOUNCEMENT & BADGE */}
              <div className="p-5 rounded-2xl bg-neutral-950 border border-emerald-500/30 space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-blue-500/15 border border-emerald-500/40 text-center space-y-2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Uanachama wa Kudumu wa Bure (Free Forever)</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Hakuna Malipo Yanayohitajika!
                  </h3>
                  <p className="text-xs text-neutral-300 leading-relaxed max-w-lg mx-auto">
                    Programu ya NeliTv sasa inapatikana <strong className="text-emerald-400">bure kabisa bila malipo</strong>. Unaweza kutazama chaneli zote za Azam Sports, ligi kuu, sinema na vibonzo vya watoto bila kikomo chochote cha muda wala vikwazo vya malipo.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                    <div className="text-sm font-black text-emerald-400">Bila Malipo</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Chaneli zote 100% Bure</div>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                    <div className="text-sm font-black text-cyan-400">Bila Kikomo</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Muda usio na ukomo</div>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                    <div className="text-sm font-black text-pink-400">Kuingia Si Lazima</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Tazama moja kwa moja</div>
                  </div>
                </div>
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
          <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Miamala ya Malipo
                    {user?.payments && user.payments.length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                        {user.payments.length}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-neutral-400">Historia ya miamala yako kutoka Supabase na HarakaPay</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setIsLoadingPayments(true);
                  try {
                    await refreshPaymentHistory();
                  } finally {
                    setIsLoadingPayments(false);
                  }
                }}
                disabled={isLoadingPayments}
                className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-neutral-800/90 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/60 text-xs font-semibold flex items-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                title="Sawazisha Miamala"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingPayments ? 'animate-spin' : ''}`} />
                <span>{isLoadingPayments ? 'Inapakia...' : 'Sasisha Miamala'}</span>
              </button>
            </div>

            {isLoadingPayments && (!user?.payments || user.payments.length === 0) ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
                <p className="text-xs text-neutral-400">Inatafuta miamala yako kutoka kwenye hifadhidata...</p>
              </div>
            ) : (!user?.payments || user.payments.length === 0) ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/60 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <Receipt className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <p className="text-sm font-semibold text-neutral-300">Hakuna muamala uliopatikana bado</p>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Ukilipia kifurushi chochote kupitia Lipa Na M-Pesa, TigoPesa, Airtel Money au HaloPesa, rekodi ya muamala wako itatokea hapa papo hapo.
                  </p>
                </div>
                {!hasActiveSubscription && (
                  <button
                    onClick={onNavigateToPremium}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold transition shadow-lg shadow-pink-500/20 active:scale-95 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Nunua Kifurushi Sasa</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto rounded-2xl border border-neutral-800/80 bg-neutral-950/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 uppercase font-mono text-[10px]">
                        <th className="py-3 px-4">Kifurushi</th>
                        <th className="py-3 px-4">Kiasi</th>
                        <th className="py-3 px-4">Namba ya Muamala (Order ID)</th>
                        <th className="py-3 px-4">Hali</th>
                        <th className="py-3 px-4 text-right">Tarehe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {user.payments.map((p, idx) => (
                        <tr key={idx} className="hover:bg-neutral-900/60 transition">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-cyan-400" />
                              <span>{p.planName || 'Kifurushi cha NeliTv'}</span>
                            </div>
                            {p.durationDays > 0 && (
                              <span className="text-[10px] text-neutral-400 pl-4 block">
                                Muda: siku {p.durationDays}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-cyan-300 font-bold">
                            TZS {Number(p.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-neutral-300">
                            <span className="bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                              {p.orderId || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              p.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : p.status === 'pending'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}>
                              {p.status === 'completed' ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Imekamilika</span>
                                </>
                              ) : p.status === 'pending' ? (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Inasubiri</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  <span>Imeshindikana</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-400 font-mono text-right text-[11px]">
                            {p.createdAt ? new Date(p.createdAt).toLocaleString('sw-TZ', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Hivi karibuni'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="sm:hidden space-y-2.5">
                  {user.payments.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/90 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white text-xs">
                            {p.planName || 'Kifurushi cha NeliTv'}
                          </div>
                          {p.durationDays > 0 && (
                            <div className="text-[10px] text-neutral-400">
                              Muda: siku {p.durationDays}
                            </div>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : p.status === 'pending'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}>
                          {p.status === 'completed' ? 'Imekamilika' : p.status === 'pending' ? 'Inasubiri' : 'Imeshindikana'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-800/60 font-mono">
                        <span className="text-neutral-400 text-[11px]">Kiasi:</span>
                        <span className="text-cyan-300 font-bold text-sm">
                          TZS {Number(p.amount || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                        <span>Order ID:</span>
                        <span className="text-neutral-200 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800 text-[10px]">
                          {p.orderId || 'N/A'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono pt-1">
                        <span>Tarehe:</span>
                        <span>
                          {p.createdAt ? new Date(p.createdAt).toLocaleString('sw-TZ', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Hivi karibuni'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Helpful phone link footer if user is using email without phone */}
                {!phone && (
                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 flex items-start gap-3 text-xs text-neutral-300">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-white font-medium">Ulipia kwa kutumia namba ya simu? </span>
                      Unganisha namba yako kwenye kichupo cha <button onClick={() => setActiveTab('profile')} className="text-cyan-400 underline font-semibold hover:text-cyan-300 cursor-pointer">Akaunti Yangu</button> ili miamala na vifurushi vyako vyote visawazishwe hapa moja kwa moja.
                    </div>
                  </div>
                )}
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
              <div className="p-5 rounded-2xl bg-neutral-900 border border-blue-900/30 hover:border-blue-500/50 transition flex flex-col justify-between gap-4 md:col-span-2">
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
                    Una tatizo la kifurushi, swali au pendekezo? Tuma ujumbe sasa hivi au barua pepe kwa <span className="text-cyan-400 font-semibold">support@nelitv.online</span> (Makao Makuu: Mombasa, Kenya · Inafanya kazi Tanzania pekee).
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubpage('contact')}
                  className="w-full sm:w-auto self-start py-2.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Wasiliana na Msaada wa Wateja</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom In-page Automatic Ad Unit */}
        <div className="pt-2">
          <AdBanner className="my-2" />
        </div>
      </div>
    </div>
  );
};
