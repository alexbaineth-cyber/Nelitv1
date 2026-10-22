import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Search, Crown, User, LogIn, Tv, Play, Download } from 'lucide-react';

interface NavbarProps {
  activeTab: 'home' | 'watch' | 'search' | 'premium' | 'account' | 'verify';
  setActiveTab: (tab: 'home' | 'watch' | 'search' | 'premium' | 'account' | 'verify') => void;
  onOpenIntro?: () => void;
  onOpenDownloadModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenIntro, onOpenDownloadModal }) => {
  const { isLoggedIn, phone, email, displayName, photoURL, hasActiveSubscription, setLoginModalOpen } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full bg-black/95 backdrop-blur-md border-b border-neutral-900 transition duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* 1. BRAND LOGO */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 group focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-[1.5px] shadow-lg shadow-pink-500/25 group-hover:scale-105 transition">
              <div className="w-full h-full rounded-[10px] bg-neutral-950 flex items-center justify-center p-1">
                <img
                  src="/logo.png"
                  alt="NeliTv Logo"
                  className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(255,0,122,0.4)]"
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

        {/* 2. RIGHT ACTIONS: ON MOBILE ONLY PAKUA APP IS SHOWN; DESKTOP SHOWS ALL ACTIONS */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* DOWNLOAD APP BUTTON - ALWAYS VISIBLE ON MOBILE & DESKTOP */}
          {onOpenDownloadModal && (
            <button
              onClick={onOpenDownloadModal}
              title="Pakua NeliTv APK (Android & Smart TV)"
              className="py-1.5 px-3 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-pink-600/25 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 animate-bounce" />
              <span>Pakua App</span>
            </button>
          )}

          {/* DESKTOP-ONLY ACTIONS (SEARCH, VIFURUSHI, ACCOUNT/LOGIN) - ON MOBILE THESE ARE IN THE BOTTOM BAR */}
          <div className="hidden md:flex items-center gap-2 sm:gap-2.5">
            {/* SEARCH */}
            <button
              onClick={() => setActiveTab('search')}
              title="Tafuta Chaneli"
              className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
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
                  ? 'bg-gradient-to-r from-amber-500 via-pink-600 to-cyan-500 text-black font-black shadow-lg shadow-pink-500/25'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800'
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
                    ? 'border-pink-500 bg-neutral-900 text-white shadow-sm shadow-pink-500/20'
                    : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName}
                    className="w-7 h-7 rounded-lg object-cover border border-neutral-700"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 font-bold">
                    {displayName.charAt(0).toUpperCase() || <User className="w-3.5 h-3.5" />}
                  </div>
                )}
                <span className="font-medium text-[11px] text-neutral-300 max-w-[90px] truncate">
                  {displayName || phone}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="py-1.5 px-3 sm:py-2 sm:px-3.5 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-pink-600/20 active:scale-95 cursor-pointer"
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
