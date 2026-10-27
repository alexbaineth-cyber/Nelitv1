import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Search, Crown, User, LogIn, Tv, Download } from 'lucide-react';

interface NavbarProps {
  activeTab: 'home' | 'watch' | 'search' | 'premium' | 'account' | 'verify';
  setActiveTab: (tab: 'home' | 'watch' | 'search' | 'premium' | 'account' | 'verify') => void;
  onOpenIntro?: () => void;
  onOpenDownloadModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenDownloadModal }) => {
  const { isLoggedIn, phone, displayName, photoURL, setLoginModalOpen } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#070A14]/95 backdrop-blur-md border-b border-white/10 transition duration-300">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
        {/* 1. BRAND LOGO */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
              try {
                if (window.location.pathname !== '/' && window.location.pathname !== '/download') {
                  window.history.pushState({}, '', '/');
                }
              } catch {}
            }}
            className="flex items-center gap-2.5 group focus:outline-none cursor-pointer"
            title="NeliTv Nyumbani"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-[1.5px] shadow-lg shadow-pink-600/30 group-hover:scale-105 transition">
              <div className="w-full h-full rounded-[10px] bg-[#070A14] flex items-center justify-center p-0.5 overflow-hidden">
                <img
                  src="/icon.svg"
                  alt="NeliTv Logo"
                  className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(255,0,128,0.4)]"
                />
              </div>
            </div>
            <div className="flex items-center tracking-tight">
              <span className="font-extrabold text-xl text-white group-hover:text-pink-400 transition">
                Neli
              </span>
              <span className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-400 ml-0.5">
                Tv
              </span>
            </div>
          </button>
        </div>

        {/* 2. RIGHT ACTIONS: MOBILE & DESKTOP */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* DOWNLOAD APP BUTTON */}
          {onOpenDownloadModal && (
            <button
              onClick={onOpenDownloadModal}
              title="Pakua NeliTv APK (Android & Smart TV)"
              className="py-1.5 px-3 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-500 hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 transition shadow-md shadow-pink-600/25 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 animate-bounce" />
              <span>Pakua App</span>
            </button>
          )}

          {/* DESKTOP-ONLY ACTIONS */}
          <div className="hidden md:flex items-center gap-2 sm:gap-2.5">
            {/* SEARCH */}
            <button
              onClick={() => setActiveTab('search')}
              title="Tafuta Chaneli"
              className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-pink-600/20 text-pink-300 border border-pink-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Tafuta</span>
            </button>

            {/* VIFURUSHI */}
            <button
              onClick={() => setActiveTab('premium')}
              className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'premium'
                  ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-500 text-white shadow-lg shadow-pink-600/30 border border-pink-400'
                  : 'bg-[#0B1020] hover:bg-white/10 text-neutral-200 border border-white/10'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Vifurushi</span>
            </button>

            {/* ACCOUNT OR LOGIN */}
            {isLoggedIn ? (
              <button
                onClick={() => setActiveTab('account')}
                className={`p-1 sm:pl-2.5 sm:pr-2 sm:py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'account'
                    ? 'border-blue-500 bg-blue-600/20 text-white shadow-sm shadow-blue-500/20'
                    : 'border-white/10 bg-[#0B1020] text-neutral-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName}
                    className="w-7 h-7 rounded-lg object-cover border border-white/15"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                    {displayName?.charAt(0).toUpperCase() || <User className="w-3.5 h-3.5" />}
                  </div>
                )}
                <span className="font-medium text-[11px] text-neutral-300 max-w-[90px] truncate">
                  {displayName || phone}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="py-1.5 px-3 sm:py-2 sm:px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-blue-600/30 active:scale-95 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Ingia</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
