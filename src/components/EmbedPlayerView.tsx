import React, { useEffect } from 'react';
import { Channel } from '../data/channels.ts';
import { VideoPlayer } from './VideoPlayer.tsx';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';

interface EmbedPlayerViewProps {
  channel: Channel;
}

export const EmbedPlayerView: React.FC<EmbedPlayerViewProps> = ({ channel }) => {
  const slug = getChannelRouteSlug(channel);
  const watchUrl = `https://nelitv.online/${slug}`;

  useEffect(() => {
    document.title = `${channel.name} | NeliTv Official Player`;
  }, [channel.name]);

  return (
    <div className="relative w-screen h-[100dvh] bg-[#03040a] overflow-hidden flex flex-col justify-center items-center">
      {/* Official NeliTv Player (100% Free, Stream Protected) */}
      <div className="w-full h-full relative">
        <VideoPlayer
          key={channel.id}
          channel={channel}
          isFullPage={true}
        />

        {/* Subtle Brand Link to NeliTv */}
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 left-3.5 z-20 px-2.5 py-1 rounded-lg bg-[#050611]/75 hover:bg-[#0b0e24]/95 border border-purple-500/30 hover:border-cyan-400/60 backdrop-blur-md flex items-center gap-1.5 text-[11px] font-bold text-slate-200 transition shadow-lg"
          title={`Tazama ${channel.name} kwenye NeliTv`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-black italic neli-gradient-text">NeliTv</span>
          <span className="text-slate-400 hidden sm:inline">· {channel.name}</span>
        </a>
      </div>
    </div>
  );
};

export default EmbedPlayerView;
