import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  User, Smartphone, Mail, Crown, Trash2, LogOut, CheckCircle2,
  AlertTriangle, RefreshCw
} from 'lucide-react';

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
  const [cacheCleared, setCacheCleared] = useState<boolean>(false);

  const handleClearCache = () => {
    try {
      localStorage.removeItem('nelitv_user_profile');
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 2500);
      refreshProfile();
    } catch (e) {
      console.error(e);
    }
  };

  const calculateRemainingTime = (expiryString?: string) => {
    if (!expiryString) return 'Hakuna kifurushi hai';
    const diff = new Date(expiryString).getTime() - Date.now();
    if (diff <= 0) return 'Kimekwisha muda wake';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days} siku, ${hours} masaa, ${mins} dakika zimebaki`;
  };

  return (
    <div className="min-h-screen pb-16 bg-[#080808] text-neutral-100 select-none">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Akaunti Yangu - NeliTv
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400">
              Simamia maelezo ya akaunti na vifurushi vya kutazama
            </p>
          </div>

          {isLoggedIn ? (
            <button
              onClick={logout}
              className="py-2 px-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-red-500/40 text-neutral-300 hover:text-red-500 text-xs font-semibold flex items-center gap-2 transition self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Ondoka kwenye Akaunti</span>
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 transition"
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
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-red-600 text-white font-bold shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Taarifa za Kifurushi</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${
              activeTab === 'payments'
                ? 'bg-red-600 text-white font-bold shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Crown className="w-4 h-4" />
            <span>Historia ya Malipo</span>
          </button>
        </div>

        {/* TAB 1: PROFILE & SUBSCRIPTION */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      className="w-12 h-12 rounded-2xl object-cover border border-neutral-700 shadow"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 font-black text-xl">
                      {displayName.charAt(0).toUpperCase() || <User className="w-6 h-6" />}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      {displayName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-0.5">
                      {email && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-neutral-300">
                          <Mail className="w-3 h-3 text-red-400" />
                          <span>{email}</span>
                        </span>
                      )}
                      {phone && (
                        <span className="flex items-center gap-1 font-mono text-[11px] text-neutral-300">
                          <Smartphone className="w-3 h-3 text-red-400" />
                          <span>{phone}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {hasActiveSubscription ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Kifurushi Kipo Hai</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Hakuna Kifurushi Hai</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Subscription details */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Kifurushi cha Sasa:</span>
                  <span className="font-bold text-white">
                    {user?.subscriptionPlan || (hasActiveSubscription ? 'Kifurushi Hai (Supabase)' : 'Majaribio ya Sekunde 60')}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Muda Uliobaki:</span>
                  <span className="font-semibold text-red-500 font-mono">
                    {calculateRemainingTime(user?.subscriptionExpiresAt)}
                  </span>
                </div>

                {!hasActiveSubscription && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Majaribio ya Bure ya Dakika 1:</span>
                    <span className="font-mono text-neutral-300">
                      {trialCompleted ? 'Yamekwisha (Sekunde 0)' : `${trialRemainingSeconds} sekunde zimebaki`}
                    </span>
                  </div>
                )}
              </div>

              {!hasActiveSubscription && (
                <button
                  onClick={onNavigateToPremium}
                  className="w-full py-3 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition active:scale-95"
                >
                  <Crown className="w-4 h-4" />
                  <span>Lipia Kifurushi Kipya (Kuanzia TZS 1,000)</span>
                </button>
              )}
            </div>

            {/* Cache & Sync Control */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Rejesha Hali ya Malipo</h4>
                  <p className="text-[11px] text-neutral-400">
                    Kagua taarifa zako mpya kutoka Supabase na server.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  refreshProfile();
                  handleClearCache();
                }}
                className="py-2 px-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold shrink-0 transition"
              >
                {cacheCleared ? 'Imesasishwa ✓' : 'Kagua Upya'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENTS HISTORY */}
        {activeTab === 'payments' && (
          <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Miamala ya Malipo</h3>
                <p className="text-xs text-neutral-400">Historia ya malipo yaliyofanyika kwenye akaunti hii</p>
              </div>
              <button
                onClick={refreshProfile}
                className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
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
                        <td className="py-3 px-3 font-mono text-red-500 font-bold">
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
