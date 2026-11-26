import React, { useState, useMemo } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Search, X, Tv, Eye, Play, Radio } from 'lucide-react';

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

      if (selectedCategory === 'azam') {
        if (!ch.isAzam && !ch.name.toLowerCase().includes('azam')) return false;
      } else if (selectedCategory !== 'all') {
        if (!ch.category.includes(selectedCategory)) return false;
      }

      if (selectedLanguage !== 'all') {
        if (ch.language !== selectedLanguage) return false;
      }

      return true;
    });
  }, [channels, searchTerm, selectedCategory, selectedLanguage]);

  return (
    <div className="min-h-screen pb-24 md:pb-16 bg-[#0b0e14] text-slate-100">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 pt-6 space-y-5">
        {/* Clean Search Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Vituo &amp; Aina
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Chagua kati ya vituo {channels.length} vinavyopatikana mubashara.
            </p>
          </div>

          <div className="relative w-full lg:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tafuta kituo (mfano: TBC 1, Azam Sports, Sinema Zetu...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-10 py-2.5 bg-[#141923] border border-white/10 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-white/35 text-xs sm:text-sm transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Futa utafutaji"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-lg whitespace-nowrap shrink-0 font-semibold transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-white text-[#0b0e14]'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#141923] p-1 rounded-lg border border-white/[0.08] text-xs shrink-0 self-start sm:self-auto">
            {[
              { id: 'all', label: 'Zote' },
              { id: 'sw', label: 'Kiswahili' },
              { id: 'en', label: 'English' },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setSelectedLanguage(lang.id)}
                className={`px-3 py-1.5 rounded-md transition font-semibold whitespace-nowrap cursor-pointer ${
                  selectedLanguage === lang.id
                    ? 'bg-white text-[#0b0e14]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-xs text-slate-400 font-medium">
          Zimepatikana chaneli <strong className="text-white">{filteredChannels.length}</strong>
        </div>

        {/* Results Grid (chunked with Native 4:1 group dividers) */}
        {filteredChannels.length === 0 ? (
          <div className="text-center py-20 rounded-xl bg-[#141923] border border-white/[0.08]">
            <Tv className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Hakuna chaneli iliyopatikana</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Jaribu kuandika neno tofauti au badilisha kichujio hapo juu.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(
              { length: filteredChannels.length > 12 ? 2 : 1 },
              (_, chunkIdx) => {
                const chunk =
                  filteredChannels.length > 12
                    ? chunkIdx === 0
                      ? filteredChannels.slice(0, 12)
                      : filteredChannels.slice(12)
                    : filteredChannels;

                return (
                  <React.Fragment key={`search-chunk-${chunkIdx}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4">
                      {chunk.map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => onSelectChannel(channel)}
                          className="group relative aspect-[16/10] w-full rounded-xl overflow-hidden text-left border border-white/[0.08] hover:border-white/30 transition-transform duration-150 hover:scale-[1.03] cursor-pointer bg-[#141923]"
                        >
                          <div className="relative z-10 h-full w-full flex items-center justify-center p-4 pb-10 bg-gradient-to-b from-[#1a2130] to-[#11151f]">
                            {channel.thumbnailUrl ? (
                              <img
                                src={channel.thumbnailUrl}
                                alt={channel.name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                className="max-h-11 sm:max-h-12 max-w-[110px] object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Radio className="w-7 h-7 text-slate-500" />
                            )}
                          </div>

                          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/35">
                            <div className="w-9 h-9 rounded-full bg-white text-[#0b0e14] flex items-center justify-center shadow">
                              <Play className="w-4 h-4 fill-[#0b0e14] ml-0.5" />
                            </div>
                          </div>

                          <div className="absolute inset-x-0 bottom-0 z-20 p-3 bg-gradient-to-t from-[#090c12] via-[#090c12]/90 to-transparent">
                            <h4 className="font-semibold text-xs sm:text-sm text-white leading-tight truncate">
                              {channel.name}
                            </h4>
                            <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1ce783]" />
                                Live
                              </span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Eye className="w-3 h-3" />
                                {(channel.viewerCount || 650).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                  </React.Fragment>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
};
