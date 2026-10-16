import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Search, Crown, User, LogIn } from 'lucide-react';

interface NavbarProps {
  activeTab: 'home' | 'watch' | 'search' | 'premium' | 'account' | 'verify';
  setActiveTab: (tab: 'home' | 'watch' | 'search' | 'premium' | 'account' | 'verify') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { isLoggedIn, phone, hasActiveSubscription, user, setLoginModalOpen } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-neutral-900 transition duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* 1. LOGO */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/30 group-hover:scale-105 transition font-black text-lg">
            M
          </div>
          <div className="flex items-center tracking-tighter">
            <span className="font-extrabold text-xl text-white group-hover:text-red-500 transition">
              YOUR MAX
            </span>
            <span className="font-black text-xl text-red-600 ml-1">
              TV
            </span>
          </div>
        </button>

        {/* ONLY: SEARCH, VIFURUSHI, ACCOUNT */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 2. SEARCH */}
          <button
            onClick={() => setActiveTab('search')}
            title="Tafuta Chaneli"
            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === 'search'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Tafuta</span>
          </button>

          {/* 3. VIFURUSHI */}
          <button
            onClick={() => setActiveTab('premium')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
              activeTab === 'premium'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Vifurushi</span>
          </button>

          {/* 4. ACCOUNT */}
          {isLoggedIn ? (
            <button
              onClick={() => setActiveTab('account')}
              className={`p-1.5 sm:pl-3 sm:pr-2 sm:py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition ${
                activeTab === 'account'
                  ? 'border-red-600 bg-neutral-900 text-white'
                  : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <span className="hidden md:inline font-mono text-[11px] text-neutral-300">
                {phone}
              </span>
              <div className="w-7 h-7 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                <User className="w-3.5 h-3.5" />
              </div>
            </button>
          ) : (
            <button
              onClick={() => setLoginModalOpen(true)}
              className="py-1.5 px-3.5 sm:py-2 sm:px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-red-600/20"
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
