import React, { useState, useEffect, useRef } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, Eye, Flame, Tv, Hash, Check } from 'lucide-react';

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
    c.name.toLowerCase().includes('tiny')
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
    { id: 'all', label: '📺 Vituo Vyote' },
    { id: 'sport', label: '⚽ Michezo' },
    { id: 'movies', label: '🎬 Sinema & Filamu' },
    { id: 'entertainment', label: '📺 Burudani' },
    { id: 'kids', label: '🧸 Watoto' },
    { id: 'news', label: '📰 Habari & Dini' },
    { id: 'africa', label: '🌍 Afrika' },
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
          const next = Math.min(currentDisplayChannels.length - 1, prev + 1);
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
        e.preventDefault();
        setFocusedChannelIndex(prev => {
          const next = Math.min(currentDisplayChannels.length - 1, (prev < 0 ? 0 : prev) + cols);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedChannelIndex(prev => {
          const next = Math.max(0, prev - cols);
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
    <div className="min-h-screen pb-24 bg-[#070A0F] text-neutral-100 select-none">
      {/* SMART TV CHANNEL NUMBER DIAL OSD (On-Screen HUD Popup) */}
      {dialedNumber && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-bounce-short pointer-events-none">
          <div className="p-4 rounded-2xl bg-neutral-950/95 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/50 backdrop-blur-md flex items-center gap-3.5 text-white pointer-events-auto">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-cyan-500 p-[1.5px] shadow-md">
              <div className="w-full h-full rounded-[10px] bg-neutral-950 flex items-center justify-center font-black font-mono text-2xl text-cyan-300">
                {dialedNumber}
              </div>
            </div>

            <div className="min-w-[150px]">
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Tv className="w-3 h-3" />
                <span>Nambari ya Chaneli</span>
              </div>
              <div className="text-sm font-black text-white truncate max-w-[180px]">
                {dialedTargetChannel ? dialedTargetChannel.name : `Chaneli #${dialedNumber} haipatikani`}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
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

      {/* 1. CATEGORY SELECTOR TABS WITH NEON ACCENT */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setFocusedChannelIndex(-1);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-400 text-black font-black shadow-lg shadow-pink-500/25 scale-105'
                  : 'bg-neutral-900/90 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. MAIN CHANNELS CONTENT ORGANIZED WITH GENEROUS SPACING & REMOTE SCROLL */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6 space-y-12">
        {selectedCategory === 'all' ? (
          <>
            {/* Section 1: Live Sports & UEFA (Baynith Sports 1 & 2 first!) */}
            <ChannelGridSection
              title="⚽ Mechi za Moja kwa Moja, Ligi Kuu & UEFA"
              subtitle="Baynith Sports 1 (#1) & Baynith Sports 2 (#2), Azam Sports HD na michuano mikubwa"
              channels={sportsChannels}
              allChannels={channels}
              focusedIndex={focusedChannelIndex}
              startIndex={0}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 2: Movies & Sinema Zetu */}
            <ChannelGridSection
              title="🎬 Sinema Zetu, Hollywood & Filamu Kali"
              subtitle="MBC 2, Sinema Zetu, Movie Box, Sony Movie Action, Ze Cinema"
              channels={moviesChannels}
              allChannels={channels}
              focusedIndex={focusedChannelIndex}
              startIndex={sportsChannels.length}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 3: Kids & Cartoons */}
            <ChannelGridSection
              title="🧸 Watoto, Katuni & Familia"
              subtitle="Tom and Jerry, POP Animation Network, TinyPop na katuni masaa 24"
              channels={kidsChannels}
              allChannels={channels}
              focusedIndex={focusedChannelIndex}
              startIndex={sportsChannels.length + moviesChannels.length}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 4: Entertainment & Music */}
            <ChannelGridSection
              title="📺 Burudani za Kitanzania, Muziki & Comedy"
              subtitle="Wasafi TV, Trace Latina, Comedy Channel, Azam One, Azam Two"
              channels={entertainmentChannels}
              allChannels={channels}
              focusedIndex={focusedChannelIndex}
              startIndex={sportsChannels.length + moviesChannels.length + kidsChannels.length}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 5: News & Religious */}
            <ChannelGridSection
              title="📰 Habari za Ulimwengu & Vipindi vya Dini"
              subtitle="Now Global, Catholic Tv, matangazo ya kimataifa na ibada"
              channels={newsChannels}
              allChannels={channels}
              focusedIndex={focusedChannelIndex}
              startIndex={sportsChannels.length + moviesChannels.length + kidsChannels.length + entertainmentChannels.length}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 6: Africa Channels */}
            {africaChannels.length > 0 && (
              <ChannelGridSection
                title="🌍 Chaneli za Afrika Mashariki na Kusini"
                subtitle="Matangazo mbalimbali kutoka pande zote za bara la Afrika"
                channels={africaChannels}
                allChannels={channels}
                focusedIndex={focusedChannelIndex}
                startIndex={channels.length - africaChannels.length}
                onSelectChannel={onSelectChannel}
              />
            )}
          </>
        ) : (
          <div>
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Flame className="w-5 h-5 text-pink-500" />
                  <span>Chaneli Zilizochaguliwa ({currentDisplayChannels.length})</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Chagua kituo unachotaka au andika nambari ya chaneli kwenye remote / keyboard
                </p>
              </div>
            </div>

            {/* Generous spacing grid for optimal keyboard, mouse & remote scrolling */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-7">
              {currentDisplayChannels.map((channel, idx) => {
                const channelNumber = channels.findIndex(c => c.id === channel.id) + 1;
                return (
                  <ChannelCard
                    key={channel.id}
                    domId={`channel-card-${idx}`}
                    channel={channel}
                    channelNumber={channelNumber}
                    isFocused={focusedChannelIndex === idx}
                    onSelectChannel={onSelectChannel}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ChannelGridSectionProps {
  title: string;
  subtitle?: string;
  channels: Channel[];
  allChannels: Channel[];
  focusedIndex?: number;
  startIndex?: number;
  onSelectChannel: (channel: Channel) => void;
}

const ChannelGridSection: React.FC<ChannelGridSectionProps> = ({
  title,
  subtitle,
  channels,
  allChannels,
  focusedIndex = -1,
  startIndex = 0,
  onSelectChannel
}) => {
  if (channels.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-baseline justify-between border-b border-neutral-900 pb-3">
        <div>
          <h2 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>{title}</span>
          </h2>
          {subtitle && (
            <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="text-[11px] font-mono text-cyan-400 font-semibold">
          {channels.length} {channels.length === 1 ? 'kituo' : 'vituo'}
        </span>
      </div>

      {/* Responsive Grid with Generous Spacing for Keyboard, Mouse & Remote Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-7">
        {channels.map((channel, idx) => {
          const globalIdx = startIndex + idx;
          const channelNumber = allChannels.findIndex(c => c.id === channel.id) + 1;
          return (
            <ChannelCard
              key={channel.id}
              domId={`channel-card-${globalIdx}`}
              channel={channel}
              channelNumber={channelNumber}
              isFocused={focusedIndex === globalIdx}
              onSelectChannel={onSelectChannel}
            />
          );
        })}
      </div>
    </section>
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
  return (
    <div
      id={domId}
      tabIndex={0}
      role="button"
      onClick={() => onSelectChannel(channel)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      className={`group relative rounded-2xl bg-neutral-900/90 border overflow-hidden cursor-pointer transition-all duration-200 transform outline-none hover:-translate-y-1.5 hover:shadow-xl hover:shadow-pink-500/15 focus:scale-105 focus:ring-4 focus:ring-cyan-400 focus:shadow-2xl focus:shadow-cyan-500/50 ${
        isFocused
          ? 'ring-4 ring-pink-500 scale-105 sm:scale-108 border-transparent shadow-2xl shadow-pink-500/50 z-10'
          : 'border-neutral-800 hover:border-pink-500/50'
      }`}
    >
      {/* 16:9 Thumbnail Container */}
      <div className="aspect-video w-full bg-neutral-950 relative overflow-hidden">
        <img
          src={channel.thumbnailUrl}
          alt={channel.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-80" />

        {/* Top Badges: Channel Number Badge (#1, #2) & LIVE Indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-black/85 border border-amber-400/50 text-[10px] sm:text-[11px] font-mono font-black text-amber-300 shadow">
            #{channelNumber}
          </span>
          <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-md bg-gradient-to-r from-pink-600 to-cyan-500 text-white shadow-md shadow-pink-600/30">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>LIVE</span>
          </span>
        </div>

        {/* Viewers Count & HD resolution tag */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-300 font-medium">
          <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
            <Eye className="w-3 h-3 text-cyan-400" />
            <span>{(channel.viewerCount || 650).toLocaleString()}</span>
          </div>

          {channel.isAzam && (
            <span className="text-[9px] font-bold text-amber-300 bg-black/70 border border-amber-500/30 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
              HD 1080p
            </span>
          )}
        </div>

        {/* Hover Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
          <div className="w-11 h-11 rounded-full bg-gradient-to-r from-pink-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-pink-600/40 transform group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info Block */}
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-pink-400 transition line-clamp-1">
            {channel.name}
          </h3>
          <span className="text-[10px] font-mono font-semibold text-neutral-500 shrink-0">
            CH {channelNumber}
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
          {channel.currentProgram || channel.description}
        </p>
      </div>
    </div>
  );
};
