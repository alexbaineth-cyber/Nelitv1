import React, { useState, useMemo } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Search, X, Tv, Eye, ShieldCheck, Play, Radio, Filter } from 'lucide-react';

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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredChannels.map(channel => (
              <div
                key={channel.id}
                onClick={() => onSelectChannel(channel)}
                className="group relative rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-amber-500/60 overflow-hidden cursor-pointer transition duration-300 hover:shadow-xl hover:shadow-amber-500/5 hover:-translate-y-0.5 flex flex-col"
              >
                {/* Thumbnail */}
                <div className="aspect-video w-full bg-neutral-950 relative flex items-center justify-center p-3 overflow-hidden">
                  {channel.thumbnailUrl ? (
                    <img
                      src={channel.thumbnailUrl}
                      alt={channel.name}
                      className="max-h-16 max-w-full object-contain filter drop-shadow group-hover:scale-105 transition duration-300"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Radio className="w-8 h-8 text-neutral-700" />
                  )}

                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-live-dot" />
                    <span className="text-[10px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                      LIVE
                    </span>
                  </div>

                  {channel.isAzam && (
                    <div className="absolute top-2 right-2">
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-500 text-white shadow-sm">
                        AZAM
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-md">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-amber-400 transition truncate mb-1">
                      {channel.name}
                    </h4>
                    <p className="text-xs text-neutral-400 line-clamp-1 mb-2">
                      {channel.currentProgram || channel.description || 'Matangazo ya moja kwa moja'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-800/80">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-neutral-400" />
                      {channel.viewerCount}
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
      </div>
    </div>
  );
};
