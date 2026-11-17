import React, { useState, useEffect, useRef } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, Tv, Check } from 'lucide-react';
import { AdBanner } from '../components/AdBanner';
import {
  AdsterraBanner,
  AdsterraGridCard,
  AdsterraNativeBanner,
} from '../components/AdsterraAds.tsx';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';

interface HomePageProps {
  channels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onNavigateToPremium: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  channels = CHANNELS_DATA,
  onSelectChannel,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [focusedChannelIndex, setFocusedChannelIndex] = useState<number>(-1);

  // Smart TV Quick Dial state (0-9 channel number + OK/Enter)
  const [dialedNumber, setDialedNumber] = useState<string>('');
  const [dialedTargetChannel, setDialedTargetChannel] = useState<Channel | null>(null);
  const dialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allChannelsRef = useRef<HTMLDivElement>(null);

  const sportsChannels = channels.filter(c => c.category.includes('sport'));
  const moviesChannels = channels.filter(c =>
    c.category.includes('movies') ||
    c.name.toLowerCase().includes('sinema') ||
    c.name.toLowerCase().includes('kix') ||
    c.name.toLowerCase().includes('movie') ||
    c.name.toLowerCase().includes('cinema') ||
    c.name.toLowerCase().includes('mbc')
  );
  const entertainmentChannels = channels.filter(c =>
    c.isAzam ||
    c.category.includes('entertainment') ||
    c.category.includes('tanzania') ||
    c.category.includes('music') ||
    c.name.toLowerCase().includes('comedy') ||
    c.name.toLowerCase().includes('trace')
  );
  const kidsChannels = channels.filter(c =>
    c.category.includes('kids') ||
    c.name.toLowerCase().includes('tom') ||
    c.name.toLowerCase().includes('pop') ||
    c.name.toLowerCase().includes('tiny') ||
    c.name.toLowerCase().includes('lego') ||
    c.name.toLowerCase().includes('bean')
  );
  const newsChannels = channels.filter(c =>
    c.category.includes('news') ||
    c.name.toLowerCase().includes('global') ||
    c.category.includes('religious') ||
    c.name.toLowerCase().includes('catholic')
  );
  const africaChannels = channels.filter(c =>
    c.category.includes('africa') ||
    c.category.includes('other') ||
    c.category.includes('documentary')
  );

  const categories = [
    { id: 'all', label: 'Vituo Vyote', count: channels.length },
    { id: 'sport', label: 'Michezo', count: sportsChannels.length },
    { id: 'movies', label: 'Sinema', count: moviesChannels.length },
    { id: 'entertainment', label: 'Burudani', count: entertainmentChannels.length },
    { id: 'news', label: 'Habari', count: newsChannels.length },
    { id: 'kids', label: 'Watoto', count: kidsChannels.length },
    { id: 'africa', label: 'Afrika & Safari', count: africaChannels.length },
  ];

  const currentDisplayChannels =
    selectedCategory === 'all'
      ? channels
      : selectedCategory === 'sport'
      ? sportsChannels
      : selectedCategory === 'movies'
      ? moviesChannels
      : selectedCategory === 'entertainment'
      ? entertainmentChannels
      : selectedCategory === 'kids'
      ? kidsChannels
      : selectedCategory === 'news'
      ? newsChannels
      : africaChannels;

  const liveFeaturedRow = channels.slice(0, 6);

  const triggerChannelJump = (channel: Channel) => {
    if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
    setDialedNumber('');
    setDialedTargetChannel(null);
    onSelectChannel(channel);
  };

  // Keyboard & Smart TV Remote navigation (0-9 quick dial + arrows + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const nextDigits = (dialedNumber + e.key).slice(0, 3);
        setDialedNumber(nextDigits);

        const chNum = parseInt(nextDigits, 10);
        const match = channels[chNum - 1] || null;
        setDialedTargetChannel(match);

        if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
        dialTimerRef.current = setTimeout(() => {
          if (match) {
            triggerChannelJump(match);
          } else {
            setDialedNumber('');
            setDialedTargetChannel(null);
          }
        }, 2200);
        return;
      }

      if (e.key === 'Enter') {
        if (dialedNumber && dialedTargetChannel) {
          e.preventDefault();
          triggerChannelJump(dialedTargetChannel);
          return;
        }
        if (focusedChannelIndex >= 0 && focusedChannelIndex < currentDisplayChannels.length) {
          e.preventDefault();
          onSelectChannel(currentDisplayChannels[focusedChannelIndex]);
          return;
        }
      }

      if (e.key === 'Backspace' || e.key === 'Escape') {
        if (dialedNumber) {
          e.preventDefault();
          if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
          const sliced = dialedNumber.slice(0, -1);
          setDialedNumber(sliced);
          if (sliced) {
            const chNum = parseInt(sliced, 10);
            setDialedTargetChannel(channels[chNum - 1] || null);
          } else {
            setDialedTargetChannel(null);
          }
          return;
        }
      }

      const cols =
        window.innerWidth >= 1280 ? 5 : window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = Math.min(currentDisplayChannels.length - 1, (prev < 0 ? 0 : prev) + 1);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = Math.max(0, prev - 1);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowDown') {
        if (focusedChannelIndex < 0) {
          e.preventDefault();
          setFocusedChannelIndex(0);
          scrollToChannelCard(0);
          return;
        }
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = Math.min(currentDisplayChannels.length - 1, prev + cols);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        if (focusedChannelIndex < cols) {
          setFocusedChannelIndex(-1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = prev - cols;
          if (next < 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return -1;
          }
          scrollToChannelCard(next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
    };
  }, [dialedNumber, dialedTargetChannel, focusedChannelIndex, currentDisplayChannels, channels]);

  const scrollToChannelCard = (idx: number) => {
    try {
      const el = document.getElementById(`channel-card-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch {}
  };

  /** Determine where inline ads appear inside the channel grid (e.g. TBC 1 -> Ad -> TBC 2 -> Ad -> Tanzania Safari Channel) */
  const shouldShowInlineAdAfter = (channel: Channel, idx: number): boolean => {
    if (currentDisplayChannels.length <= 4) return false;
    const lower = channel.name.toLowerCase();
    if (lower === 'tbc 1' || lower === 'tbc 2') return true;
    if (idx === 1) return true;
    if (idx > 14 && (idx - 11) % 10 === 0) return true;
    return false;
  };

  return (
    <div className="min-h-screen pb-24 sm:pb-16 bg-[#0b0e14] text-slate-100 touch-pan-y">
      {/* SMART TV CHANNEL NUMBER DIAL OSD */}
      {dialedNumber && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 pointer-events-none">
          <div className="p-3.5 rounded-xl bg-[#141923] border border-white/20 shadow-2xl flex items-center gap-3 text-white pointer-events-auto">
            <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center font-bold font-mono text-xl text-[#1ce783] tabular-nums">
              {dialedNumber}
            </div>

            <div className="min-w-[140px]">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Tv className="w-3.5 h-3.5" />
                <span>Nambari ya Kituo</span>
              </div>
              <div className="text-sm font-bold text-white truncate max-w-[180px]">
                {dialedTargetChannel ? dialedTargetChannel.name : `Kituo #${dialedNumber} hakipatikani`}
              </div>
            </div>

            {dialedTargetChannel && (
              <button
                onClick={() => triggerChannelJump(dialedTargetChannel)}
                className="py-2 px-3 rounded-lg bg-[#1ce783] text-[#04120b] font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <span>OK</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOP RESPONSIVE BANNER (auto-collapses if no-fill) */}
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-4">
        <AdBanner />
      </div>

      {/* CLEAN HULU / DISNEY+ CATEGORY BAR */}
      <section className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-5">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 touch-pan-x">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setFocusedChannelIndex(-1);
                }}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#0b0e14]'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* TRENDING LIVE ROW (Hulu/Disney+ Horizontal Rail, no bloated hero slider) */}
      {selectedCategory === 'all' && liveFeaturedRow.length > 0 && (
        <section className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Mubashara Sasa
            </h2>
            <span className="text-xs text-slate-400">
              Bonyeza kituo kutazama
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {liveFeaturedRow.map((ch, idx) => (
              <ChannelCard
                key={`live-rail-${ch.id}`}
                channel={ch}
                channelNumber={idx + 1}
                onSelectChannel={onSelectChannel}
              />
            ))}
          </div>
        </section>
      )}

      {/* ALL CHANNELS GRID WITH INLINE NATIVE & FEED ADS */}
      <section
        ref={allChannelsRef}
        className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-7"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {selectedCategory === 'all'
              ? 'Vituo Vyote'
              : categories.find(c => c.id === selectedCategory)?.label || 'Vituo'}
            <span className="ml-2 text-xs font-medium text-slate-400 tabular-nums">
              ({currentDisplayChannels.length})
            </span>
          </h1>
        </div>

        {/* Flex layout collapses right skyscraper column cleanly to 0px when no skyscraper ads fill */}
        <div className="flex flex-col xl:flex-row items-start gap-6">
          <div className="flex-1 min-w-0 w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {currentDisplayChannels.map((channel, idx) => {
              const channelNumber = channels.findIndex(c => c.id === channel.id) + 1;
              const isMidFeedNative = idx === 5 && currentDisplayChannels.length > 7;
              const showInlineAd = shouldShowInlineAdAfter(channel, idx);

              return (
                <React.Fragment key={channel.id}>
                  <ChannelCard
                    domId={`channel-card-${idx}`}
                    channel={channel}
                    channelNumber={channelNumber > 0 ? channelNumber : idx + 1}
                    isFocused={focusedChannelIndex === idx}
                    onSelectChannel={onSelectChannel}
                  />

                  {showInlineAd && <AdsterraGridCard />}

                  {isMidFeedNative && (
                    <div className="col-span-full">
                      <AdsterraNativeBanner />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <aside className="hidden xl:flex flex-col items-center gap-4 shrink-0 sticky top-20 empty:hidden">
            <AdsterraBanner variant="160x600" />
            <AdsterraBanner variant="160x300" />
          </aside>
        </div>

        {/* BOTTOM RESPONSIVE BANNER (auto-collapses if no-fill) */}
        <div className="pt-8">
          <AdBanner />
        </div>
      </section>
    </div>
  );
};

interface ChannelCardProps {
  domId?: string;
  channel: Channel;
  channelNumber: number;
  isFocused?: boolean;
  onSelectChannel: (channel: Channel) => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
  domId,
  channel,
  channelNumber,
  isFocused,
  onSelectChannel,
}) => {
  const channelSlug = getChannelRouteSlug(channel);

  return (
    <a
      href={`/${channelSlug}`}
      id={domId}
      tabIndex={0}
      role="button"
      aria-label={`Tazama kituo cha ${channel.name}`}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      className={`group relative block aspect-[16/10] rounded-xl overflow-hidden cursor-pointer transition-transform duration-150 outline-none hover:scale-[1.03] active:scale-[0.98] select-none bg-[#141923] border border-white/[0.08] hover:border-white/30 ${
        isFocused ? 'ring-2 ring-white scale-[1.02] z-10' : ''
      }`}
    >
      {/* Clean Station Crest on Minimal Dark Backdrop */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-4 pb-11 pointer-events-none bg-gradient-to-b from-[#1a2130] to-[#11151f]">
        <img
          src={channel.thumbnailUrl}
          alt={channel.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="max-h-12 sm:max-h-14 max-w-[120px] object-contain"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>

      {/* Clean Bottom Title Bar */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-3 py-2.5 bg-gradient-to-t from-[#090c12] via-[#090c12]/90 to-transparent pointer-events-none">
        <h3 className="font-semibold text-xs sm:text-sm text-white tracking-tight line-clamp-1">
          {channel.name}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1ce783]" />
          <span className="text-slate-300 font-medium">Live</span>
          <span aria-hidden="true">·</span>
          <span>CH {channelNumber}</span>
        </div>
      </div>

      {/* Subtle Play Hover State */}
      <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/35 pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-white text-[#0b0e14] flex items-center justify-center shadow-lg">
          <Play className="w-4 h-4 fill-[#0b0e14] ml-0.5" />
        </div>
      </div>
    </a>
  );
};
