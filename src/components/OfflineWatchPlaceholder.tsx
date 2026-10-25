import React, { useState, useEffect } from 'react';
import { Channel } from '../data/channels.ts';
import {
  WifiOff, RefreshCw, ArrowLeft, Tv, ShieldCheck,
  AlertCircle, Radio, Sparkles, CheckCircle2, Smartphone
} from 'lucide-react';
import { ServiceWorkerStatus } from '../hooks/useServiceWorkerOnline.ts';

interface OfflineWatchPlaceholderProps {
  channel: Channel;
  isFullPage?: boolean;
  onRetry: () => void;
  onBack?: () => void;
  swStatus?: ServiceWorkerStatus;
  isReconnecting?: boolean;
}

export const OfflineWatchPlaceholder: React.FC<OfflineWatchPlaceholderProps> = ({
  channel,
  isFullPage = false,
  onRetry,
  onBack,
  swStatus,
  isReconnecting = false
}) => {
  const [localRetrying, setLocalRetrying] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(10);
  const [imgError, setImgError] = useState<boolean>(false);

  // Auto retry countdown timer (counts down from 10s and triggers onRetry)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRetry();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRetry]);

  const handleManualRetry = () => {
    setLocalRetrying(true);
    setCountdown(10);
    onRetry();
    setTimeout(() => setLocalRetrying(false), 2000);
  };

  const isSpinning = isReconnecting || localRetrying;

  return (
    <div
      className={`relative w-full h-full flex flex-col justify-between bg-[#070A0F] text-neutral-100 overflow-y-auto select-none p-4 sm:p-6 ${
        isFullPage ? 'min-h-screen' : 'min-h-[420px] rounded-2xl border border-amber-500/20 shadow-2xl'
      }`}
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* 1. Header with Channel Info & Offline Badge */}
      <div className="relative z-10 flex items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 text-white transition active:scale-95 cursor-pointer"
              title="Rudi Nyuma"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
              CH {channel.order || 1}
            </span>
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate max-w-[200px] sm:max-w-xs">
              {channel.name}
            </h2>
          </div>
        </div>

        {/* Live Offline Indicator Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold animate-pulse shadow-sm">
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span>OFFLINE</span>
        </div>
      </div>

      {/* 2. Main Center Content: Cached Placeholder & Reconnection Radar */}
      <div className="relative z-10 max-w-xl mx-auto w-full my-auto py-6 flex flex-col items-center text-center space-y-5">
        {/* Animated Radar Pulse Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center relative">
            <WifiOff className="w-9 h-9 text-amber-400 animate-pulse" />
            <span className="absolute -inset-2 rounded-full border border-amber-500/30 animate-ping opacity-75 pointer-events-none" />
          </div>
          <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-neutral-900 border border-amber-500/40 text-amber-400">
            <Radio className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Heading & Swahili Explanation */}
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Muunganisho Umekatika (Uko Offline)
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 max-w-md mx-auto leading-relaxed">
            Matangazo ya moja kwa moja ya <strong className="text-white">{channel.name}</strong> yamesimama kwa sababu kifaa chako kimepoteza intaneti.
          </p>
        </div>

        {/* Cached Channel Snapshot Card (Proves cached data is safe in app shell) */}
        <div className="w-full p-3.5 sm:p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-4 text-left shadow-lg">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center p-1 overflow-hidden shrink-0">
            {!imgError && channel.thumbnailUrl ? (
              <img
                src={channel.thumbnailUrl}
                alt={channel.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain filter grayscale contrast-125 opacity-80"
              />
            ) : (
              <Tv className="w-6 h-6 text-neutral-500" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white truncate">{channel.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                {channel.category?.[0] || 'TV'}
              </span>
            </div>
            <p className="text-[11px] text-amber-300/90 font-medium truncate">
              {channel.currentProgram || 'Vipindi na Mechi za Moja kwa Moja'}
            </p>
            <p className="text-[10px] text-neutral-400 truncate">
              {channel.description || 'NeliTv Live Stream'}
            </p>
          </div>
        </div>

        {/* Live Auto-Reconnect Countdown Bar */}
        <div className="w-full max-w-sm space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Inajaribu kuunganisha tena...</span>
            </span>
            <span className="font-mono text-amber-300 font-bold">{countdown}s</span>
          </div>

          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-pink-500 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${((10 - countdown) / 10) * 100}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm pt-1">
          <button
            onClick={handleManualRetry}
            disabled={isSpinning}
            className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            <span>{isSpinning ? 'Inachunguza mtandao...' : 'Jaribu Kuunganisha Sasa'}</span>
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 active:scale-95 text-neutral-300 hover:text-white font-semibold text-xs transition cursor-pointer"
            >
              Rudi Orodha ya Vituo
            </button>
          )}
        </div>

        {/* Quick Connection Tips */}
        <div className="w-full max-w-sm p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/80 text-left space-y-1.5 text-[11px] text-neutral-400">
          <div className="font-bold text-neutral-300 flex items-center gap-1.5 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Miongozo ya Haraka:</span>
          </div>
          <div className="space-y-1">
            <p>• Hakikisha <strong>Data ya simu</strong> au <strong>Wi-Fi</strong> imewashwa.</p>
            <p>• Angalia kama bando au salio lako halijaisha.</p>
            <p>• Hakikisha <strong>Njia ya Ndege (Airplane Mode)</strong> haijawashwa.</p>
          </div>
        </div>
      </div>

      {/* 3. Footer with Service Worker PWA Status */}
      <div className="relative z-10 pt-3 border-t border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span>
            {swStatus?.isActive
              ? `Service Worker: Imewashwa (${swStatus.cacheName || 'nelitv-pwa-v3'}) • PWA Cache Iko Tayari`
              : 'Service Worker: Imesajiliwa • App Shell Imehifadhiwa (Offline Ready)'}
          </span>
        </div>

        <span className="text-neutral-500 font-mono text-[10px]">
          NeliTv Offline Protection
        </span>
      </div>
    </div>
  );
};
