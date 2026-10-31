import React, { useState } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import { Code, Copy, Check, Tv, Play, ExternalLink, Sparkles, Layers, Shield, Settings, ArrowLeft } from 'lucide-react';

interface EmbedStudioPageProps {
  channels?: Channel[];
  onBack?: () => void;
  onNavigateToApi?: () => void;
}

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
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nelitv.online';

  const embedUrl = `${origin}/embed/${selectedChannel.id}${autoplay ? '?autoplay=1' : ''}`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
  allowfullscreen>
</iframe>`;

  const sdkCode = `<!-- 1. Include NeliTv Player SDK -->
<script src="${origin}/api/developer/player-sdk.js"></script>

<!-- 2. Target container -->
<div id="nelitv-player"></div>

<!-- 3. Initialize Player -->
<script>
  const player = new NeliTvPlayer('#nelitv-player', {
    channel: '${selectedChannel.id}',
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
    <div className="min-h-screen bg-[#070A0F] text-neutral-200 py-8 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
                aria-label="Rudi Nyuma"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Code className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  NeliTv Embed Studio
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Weka Live TV na Michezo ya NBC Premier League kwenye Tovuti au Blog yako kwa sekunde chache
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onNavigateToApi && (
              <button
                onClick={onNavigateToApi}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-pink-600/20 transition active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fungua Developer API Platform →</span>
              </button>
            )}
          </div>
        </div>

        {/* Feature Notice Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-neutral-900 to-pink-950/30 border border-cyan-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
              <Shield className="w-5 h-5" />
            </span>
            <div>
              <span className="font-bold text-white block">Inafanya Kazi Popote (Nje ya App na Kwenye Tovuti Yoyote)</span>
              <span className="text-neutral-400 text-[11px]">
                Embed inacheza kwa sekunde 60 za majaribio, kisha inatokea fomu ya malipo moja kwa moja ndani ya player ya mtumiaji kulipia kwa M-Pesa/Tigo/Airtel bila kutoka kwenye blog yako!
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-cyan-900/60 text-cyan-300 font-mono text-[10px] font-bold shrink-0 uppercase">
            Auto-Paywall Ready
          </span>
        </div>

        {/* Studio Workspace: Left Controls, Right Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Channel Picker & Settings */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Channel Selector */}
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Tv className="w-4 h-4 text-cyan-400" />
                <span>1. Chagua Kituo cha Ku-embed ({channels.length} Vituo):</span>
              </label>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tafuta kituo (mfano: Azam, Sports, Sinema)..."
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              />

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                {filteredChannels.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`w-full p-2 rounded-xl text-left flex items-center gap-2.5 transition cursor-pointer ${
                      selectedChannelId === ch.id
                        ? 'bg-gradient-to-r from-cyan-600/30 to-pink-600/20 border border-cyan-400/80 text-white shadow-sm'
                        : 'bg-neutral-950/60 hover:bg-neutral-800/80 text-neutral-300 border border-neutral-800/50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center p-0.5 overflow-hidden shrink-0">
                      {ch.thumbnailUrl ? (
                        <img src={ch.thumbnailUrl} alt={ch.name} className="w-full h-full object-contain" />
                      ) : (
                        <Tv className="w-4 h-4 text-neutral-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{ch.name}</div>
                      <div className="text-[10px] text-neutral-400 truncate">{ch.currentProgram || ch.category.join(', ')}</div>
                    </div>
                    {selectedChannelId === ch.id && (
                      <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Display Settings */}
            <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-3">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-pink-400" />
                <span>2. Vipimo & Mipangilio ya Player:</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">Upana (Width):</label>
                  <select
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="100%">100% (Responsive)</option>
                    <option value="800px">800px</option>
                    <option value="640px">640px</option>
                    <option value="560px">560px (Standard)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-neutral-400">Urefu (Height):</label>
                  <select
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="500px">500px (Inayopendekezwa)</option>
                    <option value="450px">450px</option>
                    <option value="400px">400px</option>
                    <option value="100vh">100vh (Full Viewport)</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <span className="text-xs text-neutral-300">Anza Kiotomatiki (Autoplay):</span>
                <button
                  type="button"
                  onClick={() => setAutoplay(!autoplay)}
                  className={`w-11 h-6 rounded-full transition relative cursor-pointer ${
                    autoplay ? 'bg-cyan-500' : 'bg-neutral-800'
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
                  <span>Hakikisho la Moja kwa Moja (Live Preview - {selectedChannel.name})</span>
                </span>
                <a
                  href={embedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Fungua Standalone</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl">
                <iframe
                  key={embedUrl}
                  src={embedUrl}
                  title={selectedChannel.name}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Generated Code Snippets */}
            <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    HTML iFrame Code (Bandika Kwenye Tovuti Yako)
                  </h3>
                </div>

                <button
                  onClick={() => copyToClipboard(iframeCode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    copiedCode
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md'
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
                      <span>Nakili iFrame Code</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-cyan-300 overflow-x-auto leading-relaxed select-all">
                {iframeCode}
              </pre>

              {/* Player SDK Code */}
              <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-pink-400" />
                    <span>NeliTv Player SDK (Kwa ajili ya JavaScript Developers)</span>
                  </div>

                  <button
                    onClick={() => copyToClipboard(sdkCode, true)}
                    className="text-[11px] text-pink-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSdk ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSdk ? 'Imenakiliwa!' : 'Nakili SDK'}</span>
                  </button>
                </div>

                <pre className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-pink-300/90 overflow-x-auto leading-relaxed select-all max-h-36">
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
