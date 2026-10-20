import React from 'react';
import { X, Activity, Wifi, Gauge, Clock, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

interface QualityMeterModalProps {
  isOpen: boolean;
  onClose: () => void;
  resolution: string;
  bitrateKbps: number;
  bufferSeconds: number;
  selectedQuality: string;
}

export const QualityMeterModal: React.FC<QualityMeterModalProps> = ({
  isOpen,
  onClose,
  resolution,
  bitrateKbps,
  bufferSeconds,
  selectedQuality
}) => {
  if (!isOpen) return null;

  const isHealthyBuffer = bufferSeconds >= 10;
  const bufferPercentage = Math.min(100, Math.round((bufferSeconds / 30) * 100));

  const networkRating = bitrateKbps >= 1500
    ? { label: 'Bora Sana (Kasi Kubwa)', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' }
    : bitrateKbps >= 800
    ? { label: 'Nzuri (Stabili)', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/30' }
    : { label: 'Wastani (Inafaa)', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0c1017] border border-neutral-800 rounded-3xl shadow-2xl p-6 text-neutral-200 relative space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <div className="w-full h-full rounded-[14px] bg-neutral-950 flex items-center justify-center">
                <Gauge className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                <span>Kipimo cha Ubora</span>
                <span className="text-[10px] text-pink-400 font-mono font-bold uppercase">(Quality Meter)</span>
              </h3>
              <p className="text-xs text-neutral-400">Hali ya mtandao na buffer ya matangazo mubashara</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Highlights Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* 1. Resolution */}
          <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] font-semibold mb-1">
              <span>Ubora wa Video</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-white">
              {resolution}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              Hali: <span className="text-cyan-300 font-semibold">{selectedQuality === 'auto' ? 'Auto (ABR)' : `${selectedQuality}p Zisizobadilika`}</span>
            </div>
          </div>

          {/* 2. Bitrate */}
          <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800">
            <div className="flex items-center justify-between text-neutral-400 text-[11px] font-semibold mb-1">
              <span>Kasi ya Mkondo</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-white">
              {bitrateKbps >= 1000 ? `${(bitrateKbps / 1000).toFixed(1)} Mbps` : `${bitrateKbps} kbps`}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              Matumizi ya MB: <span className="text-emerald-400 font-semibold">Chini (Saver)</span>
            </div>
          </div>
        </div>

        {/* 3. Live 30-Second Buffer Reservoir Progress */}
        <div className="p-4 rounded-2xl bg-neutral-900/90 border border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-pink-400" />
              <span>Hifadhi ya Buffer (Sekunde 30)</span>
            </span>
            <span className="font-mono font-black text-pink-400">
              {bufferSeconds.toFixed(1)}s / 30s
            </span>
          </div>

          <div className="w-full h-2.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-400 transition-all duration-500 shadow-sm shadow-pink-500/50"
              style={{ width: `${bufferPercentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Delay ya Runinga: <strong className="text-neutral-200">30s salama</strong></span>
            <span className={isHealthyBuffer ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
              {isHealthyBuffer ? '✓ Zero-Buffering Active' : 'Inajaza buffer...'}
            </span>
          </div>
        </div>

        {/* 4. Network Health Badge */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${networkRating.bg}`}>
          <div className="flex items-center gap-2.5">
            <Wifi className={`w-5 h-5 ${networkRating.color}`} />
            <div>
              <div className="text-xs font-bold text-white">Hali ya Intaneti Yako</div>
              <div className={`text-[11px] font-semibold ${networkRating.color}`}>
                {networkRating.label}
              </div>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-black/40 text-[10px] font-mono text-neutral-300 border border-white/10">
            30s Buffer Lock
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-pink-600/25 active:scale-95 transition"
        >
          Funga Kipimo
        </button>
      </div>
    </div>
  );
};
