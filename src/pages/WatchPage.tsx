import React, { useState, useEffect } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { VideoPlayer } from '../components/VideoPlayer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Tv, Eye, Share2, Heart, Check, Radio
} from 'lucide-react';

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
  const { phone } = useAuth();

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('yourmaxtv_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isFavorite = favorites.includes(currentChannel.id);

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
      localStorage.setItem('yourmaxtv_favorites', JSON.stringify(updated));
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShare = () => {
    const shareUrl = window.location.origin;
    if (navigator.share) {
      navigator.share({
        title: `${currentChannel.name} - Your Max TV`,
        text: `Tazama ${currentChannel.name} mubashara kwenye Your Max TV!`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareUrl}`);
      showToast('Link ya chaneli imenakiliwa!');
    }
  };

  // Other channels list (Azam & Sports first)
  const sideChannels = channels.filter(c => c.id !== currentChannel.id);

  return (
    <div className="min-h-screen pb-16 bg-[#0a0a0a] text-neutral-100 select-none">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 right-4 z-50 py-2.5 px-4 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 2-Column Watch Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Player & Channel Header (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-4">
            {/* The Video Player with key to guarantee clean re-mount when switching channel */}
            <VideoPlayer
              key={currentChannel.id}
              channel={currentChannel}
              onBack={onBack}
              onSelectPlanClick={onNavigateToPremium}
              onOpenLoginModal={onOpenLoginModal}
              onPaymentInitiated={onPaymentInitiated}
            />

            {/* Clean Channel Info Bar (NO ClearKey text, NO HLS text, NO EPG schedule) */}
            <div className="p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center p-1.5 shrink-0">
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
                    <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                      {currentChannel.name}
                    </h1>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{currentChannel.viewerCount} watazamaji</span>
                      </span>
                      <span>•</span>
                      <span className="text-neutral-300">
                        {currentChannel.language === 'sw' ? 'Kiswahili' : 'English'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Working Like & Share Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={toggleFavorite}
                    className={`p-2.5 rounded-xl border transition flex items-center gap-1.5 text-xs font-semibold ${
                      isFavorite
                        ? 'bg-red-600/20 border-red-500 text-red-500'
                        : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
                    }`}
                    title={isFavorite ? 'Ondoa kwenye vipendwa' : 'Penda chaneli hii'}
                  >
                    <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                    <span className="hidden sm:inline">{isFavorite ? 'Imependwa' : 'Penda'}</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="p-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
                    title="Sambaza link ya chaneli"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Sambaza</span>
                  </button>
                </div>
              </div>

              {currentChannel.description && (
                <p className="text-xs text-neutral-400 mt-3 pt-3 border-t border-neutral-800/80 leading-relaxed">
                  {currentChannel.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Column: Other Side Channels (4 cols on lg) */}
          <div className="lg:col-span-4">
            <div className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Tv className="w-4 h-4 text-red-600" />
                <span>Chaneli Nyingine za Azam TV & Live</span>
              </h3>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
                {sideChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      onSelectChannel(ch);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80 hover:border-red-600/60 hover:bg-neutral-800/60 text-left transition flex items-center gap-3 group cursor-pointer"
                  >
                    <div className="w-12 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center p-1 shrink-0 overflow-hidden">
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
                        <span className="font-semibold text-xs text-white group-hover:text-red-500 transition truncate">
                          {ch.name}
                        </span>
                        <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
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
        </div>
      </div>
    </div>
  );
};
