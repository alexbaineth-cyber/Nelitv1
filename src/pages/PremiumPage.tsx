import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Crown, CheckCircle2, Zap, ArrowRight,
  AlertCircle, X
} from 'lucide-react';

interface CleanPlan {
  id: string;
  price: number;
  priceFormatted: string;
  watchDuration: string;
  name: string;
  popular?: boolean;
}

const PLANS: CleanPlan[] = [
  {
    id: 'plan_2days',
    price: 1000,
    priceFormatted: '1,000 TSH',
    watchDuration: '2 days watch',
    name: 'Kifurushi cha Siku 2',
    popular: false
  },
  {
    id: 'plan_7days',
    price: 3000,
    priceFormatted: '3,000 TSH',
    watchDuration: 'one week watch',
    name: 'Kifurushi cha Wiki 1',
    popular: true
  },
  {
    id: 'plan_30days',
    price: 10000,
    priceFormatted: '10,000 TSH',
    watchDuration: 'month watch',
    name: 'Kifurushi cha Mwezi 1',
    popular: false
  }
];

interface PremiumPageProps {
  initialPlanId?: string;
  onPaymentInitiated: (orderId: string, amount: number, phone: string, planName: string) => void;
  onOpenLoginModal: () => void;
  onSuccessRedirect?: () => void;
}

export const PremiumPage: React.FC<PremiumPageProps> = ({
  initialPlanId = 'plan_7days',
  onPaymentInitiated,
  onOpenLoginModal,
  onSuccessRedirect
}) => {
  const { user, phone, hasActiveSubscription } = useAuth();

  const [activeCheckoutPlan, setActiveCheckoutPlan] = useState<CleanPlan | null>(null);
  const [inputPhone, setInputPhone] = useState<string>(phone || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenCheckout = (plan: CleanPlan) => {
    setActiveCheckoutPlan(plan);
    setErrorMessage(null);
    if (!inputPhone && phone) {
      setInputPhone(phone);
    }
  };

  const handlePay = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeCheckoutPlan) return;

    setErrorMessage(null);
    const targetPhone = inputPhone.trim() || phone;

    if (!targetPhone) {
      setErrorMessage('Tafadhali andika namba yako ya simu kwanza.');
      return;
    }

    const clean = targetPhone.replace(/\D/g, '');
    if (clean.length < 9) {
      setErrorMessage('Namba ya simu lazima iwe ya Tanzania yenye tarakimu 10 (mfano: 0712345678).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/harakapay/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean,
          planId: activeCheckoutPlan.id
        })
      });

      const data = await res.json();
      if (data.success && data.orderId) {
        onPaymentInitiated(data.orderId, data.amount || activeCheckoutPlan.price, clean, activeCheckoutPlan.name);
      } else {
        const rawErr = data.error || '';
        if (/on\s*going\s*ussd|ongoing\s*ussd|another\s*on\s*going|rejecting/i.test(rawErr)) {
          setErrorMessage('Kuna ombi la USSD ambalo tayari lipo wazi kwenye simu yako! Tafadhali angalia skrini ya simu yako kuweka PIN, au subiri sekunde 30 kabla ya kujaribu tena.');
        } else {
          setErrorMessage(rawErr || 'Imeshindikana kuanzisha malipo. Hakikisha namba ina salio au jaribu tena.');
        }
      }
    } catch (err: any) {
      setErrorMessage('Hitilafu ya mtandao: ' + (err.message || 'Jaribu tena.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-16 text-neutral-100 select-none">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-8">
        {/* Simple Header */}
        <div className="text-center max-w-lg mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5" />
            <span>Vifurushi vya NeliTv</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Chagua Kifurushi Chako
          </h1>

          <p className="text-xs sm:text-sm text-neutral-400">
            Malipo ya papo hapo kwa simu yako (M-Pesa, Tigo Pesa, Airtel, Halopesa)
          </p>
        </div>

        {/* Active subscription status indicator */}
        {hasActiveSubscription && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-white">
                  Kifurushi chako: <span className="text-emerald-400">{user?.subscriptionPlan || 'Premium'}</span>
                </p>
                <p className="text-neutral-400 text-xs">
                  Inaisha: {user?.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('sw-TZ') : 'Haijulikani'}
                </p>
              </div>
            </div>
            {onSuccessRedirect && (
              <button
                onClick={onSuccessRedirect}
                className="text-xs font-bold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 px-4 py-2 rounded-xl transition"
              >
                Tazama TV
              </button>
            )}
          </div>
        )}

        {/* Subscription stacking notice */}
        <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center gap-3 text-xs text-neutral-300 shadow-sm">
          <Zap className="w-4 h-4 text-cyan-400 shrink-0 fill-cyan-400" />
          <p className="leading-relaxed">
            <strong className="text-white">Ongeza Kifurushi Muda Wowote:</strong> Ukilipia tena, muda mpya unajumlishwa moja kwa moja na masaa au siku zilizobaki (mfano: ukilipia siku 30 mara mbili unakuwa na siku 60, au ukiwa na siku 1 na ukalipia 1,000 unakuwa na siku 3 kamili).
          </p>
        </div>

        {/* SIMPLE 3-CARD PRICING GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {PLANS.map((plan) => {
            const isPopular = plan.popular;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl p-6 border flex flex-col justify-between transition-all duration-200 relative text-center ${
                  isPopular
                    ? 'bg-gradient-to-b from-red-600/15 to-neutral-900 border-red-500 shadow-xl shadow-red-600/10 scale-[1.02]'
                    : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider shadow">
                    BORA
                  </div>
                )}

                <div className="py-2 space-y-2">
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                    {plan.priceFormatted}
                  </div>

                  <div className="text-sm sm:text-base font-semibold text-neutral-300 capitalize">
                    {plan.watchDuration}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => handleOpenCheckout(plan)}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 ${
                      isPopular
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                    }`}
                  >
                    <span>Lipia</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mitandao inayokubaliwa */}
        <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center">
          <p className="text-xs text-neutral-400 font-medium">
            Inalipwa kwa: M-Pesa • Tigo Pesa • Airtel Money • Halopesa
          </p>
        </div>
      </div>

      {/* SIMPLE POPUP FOR PHONE NUMBER INPUT & USSD PUSH */}
      {activeCheckoutPlan && (
        <div
          onClick={() => setActiveCheckoutPlan(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-neutral-100 space-y-4"
          >
            {/* Close Button */}
            <button
              onClick={() => setActiveCheckoutPlan(null)}
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
              aria-label="Funga"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {activeCheckoutPlan.watchDuration}
              </div>
              <h3 className="text-lg font-black text-white mt-0.5">
                {activeCheckoutPlan.priceFormatted}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Weka namba yako ya simu kwa ajili ya USSD push
              </p>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handlePay} className="space-y-3.5">
              <div>
                <input
                  type="tel"
                  placeholder="07XXXXXXXX au 06XXXXXXXX"
                  value={inputPhone}
                  onChange={(e) => setInputPhone(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 font-mono text-sm transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 transition active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Inatuma Ombi...</span>
                  </div>
                ) : (
                  <>
                    <span>Lipa {activeCheckoutPlan.priceFormatted}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
