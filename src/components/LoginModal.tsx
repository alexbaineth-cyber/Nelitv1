import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Smartphone, AlertCircle, ArrowRight, X, ShieldCheck, Zap } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Ingia au Jisajili",
  subtitle = "Weka namba yako ya simu kuanza kutazama bure kwa dakika 1 au kufungua kifurushi chako."
}) => {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const clean = phoneNumber.trim().replace(/\D/g, '');
    if (!clean || clean.length < 9) {
      setError('Tafadhali andika namba sahihi ya simu (mfano: 0712 345 678 au 0655...)');
      return;
    }

    setLoading(true);
    try {
      const res = await login(clean);
      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
      } else {
        setError(res.error || 'Imeshindikana kuingia, tafadhali jaribu tena.');
      }
    } catch (err: any) {
      setError(err.message || 'Hitilafu ya mtandao');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickNumber = (sample: string) => {
    setPhoneNumber(sample);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-neutral-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition"
          aria-label="Funga"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-black">
            M
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">{title}</h3>
            <p className="text-xs text-red-500 font-semibold">Your Max TV Tanzania</p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-neutral-400 mb-5 leading-relaxed">
          {subtitle}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
              Namba ya Simu (M-Pesa, Tigo, Airtel, Halotel)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500 font-mono text-sm">
                +255
              </div>
              <input
                type="tel"
                placeholder="0712 345 678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoFocus
                className="w-full pl-16 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-red-600 font-mono transition text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Quick suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
            <span>Mfano wa haraka:</span>
            <button
              type="button"
              onClick={() => handleQuickNumber('0712345678')}
              className="text-red-400 hover:text-red-300 underline font-mono"
            >
              0712345678
            </button>
            <span>au</span>
            <button
              type="button"
              onClick={() => handleQuickNumber('0655123456')}
              className="text-red-400 hover:text-red-300 underline font-mono"
            >
              0655123456
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Inathibitisha...</span>
              </div>
            ) : (
              <>
                <span>Endelea Kutazama</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Benefits footer */}
        <div className="mt-5 pt-4 border-t border-neutral-800 space-y-1.5 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span>Kila mtumiaji mpya anapewa dakika 1 ya majaribio ya bure</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Hakuna nenosiri, unakumbukwa kwa namba yako ya simu</span>
          </div>
        </div>
      </div>
    </div>
  );
};
