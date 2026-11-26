import React, { useState, useEffect } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { VideoPlayer } from '../components/VideoPlayer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Tv, Eye, Share2, Heart, Check, ArrowLeft, Globe, Copy
} from 'lucide-react';
import { lockLandscapeOrientation, unlockScreenOrientation } from '../utils/orientation.ts';
import { getChannelRouteSlug, getChannelShareUrl } from '../utils/channelRoute.ts';
import { AdBanner } from '../components/AdBanner';
import { AdsterraBanner, ADSTERRA_SMART_LINK } from '../components/AdsterraAds.tsx';

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
  useAuth();

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
  const isFullViewport = isWatchPageFullPage;

  useEffect(() => {
    document.title = `${currentChannel.name} | Watch On NeliTv`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        `Tazama ${currentChannel.name} mubashara bure mtandaoni kwenye NeliTv. NBC Premier League, Azam TV live stream na burudani 24/7.`
      );
    }
  }, [currentChannel]);

  useEffect(() => {
    if (isFullViewport) {
      lockLandscapeOrientation();
      return () => {
        unlockScreenOrientation();
      };
    }
  }, [isFullViewport]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const toggleFavorite = () => {
    let updated: string[];
    if (isFavorite) {
      updated = favorites.filter(id => id !== currentChannel.id);
      showToast('Imeondolewa kwenye vipendwa');
    } else {
      updated = [...favorites, currentChannel.id];
      showToast('Imeongezwa kwenye vipendwa');
    }
    setFavorites(updated);
    try {
      localStorage.setItem('nelitv_favorites', JSON.stringify(updated));
    } catch {}
  };

  useEffect(() => {
    try {
      const slug = getChannelRouteSlug(currentChannel);
      const targetPath = `/${slug}`;
      if (window.location.pathname !== targetPath) {
        window.history.replaceState({ channelId: currentChannel.id, slug }, '', targetPath);
      }
    } catch {}
  }, [currentChannel]);

  const handleCopyChannelLink = () => {
    const shareUrl = getChannelShareUrl(currentChannel);
    if (navigator.share) {
      navigator.share({
        title: `${currentChannel.name} | Watch On NeliTv`,
        text: `Tazama ${currentChannel.name} mubashara kwenye NeliTv!`,
        url: shareUrl
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      showToast(`Link ya ${currentChannel.name} imenakiliwa!`);
    }
  };

  const handleSmartShare = () => {
    const shareUrl = getChannelShareUrl(currentChannel);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    showToast(`Link ya ${currentChannel.name} imenakiliwa!`);
  };

  const sideChannels = channels.filter(c => c.id !== currentChannel.id);

  return (
    <div className={`min-h-screen ${isFullViewport ? 'bg-black' : 'bg-[#0b0e14] pb-24 md:pb-16 text-slate-100'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 py-2.5 px-4 rounded-xl bg-[#141923] border border-white/15 text-white text-xs font-semibold shadow-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-[#1ce783]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className={isFullViewport ? 'w-screen h-[100dvh] overflow-hidden' : 'max-w-[1600px] mx-auto px-3 sm:px-6 pt-3 sm:pt-5'}>
        {/* Top Action Header */}
        {!isFullViewport && (
          <div className="flex items-center justify-between pb-3 mb-2">
            <button
              onClick={() => {
                if (onBack) {
                  onBack();
                } else if (window.history.length > 1) {
                  window.history.back();
                }
              }}
              className="py-2 px-3.5 rounded-lg bg-[#141923] hover:bg-[#1c2331] text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
              title="Rudi Nyuma"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Rudi Kwenye Vituo</span>
            </button>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="w-2 h-2 rounded-full bg-[#1ce783] animate-live-dot" />
              <span>Mubashara · Bure 100%</span>
            </div>
          </div>
        )}

        <div className={isFullViewport ? 'w-full h-full' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6'}>
          {/* Main Player Column */}
          <div className={isFullViewport ? 'w-full h-full' : 'lg:col-span-8 space-y-4'}>
            {/* VideoPlayer Frame immediately at top — zero ad pushing player down */}
            <div
              className={
                isFullViewport
                  ? 'fixed inset-0 z-30 w-screen h-[100dvh] bg-black flex flex-col overflow-hidden'
                  : 'relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-lg'
              }
            >
              <VideoPlayer
                key={currentChannel.id}
                channel={currentChannel}
                fallbackChannel={sideChannels[0]}
                onSwitchChannel={onSelectChannel}
                isFullPage={isFullViewport}
                onBack={() => {
                  if (isWatchPageFullPage) {
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

            {/* Clean Hulu/Disney+ Channel Detail Bar */}
            {!isFullViewport && (
              <div className="p-4 sm:p-5 rounded-xl bg-[#141923] border border-white/[0.08]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-12 rounded-lg bg-[#0b0e14] border border-white/10 shrink-0 flex items-center justify-center p-1.5 overflow-hidden">
                      {currentChannel.thumbnailUrl ? (
                        <img
                          src={currentChannel.thumbnailUrl}
                          alt={currentChannel.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Tv className="w-6 h-6 text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                        {currentChannel.name}
                      </h1>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 mt-1">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#1ce783]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1ce783]" />
                          <span>MUBASHARA</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Eye className="w-3.5 h-3.5" />
                          <span>{currentChannel.viewerCount.toLocaleString()}</span>
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5" />
                          <span>{currentChannel.language === 'sw' ? 'Kiswahili' : 'English'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Favorite & Share Buttons (Smart Link powered Share) */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={toggleFavorite}
                      className={`px-3.5 py-2 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                        isFavorite
                          ? 'bg-white text-[#0b0e14]'
                          : 'bg-white/[0.07] hover:bg-white/[0.13] border border-white/10 text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#0b0e14]' : ''}`} />
                      <span>{isFavorite ? 'Imependwa' : 'Penda'}</span>
                    </button>

                    <a
                      href={ADSTERRA_SMART_LINK}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleSmartShare}
                      className="px-3.5 py-2 rounded-lg bg-[#0072d2] hover:bg-[#0082ee] text-white transition flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
                      title="Sambaza link ya chaneli"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Sambaza</span>
                    </a>

                    <button
                      onClick={handleCopyChannelLink}
                      className="p-2 rounded-lg bg-white/[0.07] hover:bg-white/[0.13] border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Nakili URL ya chaneli"
                      aria-label="Nakili URL ya chaneli"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {currentChannel.description && (
                  <p className="text-xs sm:text-sm text-slate-400 mt-3.5 pt-3 border-t border-white/[0.08] leading-relaxed">
                    {currentChannel.description}
                  </p>
                )}
              </div>
            )}

            {/* Single Compact Banner BELOW Video Player & Details (auto-hides if no-fill) */}
            {!isFullViewport && <AdBanner mode="compact" />}
          </div>

          {/* Right Column: Live Channels List first + single 300x250 cleanly below */}
          {!isFullViewport && (
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 rounded-xl bg-[#141923] border border-white/[0.08]">
                <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/[0.08]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Chaneli Nyingine
                  </h3>
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums">
                    {sideChannels.length} Vituo
                  </span>
                </div>

                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 scrollbar-none">
                  {sideChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        onSelectChannel(ch);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="w-full p-2.5 rounded-lg bg-[#0b0e14]/70 hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/20 text-left transition flex items-center gap-3 group cursor-pointer"
                    >
                      <div className="w-12 h-9 rounded-md bg-[#0b0e14] border border-white/10 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                        {ch.thumbnailUrl ? (
                          <img
                            src={ch.thumbnailUrl}
                            alt={ch.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-4 h-4 text-slate-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-white truncate">
                            {ch.name}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                            {ch.viewerCount}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {ch.currentProgram || ch.description || 'Matangazo ya moja kwa moja'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <AdsterraBanner variant="300x250" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
