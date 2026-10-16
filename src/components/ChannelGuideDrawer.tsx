import React, { useState } from 'react';
import { Channel } from '../data/channels.ts';
import { Search, X, Tv, ShieldCheck, Eye, Radio, Sparkles, Filter } from 'lucide-react';

interface ChannelGuideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  currentChannelId: string;
  onSelectChannel: (channel: Channel) => void;
}

export const ChannelGuideDrawer: React.FC<ChannelGuideDrawerProps> = ({
  isOpen,
  onClose,
  channels,
  currentChannelId,
  onSelectChannel
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'Zote' },
    { id: 'azam', label: 'Azam TV' },
    { id: 'sport', label: 'Michezo' },
    { id: 'movies', label: 'Sinema' },
    { id: 'news', label: 'Habari' },
    { id: 'kids', label: 'Watoto' },
    { id: 'music', label: 'Muziki' }
  ];

  const filteredChannels = channels.filter(channel => {
    const matchesSearch =
      channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (channel.currentProgram && channel.currentProgram.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'azam') return Boolean(channel.isAzam || channel.name.toLowerCase().includes('azam'));
    return channel.category.includes(selectedCategory);
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Mwongozo wa Chaneli (EPG)</h3>
              <p className="text-xs text-neutral-400">Chaneli {channels.length} Mubashara Tanzania</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-neutral-800/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Tafuta chaneli au kipindi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto mt-3 pb-1 no-scrollbar text-xs">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow-sm'
                    : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredChannels.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-sm">
              Hakuna chaneli inayolingana na utafutaji wako
            </div>
          ) : (
            filteredChannels.map(ch => {
              const isSelected = ch.id === currentChannelId;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    onSelectChannel(ch);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-xl border text-left transition flex items-center gap-3.5 group ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-md'
                      : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                  }`}
                >
                  {/* Thumbnail / Logo */}
                  <div className="w-14 h-12 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {ch.thumbnailUrl ? (
                      <img
                        src={ch.thumbnailUrl}
                        alt={ch.name}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Tv className="w-5 h-5 text-neutral-600" />
                    )}

                    {isSelected && (
                      <div className="absolute inset-0 bg-amber-500/20 backdrop-blur-[1px] flex items-center justify-center">
                        <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Channel Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-amber-400 font-bold' : 'text-white'}`}>
                        {ch.name}
                      </h4>
                      {ch.isAzam && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold shrink-0">
                          AZAM
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-400 truncate mb-1">
                      {ch.currentProgram || ch.description || 'Vipindi vya moja kwa moja'}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-neutral-400" />
                        {ch.viewerCount}
                      </span>
                      <span className="text-neutral-400 font-semibold uppercase text-[10px]">
                        {ch.language === 'sw' ? 'Kiswahili' : 'English'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
