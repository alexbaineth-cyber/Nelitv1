import React, { useState } from 'react';
import {
  Smartphone, Mail, Lock, User as UserIcon, LogIn,
  AlertCircle, X, Check, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

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
  title = "Ingia au Jisajili NeliTv",
  subtitle = "Tazama Live TV na Mechi zote za Ligi Kuu kwa ubora wa juu."
}) => {
  const {
    loginWithPhone,
    loginWithGoogle,
    loginWithEmailAndPassword,
    registerWithEmailAndPassword
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'google_email' | 'phone'>('google_email');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Phone state
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  
  // Email state
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Imeshindikana kuingia na Google.');
      }
    } catch {
      setErrorMessage('Hitilafu ya mtandao wakati wa kuingia na Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Handle Email & Password
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Tafadhali jaza barua pepe na nenosiri.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Nenosiri linatakiwa kuwa na angalau herufi 6.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const cleanInput = email.trim();
    const targetEmail = /^user([1-9]|10)$/i.test(cleanInput)
      ? `${cleanInput.toLowerCase()}@login.com`
      : cleanInput;

    try {
      let res;
      if (authMode === 'login') {
        res = await loginWithEmailAndPassword(targetEmail, password);
      } else {
        res = await registerWithEmailAndPassword(targetEmail, password, displayName);
      }

      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Imeshindikana kuthibitisha akaunti.');
      }
    } catch {
      setErrorMessage('Hitilafu ya mtandao. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Phone Login
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneNumber.replace(/\D/g, '');
    if (clean.length < 9) {
      setErrorMessage('Tafadhali weka namba sahihi ya simu ya Tanzania (mfano: 0712345678).');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await loginWithPhone(phoneNumber);
      if (res.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || 'Imeshindikana kuingia.');
      }
    } catch {
      setErrorMessage('Hitilafu ya mtandao. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-5 sm:p-6 shadow-2xl text-neutral-100 space-y-4 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          aria-label="Funga"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1 pr-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/10 border border-red-600/30 text-[11px] font-bold text-red-400 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>NeliTv Akaunti</span>
          </div>
          <h2 className="text-lg font-black text-white">
            {title}
          </h2>
          <p className="text-xs text-neutral-400">
            {subtitle}
          </p>
        </div>

        {/* Auth Method Switcher Tabs */}
        <div className="flex gap-1 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs font-semibold">
          <button
            onClick={() => { setActiveTab('google_email'); setErrorMessage(null); }}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'google_email' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Google & Email</span>
          </button>
          <button
            onClick={() => { setActiveTab('phone'); setErrorMessage(null); }}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
              activeTab === 'phone' ? 'bg-red-600 text-white shadow' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Namba ya Simu</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: GOOGLE & EMAIL / PASSWORD */}
        {activeTab === 'google_email' && (
          <div className="space-y-3.5">
            {/* ONE-CLICK GOOGLE SIGN IN BUTTON */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 active:scale-95 text-neutral-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md transition disabled:opacity-50"
            >
              {googleLoading ? (
                <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>Ingia na Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <div className="flex-1 h-px bg-neutral-800" />
              <span>au tumia barua pepe</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-2.5">
              {authMode === 'register' && (
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jina lako kamili"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 transition"
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Barua pepe (mfano: user1@login.com au user1)"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 transition font-sans"
                />
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nenosiri (herufi 6+)"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 transition font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{authMode === 'login' ? 'Ingia na Email' : 'Kamilisha Usajili'}</span>
                  </>
                )}
              </button>

              {/* Free VIP Accounts Hint */}
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-cyan-500/10 border border-amber-500/20 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Akaunti za Bure (Free VIP Accounts):</span>
                </div>
                <p className="text-[10px] text-neutral-300 leading-relaxed">
                  Email: <span className="font-mono text-cyan-300 font-bold">user1@login.com</span> mpaka <span className="font-mono text-cyan-300 font-bold">user10@login.com</span> (au <span className="font-mono text-cyan-300 font-bold">user1</span> .. <span className="font-mono text-cyan-300 font-bold">user10</span>)
                  <br />
                  Nenosiri: <span className="font-mono text-amber-300 font-bold">Free123</span>
                </p>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-[11px] text-neutral-400 hover:text-white transition"
                >
                  {authMode === 'login'
                    ? 'Huna akaunti bado? Jisajili hapa'
                    : 'Tayari una akaunti? Ingia hapa'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: PHONE NUMBER AUTH */}
        {activeTab === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400">
                Namba ya Simu (M-Pesa, Tigo, Airtel, Halopesa)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="07XXXXXXXX au 06XXXXXXXX"
                  required
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-red-600 transition"
                />
              </div>
            </div>

            <p className="text-[10px] text-neutral-500">
              Ukiingia kwa simu, akaunti yako itaunganishwa mara moja na vifurushi unavyolipia bila kuhitaji nenosiri.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Ingia kwa Simu</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
