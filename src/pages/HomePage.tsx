import React, { useRef, useState, useEffect } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { MobileAppDownloadHero } from '../components/MobileAppDownloadHero.tsx';

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
      {/* 0. DEDICATED MOBILE APP DOWNLOAD HERO (Mobile Only: Logo juu, Jina chini, Verified tick, Download button) */}
      <MobileAppDownloadHero />

      {/* 1. CATEGORY SELECTOR TABS */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6">
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
