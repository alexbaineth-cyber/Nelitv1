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
    <header className="sticky top-0 z-40 w-full bg-[#060714]/90 backdrop-blur-xl border-b border-purple-500/20 shadow-[0_6px_30px_rgba(0,0,0,0.45)] transition duration-300">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={goHome}
          className="flex items-center gap-2 focus:outline-none cursor-pointer whitespace-nowrap shrink-0 group"
          title="NeliTv Nyumbani"
        >
          <NeliTvBrandMark size="sm" />
        </button>

        {/* Zone 2: Clean Single-Row Center Navigation */}
        <nav className="hidden md:flex items-center gap-2 text-xs sm:text-sm font-semibold">
          <button
            onClick={goHome}
            className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === 'home' || activeTab === 'watch'
                ? 'bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#4338ca] text-white border border-purple-400/50 shadow-[0_0_18px_rgba(124,58,237,0.45)]'
                : 'text-neutral-300 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Nyumbani</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === 'search'
                ? 'bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#4338ca] text-white border border-purple-400/50 shadow-[0_0_18px_rgba(124,58,237,0.45)]'
                : 'text-neutral-300 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Vituo &amp; Aina</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
              activeTab === 'about'
                ? 'bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#4338ca] text-white border border-purple-400/50 shadow-[0_0_18px_rgba(124,58,237,0.45)]'
                : 'text-neutral-300 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Kuhusu</span>
          </button>
        </nav>

        {/* Zone 3: Search Trigger, Download APK & Circular Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('search')}
            title="Tafuta Chaneli"
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0c0f24]/90 border border-purple-500/30 hover:border-cyan-400/60 text-neutral-300 hover:text-white text-xs transition whitespace-nowrap cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline text-neutral-400">Tafuta vituo...</span>
          </button>

          {onOpenDownloadModal && (
            <button
              onClick={onOpenDownloadModal}
              title="Pakua NeliTv APK (Android & Smart TV)"
              className="py-1.5 px-3.5 rounded-full neli-gradient-bg hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_18px_rgba(255,30,138,0.35)] active:scale-95 transition whitespace-nowrap shrink-0 cursor-pointer"
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
                  ? 'border-cyan-400 shadow-[0_0_12px_rgba(0,212,255,0.45)]'
                  : 'border-purple-400/40 hover:border-cyan-400/70 bg-[#0d1128]'
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
              className="w-9 h-9 md:w-auto md:px-3.5 md:py-1.5 rounded-full bg-[#0d1128] hover:bg-purple-600/25 border border-purple-400/40 hover:border-cyan-400/60 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline whitespace-nowrap">Ingia</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtle Neon Spectrum Bottom Hairline */}
      <div
        aria-hidden="true"
        className="h-[1px] w-full opacity-55"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, #ff1e8a 25%, #8b5cf6 50%, #00d4ff 75%, transparent 100%)',
        }}
      />
    </header>
  );
};
