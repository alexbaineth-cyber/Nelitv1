import React, { useEffect, useState, useRef } from 'react';
import { Play, Volume2, VolumeX, Sparkles, Tv } from 'lucide-react';

interface CinematicSplashProps {
  onComplete: () => void;
  appName?: string;
}

export const CinematicSplash: React.FC<CinematicSplashProps> = ({
  onComplete,
  appName = "NeliTv"
}) => {
  const [phase, setPhase] = useState<'intro' | 'glow' | 'reveal' | 'outro'>('intro');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Synthesize theatrical cinematic boom / synth swell using Web Audio API (zero external mp3 file needed)
  const playCinematicSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const now = ctx.currentTime;

      // 1. Sub bass rumble (theatrical low frequency 45Hz -> 32Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.exponentialRampToValueAtTime(35, now + 2.2);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.exponentialRampToValueAtTime(0.4, now + 0.4);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 2.5);

      // 2. Cinematic brass / synth harmonic chord (F# major cinematic swell)
      const frequencies = [185.00, 233.08, 277.18, 369.99]; // F#3, A#3, C#4, F#4
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(2400, now + 1.2);
        filter.frequency.exponentialRampToValueAtTime(300, now + 2.3);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12 / frequencies.length, now + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 2.5);
      });
    } catch {
      // Audio autoplay policy fallback
    }
  };

  useEffect(() => {
    // Phase 1: Darkness & Sub bass
    const t1 = setTimeout(() => {
      setPhase('glow');
      if (audioEnabled) {
        playCinematicSound();
      }
    }, 200);

    // Phase 2: Full logo reveal with light sweep
    const t2 = setTimeout(() => {
      setPhase('reveal');
    }, 1100);

    // Phase 3: Outro fade
    const t3 = setTimeout(() => {
      setPhase('outro');
    }, 2800);

    // Complete transition
    const t4 = setTimeout(() => {
      onComplete();
    }, 3400);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('keydown', handleKeyDown);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [audioEnabled, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black select-none overflow-hidden transition-opacity duration-700 ${
        phase === 'outro' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Cinematic anamorphic lens flare & particle backdrop */}
      <div className="absolute inset-0 bg-radial from-red-950/40 via-black to-black" />
      
      {/* Horizontal anamorphic light beam */}
      <div
        className={`absolute w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/80 to-transparent blur-sm transition-transform duration-1000 ${
          phase === 'reveal' ? 'scale-x-100 opacity-80' : 'scale-x-0 opacity-0'
        }`}
      />

      {/* Radial soft glow behind logo */}
      <div
        className={`absolute w-[360px] sm:w-[540px] h-[360px] sm:h-[540px] rounded-full bg-red-600/20 blur-3xl transition-all duration-1000 ${
          phase === 'reveal' ? 'scale-110 opacity-100' : 'scale-50 opacity-0'
        }`}
      />

      {/* Main Theatrical Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4">
        {/* Animated TV Crest Logo */}
        <div
          className={`w-20 h-20 sm:w-28 sm:h-28 mb-4 rounded-3xl bg-gradient-to-br from-red-600 to-red-950 p-[2px] shadow-2xl transition-all duration-1000 transform ${
            phase === 'intro' ? 'scale-75 opacity-0' : phase === 'glow' ? 'scale-95 opacity-80' : 'scale-100 opacity-100 shadow-red-600/40'
          }`}
        >
          <div className="w-full h-full rounded-3xl bg-neutral-950 flex items-center justify-center relative overflow-hidden">
            {/* Shimmer light sweep */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
            <Tv className="w-10 h-10 sm:w-14 sm:h-14 text-red-500" />
            <Play className="w-5 h-5 sm:w-7 sm:h-7 text-white fill-white absolute" />
          </div>
        </div>

        {/* Brand Name Typography with Cinema Styling */}
        <div
          className={`transition-all duration-1000 transform ${
            phase === 'reveal'
              ? 'translate-y-0 opacity-100 scale-100'
              : 'translate-y-4 opacity-0 scale-95'
          }`}
        >
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-100 to-neutral-400 drop-shadow-[0_10px_20px_rgba(229,9,20,0.5)]">
            {appName.toUpperCase()}
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold tracking-widest text-red-400 uppercase">
            <span>Live Sports</span>
            <span className="text-neutral-600">·</span>
            <span>NBC Premier League</span>
            <span className="text-neutral-600">·</span>
            <span>Cinema HD</span>
          </div>
        </div>

        {/* Subtle tagline */}
        <p
          className={`mt-4 text-[11px] sm:text-xs text-neutral-400 tracking-wider transition-opacity duration-700 ${
            phase === 'reveal' ? 'opacity-80' : 'opacity-0'
          }`}
        >
          Burudani ya Moja kwa Moja Popote Ulipo
        </p>

        {/* Skip button for quick TV & PC access */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={onComplete}
            className="px-4 py-1.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-300 hover:text-white text-xs font-semibold backdrop-blur-sm transition active:scale-95 flex items-center gap-1.5"
          >
            <span>Ruka Intro</span>
            <span className="text-[10px] text-neutral-500">(ESC)</span>
          </button>
          
          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playCinematicSound();
            }}
            className="p-1.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-400 hover:text-white transition"
            title={audioEnabled ? "Zima Sauti ya Intro" : "Washa Sauti ya Intro"}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
