/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { CHANNELS_DATA, Channel } from './data/channels.ts';
import { findChannelFromRoute, getChannelRouteSlug } from './utils/channelRoute.ts';
import { warmLiveCdnToken } from './utils/streamTokens.ts';
import { Navbar } from './components/Navbar.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { WatchPage } from './pages/WatchPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { DmcaPage } from './pages/DmcaPage.tsx';
import { TermsPage } from './pages/TermsPage.tsx';
import { ContactPage } from './pages/ContactPage.tsx';
import { ApiPortalPage } from './pages/ApiPortalPage.tsx';
import { EmbedStudioPage } from './pages/EmbedStudioPage.tsx';
import { EmbedPlayerView } from './components/EmbedPlayerView.tsx';
import { MobileApkLandingView } from './components/MobileApkLandingView.tsx';
import { DownloadAppModal } from './components/DownloadAppModal.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal.tsx';
import { CinematicSplash } from './components/CinematicSplash.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { AdsterraGlobalScripts } from './components/AdsterraAds.tsx';
import { Home, Search, Download, User } from 'lucide-react';

type ActiveRouteTab =
  | 'home'
  | 'watch'
  | 'search'
  | 'account'
  | 'about'
  | 'dmca'
  | 'terms'
  | 'contact'
  | 'api'
  | 'server'
  | 'stream-generator'
  | 'embed'
  | 'download'
  | 'embed-player';

interface RouteResolution {
  tab: ActiveRouteTab;
  channel: Channel | null;
  openPrivacyModal?: boolean;
}

function resolveCurrentRoute(): RouteResolution {
  if (typeof window === 'undefined') {
    return { tab: 'home', channel: null };
  }

  const pathname = window.location.pathname || '/';
  const lowerPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const queryChannel = params.get('ch');
  const queryView = params.get('view');

  // Embed player route: /embed/:channelSlug
  if (lowerPath.startsWith('/embed/')) {
    const slug = pathname.slice('/embed/'.length);
    const ch = findChannelFromRoute(slug, CHANNELS_DATA) || CHANNELS_DATA[0] || null;
    return { tab: 'embed-player', channel: ch };
  }

  // Explicit APK / API / Server view query routes
  if (lowerPath === '/download' || lowerPath === '/apk' || queryView === 'apk') {
    return { tab: 'download', channel: null };
  }
  if (queryView === 'api') return { tab: 'api', channel: null };
  if (queryView === 'stream-generator') return { tab: 'stream-generator', channel: null };
  if (queryView === 'server') return { tab: 'server', channel: null };

  // Static app & legal routes
  if (lowerPath === '/search') return { tab: 'search', channel: null };
  if (lowerPath === '/account') return { tab: 'account', channel: null };
  if (lowerPath === '/about') return { tab: 'about', channel: null };
  if (lowerPath === '/dmca') return { tab: 'dmca', channel: null };
  if (lowerPath === '/terms') return { tab: 'terms', channel: null };
  if (lowerPath === '/contact') return { tab: 'contact', channel: null };
  if (lowerPath === '/api') return { tab: 'api', channel: null };
  if (lowerPath === '/server/stream-generator') return { tab: 'stream-generator', channel: null };
  if (lowerPath === '/server' || lowerPath === '/nelitv-server') return { tab: 'server', channel: null };
  if (lowerPath === '/embed') return { tab: 'embed', channel: null };
  if (lowerPath === '/privacy') return { tab: 'home', channel: null, openPrivacyModal: true };

  // Query param ?ch=slug
  if (queryChannel) {
    const ch = findChannelFromRoute(queryChannel, CHANNELS_DATA);
    if (ch) return { tab: 'watch', channel: ch };
  }

  // Direct channel slug route /:channelSlug
  if (lowerPath !== '/' && lowerPath !== '') {
    const ch = findChannelFromRoute(pathname, CHANNELS_DATA);
    if (ch) return { tab: 'watch', channel: ch };
  }

  return { tab: 'home', channel: null };
}

function MainApp() {
  const { isLoginModalOpen, setLoginModalOpen } = useAuth();

  const initialRoute = resolveCurrentRoute();
  const [activeTab, setActiveTabState] = useState<ActiveRouteTab>(initialRoute.tab);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(initialRoute.channel);
  const [isDownloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);
  const [isPrivacyModalOpen, setPrivacyModalOpen] = useState<boolean>(
    Boolean(initialRoute.openPrivacyModal)
  );
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      if (initialRoute.tab !== 'home') return false;
      return sessionStorage.getItem('nelitv_splash_seen') !== 'true';
    } catch {
      return false;
    }
  });

  const [offlineIds, setOfflineIds] = useState<Set<string>>(() => new Set());
  const [proxyPreferredIds, setProxyPreferredIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    warmLiveCdnToken();
  }, []);

  useEffect(() => {
    let active = true;
    const syncHealth = async () => {
      try {
        const resp = await fetch('/api/channels/health', { cache: 'no-store' });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!active || !data?.success) return;
        if (Array.isArray(data.offlineIds)) {
          setOfflineIds(new Set(data.offlineIds));
        }
        if (Array.isArray(data.proxyPreferredIds)) {
          setProxyPreferredIds(new Set(data.proxyPreferredIds));
        }
      } catch {}
    };
    void syncHealth();
    const timer = setInterval(syncHealth, 120_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const healthyChannels = useMemo<Channel[]>(() => {
    const annotated = CHANNELS_DATA.map((ch) => ({
      ...ch,
      preferProxy: proxyPreferredIds.has(ch.id) || ch.preferProxy,
      isOnline: !offlineIds.has(ch.id)
    }));
    const filtered = annotated.filter((ch) => !offlineIds.has(ch.id));
    return filtered.length > 0 ? filtered : annotated;
  }, [offlineIds, proxyPreferredIds]);

  const resolvedSelectedChannel = useMemo<Channel>(() => {
    const base = selectedChannel || healthyChannels[0] || CHANNELS_DATA[0];
    return {
      ...base,
      preferProxy: proxyPreferredIds.has(base.id) || base.preferProxy,
      isOnline: !offlineIds.has(base.id)
    };
  }, [selectedChannel, healthyChannels, offlineIds, proxyPreferredIds]);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    try {
      sessionStorage.setItem('nelitv_splash_seen', 'true');
    } catch {}
  }, []);

  const navigateToTab = useCallback((nextTab: ActiveRouteTab) => {
    setActiveTabState(nextTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const targetUrl =
        nextTab === 'home'
          ? '/'
          : nextTab === 'stream-generator'
          ? '/server/stream-generator'
          : nextTab === 'watch' && selectedChannel
          ? `/${getChannelRouteSlug(selectedChannel)}`
          : `/${nextTab}`;

      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ tab: nextTab }, '', targetUrl);
      }
    } catch {}
  }, [selectedChannel]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    setActiveTabState('watch');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const slug = getChannelRouteSlug(channel);
      const targetUrl = `/${slug}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ tab: 'watch', channelId: channel.id }, '', targetUrl);
      }
    } catch {}
  }, []);

  // Browser back/forward button support
  useEffect(() => {
    const handlePopState = () => {
      const resolved = resolveCurrentRoute();
      setActiveTabState(resolved.tab);
      setSelectedChannel(resolved.channel);
      if (resolved.openPrivacyModal) {
        setPrivacyModalOpen(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update document title for non-watch tabs
  useEffect(() => {
    if (activeTab === 'watch' && selectedChannel) return;
    if (activeTab === 'download') {
      document.title = 'Pakua NeliTv App & APK (Official Download) — APKPure nelitv.apk.com | NeliTv';
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute(
          'content',
          'Pakua NeliTv App / NeliTv APK toleo jipya kwa Android na Smart TV bure bila matangazo. Inapatikana moja kwa moja hapa au kupitia APKPure (nelitv.apk.com).'
        );
      }
    } else if (activeTab === 'home') {
      document.title = 'NeliTv — Tazama Live TV, Azam Sports, Ligi Kuu & Sinema Bure';
    } else if (activeTab === 'search') {
      document.title = 'Tafuta Chaneli | NeliTv';
    } else if (activeTab === 'about') {
      document.title = 'Kuhusu NeliTv | About Us';
    } else if (activeTab === 'dmca') {
      document.title = 'Sera ya DMCA & Hakimiliki | NeliTv';
    } else if (activeTab === 'terms') {
      document.title = 'Masharti ya Huduma | NeliTv';
    } else if (activeTab === 'contact') {
      document.title = 'Wasiliana Nasi | NeliTv';
    } else if (activeTab === 'account') {
      document.title = 'Akaunti Yangu | NeliTv';
    } else if (activeTab === 'server') {
      document.title = 'NeliTv Server — Live Token & App Sync | NeliTv';
    } else if (activeTab === 'stream-generator') {
      document.title = 'Temporary Stream Generator — NeliTv Server | NeliTv';
    } else if (activeTab === 'api') {
      document.title = 'NeliTv API & SDK | NeliTv';
    }
  }, [activeTab, selectedChannel]);

  // Isolated full-bleed embed player (no nav, no ads)
  if (activeTab === 'embed-player' && selectedChannel) {
    return <EmbedPlayerView channel={selectedChannel} />;
  }

  // Dedicated mobile APK download landing page (/download or /apk)
  if (activeTab === 'download') {
    return (
      <div className="min-h-screen bg-[#050611] text-slate-100">
        <MobileApkLandingView
          onContinueInBrowser={() => navigateToTab('home')}
          onOpenPrivacyPolicy={() => setPrivacyModalOpen(true)}
        />
        <PrivacyPolicyModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setPrivacyModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 selection:bg-[#1ce783] selection:text-[#04120b] flex flex-col">
      <AdsterraGlobalScripts
        enabled={activeTab === 'home' || activeTab === 'watch'}
      />
      {showSplash && <CinematicSplash onComplete={handleSplashComplete} />}

      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => navigateToTab(tab as ActiveRouteTab)}
        onOpenDownloadModal={() => setDownloadModalOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <HomePage
            channels={healthyChannels}
            onSelectChannel={handleSelectChannel}
            onNavigateToPremium={() => navigateToTab('account')}
          />
        )}

        {activeTab === 'watch' && resolvedSelectedChannel && (
          <WatchPage
            currentChannel={resolvedSelectedChannel}
            channels={healthyChannels}
            onBack={() => navigateToTab('home')}
            onSelectChannel={handleSelectChannel}
            onNavigateToPremium={() => navigateToTab('account')}
            onOpenLoginModal={() => setLoginModalOpen(true)}
          />
        )}

        {activeTab === 'search' && (
          <SearchPage
            channels={healthyChannels}
            onSelectChannel={handleSelectChannel}
          />
        )}

        {activeTab === 'account' && (
          <AccountPage
            onNavigateToPremium={() => navigateToTab('home')}
            onOpenLoginModal={() => setLoginModalOpen(true)}
            onNavigateToPage={(page) => {
              if (page === 'privacy') {
                setPrivacyModalOpen(true);
              } else {
                navigateToTab(page);
              }
            }}
          />
        )}

        {activeTab === 'about' && (
          <AboutPage
            onBack={() => navigateToTab('home')}
            onNavigateHome={() => navigateToTab('home')}
          />
        )}

        {activeTab === 'dmca' && (
          <DmcaPage onBack={() => navigateToTab('home')} />
        )}

        {activeTab === 'terms' && (
          <TermsPage onBack={() => navigateToTab('home')} />
        )}

        {activeTab === 'contact' && (
          <ContactPage onBack={() => navigateToTab('home')} />
        )}

        {(activeTab === 'api' || activeTab === 'server' || activeTab === 'stream-generator') && (
          <ApiPortalPage
            initialView={
              activeTab === 'stream-generator'
                ? 'stream-generator'
                : activeTab === 'server'
                ? 'server'
                : 'api'
            }
            onBack={() => navigateToTab('home')}
            onNavigateToEmbed={() => navigateToTab('embed')}
            onChangeRouteTab={(nextTab) => navigateToTab(nextTab)}
          />
        )}

        {activeTab === 'embed' && (
          <EmbedStudioPage
            channels={healthyChannels}
            onBack={() => navigateToTab('home')}
            onNavigateToApi={() => navigateToTab('api')}
          />
        )}
      </main>

      {/* Clean Footer Navigation for Legal, Privacy & Tools */}
      {activeTab !== 'watch' && activeTab !== 'api' && activeTab !== 'server' && activeTab !== 'stream-generator' && activeTab !== 'embed' && (
        <footer className="border-t border-white/[0.08] bg-[#090c11] text-slate-400 pb-24 md:pb-8 pt-7 px-4 sm:px-8">
          <div className="max-w-[1680px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="text-center sm:text-left">
              <span className="font-bold text-white text-sm mr-1.5">
                Neli<span className="text-[#1ce783]">Tv</span>
              </span> · Live TV, Sports &amp; Cinema · Bure 100%
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <button
                onClick={() => navigateToTab('about')}
                className="hover:text-white transition cursor-pointer"
              >
                Kuhusu Sisi
              </button>
              <button
                onClick={() => setPrivacyModalOpen(true)}
                className="hover:text-white transition cursor-pointer"
              >
                Sera ya Faragha
              </button>
              <button
                onClick={() => navigateToTab('terms')}
                className="hover:text-white transition cursor-pointer"
              >
                Masharti
              </button>
              <button
                onClick={() => navigateToTab('dmca')}
                className="hover:text-white transition cursor-pointer"
              >
                DMCA
              </button>
              <button
                onClick={() => navigateToTab('contact')}
                className="hover:text-white transition cursor-pointer"
              >
                Mawasiliano
              </button>
            </nav>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0e14]/95 backdrop-blur-md border-t border-white/[0.08] px-2 py-1.5 flex items-center justify-around"
      >
        <button
          onClick={() => navigateToTab('home')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
            activeTab === 'home' || activeTab === 'watch' ? 'text-white' : 'text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Nyumbani</span>
        </button>

        <button
          onClick={() => navigateToTab('search')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
            activeTab === 'search' ? 'text-white' : 'text-slate-400'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Vituo</span>
        </button>

        <button
          onClick={() => setDownloadModalOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold text-[#1ce783] transition cursor-pointer"
        >
          <Download className="w-5 h-5" />
          <span>Pakua APK</span>
        </button>

        <button
          onClick={() => navigateToTab('account')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
            activeTab === 'account' ? 'text-white' : 'text-slate-400'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Akaunti</span>
        </button>
      </nav>

      {/* Modals & Offline Indicator */}
      <DownloadAppModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />

      <OfflineIndicator />
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
