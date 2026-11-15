import React, { useState, useMemo } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Search, X, Tv, Eye, Play, Radio } from 'lucide-react';
import { AdBanner } from '../components/AdBanner';
import { InMobiAdSlot } from '../components/InMobiAdSlot.tsx';

interface SearchPageProps {
  channels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
}

function splitTitleWords(title: string) {
  const parts = title.trim().split(/\s+/);
  if (parts.length <= 1) return { lead: '', tail: title };
  return {
    lead: parts.slice(0, -1).join(' '),
    tail: parts[parts.length - 1],
  };
}

const CARD_THEMES = [
  'from-[#3d1b0f] via-[#1c1026] to-[#080a18]',
  'from-[#11254d] via-[#101433] to-[#080a18]',
  'from-[#3d1145] via-[#19112b] to-[#080a18]',
  'from-[#0d2f45] via-[#0e152e] to-[#080a18]',
  'from-[#3f200e] via-[#1b1124] to-[#080a18]',
];

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
    <div className="min-h-screen pb-24 md:pb-16 text-slate-100">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Neon Header Banner matching Image 3 */}
        <div className="relative overflow-hidden rounded-3xl neli-card-surface border border-purple-500/25 p-5 sm:p-7">
          <div className="pointer-events-none absolute -top-20 -left-16 w-64 h-64 rounded-full bg-[#ff1e8a]/16 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-0 w-72 h-72 rounded-full bg-[#00d4ff]/15 blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Gundua <span className="neli-gradient-text">Vituo &amp; Aina</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Chagua kutoka vituo {channels.length} vya Azam TV, Michezo, Sinema na Habari mubashara.
              </p>
            </div>

            {/* Obsidian Neon Search Input */}
            <div className="relative w-full lg:max-w-md">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                placeholder="Andika jina la kituo (mfano: Azam Sports, Sinema Zetu...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full pl-11 pr-10 py-3 bg-[#060716]/90 border border-purple-500/40 rounded-2xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 text-xs sm:text-sm transition shadow-lg"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Futa utafutaji"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl whitespace-nowrap shrink-0 font-bold transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-gradient-to-r from-[#5b21b6] to-[#4338ca] text-white border border-purple-400/60 shadow-[0_0_16px_rgba(124,58,237,0.45)]'
                    : 'bg-[#0b0e24]/85 border border-purple-500/20 text-slate-300 hover:text-white hover:border-purple-400/45'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Language toggle */}
          <div className="flex items-center gap-1 bg-[#0b0e24]/90 p-1 rounded-xl border border-purple-500/25 text-xs shrink-0 self-start sm:self-auto">
            {[
              { id: 'all', label: 'Lugha Zote' },
              { id: 'sw', label: 'Kiswahili' },
              { id: 'en', label: 'English' },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setSelectedLanguage(lang.id)}
                className={`px-3 py-1.5 rounded-lg transition font-bold whitespace-nowrap cursor-pointer ${
                  selectedLanguage === lang.id
                    ? 'neli-gradient-bg text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Top InMobi Banner Ad */}
        <AdBanner slotId="inmobi-banner-search-top" className="my-2" />

        {/* Results Counter */}
        <div className="text-xs text-slate-400 font-semibold flex items-center justify-between">
          <span>
            Zimepatikana chaneli <strong className="text-[#ffb020]">{filteredChannels.length}</strong>
          </span>
        </div>

        {/* Results Grid */}
        {filteredChannels.length === 0 ? (
          <div className="text-center py-20 neli-card-surface rounded-3xl border border-purple-500/25">
            <Tv className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Hakuna chaneli iliyopatikana</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Jaribu kuandika neno tofauti au badilisha kichujio cha makundi hapo juu.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredChannels.map((channel, idx) => {
              const { lead, tail } = splitTitleWords(channel.name);
              const gradient = CARD_THEMES[idx % CARD_THEMES.length];

              return (
                <React.Fragment key={channel.id}>
                  <button
                    onClick={() => onSelectChannel(channel)}
                    className="group relative aspect-[16/10] w-full rounded-xl overflow-hidden text-left border border-white/12 hover:border-cyan-400/75 shadow-lg hover:shadow-[0_0_25px_rgba(0,212,255,0.22)] transition-all duration-300 hover:-translate-y-1 cursor-pointer bg-[#070918]"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(0,212,255,0.22),transparent_55%)] opacity-80 group-hover:opacity-100 transition-opacity" />

                    {/* Centered Logo */}
                    <div className="relative z-10 h-full w-full flex items-center justify-center p-5 pb-10">
                      {channel.thumbnailUrl ? (
                        <img
                          src={channel.thumbnailUrl}
                          alt={channel.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="max-h-12 sm:max-h-14 max-w-[115px] object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Radio className="w-7 h-7 text-slate-500" />
                      )}
                    </div>

                    {/* Contrast Bottom Scrim */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#03040c]/95 via-[#050611]/35 to-transparent pointer-events-none" />

                    {/* Hover Play Ring */}
                    <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full neli-gradient-bg flex items-center justify-center text-white shadow-lg">
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Clean Typography Bottom Info */}
                    <div className="absolute inset-x-0 bottom-0 z-20 p-3">
                      <h4 className="font-extrabold text-xs sm:text-sm leading-tight truncate drop-shadow">
                        {lead && <span className="text-white">{lead} </span>}
                        <span className="text-[#ffb020]">{tail}</span>
                      </h4>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-300/90 font-medium">
                        <span>{channel.language === 'sw' ? 'Kiswahili' : 'English'} · Live</span>
                        <span className="inline-flex items-center gap-1 tabular-nums text-cyan-300/90">
                          <Eye className="w-3 h-3" />
                          {(channel.viewerCount || 650).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </button>

                  {idx === 5 && filteredChannels.length > 8 && (
                    <div className="col-span-full py-2">
                      <InMobiAdSlot format="native" slotId="inmobi-native-search-feed" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Bottom InMobi Banner Ad */}
        <div className="pt-4">
          <AdBanner slotId="inmobi-banner-search-bottom" className="my-2" />
        </div>
      </div>
    </div>
  );
};
