import React, { useState, useEffect, useRef } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, Tv, Check } from 'lucide-react';
import { AdBanner } from '../components/AdBanner';
import { AdsterraNativeBanner } from '../components/AdsterraAds.tsx';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';
import { prewarmChannelConnection } from '../utils/streamTokens.ts';

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

  /** Group channels cleanly into non-overlapping sections for "Vituo Vyote" */
  const channelGroups = React.useMemo(() => {
    if (selectedCategory !== 'all') {
      if (currentDisplayChannels.length <= 8) {
        return [
          {
            id: selectedCategory,
            title: categories.find((c) => c.id === selectedCategory)?.label || 'Vituo',
            items: currentDisplayChannels,
          },
        ];
      }
      const chunks: { id: string; title: string; items: Channel[] }[] = [];
      const baseTitle = categories.find((c) => c.id === selectedCategory)?.label || 'Vituo';
      for (let i = 0; i < currentDisplayChannels.length; i += 8) {
        chunks.push({
          id: `${selectedCategory}-${i}`,
          title: i === 0 ? baseTitle : `${baseTitle} — Sehemu ya ${Math.floor(i / 8) + 1}`,
          items: currentDisplayChannels.slice(i, i + 8),
        });
      }
      return chunks;
    }

    const assignedIds = new Set<string>();
    const take = (predicate: (c: Channel) => boolean) => {
      const list = channels.filter((c) => !assignedIds.has(c.id) && predicate(c));
      list.forEach((c) => assignedIds.add(c.id));
      return list;
    };

    const tanzaniaGroup = take(
      (c) =>
        (c.category.includes('tanzania') && !c.category.includes('sport')) ||
        c.name.toLowerCase().includes('azam one') ||
        c.name.toLowerCase().includes('azam two') ||
        c.name.toLowerCase().includes('sinema zetu')
    );
    const sportsGroup = take((c) => c.category.includes('sport') || c.category.includes('sports'));
    const moviesGroup = take(
      (c) =>
        c.category.includes('movies') ||
        c.category.includes('comedy') ||
        c.name.toLowerCase().includes('movie') ||
        c.name.toLowerCase().includes('cinema')
    );
    const kidsGroup = take((c) => c.category.includes('kids'));
    const newsAfricaMusicGroup = take(() => true);

    return [
      { id: 'tanzania', title: 'Tanzania & Burudani', items: tanzaniaGroup },
      { id: 'sports', title: 'Michezo Mubashara', items: sportsGroup },
      { id: 'movies', title: 'Sinema & Tamthilia', items: moviesGroup },
      { id: 'kids', title: 'Watoto & Katuni', items: kidsGroup },
      { id: 'africa-news', title: 'Habari, Muziki & Afrika', items: newsAfricaMusicGroup },
    ].filter((g) => g.items.length > 0);
  }, [channels, currentDisplayChannels, selectedCategory, categories]);

  const orderedDisplayedChannels = React.useMemo(
    () => channelGroups.flatMap((g) => g.items),
    [channelGroups]
  );

  const focusedTargetChannel =
    focusedChannelIndex >= 0 && focusedChannelIndex < orderedDisplayedChannels.length
      ? orderedDisplayedChannels[focusedChannelIndex]
      : null;

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
        if (focusedChannelIndex >= 0 && focusedChannelIndex < orderedDisplayedChannels.length) {
          e.preventDefault();
          onSelectChannel(orderedDisplayedChannels[focusedChannelIndex]);
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
          const next = Math.min(orderedDisplayedChannels.length - 1, (prev < 0 ? 0 : prev) + 1);
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
          const next = Math.min(orderedDisplayedChannels.length - 1, prev + cols);
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
  }, [dialedNumber, dialedTargetChannel, focusedChannelIndex, orderedDisplayedChannels, channels]);

  const scrollToChannelCard = (idx: number) => {
    try {
      const el = document.getElementById(`channel-card-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch {}
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

      {/* SLIM TOP RESPONSIVE BANNER (auto-collapses if no-fill) */}
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-3">
        <AdBanner mode="compact" />
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

      {/* TRENDING LIVE ROW (Hulu/Disney+ Horizontal Rail) */}
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

      {/* NATIVE 4:1 BANNER DIRECTLY ABOVE ALL CHANNELS ("JUU YA VITUO VYOTE") */}
      <section className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-6">
        <AdsterraNativeBanner mode="dom" />
      </section>

      {/* GROUPED CHANNELS SEPARATED BY NATIVE 4:1 BANNERS */}
      <section
        ref={allChannelsRef}
        className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-5"
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

        <div className="w-full space-y-8">
          {(() => {
            let runningFlatIdx = 0;
            return channelGroups.map((group, groupIdx) => (
              <React.Fragment key={group.id}>
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-2">
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      {group.title}
                    </h2>
                    <span className="text-xs text-slate-400 tabular-nums">
                      Vituo {group.items.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
                    {group.items.map((channel) => {
                      const flatIdx = runningFlatIdx++;
                      const channelNumber = channels.findIndex(c => c.id === channel.id) + 1;
                      const isFocused = focusedTargetChannel?.id === channel.id;

                      return (
                        <ChannelCard
                          key={channel.id}
                          domId={`channel-card-${flatIdx}`}
                          channel={channel}
                          channelNumber={channelNumber > 0 ? channelNumber : flatIdx + 1}
                          isFocused={isFocused}
                          onSelectChannel={onSelectChannel}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Single clean mid-page Native 4:1 divider after group 2 */}
                {groupIdx === 1 && groupIdx < channelGroups.length - 1 && (
                  <div className="pt-1">
                    <AdsterraNativeBanner mode="iframe" />
                  </div>
                )}
              </React.Fragment>
            ));
          })()}
        </div>

        {/* SLIM BOTTOM RESPONSIVE BANNER (auto-collapses if no-fill) */}
        <div className="pt-8">
          <AdBanner mode="compact" />
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
      onMouseEnter={() => prewarmChannelConnection(channel)}
      onFocus={() => prewarmChannelConnection(channel)}
      onTouchStart={() => prewarmChannelConnection(channel)}
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
