/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Channel, CHANNELS_DATA } from './data/channels.ts';
import { Navbar } from './components/Navbar.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { DownloadAppModal } from './components/DownloadAppModal.tsx';
import { CinematicSplash } from './components/CinematicSplash.tsx';
import { MobileApkLandingView } from './components/MobileApkLandingView.tsx';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { Download, QrCode, Smartphone, X, ShieldCheck, Tv, Search, Crown, User } from 'lucide-react';
import { WatchPage } from './pages/WatchPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { PremiumPage } from './pages/PremiumPage.tsx';
import { VerificationPage } from './pages/VerificationPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';

type TabType = 'home' | 'watch' | 'search' | 'premium' | 'account' | 'verify';

interface ActivePayment {
  orderId: string;
  amount: number;
  phone: string;
  planName: string;
}

function MainApp() {
  const { isLoggedIn, hasActiveSubscription, isLoginModalOpen, setLoginModalOpen } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [channels, setChannels] = useState<Channel[]>(CHANNELS_DATA);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(CHANNELS_DATA[0]);
  const [pendingChannelToPlay, setPendingChannelToPlay] = useState<Channel | null>(null);
  const [initialPlanForPremium, setInitialPlanForPremium] = useState<string>('plan_7days');

  const [activePayment, setActivePayment] = useState<ActivePayment | null>(null);

  // Mobile Response Detection: renders full single-page APK landing on mobile viewports
  const [isMobileLanding, setIsMobileLanding] = useState<boolean>(() => {
    try {
      const search = window.location.search;
      if (search.includes('view=apk') || window.location.pathname === '/download') {
        return true;
      }
      const forcedWeb = sessionStorage.getItem('nelitv_force_web_mode');
      if (forcedWeb === 'true') {
        return false;
      }
      const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      return isMobileUA || isSmallScreen;
    } catch {
      return false;
    }
  });

  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);

  // Cinematic Intro Splash state - shows once on first entrance
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [downloadModalTab, setDownloadModalTab] = useState<'direct' | 'qr'>('direct');
  const [showDownloadBanner, setShowDownloadBanner] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nelitv_hide_app_banner') !== 'true';
    } catch {
      return true;
    }
  });

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Anti-inspection and stream protection
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'I', 'J', 'C'].includes(e.key)) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch live channels from server on mount
  useEffect(() => {
    fetch('/api/channels')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setChannels(data.data);
          setSelectedChannel(prev => {
            const found = data.data.find((c: Channel) => c.id === prev.id);
            return found || prev;
          });
        }
      })
      .catch(err => console.warn('Could not load channels from /api/channels', err));
  }, []);

  // Global TV Remote & Keyboard numeric channel dialing (0-9 + OK/Enter)
  const [globalDialedNumber, setGlobalDialedNumber] = useState<string>('');
  const [globalDialedTarget, setGlobalDialedTarget] = useState<Channel | null>(null);
  const globalDialTimerRef = React.useRef<any>(null);

  // When a channel is selected
  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setActiveTab('watch');
    window.scrollTo(0, 0);
  };

  const handleLoginSuccess = () => {
    if (pendingChannelToPlay) {
      setSelectedChannel(pendingChannelToPlay);
      setPendingChannelToPlay(null);
      setActiveTab('watch');
    }
  };

  const handlePaymentInitiated = (orderId: string, amount: number, phone: string, planName: string) => {
    setActivePayment({ orderId, amount, phone, planName });
    setActiveTab('verify');
    window.scrollTo(0, 0);
  };

  const handleNavigateToPremiumWithPlan = (planId?: string) => {
    if (planId) {
      setInitialPlanForPremium(planId);
    }
    setActiveTab('premium');
    window.scrollTo(0, 0);
  };

  // Global numeric keypress listener for Smart TV Remote & Keyboard
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const next = (globalDialedNumber + e.key).slice(0, 3);
        setGlobalDialedNumber(next);
        const chNum = parseInt(next, 10);
        const match = channels[chNum - 1] || null;
        setGlobalDialedTarget(match);

        if (globalDialTimerRef.current) clearTimeout(globalDialTimerRef.current);
        globalDialTimerRef.current = setTimeout(() => {
          if (match) {
            handleSelectChannel(match);
          }
          setGlobalDialedNumber('');
          setGlobalDialedTarget(null);
        }, 2200);
        return;
      }

      if (e.key === 'Enter' && globalDialedNumber && globalDialedTarget) {
        e.preventDefault();
        if (globalDialTimerRef.current) clearTimeout(globalDialTimerRef.current);
        handleSelectChannel(globalDialedTarget);
        setGlobalDialedNumber('');
        setGlobalDialedTarget(null);
        return;
      }

      if (e.key === 'Escape' || e.key === 'Backspace') {
        if (globalDialedNumber) {
          e.preventDefault();
          if (globalDialTimerRef.current) clearTimeout(globalDialTimerRef.current);
          const sliced = globalDialedNumber.slice(0, -1);
          setGlobalDialedNumber(sliced);
          if (sliced) {
            const chNum = parseInt(sliced, 10);
            setGlobalDialedTarget(channels[chNum - 1] || null);
          } else {
            setGlobalDialedTarget(null);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (globalDialTimerRef.current) clearTimeout(globalDialTimerRef.current);
    };
  }, [globalDialedNumber, globalDialedTarget, channels]);

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* 1. CINEMATIC VIDEO SPLASH INTRO */}
      {showSplash && (
        <CinematicSplash
          onComplete={handleSplashComplete}
          appName="NeliTv"
        />
      )}

      {/* 2. MOBILE RESPONSE: DEDICATED FULL SINGLE PAGE FOR APK DOWNLOAD */}
      {isMobileLanding && !showSplash ? (
        <div className="flex-1 flex flex-col">
          <MobileApkLandingView
            onContinueInBrowser={() => {
              try { sessionStorage.setItem('nelitv_force_web_mode', 'true'); } catch {}
              setIsMobileLanding(false);
            }}
            onOpenPrivacyPolicy={() => setIsPrivacyModalOpen(true)}
          />
        </div>
      ) : (
        <>
          {/* 3. TV / DESKTOP / PC TOP NAVIGATION */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo(0, 0);
            }}
            onOpenDownloadModal={() => {
              setDownloadModalTab('direct');
              setIsDownloadModalOpen(true);
            }}
          />

          {/* Global Smart TV Dial HUD when typing numbers in Watch page or elsewhere */}
          {globalDialedNumber && activeTab !== 'home' && (
            <div className="fixed top-20 right-4 sm:right-8 z-50 animate-bounce-short pointer-events-none">
              <div className="p-4 rounded-2xl bg-neutral-950/95 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/50 backdrop-blur-md flex items-center gap-3.5 text-white pointer-events-auto">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-cyan-500 p-[1.5px] shadow-md">
                  <div className="w-full h-full rounded-[10px] bg-neutral-950 flex items-center justify-center font-black font-mono text-2xl text-cyan-300">
                    {globalDialedNumber}
                  </div>
                </div>

                <div className="min-w-[150px]">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Tv className="w-3 h-3" />
                    <span>Nambari ya Chaneli</span>
                  </div>
                  <div className="text-sm font-black text-white truncate max-w-[180px]">
                    {globalDialedTarget ? globalDialedTarget.name : `Chaneli #${globalDialedNumber}`}
                  </div>
                  <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                    Bonyeza OK au subiri...
                  </div>
                </div>

                {globalDialedTarget && (
                  <button
                    onClick={() => {
                      if (globalDialTimerRef.current) clearTimeout(globalDialTimerRef.current);
                      handleSelectChannel(globalDialedTarget);
                      setGlobalDialedNumber('');
                      setGlobalDialedTarget(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <span>OK</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. PAGES SWITCHER (TV, PC, Tablets & Desktops) */}
          <main className="flex-1">
            {activeTab === 'home' && (
              <HomePage
                channels={channels}
                onSelectChannel={handleSelectChannel}
                onNavigateToPremium={() => handleNavigateToPremiumWithPlan('plan_7days')}
              />
            )}

            {activeTab === 'watch' && (
              <WatchPage
                currentChannel={selectedChannel}
                channels={channels}
                onBack={() => {
                  setActiveTab('home');
                  window.scrollTo(0, 0);
                }}
                onSelectChannel={handleSelectChannel}
                onNavigateToPremium={handleNavigateToPremiumWithPlan}
                onOpenLoginModal={() => setLoginModalOpen(true)}
                onPaymentInitiated={handlePaymentInitiated}
              />
            )}

            {activeTab === 'search' && (
              <SearchPage
                channels={channels}
                onSelectChannel={handleSelectChannel}
              />
            )}

            {activeTab === 'premium' && (
              <PremiumPage
                initialPlanId={initialPlanForPremium}
                onPaymentInitiated={handlePaymentInitiated}
                onOpenLoginModal={() => setLoginModalOpen(true)}
                onSuccessRedirect={() => {
                  setActiveTab('watch');
                  window.scrollTo(0, 0);
                }}
              />
            )}

            {activeTab === 'verify' && (
              <VerificationPage
                orderId={activePayment?.orderId}
                amount={activePayment?.amount}
                phone={activePayment?.phone}
                planName={activePayment?.planName}
                onSuccessRedirect={() => {
                  setActiveTab('watch');
                  window.scrollTo(0, 0);
                }}
                onRetryPayment={() => setActiveTab('premium')}
              />
            )}

            {activeTab === 'account' && (
              <AccountPage
                onNavigateToPremium={() => handleNavigateToPremiumWithPlan('plan_7days')}
                onOpenLoginModal={() => setLoginModalOpen(true)}
              />
            )}
          </main>

          {/* Floating Download Our App Prompt for Desktop */}
          {showDownloadBanner && !showSplash && activeTab !== 'watch' && (
            <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] rounded-2xl bg-neutral-900/95 border border-cyan-500/30 p-3.5 shadow-2xl backdrop-blur-md animate-fade-in text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-[1.5px] shrink-0 shadow-md shadow-pink-500/20">
                    <div className="w-full h-full rounded-[10px] bg-neutral-950 flex items-center justify-center p-1">
                      <Smartphone className="w-4 h-4 text-cyan-400" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-white tracking-tight">NeliTv App</h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono font-bold">APK</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 truncate">
                      Tazama mechi na TV bila kukwama
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDownloadBanner(false);
                    try { localStorage.setItem('nelitv_hide_app_banner', 'true'); } catch {}
                  }}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg transition"
                  title="Funga"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-neutral-800/80">
                <button
                  onClick={() => {
                    setDownloadModalTab('direct');
                    setIsDownloadModalOpen(true);
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-pink-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pakua APK</span>
                </button>

                <button
                  onClick={() => {
                    setDownloadModalTab('qr');
                    setIsDownloadModalOpen(true);
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 border border-neutral-700"
                >
                  <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Scan QR</span>
                </button>
              </div>
            </div>
          )}

          {/* 6. TV & PC CLEAN FOOTER */}
          <footer className="border-t border-neutral-900 bg-[#070A0F] py-8 px-4 text-center text-xs text-neutral-500 space-y-3">
            <p className="font-bold text-neutral-300 tracking-wide">
              NeliTv © {new Date().getFullYear()} · Tanzania Live TV Streaming
            </p>
            <p className="text-neutral-500 max-w-sm mx-auto text-[11px]">
              Tazama mechi za ligi kuu ya NBC, sinema na vipindi vya moja kwa moja Tanzania kwa ubora wa 4K na HD kwenye TV, PC na Simu.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-neutral-400 pt-1">
              <button
                onClick={() => setIsPrivacyModalOpen(true)}
                className="hover:text-cyan-400 transition underline cursor-pointer"
              >
                Sera ya Faragha (Privacy Policy)
              </button>
              <span>•</span>
              <button
                onClick={() => setIsMobileLanding(true)}
                className="hover:text-cyan-400 transition underline cursor-pointer"
              >
                Pakua NeliTv APK
              </button>
              <span>•</span>
              <a
                href="https://nelitv.xyz"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 transition"
              >
                nelitv.xyz
              </a>
            </div>
          </footer>

          {/* 7. MOBILE BOTTOM NAVIGATION (Quick access on mobile web browsers) */}
          {activeTab !== 'watch' && (
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/95 backdrop-blur-lg border-t border-neutral-800/90 px-2 py-2 flex items-center justify-around safe-area-bottom">
              <button
                onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
                  activeTab === 'home'
                    ? 'text-pink-400 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Tv className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Nyumbani</span>
              </button>

              <button
                onClick={() => { setActiveTab('search'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
                  activeTab === 'search'
                    ? 'text-pink-400 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Search className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Tafuta</span>
              </button>

              <button
                onClick={() => { setActiveTab('premium'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
                  activeTab === 'premium'
                    ? 'text-amber-400 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Crown className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Vifurushi</span>
              </button>

              <button
                onClick={() => { setActiveTab('account'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition ${
                  activeTab === 'account'
                    ? 'text-cyan-400 font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] mt-0.5">Akaunti</span>
              </button>

              <button
                onClick={() => {
                  setDownloadModalTab('direct');
                  setIsDownloadModalOpen(true);
                }}
                className="flex flex-col items-center py-1 px-2.5 rounded-xl text-cyan-400 hover:text-cyan-300 transition"
              >
                <Download className="w-5 h-5 animate-bounce" />
                <span className="text-[10px] mt-0.5 font-bold">Pakua App</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* 8. PRIVACY POLICY MODAL */}
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* 9. DOWNLOAD APP MODAL */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        initialTab={downloadModalTab}
      />

      {/* 10. AUTH LOGIN & REGISTER MODAL */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
