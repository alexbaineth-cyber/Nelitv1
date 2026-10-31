import React, { useState, useEffect, useRef } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { VideoPlayer } from './VideoPlayer.tsx';
import { Lock, Smartphone, CheckCircle2, AlertTriangle, RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import { normalizePhoneNumber } from '../lib/supabase.ts';

interface EmbedPlayerViewProps {
  channel: Channel;
}

const EMBED_PLANS = [
  { id: 'plan_2days', name: 'Siku 2', priceTsh: 1000, durationText: 'Masaa 48' },
  { id: 'plan_7days', name: 'Wiki 1', priceTsh: 3000, durationText: 'Siku 7' },
  { id: 'plan_30days', name: 'Mwezi 1', priceTsh: 10000, durationText: 'Siku 30' }
];

export const EmbedPlayerView: React.FC<EmbedPlayerViewProps> = ({ channel }) => {
  // Check if this viewer already unlocked embed playback on this device
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(`nelitv_embed_unlocked_${channel.id}`) || localStorage.getItem('nelitv_embed_global_unlocked');
      if (saved) {
        const exp = Number(saved);
        if (exp > Date.now()) return true;
      }
    } catch {}
    return false;
  });

  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan_2days');
  const [phone, setPhone] = useState<string>('');
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);
  const [showLinkPhone, setShowLinkPhone] = useState<boolean>(false);

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

  // Poll HarakaPay status when orderId is active
  useEffect(() => {
    if (!activeOrderId || isUnlocked) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/harakapay/check-status/${activeOrderId}`);
        const data = await res.json();
        if (data.success && data.status === 'completed') {
          clearInterval(pollInterval);
          unlockPlayback(30); // 30 days unlock
          setPaySuccessMsg('Malipo yamethibitishwa kikamilifu! Kituo kimefunguliwa.');
          setIsPaying(false);
          setShowPaywall(false);
        }
      } catch (err) {
        console.warn('Poll status error', err);
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeOrderId, isUnlocked]);

  const unlockPlayback = (days: number = 30) => {
    const expiry = Date.now() + days * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(`nelitv_embed_unlocked_${channel.id}`, String(expiry));
      localStorage.setItem('nelitv_embed_global_unlocked', String(expiry));
    } catch {}
    setIsUnlocked(true);
    setShowPaywall(false);
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 9) {
      setPayError('Tafadhali weka namba sahihi ya simu (mfano: 0712345678)');
      return;
    }

    setIsPaying(true);
    setPayError(null);

    try {
      const res = await fetch('/api/harakapay/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, planId: selectedPlanId })
      });
      const data = await res.json();

      if (data.success && data.orderId) {
        setActiveOrderId(data.orderId);
        setPaySuccessMsg(data.message || 'Ombi la USSD limetumwa kwenye simu yako! Weka PIN kuthibitisha.');
      } else {
        setPayError(data.error || 'Imeshindikana kuanzisha malipo. Hakikisha simu ina salio na iko hewani.');
        setIsPaying(false);
      }
    } catch {
      setPayError('Hitilafu ya mtandao. Tafadhali jaribu tena.');
      setIsPaying(false);
    }
  };

  // Verify existing subscription by phone
  const handleVerifyExistingPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setIsPaying(true);
    setPayError(null);

    try {
      const res = await fetch(`/api/subscription/check?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (data.success && data.active) {
        unlockPlayback(30);
        setPaySuccessMsg('Namba yako ina kifurushi hai! Kituo kimefunguliwa.');
        setIsPaying(false);
      } else {
        setPayError('Namba hii haina kifurushi hai. Tafadhali chagua kifurushi na ulipe.');
        setIsPaying(false);
      }
    } catch {
      setPayError('Imeshindikana kuthibitisha namba kwa sasa.');
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

        {/* 60s Trial Countdown Badge (Discreet overlay during the 1-minute preview) */}
        {!isUnlocked && !showPaywall && (
          <div className="absolute top-3 right-3 z-30 pointer-events-none bg-black/80 backdrop-blur-md border border-amber-500/50 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-lg animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-bold text-neutral-300">
              Majaribio ya Bure: <span className="font-mono text-amber-300 font-black">{secondsRemaining}s</span>
            </span>
          </div>
        )}
      </div>

      {/* 2. 60-Second In-Player Paywall Popup Modal */}
      {showPaywall && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 text-white animate-fade-in">
          <div className="w-full max-w-md bg-[#0C101A] border border-cyan-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-pink-500 p-0.5 flex items-center justify-center shadow-lg shadow-pink-500/30">
                <div className="w-full h-full rounded-[14px] bg-[#0C101A] flex items-center justify-center">
                  <Lock className="w-6 h-6 text-amber-400" />
                </div>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white">
                Muda wa Bure Umekwisha (60s)
              </h2>
              <p className="text-xs text-neutral-400">
                Tazama <strong className="text-cyan-400">{channel.name}</strong> moja kwa moja bila kukatika kwa kulipia kifurushi cha bei nafuu.
              </p>
            </div>

            {/* Plan Selector */}
            <div className="grid grid-cols-3 gap-2">
              {EMBED_PLANS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`p-2.5 rounded-2xl text-center border transition cursor-pointer ${
                    selectedPlanId === p.id
                      ? 'bg-gradient-to-b from-cyan-600/30 to-pink-600/20 border-cyan-400 shadow-lg text-white'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold">{p.name}</div>
                  <div className="text-sm font-black font-mono text-cyan-300 mt-0.5">
                    {p.priceTsh.toLocaleString()} /=
                  </div>
                  <div className="text-[10px] text-neutral-500">{p.durationText}</div>
                </button>
              ))}
            </div>

            {/* Form */}
            {!showLinkPhone ? (
              <form onSubmit={handleInitiatePayment} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Namba ya Simu (M-Pesa / Tigo / Airtel / Halo):</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XXXXXXXX au 06XXXXXXXX"
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs sm:text-sm font-mono"
                  />
                </div>

                {payError && (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{payError}</span>
                  </div>
                )}

                {paySuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-800/60 text-cyan-300 text-xs flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>{paySuccessMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPaying}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isPaying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Inasubiri PIN kwenye Simu...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>Lipa TZS {selectedPlan.priceTsh.toLocaleString()} Sasa</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyExistingPhone} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-300">
                    Weka Namba Uliyolipia Awali:
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07XXXXXXXX"
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs font-mono"
                  />
                </div>

                {payError && (
                  <div className="p-2 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs">
                    {payError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPaying}
                  className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  {isPaying ? 'Inathibitisha...' : 'Thibitisha Namba'}
                </button>
              </form>
            )}

            {/* Switch between Pay and Verify Existing */}
            <div className="pt-2 border-t border-neutral-800/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowLinkPhone(!showLinkPhone);
                  setPayError(null);
                }}
                className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
              >
                {showLinkPhone ? '← Rudi kwenye malipo mapya' : 'Tayari umelipia? Bonyeza hapa kuunganisha namba yako'}
              </button>
            </div>

            <div className="text-[10px] text-neutral-500 text-center flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Malipo Salama kwa Simu kupitia HarakaPay & NeliTv</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbedPlayerView;
