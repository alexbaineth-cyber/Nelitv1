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
            className="flex items-center gap-2 group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center text-white shadow-lg shadow-red-600/30 group-hover:scale-105 transition">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center tracking-tight">
              <span className="font-extrabold text-xl text-white group-hover:text-red-500 transition">
                NELI
              </span>
              <span className="font-black text-xl text-red-600 ml-0.5">
                TV
              </span>
            </div>
          </button>

          {/* Intro Replay Icon */}
          {onOpenIntro && (
            <button
              onClick={onOpenIntro}
              title="Tazama Cinema Intro"
              className="hidden lg:flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-1 rounded-md hover:bg-neutral-900 transition"
            >
              <Play className="w-3 h-3 text-red-500 fill-red-500" />
              <span>Intro</span>
            </button>
          )}
        </div>

        {/* 2. RIGHT ACTIONS: DOWNLOAD APP, SEARCH, VIFURUSHI, ACCOUNT */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* DOWNLOAD APP BUTTON */}
          {onOpenDownloadModal && (
            <button
              onClick={onOpenDownloadModal}
              title="Pakua NeliTv APK (Android & Smart TV)"
              className="py-1.5 px-2.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-700/20 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pakua App</span>
            </button>
          )}

          {/* SEARCH */}
          <button
            onClick={() => setActiveTab('search')}
            title="Tafuta Chaneli"
            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'search'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Tafuta</span>
          </button>

          {/* VIFURUSHI */}
          <button
            onClick={() => setActiveTab('premium')}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'premium'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
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
              className={`p-1 sm:pl-2.5 sm:pr-2 sm:py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition ${
                activeTab === 'account'
                  ? 'border-red-600 bg-neutral-900 text-white'
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
                <div className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-bold">
                  {displayName.charAt(0).toUpperCase() || <User className="w-3.5 h-3.5" />}
                </div>
              )}
              <span className="hidden md:inline font-medium text-[11px] text-neutral-300 max-w-[90px] truncate">
                {displayName || phone}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setLoginModalOpen(true)}
              className="py-1.5 px-3 sm:py-2 sm:px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-red-600/20 active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Ingia</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
