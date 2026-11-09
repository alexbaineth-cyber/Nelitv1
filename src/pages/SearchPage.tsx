import React, { useState, useMemo } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Search, X, Tv, Eye, ShieldCheck, Play, Radio, Filter } from 'lucide-react';
import { AdBanner } from '../components/AdBanner';

interface SearchPageProps {
  channels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  channels = CHANNELS_DATA,
  onSelectChannel
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'Zote' },
    { id: 'azam', label: 'Azam TV' },
    { id: 'sport', label: 'Michezo' },
    { id: 'movies', label: 'Sinema' },
    { id: 'news', label: 'Habari' },
    { id: 'kids', label: 'Watoto' },
    { id: 'music', label: 'Muziki' },
    { id: 'africa', label: 'Afrika' }
  ];

  const filteredChannels = useMemo(() => {
    return channels.filter(ch => {
      const q = searchTerm.toLowerCase().trim();
      const matchesText =
        !q ||
        ch.name.toLowerCase().includes(q) ||
        ch.description.toLowerCase().includes(q) ||
        (ch.currentProgram && ch.currentProgram.toLowerCase().includes(q));

      if (!matchesText) return false;

      // Category match
      if (selectedCategory === 'azam') {
        if (!ch.isAzam && !ch.name.toLowerCase().includes('azam')) return false;
      } else if (selectedCategory !== 'all') {
        if (!ch.category.includes(selectedCategory)) return false;
      }

      // Language match
      if (selectedLanguage !== 'all') {
        if (ch.language !== selectedLanguage) return false;
      }

      return true;
    });
  }, [searchTerm, selectedCategory, selectedLanguage]);

  return (
    <div className="min-h-screen pb-24 md:pb-16 text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1">
            Tafuta Chaneli au Kipindi
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            Tafuta kati ya chaneli zote {CHANNELS_DATA.length} za Azam TV, michezo, na sinema za Tanzania
          </p>
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Andika jina la chaneli (mfano: Azam Sports, Sinema Zetu, Wasafi, ZBC, TNT...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="w-full pl-12 pr-10 py-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm sm:text-base transition shadow-lg"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap font-semibold transition ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-md'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Language toggle */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setSelectedLanguage('all')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                selectedLanguage === 'all' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Lugha Zote
            </button>
            <button
              onClick={() => setSelectedLanguage('sw')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                selectedLanguage === 'sw' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Kiswahili
            </button>
            <button
              onClick={() => setSelectedLanguage('en')}
              className={`px-2.5 py-1 rounded-lg transition font-medium ${
                selectedLanguage === 'en' ? 'bg-amber-500 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Kiingereza
            </button>
          </div>
        </div>

        {/* In-page Automatic Ad Unit */}
        <AdBanner className="my-2" />

        {/* Results Counter */}
        <div className="text-xs text-neutral-400 font-medium">
          Zimepatikana chaneli <strong className="text-amber-400">{filteredChannels.length}</strong>
        </div>

        {/* Results Grid */}
        {filteredChannels.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900/40 rounded-3xl border border-neutral-800/80">
            <Tv className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Hakuna chaneli iliyopatikana</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Jaribu kuandika neno tofauti au badilisha kichujio cha makundi hapo juu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 lg:gap-7">
            {filteredChannels.map(channel => (
              <div
                key={channel.id}
                onClick={() => onSelectChannel(channel)}
                className="group relative flex flex-col rounded-2xl bg-[#0c1120] border border-white/10 hover:border-cyan-400/50 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10 hover:-translate-y-1.5 focus:scale-[1.03]"
              >
                {/* Media Canvas with Compact Logo */}
                <div className="aspect-[16/10] sm:aspect-video w-full bg-gradient-to-br from-[#12192e] via-[#0d1424] to-[#070b16] relative flex items-center justify-center p-4 sm:p-5 overflow-hidden border-b border-white/5">
                  <div className="absolute inset-0 bg-radial from-cyan-500/10 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="w-16 h-12 sm:w-20 sm:h-14 flex items-center justify-center z-10 transition-transform duration-300 group-hover:scale-105">
                    {channel.thumbnailUrl ? (
                      <img
                        src={channel.thumbnailUrl}
                        alt={channel.name}
                        className="max-h-10 sm:max-h-12 max-w-[100px] sm:max-w-[110px] object-contain filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Radio className="w-7 h-7 text-neutral-600" />
                    )}
                  </div>

                  <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-600/90 backdrop-blur-md text-white shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>LIVE</span>
                  </div>

                  {channel.isAzam && (
                    <div className="absolute top-2.5 left-2.5 z-20">
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
                        AZAM HD
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 z-20 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-400/50 transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 sm:p-4 bg-[#0a0f1d] flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-cyan-400 transition truncate mb-1">
                      {channel.name}
                    </h4>
                    <p className="text-[11px] text-neutral-400 line-clamp-1 mb-2">
                      {channel.currentProgram || channel.description || 'Matangazo ya moja kwa moja'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-cyan-400/80" />
                      {(channel.viewerCount || 650).toLocaleString()}
                    </span>

                    <span className="text-[10px] uppercase font-semibold text-neutral-400">
                      {channel.language === 'sw' ? 'Kiswahili' : 'English'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom In-page Automatic Ad Unit */}
        <div className="pt-4">
          <AdBanner className="my-2" />
        </div>
      </div>
    </div>
  );
};
