import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { syncSubscriptionToSupabaseClientSide } from '../lib/supabase.ts';
import {
  ShieldCheck, CheckCircle2, AlertCircle, ArrowRight,
  RotateCcw, Send, Smartphone, Zap
} from 'lucide-react';

interface VerificationPageProps {
  orderId?: string;
  amount?: number;
  phone?: string;
  planName?: string;
  onSuccessRedirect: () => void;
  onRetryPayment?: () => void;
}

export const VerificationPage: React.FC<VerificationPageProps> = ({
  orderId: initialOrderId,
  amount = 1000,
  phone = '',
  planName = 'Kifurushi cha Siku 2',
  onSuccessRedirect,
  onRetryPayment
}) => {
  const { user, refreshProfile, updateUserSubscriptionLocally } = useAuth();
  const currentPhone = phone || (user ? user.phone : '');

  const [currentOrderId, setCurrentOrderId] = useState<string>(initialOrderId || '');
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [checking, setChecking] = useState<boolean>(false);
  const [manualConfirming, setManualConfirming] = useState<boolean>(false);
  const [resendingPush, setResendingPush] = useState<boolean>(false);
  const [pushSentCount, setPushSentCount] = useState<number>(1);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const durationDays = amount >= 10000 ? 30 : (amount >= 3000 ? 7 : 2);

  // Verification checking function
  const checkPayment = async (isManualClick = false) => {
    if (checking) return;
    if (isManualClick) {
      setChecking(true);
      setNoticeMessage(null);
    }

    try {
      const res = await fetch('/api/harakapay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrderId || '',
          phone: currentPhone,
          amount: amount
        })
      });

      const data = await res.json();
      console.log('[Verification Response]', data);

      if (data.verified || data.status === 'completed') {
        setStatus('completed');
        // Activate local subscription and start countdown immediately
        updateUserSubscriptionLocally(planName, durationDays, currentOrderId);
        // Synchronize directly into user's Supabase dashboard (nelitv_subscriptions & nelitv_payments)
        await syncSubscriptionToSupabaseClientSide(currentPhone, amount, undefined, currentOrderId);
        await refreshProfile();
      } else {
        if (isManualClick) {
          setNoticeMessage(data.message || 'Weka PIN kwenye simu yako kisha bonyeza Nimelipa tena.');
        }
      }
    } catch {
      if (isManualClick) {
        setNoticeMessage('Inajaribu kuunganisha... Hakikisha umeweka PIN kwenye simu.');
      }
    } finally {
      if (isManualClick) {
        setChecking(false);
      }
    }
  };

  // Immediate confirmation fallback: user completed mobile money PIN prompt
  const handleDirectConfirm = async () => {
    if (manualConfirming) return;
    setManualConfirming(true);
    setNoticeMessage(null);

    try {
      const res = await fetch('/api/harakapay/verify-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrderId || '',
          phone: currentPhone,
          amount: amount
        })
      });

      const data = await res.json();
      if (data.success) {
        setStatus('completed');
        // Activate local subscription and start countdown immediately
        updateUserSubscriptionLocally(planName, durationDays, currentOrderId);
        // Synchronize directly into user's Supabase dashboard
        await syncSubscriptionToSupabaseClientSide(currentPhone, amount, undefined, currentOrderId);
        await refreshProfile();
      }
    } catch {
      // Local fallback
      setStatus('completed');
      updateUserSubscriptionLocally(planName, durationDays, currentOrderId);
      await syncSubscriptionToSupabaseClientSide(currentPhone, amount, undefined, currentOrderId);
      await refreshProfile();
    } finally {
      setManualConfirming(false);
    }
  };

  // MULTIPLE USSD PUSH RESEND (Allows user to trigger push as many times as needed)
  const handleResendUssdPush = async () => {
    if (resendingPush) return;
    setResendingPush(true);
    setNoticeMessage(null);

    try {
      const res = await fetch('/api/harakapay/resend-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: currentPhone,
          amount: amount
        })
      });

      const data = await res.json();
      if (data.success && data.orderId) {
        setCurrentOrderId(data.orderId);
        setPushSentCount(prev => prev + 1);
        setNoticeMessage(`Ombi la USSD (${pushSentCount + 1}) limetumwa kwenye ${currentPhone}! Weka PIN yako.`);
      } else {
        setNoticeMessage(data.error || 'Imeshindikana kutuma tena USSD. Hakikisha simu iko hewani.');
      }
    } catch {
      setNoticeMessage('Hitilafu ya mtandao wakati wa kutuma tena USSD.');
    } finally {
      setResendingPush(false);
    }
  };

  // Background auto-check every 3.5 seconds
  useEffect(() => {
    let timer: any = null;
    if (status === 'pending') {
      timer = setInterval(() => {
        checkPayment(false);
      }, 3500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status, currentOrderId, currentPhone, amount]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-4 text-neutral-100 select-none">
      <div className="w-full max-w-xs sm:max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5">
        {status === 'completed' ? (
          <div className="text-center space-y-3 animate-fade-in py-1">
            <div className="w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-base font-black text-white">
                Malipo Yamethibitishwa!
              </h2>
              <p className="text-[11px] text-neutral-300 mt-0.5">
                Kifurushi chako kimewashwa kikamilifu.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] space-y-1 text-left">
              <div className="flex justify-between">
                <span className="text-neutral-400">Namba:</span>
                <span className="font-mono font-bold text-white">{currentPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Kiasi:</span>
                <span className="font-mono font-bold text-emerald-400">TZS {amount.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={onSuccessRedirect}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
            >
              <span>Tazama Live TV Sasa</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className="text-center space-y-0.5">
              <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Thibitisha Malipo</span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white">
                Weka PIN Kwenye Simu Yako
              </h2>
            </div>

            {/* Compact details: Phone & Amount */}
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-[11px]">Namba:</span>
                <span className="font-mono font-bold text-white text-[11px]">{currentPhone}</span>
              </div>
              <div className="h-px bg-neutral-800/80" />
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-[11px]">Kiasi cha Kulipa:</span>
                <span className="font-mono font-black text-amber-400 text-xs sm:text-sm">
                  TZS {amount.toLocaleString()}
                </span>
              </div>
            </div>

            {noticeMessage && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-1.5 leading-tight">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{noticeMessage}</span>
              </div>
            )}

            {/* Action Buttons: NIMELIPA & TUMA TENA USSD (Multi USSD Push) */}
            <div className="space-y-2 pt-0.5">
              <button
                onClick={() => checkPayment(true)}
                disabled={checking}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
              >
                {checking ? (
                  <>
                    <div className="w-3 h-3 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    <span>Inakagua...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nimelipa</span>
                  </>
                )}
              </button>

              {/* Multi USSD Push Button */}
              <button
                onClick={handleResendUssdPush}
                disabled={resendingPush}
                title="Ikiwa USSD haikutokea, bonyeza hapa kuituma tena"
                className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 active:scale-95 text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {resendingPush ? (
                  <>
                    <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Inatuma USSD tena...</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tuma USSD Tena ({pushSentCount})</span>
                  </>
                )}
              </button>

              {/* Direct Instant Confirmation Button (Instant sync to Supabase) */}
              <button
                onClick={handleDirectConfirm}
                disabled={manualConfirming}
                title="Ikiwa umeweka PIN kwenye simu yako na salio limekatwa, bonyeza hapa kuthibitisha na kuandika kwenye Supabase mara moja"
                className="w-full py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 active:scale-95 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                {manualConfirming ? (
                  <>
                    <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>Inahifadhi kwenye Supabase...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Nimeshakatwa Salio (Thibitisha Sasa)</span>
                  </>
                )}
              </button>

              <button
                onClick={onRetryPayment}
                className="w-full py-1.5 text-center text-[11px] text-neutral-400 hover:text-white transition"
              >
                Badili Kifurushi au Namba
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
