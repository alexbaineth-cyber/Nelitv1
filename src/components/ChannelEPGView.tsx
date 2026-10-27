import React from 'react';
import { getChannelEPG, EPGProgram } from '../data/epg.ts';
import { Calendar, Radio, Clock, Film, X } from 'lucide-react';

interface ChannelEPGViewProps {
  channelId: string;
  channelName: string;
  variant?: 'inline' | 'drawer';
  onClose?: () => void;
}

export const ChannelEPGView: React.FC<ChannelEPGViewProps> = ({
  channelId,
  channelName,
  variant = 'inline',
  onClose
}) => {
  const programs: EPGProgram[] = getChannelEPG(channelId, channelName);
  const nowPlaying = programs.find(p => p.isLiveNow) || programs[0];
  const upcoming = programs.filter(p => p.id !== nowPlaying?.id);

  if (programs.length === 0) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-[#0B1020]/80 p-5 backdrop-blur-md ${
        variant === 'drawer' ? 'h-full flex flex-col justify-center' : ''
      }`}>
        {variant === 'drawer' && (
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Ratiba ya Vipindi (EPG)</h3>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <div className="py-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-400 mb-3 shadow-inner">
            <Calendar className="w-6 h-6 text-neutral-500" />
          </div>
          <p className="text-sm font-semibold text-neutral-300">
            Hakuna ratiba ya vipindi kwa sasa
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            (No EPG for the current channel)
          </p>
        </div>
      </div>
    );
  }

  // DRAWER OVERLAY (Fullscreen Player)
  if (variant === 'drawer') {
    return (
      <div className="w-full max-w-md h-full bg-[#070A14]/95 border-l border-white/15 p-4 sm:p-6 backdrop-blur-xl flex flex-col text-white shadow-2xl animate-fade-in overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 sticky top-0 bg-[#070A14]/95 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">Ratiba ya Vipindi (EPG)</h3>
              <p className="text-[11px] text-cyan-400 font-semibold">{channelName}</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition cursor-pointer"
              title="Funga Ratiba"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Now Playing Banner */}
        {nowPlaying && (
          <div className="mb-5 p-3.5 rounded-xl bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-blue-900/40 border border-blue-500/40 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <span>INAYOENDELEA SASA</span>
              </span>
              <span className="text-[11px] font-mono text-cyan-300 font-bold">
                {nowPlaying.startTime} - {nowPlaying.endTime}
              </span>
            </div>

            <div className="flex gap-3 items-start">
              {nowPlaying.thumbnailUrl && (
                <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0 border border-white/15 bg-black/50">
                  <img
                    src={nowPlaying.thumbnailUrl}
                    alt={nowPlaying.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                  {nowPlaying.title}
                </h4>
                <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2">
                  {nowPlaying.description}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400">
                  <span className="px-1.5 py-0.2 rounded bg-white/10 text-neutral-300 font-medium">
                    {nowPlaying.category}
                  </span>
                  <span>•</span>
                  <span>{nowPlaying.duration}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming List (Non-skippable, display-only) */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vipindi Vinavyofuata</span>
          </h4>

          <div className="space-y-2.5">
            {upcoming.map((prog) => (
              <div
                key={prog.id}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex gap-3 items-center cursor-default select-none transition hover:bg-white/[0.07]"
              >
                {prog.thumbnailUrl ? (
                  <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-black/40">
                    <img
                      src={prog.thumbnailUrl}
                      alt={prog.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-12 rounded-lg bg-neutral-800/80 border border-white/10 flex items-center justify-center shrink-0 text-neutral-500">
                    <Film className="w-5 h-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      {prog.startTime} - {prog.endTime}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-neutral-400 uppercase">
                      {prog.category}
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-neutral-200 truncate">
                    {prog.title}
                  </h5>
                  <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                    {prog.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // INLINE VIEW (Normal layout below player)
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0B1020] to-[#070A14] p-4 sm:p-5 backdrop-blur-md shadow-xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600/25 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white tracking-tight flex items-center gap-2">
              <span>Ratiba ya Vipindi (EPG)</span>
              <span className="text-[10px] font-normal text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/40">
                Mubashara
              </span>
            </h3>
            <p className="text-[11px] text-neutral-400">{channelName}</p>
          </div>
        </div>
      </div>

      {/* Grid: Now Playing + Upcoming Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Now Playing Featured Card */}
        {nowPlaying && (
          <div className="lg:col-span-1 rounded-xl bg-gradient-to-br from-blue-950/70 via-slate-900/80 to-[#070A14] border border-blue-500/30 p-3.5 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span>INAYOENDELEA SASA</span>
                </span>
                <span className="text-xs font-mono text-cyan-300 font-bold">
                  {nowPlaying.startTime} - {nowPlaying.endTime}
                </span>
              </div>

              {nowPlaying.thumbnailUrl && (
                <div className="w-full aspect-video rounded-lg overflow-hidden mb-2.5 border border-white/10 bg-black/60 relative">
                  <img
                    src={nowPlaying.thumbnailUrl}
                    alt={nowPlaying.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md text-[10px] font-bold text-amber-300 uppercase border border-white/10">
                    {nowPlaying.category}
                  </div>
                </div>
              )}

              <h4 className="text-sm font-bold text-white leading-snug line-clamp-2">
                {nowPlaying.title}
              </h4>
              <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                {nowPlaying.description}
              </p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                <Radio className="w-3.5 h-3.5" />
                <span>Inaruka Moja kwa Moja</span>
              </span>
              <span>{nowPlaying.duration}</span>
            </div>
          </div>
        )}

        {/* Upcoming Cards (Horizontal scroll or grid, non-skippable) */}
        <div className="lg:col-span-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vipindi Vinavyofuata</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {upcoming.map((prog) => (
              <div
                key={prog.id}
                className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 flex gap-3 items-center cursor-default select-none transition"
              >
                {prog.thumbnailUrl ? (
                  <div className="w-16 h-14 sm:w-20 sm:h-16 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-black/50">
                    <img
                      src={prog.thumbnailUrl}
                      alt={prog.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-14 sm:w-20 sm:h-16 rounded-lg bg-neutral-800/80 border border-white/10 flex items-center justify-center shrink-0 text-neutral-500">
                    <Film className="w-5 h-5" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      {prog.startTime} - {prog.endTime}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-neutral-400 uppercase font-medium">
                      {prog.category}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-neutral-200 line-clamp-1">
                    {prog.title}
                  </h5>
                  <p className="text-[10px] text-neutral-400 line-clamp-2 mt-0.5 leading-tight">
                    {prog.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
