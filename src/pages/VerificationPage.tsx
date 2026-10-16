import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ShieldCheck, CheckCircle2, AlertCircle, ArrowRight,
  RotateCcw
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
  orderId,
  amount = 1000,
  phone = '',
  planName = 'Kifurushi cha Siku 2',
  onSuccessRedirect,
  onRetryPayment
}) => {
  const { user, refreshProfile } = useAuth();
  const currentPhone = phone || (user ? user.phone : '');

  const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const [checking, setChecking] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

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
          orderId: orderId || '',
          phone: currentPhone,
          amount: amount
        })
      });

      const data = await res.json();
      console.log('[Verification Response]', data);

      if (data.verified || data.status === 'completed') {
        setStatus('completed');
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
  }, [status, orderId, currentPhone, amount]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-6 text-neutral-100 select-none">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
        {status === 'completed' ? (
          <div className="text-center space-y-4 animate-fade-in py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-black text-white">
                Malipo Yamethibitishwa!
              </h2>
              <p className="text-xs text-neutral-300 mt-1">
                Kifurushi chako kimewashwa na kimehifadhiwa kikamilifu.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-1.5 text-left">
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
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <span>Tazama Live TV Sasa</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Thibitisha Malipo</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Weka PIN Kwenye Simu Yako
              </h2>
            </div>

            {/* Compact details: Phone & Amount only */}
            <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Namba ya Simu:</span>
                <span className="font-mono font-bold text-white">{currentPhone}</span>
              </div>
              <div className="h-px bg-neutral-800/80" />
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Kiasi cha Kulipa:</span>
                <span className="font-mono font-black text-amber-400 text-sm">
                  TZS {amount.toLocaleString()}
                </span>
              </div>
            </div>

            {noticeMessage && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{noticeMessage}</span>
              </div>
            )}

            {/* TWO SIMPLE BUTTONS: Nimelipa & Lipa Tena */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => checkPayment(true)}
                disabled={checking}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
              >
                {checking ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    <span>Inakagua...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Nimelipa</span>
                  </>
                )}
              </button>

              <button
                onClick={onRetryPayment}
                className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 border border-neutral-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                <span>Lipa Tena</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
