import React, { useState, useEffect } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { VideoPlayer } from '../components/VideoPlayer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Tv, Eye, Share2, Heart, Check, ArrowLeft, Radio, Globe
} from 'lucide-react';
import { lockLandscapeOrientation, unlockScreenOrientation } from '../utils/orientation.ts';
import { getChannelRouteSlug, getChannelShareUrl } from '../utils/channelRoute.ts';
import { AdBanner } from '../components/AdBanner';
import { InMobiAdSlot } from '../components/InMobiAdSlot.tsx';

interface WatchPageProps {
  currentChannel: Channel;
  channels?: Channel[];
  onBack?: () => void;
  onSelectChannel: (channel: Channel) => void;
  onNavigateToPremium: (planId?: string) => void;
  onOpenLoginModal: () => void;
  onPaymentInitiated?: (orderId: string, amount: number, phone: string, planName: string) => void;
}

function splitTitleWords(title: string) {
  const parts = title.trim().split(/\s+/);
  if (parts.length <= 1) return { lead: '', tail: title };
  return {
    lead: parts.slice(0, -1).join(' '),
    tail: parts[parts.length - 1],
  };
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

  // SEO: Keep original dynamic title & meta format
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

  // Sync URL with currently watched channel
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
        title: `${currentChannel.name} | Watch On NeliTv`,
        text: `Tazama ${currentChannel.name} mubashara kwenye NeliTv! Bonyeza hapa kutazama:`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast(`Link ya ${currentChannel.name} imenakiliwa!`);
    }
  };

  const sideChannels = channels.filter(c => c.id !== currentChannel.id);
  const { lead: titleLead, tail: titleTail } = splitTitleWords(currentChannel.name);

  return (
    <div className={`min-h-screen ${isFullViewport ? 'bg-black' : 'pb-24 md:pb-16 text-slate-100'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 py-2.5 px-4 rounded-xl bg-[#070918]/95 border border-purple-500/40 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
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
              className="py-2 px-4 rounded-xl bg-[#0b0e24]/90 hover:bg-[#14183b] text-slate-200 hover:text-white border border-purple-500/35 hover:border-cyan-400/60 text-xs font-bold flex items-center gap-2 transition active:scale-95 whitespace-nowrap cursor-pointer shadow-sm"
              title="Rudi Nyuma"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Rudi Kwenye Vituo</span>
            </button>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Mubashara Bure · 100% Free TV</span>
            </div>
          </div>
        )}

        <div className={isFullViewport ? 'w-full h-full' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6'}>
          {/* Main Player Column */}
          <div className={isFullViewport ? 'w-full h-full' : 'lg:col-span-8 space-y-4'}>
            {/* InMobi Banner above Player */}
            {!isFullViewport && (
              <AdBanner slotId="inmobi-banner-watch-top" className="my-0 mb-2" />
            )}

            {/* VideoPlayer Frame with Neon Obsidian Border Glow */}
            <div
              className={
                isFullViewport
                  ? 'fixed inset-0 z-30 w-screen h-[100dvh] bg-black flex flex-col overflow-hidden'
                  : 'relative w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-[0_0_45px_rgba(124,58,237,0.22)] border border-purple-500/35'
              }
            >
              <VideoPlayer
                key={currentChannel.id}
                channel={currentChannel}
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

            {/* Channel Detail Panel matching Image 6 obsidian & gold aesthetic */}
            {!isFullViewport && (
              <div className="relative overflow-hidden p-4 sm:p-6 rounded-2xl neli-card-surface border border-purple-500/25 shadow-xl">
                {/* Ambient Left Pink & Right Blue Glow */}
                <div className="pointer-events-none absolute -top-20 -left-16 w-56 h-56 rounded-full bg-[#ff1e8a]/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 -right-16 w-56 h-56 rounded-full bg-[#00d4ff]/12 blur-3xl" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Emblem Poster Card */}
                    <div className="w-16 h-16 sm:w-20 sm:h-16 rounded-xl p-[1.5px] bg-gradient-to-br from-[#ff9d00]/60 via-[#ff1e8a]/60 to-[#00d4ff]/60 shrink-0 shadow-lg">
                      <div className="w-full h-full rounded-[10px] bg-[#04050e] flex items-center justify-center p-2 overflow-hidden">
                        {currentChannel.thumbnailUrl ? (
                          <img
                            src={currentChannel.thumbnailUrl}
                            alt={currentChannel.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-7 h-7 text-slate-500" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">
                        {titleLead && <span className="text-white">{titleLead} </span>}
                        <span className="text-[#ffb020]">{titleTail}</span>
                      </h1>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300 mt-1.5">
                        <span className="inline-flex items-center gap-1.5 font-extrabold text-[#ff3b8d]">
                          <Radio className="w-3.5 h-3.5 animate-pulse" />
                          <span>MUBASHARA</span>
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{currentChannel.viewerCount.toLocaleString()} watazamaji</span>
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <Globe className="w-3.5 h-3.5 text-[#ffb020]" />
                          <span>{currentChannel.language === 'sw' ? 'Kiswahili' : 'English'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Favorite & Share Buttons */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={toggleFavorite}
                      className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 text-xs font-extrabold whitespace-nowrap cursor-pointer active:scale-95 touch-manipulation ${
                        isFavorite
                          ? 'neli-gradient-bg text-white shadow-[0_0_20px_rgba(255,30,138,0.4)]'
                          : 'bg-[#0b0e24]/90 border border-purple-500/35 text-slate-200 hover:border-pink-400/60 hover:text-white'
                      }`}
                      title={isFavorite ? 'Ondoa kwenye vipendwa' : 'Penda chaneli hii'}
                    >
                      <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white text-white' : 'text-pink-400'}`} />
                      <span>{isFavorite ? 'Imependwa' : 'Penda'}</span>
                    </button>

                    <button
                      onClick={handleShare}
                      className="px-4 py-2.5 rounded-xl bg-[#0b0e24]/90 border border-cyan-400/40 text-slate-100 hover:bg-[#131838] hover:border-cyan-400 transition flex items-center gap-2 text-xs font-extrabold whitespace-nowrap cursor-pointer active:scale-95 touch-manipulation"
                      title="Sambaza link ya chaneli"
                    >
                      <Share2 className="w-4 h-4 text-cyan-400" />
                      <span>Sambaza</span>
                    </button>
                  </div>
                </div>

                {currentChannel.description && (
                  <p className="relative z-10 text-xs sm:text-sm text-slate-300/90 mt-4 pt-3.5 border-t border-purple-500/20 leading-relaxed">
                    {currentChannel.description}
                  </p>
                )}
              </div>
            )}

            {/* InMobi Video Ad Placement (10000869534) below Player */}
            {!isFullViewport && (
              <InMobiAdSlot format="video" slotId="inmobi-video-watch-player" className="my-2" />
            )}
          </div>

          {/* Right Column: Other Live Channels Sidepanel */}
          {!isFullViewport && (
            <div className="lg:col-span-4 space-y-4">
              {/* InMobi Banner in Sidebar */}
              <AdBanner slotId="inmobi-banner-watch-sidebar" className="my-0" />

              <div className="p-4 rounded-2xl neli-card-surface border border-purple-500/25 shadow-xl">
                <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-purple-500/20">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ff3b8d] animate-pulse" />
                    <span>Chaneli Nyingine Mubashara</span>
                  </h3>
                  <span className="text-[11px] font-bold text-cyan-400 tabular-nums">
                    {sideChannels.length} Vituo
                  </span>
                </div>

                <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1 scrollbar-none">
                  {sideChannels.map((ch) => {
                    const { lead, tail } = splitTitleWords(ch.name);
                    return (
                      <button
                        key={ch.id}
                        onClick={() => {
                          onSelectChannel(ch);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full p-2.5 rounded-xl bg-[#0b0e24]/75 border border-purple-500/20 hover:border-cyan-400/60 hover:bg-[#131838]/90 text-left transition flex items-center gap-3 group cursor-pointer active:scale-[0.99]"
                      >
                        <div className="w-14 h-10 rounded-lg bg-[#04050d] border border-white/10 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-inner">
                          {ch.thumbnailUrl ? (
                            <img
                              src={ch.thumbnailUrl}
                              alt={ch.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Tv className="w-4 h-4 text-slate-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="font-extrabold text-xs truncate">
                              {lead && <span className="text-white">{lead} </span>}
                              <span className="text-[#ffb020] group-hover:text-cyan-300 transition-colors">
                                {tail}
                              </span>
                            </span>
                            <span className="text-[10px] text-cyan-400/90 shrink-0 tabular-nums font-semibold">
                              {ch.viewerCount}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {ch.currentProgram || ch.description || 'Matangazo ya moja kwa moja'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
