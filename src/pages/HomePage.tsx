import React, { useState, useEffect, useRef } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, Eye, Tv, Check, Radio, Sparkles, Volume2 } from 'lucide-react';
import { AdBanner, ADS_ENABLED } from '../components/AdBanner';
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

  // TV Quick Dial state: typing channel number (e.g. 1, 2, 10) + OK / Enter
  const [dialedNumber, setDialedNumber] = useState<string>('');
  const [dialedTargetChannel, setDialedTargetChannel] = useState<Channel | null>(null);
  const dialTimerRef = useRef<any>(null);

  // Categorize channels once
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
    { id: 'all', label: 'Vituo Vyote' },
    { id: 'sport', label: 'Michezo (Sports)' },
    { id: 'movies', label: 'Sinema Zetu & Filamu' },
    { id: 'entertainment', label: 'Burudani' },
    { id: 'news', label: 'Habari & Taarifa' },
    { id: 'kids', label: 'Watoto' },
    { id: 'africa', label: 'Utamaduni & Safari' },
  ];

  const currentDisplayChannels = selectedCategory === 'all'
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

  // Featured channel (Azam Sports 1 HD or first channel)
  const featuredChannel = channels[0] || null;

  // Jump to dialed channel
  const triggerChannelJump = (channel: Channel) => {
    if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
    setDialedNumber('');
    setDialedTargetChannel(null);
    onSelectChannel(channel);
  };

  // Keyboard, Smart TV Remote (0-9 Dialing, D-pad & OK/Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside a form input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // 1. Number Dialing (0-9) for Smart TV Remote and Keyboard
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const nextDigits = (dialedNumber + e.key).slice(0, 3);
        setDialedNumber(nextDigits);

        const chNum = parseInt(nextDigits, 10);
        const match = channels[chNum - 1] || null;
        setDialedTargetChannel(match);

        // Reset 2-second auto-jump timer
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

      // 2. OK / Enter Key
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

      // 3. Clear dialing with Backspace or Escape
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

      // 4. Remote & Keyboard D-pad navigation (Up, Down, Left, Right)
      const cols = window.innerWidth >= 1280 ? 5 : window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedChannelIndex(prev => {
          const next = Math.min(currentDisplayChannels.length - 1, (prev < 0 ? 0 : prev) + 1);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedChannelIndex(prev => {
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
        setFocusedChannelIndex(prev => {
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
        setFocusedChannelIndex(prev => {
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

  return (
    <div className="min-h-screen pb-32 sm:pb-28 bg-[#060913] text-neutral-100 touch-pan-y selection:bg-cyan-500 selection:text-black">
      {/* SMART TV CHANNEL NUMBER DIAL OSD */}
      {dialedNumber && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-fade-in pointer-events-none">
          <div className="p-4 rounded-2xl bg-[#0B1020]/95 border-2 border-cyan-500 shadow-2xl shadow-cyan-500/30 backdrop-blur-md flex items-center gap-3.5 text-white pointer-events-auto">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-400 p-1 flex items-center justify-center font-black font-mono text-2xl text-cyan-300">
              {dialedNumber}
            </div>

            <div className="min-w-[150px]">
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Tv className="w-3 h-3" />
                <span>Nambari ya Kituo</span>
              </div>
              <div className="text-sm font-black text-white truncate max-w-[180px]">
                {dialedTargetChannel ? dialedTargetChannel.name : `Kituo #${dialedNumber} hakipatikani`}
              </div>
              <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                Bonyeza OK au subiri...
              </div>
            </div>

            {dialedTargetChannel && (
              <button
                onClick={() => triggerChannelJump(dialedTargetChannel)}
                className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
              >
                <span>OK</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* TOP TV SPOTLIGHT HERO (Azam Sports 1 HD / Live Sports Spotlight) */}
      {featuredChannel && selectedCategory === 'all' && (
        <div className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-4 sm:pt-6">
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-r from-[#0d1428] via-[#091022] to-[#060913] border border-white/10 p-5 sm:p-8 lg:p-10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 group">
            {/* Subtle atmospheric background glow */}
            <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full bg-red-600 text-white shadow-md shadow-red-600/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>INAYOTANGAZWA SASA</span>
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-md">
                  CH #1
                </span>
                <span className="text-xs text-neutral-400">·</span>
                <span className="text-xs text-neutral-300 font-medium">Bure 100% Moja kwa Moja</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                {featuredChannel.name}
              </h1>

              <p className="text-sm sm:text-base text-neutral-300 mt-2 font-normal line-clamp-2 max-w-xl">
                {featuredChannel.currentProgram || featuredChannel.description}
              </p>

              <div className="flex items-center gap-3.5 mt-5">
                <button
                  onClick={() => onSelectChannel(featuredChannel)}
                  className="py-3 px-6 rounded-xl bg-white hover:bg-neutral-100 text-black font-extrabold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-white/10 hover:shadow-cyan-400/20 transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
                  <span>Tazama Moja kwa Moja</span>
                </button>

                <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-300 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span>{(featuredChannel.viewerCount || 1420).toLocaleString()} watazamaji</span>
                </div>
              </div>
            </div>

            {/* Centered TV Logo Spotlight Badge */}
            <div className="relative z-10 flex items-center justify-center self-center md:self-auto">
              <div className="w-28 h-20 sm:w-36 sm:h-24 rounded-2xl bg-black/60 border border-white/15 backdrop-blur-md p-3.5 flex items-center justify-center shadow-2xl transition-transform duration-300 group-hover:scale-105">
                <img
                  src={featuredChannel.thumbnailUrl}
                  alt={featuredChannel.name}
                  className="max-h-12 sm:max-h-16 max-w-full object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. CATEGORY SELECTOR TABS (Spacious TV Rails) */}
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8">
        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none pb-2 pt-1 touch-pan-x">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setFocusedChannelIndex(-1);
                }}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 font-bold shadow-lg shadow-white/10 border border-white'
                    : 'bg-[#0d1326] text-neutral-300 hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. AD BANNER (JUU YA CHANNELS) */}
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-4">
        <AdBanner />
      </div>

      {/* 3. MAIN CHANNELS GRID (Spacious TV Tile Architecture) */}
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Tv className="w-5 h-5 text-cyan-400" />
              <span>
                {selectedCategory === 'all'
                  ? `Vituo Vyote vya NeliTv (${channels.length})`
                  : `${categories.find(c => c.id === selectedCategory)?.label || 'Vituo'} (${currentDisplayChannels.length})`}
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Tumia remote au keyboard kubonyeza nambari ya kituo (#1, #2, nk.) au bonyeza kituo kutazama.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-300 bg-[#0d1326] px-3.5 py-2 rounded-xl border border-white/10 self-start sm:self-auto shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">{currentDisplayChannels.length} Vituo Moja kwa Moja</span>
          </div>
        </div>

        {/* Spacious Grid of Channel Cards (TV App Layout) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 lg:gap-7">
          {currentDisplayChannels.map((channel, idx) => {
            const channelNumber = channels.findIndex(c => c.id === channel.id) + 1;
            const isMidpoint = idx === 5 && currentDisplayChannels.length > 6;
            return (
              <React.Fragment key={channel.id}>
                <ChannelCard
                  domId={`channel-card-${idx}`}
                  channel={channel}
                  channelNumber={channelNumber > 0 ? channelNumber : idx + 1}
                  isFocused={focusedChannelIndex === idx}
                  onSelectChannel={onSelectChannel}
                />
                {isMidpoint && (
                  <div className="col-span-full py-4">
                    <AdBanner />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* 4. AD BANNER (CHINI YA CHANNELS) */}
        <div className="pt-10 pb-4">
          <AdBanner />
        </div>
      </div>
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
  onSelectChannel
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
        // Prevent full page reload unless cmd/ctrl clicked
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
      className={`group relative flex flex-col rounded-2xl bg-[#0c1120] border overflow-hidden cursor-pointer transition-all duration-300 outline-none hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-cyan-500/10 focus:scale-[1.03] touch-manipulation select-none active:scale-95 ${
        isFocused
          ? 'ring-4 ring-cyan-400 scale-[1.03] border-cyan-400 shadow-2xl shadow-cyan-500/30 z-10'
          : 'border-white/10 hover:border-cyan-400/50'
      }`}
    >
      {/* 1. Media Canvas (TV Tile with Compact, Perfectly Centered Logo) */}
      <div className="aspect-[16/10] sm:aspect-video w-full bg-gradient-to-br from-[#12192e] via-[#0d1424] to-[#070b16] relative flex items-center justify-center p-4 sm:p-5 overflow-hidden border-b border-white/5 pointer-events-none">
        {/* Subtle radial ambient glow behind logo */}
        <div className="absolute inset-0 bg-radial from-cyan-500/10 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

        {/* Top Badges: Channel Number Badge (#1, #2) */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] font-mono font-bold text-neutral-300 group-hover:text-cyan-300 transition-colors shadow-sm">
            #{channelNumber}
          </span>
        </div>

        {/* Top Right: LIVE Indicator */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-600/90 backdrop-blur-md text-white shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>LIVE</span>
        </div>

        {/* Centered Channel Logo (Clean, Compact, Well-Proportioned — NOT oversized) */}
        <div className="w-16 h-12 sm:w-20 sm:h-14 flex items-center justify-center z-10 transition-transform duration-300 group-hover:scale-105">
          <img
            src={channel.thumbnailUrl}
            alt={channel.name}
            className="max-h-10 sm:max-h-12 max-w-[100px] sm:max-w-[120px] object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Play Icon Hover Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[1px]">
          <div className="w-11 h-11 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-400/50 transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
          </div>
        </div>
      </div>

      {/* 2. Info Block (Crisp TV Typography & Metadata) */}
      <div className="p-3.5 sm:p-4 bg-[#0a0f1d] flex-1 flex flex-col justify-between pointer-events-none">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-cyan-400 transition-colors line-clamp-1 tracking-tight">
              {channel.name}
            </h3>
            {channel.isAzam && (
              <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 rounded shrink-0">
                HD
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-400 line-clamp-1 mt-1 font-normal">
            {channel.currentProgram || channel.description || 'Matangazo ya moja kwa moja'}
          </p>
        </div>

        {/* Card Footer Metadata */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5 text-[10px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-cyan-400/80" />
            <span>{(channel.viewerCount || 650).toLocaleString()} watazamaji</span>
          </div>
          <span className="font-mono text-neutral-400 text-[10px]">CH {channelNumber}</span>
        </div>
      </div>
    </a>
  );
};
