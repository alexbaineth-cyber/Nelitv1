import React, { useState } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';
import { Code, Copy, Check, Tv, Play, ExternalLink, Sparkles, Layers, ShieldCheck, Settings, ArrowLeft } from 'lucide-react';

interface EmbedStudioPageProps {
  channels?: Channel[];
  onBack?: () => void;
  onNavigateToApi?: () => void;
}

const PUBLIC_BASE_URL = 'https://nelitv.online';

export const EmbedStudioPage: React.FC<EmbedStudioPageProps> = ({
  channels = CHANNELS_DATA,
  onBack,
  onNavigateToApi
}) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string>(channels[0]?.id || 'azam-sports-1-hd');
  const [width, setWidth] = useState<string>('100%');
  const [height, setHeight] = useState<string>('500px');
  const [autoplay, setAutoplay] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedSdk, setCopiedSdk] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const selectedChannel = channels.find(c => c.id === selectedChannelId) || channels[0];
  const channelSlug = getChannelRouteSlug(selectedChannel);

  // All exported endpoints and snippets always use https://nelitv.online
  const embedUrl = `${PUBLIC_BASE_URL}/embed/${channelSlug}?autoplay=${autoplay ? '1' : '0'}`;
  const previewSrc = `/embed/${channelSlug}?autoplay=${autoplay ? '1' : '0'}`;
  const sdkScriptUrl = `${PUBLIC_BASE_URL}/api/v1/player/sdk.js`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
  allowfullscreen
  title="${selectedChannel.name} | NeliTv Player">
</iframe>`;

  const sdkCode = `<!-- 1. Jumuisha NeliTv Official Player SDK (100% Bure) -->
<script src="${sdkScriptUrl}"></script>

<!-- 2. Sehemu ya Player -->
<div id="nelitv-player"></div>

<!-- 3. Washa NeliTv Player -->
<script>
  const player = new NeliTvPlayer('#nelitv-player', {
    channel: '${channelSlug}',
    width: '${width}',
    height: '${height}',
    autoplay: ${autoplay}
  });
</script>`;

  const copyToClipboard = (text: string, isSdk = false) => {
    navigator.clipboard.writeText(text);
    if (isSdk) {
      setCopiedSdk(true);
      setTimeout(() => setCopiedSdk(false), 2500);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#050611] text-slate-200 py-8 px-4 sm:px-8 pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2.5 rounded-xl bg-[#0b0e24] hover:bg-[#14183b] border border-purple-500/30 text-slate-200 hover:text-white transition cursor-pointer"
                aria-label="Rudi Nyuma"
              >
                <ArrowLeft className="w-5 h-5 text-cyan-400" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Code className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  NeliTv <span className="neli-gradient-text">Embed Studio</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Weka NeliTv Official Player kwenye tovuti au blog yako — 100% Bure na Salama bila kufichua stream links.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onNavigateToApi && (
              <button
                onClick={onNavigateToApi}
                className="px-4 py-2.5 rounded-xl neli-gradient-bg text-white font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(255,30,138,0.35)] hover:brightness-110 transition active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fungua Content &amp; Player API →</span>
              </button>
            )}
          </div>
        </div>

        {/* Free & Protected Playback Banner */}
        <div className="p-4 sm:p-5 rounded-2xl neli-card-surface border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <span className="font-extrabold text-white block">
                100% Bure · Inacheza Kupitia NeliTv Player Pekee
              </span>
              <span className="text-slate-400 text-[11px]">
                Endpoint zote zinatumia <strong>https://nelitv.online</strong>. Stream halisi hazipatikani nje ya Player hii, na hakuna malipo wala kikomo kwa watazamaji.
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-bold text-[11px] shrink-0 whitespace-nowrap">
            Free &amp; Protected
          </span>
        </div>

        {/* Studio Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Channel Picker & Settings */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Channel Selector */}
            <div className="p-5 rounded-2xl neli-card-surface border border-purple-500/25 space-y-3">
              <label className="text-xs font-extrabold text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-cyan-400" />
                <span>1. Chagua Kituo ({channels.length} Vituo):</span>
              </label>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tafuta kituo (mfano: Azam, Sports, Sinema)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#050611] border border-purple-500/30 text-xs text-white focus:outline-none focus:border-cyan-400"
              />

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
                {filteredChannels.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition cursor-pointer ${
                      selectedChannelId === ch.id
                        ? 'bg-gradient-to-r from-[#5b21b6]/70 to-[#0e7490]/50 border border-cyan-400/70 text-white shadow-sm'
                        : 'bg-[#080a1c]/80 hover:bg-[#111533] text-slate-300 border border-purple-500/15'
                    }`}
                  >
                    <div className="w-9 h-8 rounded-lg bg-[#04050d] border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {ch.thumbnailUrl ? (
                        <img src={ch.thumbnailUrl} alt={ch.name} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                      ) : (
                        <Tv className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{ch.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{ch.currentProgram || ch.category.join(', ')}</div>
                    </div>
                    {selectedChannelId === ch.id && (
                      <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Display Settings */}
            <div className="p-5 rounded-2xl neli-card-surface border border-purple-500/25 space-y-3">
              <label className="text-xs font-extrabold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#ffb020]" />
                <span>2. Vipimo &amp; Mipangilio ya Player:</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Upana (Width):</label>
                  <select
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#050611] border border-purple-500/30 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="100%">100% (Responsive)</option>
                    <option value="800px">800px</option>
                    <option value="640px">640px</option>
                    <option value="560px">560px (Standard)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Urefu (Height):</label>
                  <select
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#050611] border border-purple-500/30 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="500px">500px (Inayopendekezwa)</option>
                    <option value="480px">480px</option>
                    <option value="400px">400px</option>
                    <option value="100vh">100vh (Full Viewport)</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs text-slate-300">Anza Kiotomatiki (Autoplay):</span>
                <button
                  type="button"
                  onClick={() => setAutoplay(!autoplay)}
                  className={`w-11 h-6 rounded-full transition relative cursor-pointer ${
                    autoplay ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-md transform transition ${
                      autoplay ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Player Preview & Code Generator */}
          <div className="lg:col-span-7 space-y-5">
            {/* Live Preview Container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hakikisho la Moja kwa Moja ({selectedChannel.name})</span>
                </span>
                <a
                  href={embedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>{embedUrl}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-purple-500/35 shadow-[0_0_35px_rgba(124,58,237,0.2)]">
                <iframe
                  key={previewSrc}
                  src={previewSrc}
                  title={selectedChannel.name}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Generated Code Snippets */}
            <div className="p-5 rounded-2xl neli-card-surface border border-purple-500/25 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">
                    HTML iFrame Code (https://nelitv.online)
                  </h3>
                </div>

                <button
                  onClick={() => copyToClipboard(iframeCode)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    copiedCode
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'neli-gradient-bg text-white shadow-md'
                  }`}
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Imenakiliwa!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Nakili iFrame</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-[#04050e] border border-purple-500/20 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed select-all">
                {iframeCode}
              </pre>

              {/* Player SDK Code */}
              <div className="pt-2 border-t border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#ffb020]" />
                    <span>NeliTv Player API SDK</span>
                  </div>

                  <button
                    onClick={() => copyToClipboard(sdkCode, true)}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSdk ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSdk ? 'Imenakiliwa!' : 'Nakili SDK Code'}</span>
                  </button>
                </div>

                <pre className="p-3.5 rounded-xl bg-[#04050e] border border-purple-500/20 text-[11px] font-mono text-purple-300 overflow-x-auto leading-relaxed select-all">
                  {sdkCode}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbedStudioPage;
