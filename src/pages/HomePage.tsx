import React, { useRef } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Play, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface HomePageProps {
  channels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onNavigateToPremium: () => void;
}

interface ChannelSection {
  title: string;
  subtitle?: string;
  channels: Channel[];
}

export const HomePage: React.FC<HomePageProps> = ({
  channels = CHANNELS_DATA,
  onSelectChannel
}) => {
  // Categorize channels Netflix-style
  const sportsChannels = channels.filter(c => c.category.includes('sport'));
  const moviesChannels = channels.filter(c => c.category.includes('movies') || c.name.toLowerCase().includes('sinema') || c.name.toLowerCase().includes('kix'));
  const entertainmentChannels = channels.filter(c => c.isAzam || c.category.includes('entertainment') || c.category.includes('tanzania') || c.category.includes('music'));
  const newsChannels = channels.filter(c => c.category.includes('news'));
  const kidsChannels = channels.filter(c => c.category.includes('kids'));
  const africaChannels = channels.filter(c => c.category.includes('africa') || c.category.includes('other') || c.category.includes('documentary'));

  const sections: ChannelSection[] = [
    {
      title: "⚽ Mechi za Moja kwa Moja & Ligi Kuu",
      subtitle: "Azam Sports HD, NBC Premier League, na Ligi za Kimataifa",
      channels: sportsChannels
    },
    {
      title: "🎬 Sinema Zetu & Filamu Kali",
      subtitle: "Filamu za Kibongo, tamthilia pendwa na action movies masaa 24",
      channels: moviesChannels
    },
    {
      title: "📺 Burudani za Kitanzania & Tamthilia",
      subtitle: "Vipindi maarufu vya familia, muziki wa Bongo Flava na utamaduni",
      channels: entertainmentChannels
    },
    {
      title: "📰 Habari & Taarifa za Uhakika",
      subtitle: "Matukio ya papo hapo Tanzania na ulimwenguni kote",
      channels: newsChannels
    },
    {
      title: "🧸 Watoto & Katuni za Familia",
      subtitle: "Elimu, burudani na vicheko kwa ajili ya watoto nyumbani",
      channels: kidsChannels
    },
    {
      title: "🌍 Chaneli za Afrika Mashariki na Kusini",
      subtitle: "Matangazo mbalimbali kutoka pande zote za bara la Afrika",
      channels: africaChannels
    }
  ];

  return (
    <div className="min-h-screen pb-16 bg-[#0a0a0a] text-neutral-100 select-none">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-8 pt-6 space-y-10">
        {/* Netflix-style Channel Rows */}
        {sections.map((section, idx) => {
          if (section.channels.length === 0) return null;
          return (
            <ChannelRow
              key={idx}
              title={section.title}
              subtitle={section.subtitle}
              channels={section.channels}
              onSelectChannel={onSelectChannel}
            />
          );
        })}
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

  return (
    <div className="space-y-3 group/row relative">
      {/* Row Header */}
      <div className="flex items-baseline justify-between px-1">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
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
          className="absolute left-0 top-0 bottom-0 z-20 w-10 sm:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity backdrop-blur-sm"
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
              className="flex-none w-[170px] sm:w-[220px] md:w-[250px] group/card cursor-pointer rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800/80 hover:border-red-600/80 transition duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-red-600/10 flex flex-col"
            >
              {/* Poster/Thumbnail container */}
              <div className="aspect-video w-full bg-neutral-950 flex items-center justify-center p-3 relative overflow-hidden">
                {channel.thumbnailUrl ? (
                  <img
                    src={channel.thumbnailUrl}
                    alt={channel.name}
                    className="max-h-16 sm:max-h-20 max-w-full object-contain filter drop-shadow group-hover/card:scale-110 transition duration-300"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-xs font-bold text-neutral-500">{channel.name}</div>
                )}

                {/* Netflix Live Red Badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-600 text-white font-black text-[10px] tracking-wider uppercase shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span>LIVE</span>
                </div>

                {/* Instant Play overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition flex items-center justify-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xl group-hover/card:scale-110 transition">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Card Meta (NO HLS, NO ClearKey) */}
              <div className="p-3 bg-neutral-900/90 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-white group-hover/card:text-red-500 transition truncate mb-0.5">
                    {channel.name}
                  </h3>
                  <p className="text-[11px] text-neutral-400 line-clamp-1">
                    {channel.currentProgram || channel.description || 'Matangazo ya moja kwa moja'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 mt-1 border-t border-neutral-800/60">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-neutral-400" />
                    <span>{channel.viewerCount}</span>
                  </span>
                  <span className="text-[10px] uppercase font-semibold text-neutral-400">
                    {channel.language === 'sw' ? 'Kiswahili' : 'English'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-20 w-10 sm:w-12 bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity backdrop-blur-sm"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
