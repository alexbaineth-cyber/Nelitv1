import React, { useRef, useState, useEffect } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, ChevronLeft, ChevronRight, Eye, Radio, Sparkles, Tv, ShieldCheck } from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton.tsx';

interface HomePageProps {
  channels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onNavigateToPremium: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  channels = CHANNELS_DATA,
  onSelectChannel,
  onNavigateToPremium
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [focusedChannelIndex, setFocusedChannelIndex] = useState<number>(-1);

  // Featured channel for grand TV & PC Hero Banner
  const featuredChannel = channels.find(c => c.name.includes('Azam Sports 1')) || channels[0];

  // Categorize channels
  const sportsChannels = channels.filter(c => c.category.includes('sport'));
  const moviesChannels = channels.filter(c => c.category.includes('movies') || c.name.toLowerCase().includes('sinema') || c.name.toLowerCase().includes('kix'));
  const entertainmentChannels = channels.filter(c => c.isAzam || c.category.includes('entertainment') || c.category.includes('tanzania') || c.category.includes('music'));
  const newsChannels = channels.filter(c => c.category.includes('news'));
  const kidsChannels = channels.filter(c => c.category.includes('kids'));
  const africaChannels = channels.filter(c => c.category.includes('africa') || c.category.includes('other') || c.category.includes('documentary'));

  const categories = [
    { id: 'all', label: 'Vituo Vyote' },
    { id: 'sport', label: '⚽ Michezo' },
    { id: 'movies', label: '🎬 Sinema & Filamu' },
    { id: 'entertainment', label: '📺 Burudani' },
    { id: 'news', label: '📰 Habari' },
    { id: 'kids', label: '🧸 Watoto' },
  ];

  const filteredChannels = selectedCategory === 'all'
    ? channels
    : channels.filter(c => c.category.includes(selectedCategory) || (selectedCategory === 'movies' && c.name.toLowerCase().includes('sinema')));

  // Smart TV Remote & Keyboard D-pad navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hijacking input fields
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedChannelIndex(prev => Math.min(filteredChannels.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedChannelIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter' && focusedChannelIndex >= 0 && focusedChannelIndex < filteredChannels.length) {
        e.preventDefault();
        onSelectChannel(filteredChannels[focusedChannelIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedChannelIndex, filteredChannels, onSelectChannel]);

  return (
    <div className="min-h-screen pb-20 bg-[#080808] text-neutral-100 select-none">
      {/* 1. CINEMATIC HERO BANNER FOR TV & PC */}
      {featuredChannel && (
        <div className="relative w-full h-[52vh] sm:h-[62vh] lg:h-[72vh] overflow-hidden bg-neutral-950">
          {/* Background backdrop with rich gradient overlays */}
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-1000 blur-[1px]"
            style={{
              backgroundImage: `url(${featuredChannel.thumbnailUrl || 'https://i.ibb.co/B29Xvb5P/azam-sport-1-01.png'})`
            }}
          />
          {/* Multi-layered cinematic shadows for TV contrast */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent w-full lg:w-3/4" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-black/60" />

          {/* Hero Content Information */}
          <div className="relative z-10 h-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 flex flex-col justify-end pb-10 sm:pb-16 max-w-2xl lg:max-w-3xl space-y-3 sm:space-y-4">
            {/* Live TV Badge */}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-[11px] font-black uppercase tracking-wider animate-pulse">
                <Radio className="w-3 h-3" />
                <span>MOJA KWA MOJA</span>
              </span>
              <span className="text-xs font-semibold text-neutral-300">
                NBC Premier League & Live Sports
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight leading-none drop-shadow-md">
              {featuredChannel.name}
            </h1>

            {/* Description / Current Program */}
            <p className="text-xs sm:text-sm lg:text-base text-neutral-300 line-clamp-2 sm:line-clamp-3 leading-relaxed">
              {featuredChannel.currentProgram || featuredChannel.description}
            </p>

            {/* Call to Action Buttons for TV Remote / Mouse */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onSelectChannel(featuredChannel)}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm sm:text-base flex items-center gap-2.5 shadow-xl shadow-red-600/30 transition focus:ring-4 focus:ring-white"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>Tazama Sasa</span>
              </button>

              <button
                onClick={onNavigateToPremium}
                className="px-5 py-3 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 active:scale-95 text-neutral-200 font-bold text-sm sm:text-base flex items-center gap-2 backdrop-blur-md transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Vifurushi vya 1,000 Tsh</span>
              </button>

              <PWAInstallButton variant="hero" className="hidden sm:flex" />
            </div>
          </div>
        </div>
      )}

      {/* 2. PWA & TV BANNER */}
      <PWAInstallButton variant="banner" />

      {/* 3. CATEGORY SELECTOR TABS (FOR TV & DESKTOP) */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-8">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-white text-black shadow-lg scale-105'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. MAIN CHANNELS CONTENT */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6 space-y-10">
        {selectedCategory === 'all' ? (
          <>
            {/* Row 1: Live Sports & Azam Sports */}
            <ChannelRow
              title="⚽ Mechi za Moja kwa Moja & Ligi Kuu"
              subtitle="Azam Sports HD, NBC Premier League, na Ligi za Kimataifa"
              channels={sportsChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Row 2: Movies & Sinema Zetu */}
            <ChannelRow
              title="🎬 Sinema Zetu & Filamu Kali"
              subtitle="Filamu za Kibongo, tamthilia pendwa na action movies masaa 24"
              channels={moviesChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Row 3: Entertainment & Tanzania Local */}
            <ChannelRow
              title="📺 Burudani za Kitanzania & Tamthilia"
              subtitle="Vipindi maarufu vya familia, muziki wa Bongo Flava na utamaduni"
              channels={entertainmentChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Row 4: News & Information */}
            <ChannelRow
              title="📰 Habari & Taarifa za Uhakika"
              subtitle="Matukio ya papo hapo Tanzania na ulimwenguni kote"
              channels={newsChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Row 5: Kids & Cartoons */}
            <ChannelRow
              title="🧸 Watoto & Katuni za Familia"
              subtitle="Elimu, burudani na vicheko kwa ajili ya watoto nyumbani"
              channels={kidsChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Row 6: Africa Channels */}
            <ChannelRow
              title="🌍 Chaneli za Afrika Mashariki na Kusini"
              subtitle="Matangazo mbalimbali kutoka pande zote za bara la Afrika"
              channels={africaChannels}
              onSelectChannel={onSelectChannel}
            />
          </>
        ) : (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              Chaneli Zinazopatikana ({filteredChannels.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredChannels.map((channel, idx) => (
                <div
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`group relative rounded-2xl bg-neutral-900 border overflow-hidden cursor-pointer transition-all transform hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-red-950/40 ${
                    focusedChannelIndex === idx
                      ? 'ring-4 ring-red-500 scale-105 border-transparent'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="aspect-video w-full bg-neutral-950 relative overflow-hidden">
                    <img
                      src={channel.thumbnailUrl}
                      alt={channel.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                        LIVE
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-neutral-300 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                        <Eye className="w-3 h-3 text-red-500" />
                        <span>{channel.viewerCount || 500}+</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-xs sm:text-sm text-white line-clamp-1 group-hover:text-red-400 transition">
                      {channel.name}
                    </h3>
                    <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                      {channel.currentProgram || channel.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface ChannelRowProps {
  title: string;
  subtitle?: string;
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
}

const ChannelRow: React.FC<ChannelRowProps> = ({
  title,
  subtitle,
  channels,
  onSelectChannel
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (channels.length === 0) return null;

  return (
    <div className="space-y-3 group/row relative">
      {/* Row Header */}
      <div className="flex items-baseline justify-between px-1">
        <div>
          <h2 className="text-base sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{title}</span>
          </h2>
          {subtitle && (
            <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Row Horizontal Slider with Arrows */}
      <div className="relative">
        {/* Left Arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-20 w-10 sm:w-12 bg-black/80 hover:bg-black text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity backdrop-blur-sm"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto scrollbar-none scroll-smooth pb-2 pt-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {channels.map((channel) => (
            <div
              key={channel.id}
              onClick={() => onSelectChannel(channel)}
              className="w-48 sm:w-60 md:w-64 lg:w-72 shrink-0 group/card relative rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 overflow-hidden cursor-pointer transition-all transform hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-red-950/40"
            >
              {/* Thumbnail Container */}
              <div className="aspect-video w-full bg-neutral-950 relative overflow-hidden">
                <img
                  src={channel.thumbnailUrl}
                  alt={channel.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent opacity-80" />

                {/* Live Badge */}
                <div className="absolute top-2 left-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white shadow">
                    LIVE
                  </span>
                </div>

                {/* Viewers Count */}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] text-neutral-300 font-medium">
                  <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
                    <Eye className="w-3 h-3 text-red-500" />
                    <span>{(channel.viewerCount || 500).toLocaleString()}</span>
                  </div>
                  {channel.isAzam && (
                    <span className="text-[10px] font-semibold text-neutral-400 bg-black/60 px-1.5 py-0.5 rounded">
                      HD 1080p
                    </span>
                  )}
                </div>

                {/* Play Button Overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                  <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform group-hover/card:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Info Block */}
              <div className="p-3">
                <h3 className="font-bold text-xs sm:text-sm text-white group-hover/card:text-red-400 transition line-clamp-1">
                  {channel.name}
                </h3>
                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                  {channel.currentProgram || channel.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-20 w-10 sm:w-12 bg-black/80 hover:bg-black text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
