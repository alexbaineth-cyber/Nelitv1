import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Search, User, LogIn, Download, Home, Tv, Compass } from 'lucide-react';
import { NeliTvBrandMark } from './NeliTvBrandMark.tsx';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onOpenIntro?: () => void;
  onOpenDownloadModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenDownloadModal,
}) => {
  const { isLoggedIn, phone, displayName, photoURL, setLoginModalOpen } = useAuth();

  const goHome = () => {
    setActiveTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      if (window.location.pathname !== '/' && window.location.pathname !== '/download') {
        window.history.pushState({}, '', '/');
      }
    } catch {}
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0b0e14]/95 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Brand Wordmark */}
        <button
          onClick={goHome}
          className="flex items-center gap-2 focus:outline-none cursor-pointer whitespace-nowrap shrink-0"
          title="NeliTv Nyumbani"
        >
          <NeliTvBrandMark size="sm" />
        </button>

        {/* Clean Hulu/Disney+ Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
          <button
            onClick={goHome}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === 'home' || activeTab === 'watch'
                ? 'text-white bg-white/[0.09]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Nyumbani</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === 'search'
                ? 'text-white bg-white/[0.09]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Vituo</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`px-3.5 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === 'about'
                ? 'text-white bg-white/[0.09]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Kuhusu</span>
          </button>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('search')}
            title="Tafuta Chaneli"
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-medium transition whitespace-nowrap cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden lg:inline">Tafuta vituo...</span>
          </button>

          {onOpenDownloadModal && (
            <button
              onClick={onOpenDownloadModal}
              title="Pakua NeliTv APK (Android & Smart TV)"
              className="py-1.5 px-3.5 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] text-xs font-bold flex items-center gap-1.5 active:scale-95 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pakua App</span>
            </button>
          )}

          {isLoggedIn ? (
            <button
              onClick={() => setActiveTab('account')}
              title={displayName || phone || 'Akaunti'}
              className={`w-9 h-9 rounded-full border flex items-center justify-center overflow-hidden transition shrink-0 cursor-pointer ${
                activeTab === 'account'
                  ? 'border-white ring-2 ring-white/25'
                  : 'border-white/20 hover:border-white/50 bg-[#141923]'
              }`}
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-white">
                  {displayName?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setLoginModalOpen(true)}
              title="Ingia au Jisajili"
              className="w-9 h-9 md:w-auto md:px-3.5 md:py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden md:inline whitespace-nowrap">Ingia</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
