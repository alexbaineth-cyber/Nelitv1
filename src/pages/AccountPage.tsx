import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  User, Smartphone, Mail, Crown, LogOut, CheckCircle2,
  AlertTriangle, RefreshCw, Clock, ShieldCheck, Zap
} from 'lucide-react';
import { fetchCustomerSubscriptionFromSupabase, normalizePhoneNumber, isSubscriptionActive } from '../lib/supabase.ts';

interface AccountPageProps {
  onNavigateToPremium: () => void;
  onOpenLoginModal: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  onNavigateToPremium,
  onOpenLoginModal
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
    refreshProfile
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'payments'>('profile');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // 1-second real-time countdown ticker for Days, Hours, Minutes, Seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh subscription from Supabase on mount
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Calculate live countdown breakdown
  const expiryTimestamp = user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() : 0;
  const timeDifferenceMs = Math.max(0, expiryTimestamp - now);
  const isSubscriptionExpired = expiryTimestamp > 0 && timeDifferenceMs <= 0;

  const daysLeft = Math.floor(timeDifferenceMs / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeDifferenceMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeDifferenceMs % (1000 * 60 * 60)) / (1000 * 60));
  const secondsLeft = Math.floor((timeDifferenceMs % (1000 * 60)) / 1000);

  // Manual direct sync with Supabase and server
  const handleDirectSyncWithSupabase = async () => {
    setIsSyncing(true);
    setSyncStatusMessage('Inatafuta rekodi kutoka Supabase na HarakaPay...');
    try {
      const targetPhone = phone || user?.phone;
      if (targetPhone) {
        const cleanPhone = normalizePhoneNumber(targetPhone);
        const sub = await fetchCustomerSubscriptionFromSupabase(cleanPhone);
        if (sub && isSubscriptionActive(sub)) {
          setSyncStatusMessage('✓ Kifurushi hai kimepatikana na kusawazishwa kutoka Supabase!');
        } else {
          setSyncStatusMessage('✓ Taarifa za akaunti zimesawazishwa kutoka Supabase na server.');
        }
      }
      await refreshProfile();
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
    <div className="min-h-screen pb-20 bg-[#070A0F] text-neutral-100 select-none">
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
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'payments'
                ? 'bg-gradient-to-r from-pink-600 to-cyan-600 text-white font-bold shadow-md shadow-pink-600/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Historia ya Malipo</span>
          </button>
        </div>

        {/* TAB 1: PROFILE & LIVE COUNTDOWN */}
        {activeTab === 'profile' && (
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

                {hasActiveSubscription && !isSubscriptionExpired ? (
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
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENTS HISTORY */}
        {activeTab === 'payments' && (
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
      </div>
    </div>
  );
};
