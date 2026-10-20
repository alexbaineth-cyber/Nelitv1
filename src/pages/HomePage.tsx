import React, { useState, useEffect } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, Eye, Sparkles, Tv, Flame } from 'lucide-react';

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
    <div className="min-h-screen pb-24 bg-[#070A0F] text-neutral-100 select-none">
      {/* 1. CATEGORY SELECTOR TABS WITH NEON GRADIENT ACCENT */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
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

      {/* 2. MAIN CHANNELS CONTENT ORGANIZED IN VERTICAL RESPONSIVE GRIDS */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6 space-y-12">
        {selectedCategory === 'all' ? (
          <>
            {/* Section 1: Live Sports & Azam Sports (Vertical Grid) */}
            <ChannelGridSection
              title="⚽ Mechi za Moja kwa Moja & Ligi Kuu"
              subtitle="Azam Sports HD, NBC Premier League, na Ligi za Kimataifa"
              channels={sportsChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 2: Movies & Sinema Zetu (Vertical Grid) */}
            <ChannelGridSection
              title="🎬 Sinema Zetu & Filamu Kali"
              subtitle="Filamu za Kibongo, tamthilia pendwa na action movies masaa 24"
              channels={moviesChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 3: Entertainment & Tanzania Local (Vertical Grid) */}
            <ChannelGridSection
              title="📺 Burudani za Kitanzania & Tamthilia"
              subtitle="Vipindi maarufu vya familia, muziki wa Bongo Flava na utamaduni"
              channels={entertainmentChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 4: News & Information (Vertical Grid) */}
            <ChannelGridSection
              title="📰 Habari & Taarifa za Uhakika"
              subtitle="Matukio ya papo hapo Tanzania na ulimwenguni kote"
              channels={newsChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 5: Kids & Cartoons (Vertical Grid) */}
            <ChannelGridSection
              title="🧸 Watoto & Katuni za Familia"
              subtitle="Elimu, burudani na vicheko kwa ajili ya watoto nyumbani"
              channels={kidsChannels}
              onSelectChannel={onSelectChannel}
            />

            {/* Section 6: Africa Channels (Vertical Grid) */}
            <ChannelGridSection
              title="🌍 Chaneli za Afrika Mashariki na Kusini"
              subtitle="Matangazo mbalimbali kutoka pande zote za bara la Afrika"
              channels={africaChannels}
              onSelectChannel={onSelectChannel}
            />
          </>
        ) : (
          <div>
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Flame className="w-5 h-5 text-pink-500" />
                  <span>Chaneli Zilizochaguliwa ({filteredChannels.length})</span>
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Chagua kituo unachotaka kuanza kutazama sasa
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-5">
              {filteredChannels.map((channel, idx) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isFocused={focusedChannelIndex === idx}
                  onSelectChannel={onSelectChannel}
                />
              ))}
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
  onSelectChannel: (channel: Channel) => void;
}

const ChannelGridSection: React.FC<ChannelGridSectionProps> = ({
  title,
  subtitle,
  channels,
  onSelectChannel
}) => {
  if (channels.length === 0) return null;

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-baseline justify-between border-b border-neutral-900 pb-2.5">
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

      {/* Pure Vertical Grid (No horizontal overflow slider) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4.5">
        {channels.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onSelectChannel={onSelectChannel}
          />
        ))}
      </div>
    </section>
  );
};

interface ChannelCardProps {
  channel: Channel;
  isFocused?: boolean;
  onSelectChannel: (channel: Channel) => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isFocused,
  onSelectChannel
}) => {
  return (
    <div
      onClick={() => onSelectChannel(channel)}
      className={`group relative rounded-2xl bg-neutral-900/90 border overflow-hidden cursor-pointer transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-xl hover:shadow-pink-500/15 ${
        isFocused
          ? 'ring-4 ring-pink-500 scale-105 border-transparent shadow-2xl shadow-pink-500/40'
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

        {/* Live Neon Badge */}
        <div className="absolute top-2 left-2">
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
      <div className="p-3">
        <h3 className="font-bold text-xs sm:text-sm text-white group-hover:text-pink-400 transition line-clamp-1">
          {channel.name}
        </h3>
        <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
          {channel.currentProgram || channel.description}
        </p>
      </div>
    </div>
  );
};
