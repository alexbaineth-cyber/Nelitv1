import React, { useState, useEffect } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { VideoPlayer } from '../components/VideoPlayer.tsx';
import { ChannelEPGView } from '../components/ChannelEPGView.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Tv, Eye, Share2, Heart, Check, ArrowLeft, WifiOff, Minimize2, Radio
} from 'lucide-react';
import { lockLandscapeOrientation, unlockScreenOrientation } from '../utils/orientation.ts';
import { getChannelRouteSlug, getChannelShareUrl } from '../utils/channelRoute.ts';
import { useServiceWorkerOnline } from '../hooks/useServiceWorkerOnline.ts';

interface WatchPageProps {
  currentChannel: Channel;
  channels?: Channel[];
  onBack?: () => void;
  onSelectChannel: (channel: Channel) => void;
  onNavigateToPremium: (planId?: string) => void;
  onOpenLoginModal: () => void;
  onPaymentInitiated?: (orderId: string, amount: number, phone: string, planName: string) => void;
}

export const WatchPage: React.FC<WatchPageProps> = ({
  currentChannel,
  channels = CHANNELS_DATA,
  onBack,
  onSelectChannel,
  onNavigateToPremium,
  onOpenLoginModal,
  onPaymentInitiated
}) => {
  const { hasActiveSubscription, trialRemainingSeconds } = useAuth();
  const { isOffline } = useServiceWorkerOnline();

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nelitv_favorites') || localStorage.getItem('yourmaxtv_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWatchPageFullPage, setIsWatchPageFullPage] = useState<boolean>(false);

  const isFavorite = favorites.includes(currentChannel.id);
  const isEmbedded = currentChannel.streamFormat === 'embed' || Boolean(currentChannel.embedUrl);
  const isFullViewport = isEmbedded || isWatchPageFullPage;
  const isPaidChannel = Boolean(currentChannel.requiredPackages?.includes('PAID') || currentChannel.isAzam || currentChannel.requiredPackages?.length);
  const showTrialBadge = !hasActiveSubscription && !isPaidChannel;

  // Force landscape viewing for full-screen / full-page channels on mobile / webview
  useEffect(() => {
    if (isFullViewport) {
      lockLandscapeOrientation();
      return () => {
        unlockScreenOrientation();
      };
    }
  }, [isFullViewport]);

  const toggleFavorite = () => {
    let updated: string[];
    if (isFavorite) {
      updated = favorites.filter(id => id !== currentChannel.id);
      showToast('Imeondolewa kwenye vipendwa');
    } else {
      updated = [...favorites, currentChannel.id];
      showToast('Imeongezwa kwenye vipendwa ❤️');
    }
    setFavorites(updated);
    try {
      localStorage.setItem('nelitv_favorites', JSON.stringify(updated));
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Keep URL in sync with currently watched channel (e.g. appurl/azam-one or channel-id)
  useEffect(() => {
    try {
      const slug = getChannelRouteSlug(currentChannel);
      const targetPath = `/${slug}`;
      if (window.location.pathname !== targetPath) {
        window.history.replaceState({ channelId: currentChannel.id, slug }, '', targetPath);
      }
    } catch {}
  }, [currentChannel]);

  const handleShare = () => {
    const shareUrl = getChannelShareUrl(currentChannel);
    if (navigator.share) {
      navigator.share({
        title: `${currentChannel.name} - NeliTv`,
        text: `Tazama ${currentChannel.name} mubashara kwenye NeliTv! Bonyeza hapa kutazama:`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast(`Link ya ${currentChannel.name} imenakiliwa!`);
    }
  };

  const formatSeconds = (sec: number) => {
    const s = Math.max(0, sec);
    const mins = Math.floor(s / 60);
    const remainingSecs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Other channels list (for non-embedded standard sidepanel view)
  const sideChannels = channels.filter(c => c.id !== currentChannel.id);

  // SINGLE UNIFIED RENDER:
  // VideoPlayer remains permanently mounted across fullscreen toggles!
  // Toggling fullscreen or pressing 'F' does NOT destroy the stream, restart playback, or cause buffering!
  return (
    <div className={`min-h-screen ${isFullViewport ? 'bg-black' : 'pb-20 bg-[#070A14] text-neutral-100'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 py-2.5 px-4 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Top Control Overlay when in Fullscreen Viewport Mode */}
      {isFullViewport && !isEmbedded && (
        <div className="fixed top-0 inset-x-0 z-40 p-2.5 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none">
          <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
            <button
              onClick={() => {
                if (isWatchPageFullPage && !isEmbedded) {
                  setIsWatchPageFullPage(false);
                } else if (onBack) {
                  onBack();
                } else if (window.history.length > 1) {
                  window.history.back();
                }
              }}
              className="py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl bg-black/80 hover:bg-blue-600 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 sm:gap-2 transition shadow-2xl border border-white/20 cursor-pointer backdrop-blur-md"
              title={isWatchPageFullPage && !isEmbedded ? "Punguza Skrini" : "Rudi kwenye vituo vyote"}
            >
              {isWatchPageFullPage && !isEmbedded ? (
                <>
                  <Minimize2 className="w-4 h-4 text-cyan-400" />
                  <span>Punguza Skrini</span>
                </>
              ) : (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  <span>Rudi Nyuma</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg">
              <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-amber-400 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-xs sm:text-sm font-black tracking-tight text-white truncate max-w-[140px] sm:max-w-xs">
                {currentChannel.name}
              </span>
              {isOffline ? (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1">
                  <WifiOff className="w-3 h-3 text-amber-400" />
                  <span>OFFLINE</span>
                </span>
              ) : (
                <span className="text-[10px] bg-red-600/90 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider hidden sm:inline">
                  LIVE
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {showTrialBadge && (
              <div className="px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-amber-500/50 text-[11px] font-semibold text-neutral-100 flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 font-mono font-black">{formatSeconds(trialRemainingSeconds)}</span>
              </div>
            )}

            <button
              onClick={toggleFavorite}
              className={`p-2 rounded-xl backdrop-blur-md border transition text-xs font-semibold ${
                isFavorite
                  ? 'bg-blue-600/40 border-blue-500 text-blue-400'
                  : 'bg-black/70 border-white/15 text-neutral-300 hover:text-white'
              }`}
              title={isFavorite ? 'Ondoa kwenye vipendwa' : 'Penda chaneli hii'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-neutral-300 hover:text-white transition text-xs font-semibold"
              title="Sambaza link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Embedded & Standard layout container */}
      <div className={isFullViewport ? 'w-screen h-[100dvh] overflow-hidden' : 'max-w-[1600px] mx-auto px-3 sm:px-6 pt-3 sm:pt-4'}>
        <div className={isFullViewport ? 'w-full h-full' : 'grid grid-cols-1 lg:grid-cols-12 gap-5'}>
          {/* Main Player Column */}
          <div className={isFullViewport ? 'w-full h-full' : 'lg:col-span-8 space-y-4'}>
            {/* The VideoPlayer wrapper: persistent DOM node to avoid reload on fullscreen toggle */}
            <div
              className={
                isFullViewport
                  ? 'fixed inset-0 z-30 w-screen h-[100dvh] bg-black flex flex-col overflow-hidden'
                  : 'relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10'
              }
            >
              <VideoPlayer
                key={currentChannel.id}
                channel={currentChannel}
                isFullPage={isFullViewport}
                onBack={() => {
                  if (isWatchPageFullPage && !isEmbedded) {
                    setIsWatchPageFullPage(false);
                  } else if (onBack) {
                    onBack();
                  }
                }}
                onToggleFullscreen={(fs) => setIsWatchPageFullPage(fs)}
                onSelectPlanClick={onNavigateToPremium}
                onOpenLoginModal={onOpenLoginModal}
                onPaymentInitiated={onPaymentInitiated}
              />
            </div>

            {/* Below Player (Visible only in Normal non-fullscreen view) */}
            {!isFullViewport && (
              <div className="space-y-4">
                {/* Channel Details Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0B1020] via-slate-900/60 to-[#070A14] border border-white/10 shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-10 sm:w-14 sm:h-12 rounded-xl bg-black/60 border border-white/15 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
                        {currentChannel.thumbnailUrl ? (
                          <img
                            src={currentChannel.thumbnailUrl}
                            alt={currentChannel.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-6 h-6 text-neutral-600" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                            {currentChannel.name}
                          </h1>
                          <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-sm shrink-0">
                            <Radio className="w-2.5 h-2.5" />
                            <span>LIVE</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{currentChannel.viewerCount} watazamaji</span>
                          </span>
                          <span>•</span>
                          <span className="text-neutral-300">
                            {currentChannel.language === 'sw' ? 'Kiswahili' : 'English'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Like & Share Action Buttons (Duplicate fullscreen button removed) */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={toggleFavorite}
                        className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 ${
                          isFavorite
                            ? 'bg-blue-600/30 border-blue-500 text-blue-400'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
                        }`}
                        title={isFavorite ? 'Ondoa kwenye vipendwa' : 'Penda chaneli hii'}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current text-blue-400' : ''}`} />
                        <span className="hidden sm:inline">{isFavorite ? 'Imependwa' : 'Penda'}</span>
                      </button>

                      <button
                        onClick={handleShare}
                        className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                        title="Sambaza link ya chaneli"
                      >
                        <Share2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Sambaza</span>
                      </button>
                    </div>
                  </div>

                  {currentChannel.description && (
                    <p className="text-xs text-neutral-400 mt-3 pt-3 border-t border-white/10 leading-relaxed">
                      {currentChannel.description}
                    </p>
                  )}
                </div>

                {/* EPG Electronic Program Guide Section Below Player */}
                <ChannelEPGView
                  channelId={currentChannel.id}
                  channelName={currentChannel.name}
                  variant="inline"
                />
              </div>
            )}
          </div>

          {/* Right Column: Other Side Channels (Visible in Normal non-fullscreen view) */}
          {!isFullViewport && (
            <div className="lg:col-span-4">
              <div className="p-4 rounded-2xl bg-[#0B1020]/90 border border-white/10 shadow-xl">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                    <Tv className="w-4 h-4 text-blue-500" />
                    <span>Chaneli Nyingine Mubashara</span>
                  </h3>
                  <span className="text-[11px] font-mono text-cyan-400">
                    {sideChannels.length} Vituo
                  </span>
                </div>

                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
                  {sideChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        onSelectChannel(ch);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-blue-500/60 hover:bg-white/[0.07] text-left transition flex items-center gap-3 group cursor-pointer active:scale-98"
                    >
                      <div className="w-12 h-10 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-inner">
                        {ch.thumbnailUrl ? (
                          <img
                            src={ch.thumbnailUrl}
                            alt={ch.name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-4 h-4 text-neutral-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="font-bold text-xs text-white group-hover:text-cyan-400 transition truncate">
                            {ch.name}
                          </span>
                          <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                            {ch.viewerCount}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-400 truncate">
                          {ch.description || 'Matangazo ya moja kwa moja'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
