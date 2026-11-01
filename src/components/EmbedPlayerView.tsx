import React, { useState, useEffect } from 'react';
import { Channel } from '../data/channels.ts';
import { VideoPlayer } from './VideoPlayer.tsx';
import { Lock, Smartphone, RefreshCw, CheckCircle2, Zap } from 'lucide-react';

interface EmbedPlayerViewProps {
  channel: Channel;
}

const EMBED_PLANS = [
  { id: 'plan_2days', name: 'Siku 2', priceTsh: 1000 },
  { id: 'plan_7days', name: 'Wiki 1', priceTsh: 3000 },
  { id: 'plan_30days', name: 'Mwezi 1', priceTsh: 10000 }
];

export const EmbedPlayerView: React.FC<EmbedPlayerViewProps> = ({ channel }) => {
  // Check if this viewer already has an active unlock token on this browser
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      const savedCh = localStorage.getItem(`nelitv_embed_unlocked_${channel.id}`);
      const savedGlobal = localStorage.getItem('nelitv_embed_global_unlocked');
      const now = Date.now();
      if (savedCh && Number(savedCh) > now) return true;
      if (savedGlobal && Number(savedGlobal) > now) return true;
    } catch {}
    return false;
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_2days');
  const [phone, setPhone] = useState<string>(() => {
    try {
      return localStorage.getItem('nelitv_user_phone') || localStorage.getItem('nelitv_phone') || '';
    } catch {
      return '';
    }
  });
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [showVerifyOnly, setShowVerifyOnly] = useState<boolean>(false);

  const unlockPlayback = (days: number = 30) => {
    const expiry = Date.now() + days * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(`nelitv_embed_unlocked_${channel.id}`, String(expiry));
      localStorage.setItem('nelitv_embed_global_unlocked', String(expiry));
    } catch {}
    setIsUnlocked(true);
    setShowPaywall(false);
    setIsPaying(false);
  };

  // Auto-read user data on browser entry & verify existing active subscription silently
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem('nelitv_user_phone') || localStorage.getItem('nelitv_phone');
      if (savedPhone && savedPhone.trim().length >= 9) {
        setPhone(savedPhone);
        fetch(`/api/subscription/check?phone=${encodeURIComponent(savedPhone.trim())}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.active) {
              unlockPlayback(30);
            }
          })
          .catch(() => {});
      }
    } catch {}
  }, [channel.id]);

  // 60-second trial countdown timer
  useEffect(() => {
    if (isUnlocked) return;

    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowPaywall(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isUnlocked]);

  // Status check for order polling
  const checkOrderStatus = async (orderIdToCheck: string) => {
    try {
      const res = await fetch(`/api/harakapay/status/${orderIdToCheck}`);
      const data = await res.json();
      if (data.success && data.status === 'completed') {
        unlockPlayback(30);
        return true;
      }
    } catch {}
    return false;
  };

  // Poll HarakaPay status when orderId is active
  useEffect(() => {
    if (!activeOrderId || isUnlocked) return;

    const pollInterval = setInterval(async () => {
      const done = await checkOrderStatus(activeOrderId);
      if (done) clearInterval(pollInterval);
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeOrderId, isUnlocked]);

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 9) {
      setPayError('Weka namba sahihi (07XXXXXXXX)');
      return;
    }

    try {
      localStorage.setItem('nelitv_user_phone', phone.trim());
    } catch {}

    setIsPaying(true);
    setPayError(null);

    try {
      const res = await fetch('/api/harakapay/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), planId: selectedPlanId })
      });
      const data = await res.json();

      if (data.success && data.orderId) {
        setActiveOrderId(data.orderId);
      } else {
        setPayError(data.error || 'Imeshindikana kutuma ombi. Hakikisha simu iko hewani.');
        setIsPaying(false);
      }
    } catch {
      setPayError('Hitilafu ya mtandao. Jaribu tena.');
      setIsPaying(false);
    }
  };

  // Verify existing subscription by phone
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 9) {
      setPayError('Weka namba sahihi');
      return;
    }

    try {
      localStorage.setItem('nelitv_user_phone', phone.trim());
    } catch {}

    setIsPaying(true);
    setPayError(null);

    try {
      const res = await fetch(`/api/subscription/check?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (data.success && data.active) {
        unlockPlayback(30);
      } else {
        setPayError('Namba hii haina kifurushi hai');
        setIsPaying(false);
      }
    } catch {
      setPayError('Hitilafu ya ukaguzi');
      setIsPaying(false);
    }
  };

  const selectedPlan = EMBED_PLANS.find(p => p.id === selectedPlanId) || EMBED_PLANS[0];

  return (
    <div className="relative w-screen h-[100dvh] bg-black overflow-hidden flex flex-col justify-center items-center">
      {/* 1. NeliTv Custom VideoPlayer */}
      <div className="w-full h-full relative">
        <VideoPlayer
          channel={channel}
          isFullPage={true}
        />

        {/* 60s Trial Countdown Badge */}
        {!isUnlocked && !showPaywall && (
          <div className="absolute top-2 right-2 z-30 pointer-events-none bg-black/85 backdrop-blur-md border border-amber-500/40 rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold text-neutral-300">
              Bure: <span className="font-mono text-amber-300 font-black">{secondsRemaining}s</span>
            </span>
          </div>
        )}
      </div>

      {/* 2. Compact In-Player Paywall Popup Modal (Fits any small embed size) */}
      {showPaywall && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 text-white animate-fade-in">
          <div className="w-full max-w-[320px] bg-[#0A0E17]/95 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl flex flex-col space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-2">
              <div className="p-1 rounded-lg bg-pink-500/20 text-pink-400">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-black text-white truncate">
                  Muda wa bure umekwisha
                </h3>
                <p className="text-[10px] text-neutral-400 truncate">
                  {channel.name}
                </p>
              </div>
            </div>

            {!showVerifyOnly ? (
              <>
                {/* 3 Compact Plan Pills */}
                <div className="grid grid-cols-3 gap-1.5">
                  {EMBED_PLANS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`py-1.5 px-1 rounded-xl text-center border text-[11px] font-bold transition cursor-pointer ${
                        selectedPlanId === p.id
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow-sm'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <div>{p.priceTsh.toLocaleString()}/=</div>
                      <div className={`text-[9px] ${selectedPlanId === p.id ? 'text-neutral-900 font-semibold' : 'text-neutral-400'}`}>
                        {p.name}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Form */}
                <form onSubmit={handleInitiatePayment} className="space-y-2">
                  <div className="space-y-1">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Namba ya simu (07XXXXXXXX)"
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-400 focus:outline-none text-white text-xs font-mono"
                    />
                  </div>

                  {payError && (
                    <div className="text-[10px] text-red-400 font-semibold">
                      {payError}
                    </div>
                  )}

                  {activeOrderId ? (
                    <div className="space-y-1.5">
                      <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 text-[11px] flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Weka PIN kwenye simu yako...</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkOrderStatus(activeOrderId)}
                        className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
                      >
                        Nimelipa Tayari (Thibitisha)
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isPaying}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-black text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      {isPaying ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Inatuma ombi...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>Lipa TZS {selectedPlan.priceTsh.toLocaleString()}</span>
                        </>
                      )}
                    </button>
                  )}
                </form>

                <div className="text-center pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVerifyOnly(true);
                      setPayError(null);
                    }}
                    className="text-[10px] text-neutral-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Ulishalipia? Hakiki Namba
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleVerifyPhone} className="space-y-2">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Weka namba uliyolipia (07XXXXXXXX)"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-400 focus:outline-none text-white text-xs font-mono"
                />

                {payError && (
                  <div className="text-[10px] text-red-400 font-semibold">
                    {payError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPaying}
                  className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
                >
                  {isPaying ? 'Inahakiki...' : 'Hakiki Kifurushi'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVerifyOnly(false);
                      setPayError(null);
                    }}
                    className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
                  >
                    ← Rudi kulipa
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbedPlayerView;
