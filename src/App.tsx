/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Channel, CHANNELS_DATA } from './data/channels.ts';
import { Navbar } from './components/Navbar.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { WatchPage } from './pages/WatchPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { PremiumPage } from './pages/PremiumPage.tsx';
import { VerificationPage } from './pages/VerificationPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { Download, X } from 'lucide-react';

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

  // PWA install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState<boolean>(false);

  // First-time user popup: if not logged in, trigger login modal
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('yourmaxtv_welcome_seen');
    if (!isLoggedIn && !hasSeenWelcome) {
      const timer = setTimeout(() => {
        setLoginModalOpen(true);
        localStorage.setItem('yourmaxtv_welcome_seen', 'true');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, setLoginModalOpen]);

  // Anti-inspection and stream protection (disable right-click & F12 devtools shortcuts)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent F12
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      // Prevent Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'I', 'J', 'C'].includes(e.key)) {
        e.preventDefault();
        return;
      }
      // Prevent Ctrl+U (view source)
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

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

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

  // When a channel is selected
  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);

    // If user is not logged in, prompt login first
    if (!isLoggedIn) {
      setPendingChannelToPlay(channel);
      setLoginModalOpen(true);
      return;
    }

    setActiveTab('watch');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToPremiumWithPlan = (planId?: string) => {
    if (planId) {
      setInitialPlanForPremium(planId);
    }
    setActiveTab('premium');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* PWA In-App Install Banner for Desktop & Mobile */}
      {showInstallBanner && (
        <div className="bg-red-600/90 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-semibold shadow-lg backdrop-blur-sm z-40">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 shrink-0" />
            <span>Weka Your Max TV kama Programu kwenye simu au kompyuta yako kwa urahisi</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallPwa}
              className="px-3 py-1 bg-white text-black font-bold rounded-lg hover:bg-neutral-200 transition"
            >
              Weka Programu
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-1 hover:bg-red-700 rounded-md transition"
              aria-label="Funga"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pages Switcher */}
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
              window.scrollTo({ top: 0, behavior: 'smooth' });
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
              window.scrollTo({ top: 0, behavior: 'smooth' });
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

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
        title="Ingia au Jisajili"
        subtitle="Weka namba yako ya simu ya Tanzania (mfano: 0712345678) ili kuanza majaribio ya bure ya dakika 1 au kufungua kifurushi chako."
      />

      {/* Clean Footer (NO Azam TV text, NO ClearKey text, NO HarakaPay text) */}
      <footer className="border-t border-neutral-900 bg-black py-8 px-4 text-center text-xs text-neutral-500 space-y-2">
        <p className="font-bold text-neutral-300 tracking-wide">
          Your Max TV © {new Date().getFullYear()} · Tanzania Live TV Streaming
        </p>
        <p className="text-neutral-500 max-w-sm mx-auto">
          Tazama mechi za ligi kuu, sinema na vipindi vya moja kwa moja Tanzania kwa ubora wa juu popote ulipo.
        </p>
      </footer>
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
