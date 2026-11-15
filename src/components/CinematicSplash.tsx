import React, { useEffect, useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { NeliTvBrandMark } from './NeliTvBrandMark.tsx';

interface CinematicSplashProps {
  onComplete: () => void;
  appName?: string;
}

export const CinematicSplash: React.FC<CinematicSplashProps> = ({
  onComplete,
  appName = 'NELITV',
}) => {
  const [phase, setPhase] = useState<'intro' | 'glow' | 'reveal' | 'outro'>('intro');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playCinematicSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const now = ctx.currentTime;

      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.exponentialRampToValueAtTime(35, now + 2.0);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.exponentialRampToValueAtTime(0.35, now + 0.35);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 2.3);

      const frequencies = [185.0, 233.08, 277.18, 369.99];
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(220, now);
        filter.frequency.exponentialRampToValueAtTime(2400, now + 1.0);
        filter.frequency.exponentialRampToValueAtTime(300, now + 2.1);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.11 / frequencies.length, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 2.3);
      });
    } catch {
      // Browser autoplay fallback
    }
  };

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('glow');
      if (audioEnabled) {
        playCinematicSound();
      }
    }, 150);

    const t2 = setTimeout(() => {
      setPhase('reveal');
    }, 850);

    const t3 = setTimeout(() => {
      setPhase('outro');
    }, 2400);

    const t4 = setTimeout(() => {
      onComplete();
    }, 2950);

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
      onClick={onComplete}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#030308] select-none overflow-hidden transition-opacity duration-600 cursor-pointer ${
        phase === 'outro' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Sweeping Magenta (Left) & Electric Blue-Cyan (Right) Neon Wave Ribbons */}
      <div
        className={`absolute -left-24 top-1/4 w-[65vw] h-[55vh] rounded-full blur-3xl transition-all duration-1000 pointer-events-none ${
          phase === 'reveal' ? 'opacity-60 scale-105' : 'opacity-25 scale-90'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255, 0, 128, 0.55) 0%, rgba(168, 85, 247, 0.25) 45%, transparent 72%)',
        }}
      />
      <div
        className={`absolute -right-24 bottom-1/4 w-[65vw] h-[55vh] rounded-full blur-3xl transition-all duration-1000 pointer-events-none ${
          phase === 'reveal' ? 'opacity-65 scale-105' : 'opacity-25 scale-90'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0, 212, 255, 0.52) 0%, rgba(37, 99, 235, 0.3) 45%, transparent 72%)',
        }}
      />

      {/* Luminous horizontal ribbon curves inspired by Splash Showcase */}
      <svg
        viewBox="0 0 1440 720"
        className="absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="splashPink" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#ff1e8a" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#a855f7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="splashBlue" x1="100%" y1="100%" x2="0%" y2="40%">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#2563eb" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff1e8a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-60 120 C 320 280, 620 420, 1480 560"
          stroke="url(#splashPink)"
          strokeWidth="4"
          fill="none"
        />
        <path
          d="M-60 540 C 420 480, 960 300, 1500 120"
          stroke="url(#splashBlue)"
          strokeWidth="4"
          fill="none"
        />
      </svg>

      {/* Main Centered Neon Crest & Title */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div
          className={`mb-5 transition-all duration-700 transform ${
            phase === 'intro'
              ? 'scale-75 opacity-0'
              : phase === 'glow'
              ? 'scale-95 opacity-85'
              : 'scale-100 opacity-100'
          }`}
        >
          <NeliTvBrandMark size="lg" showWordmark={false} />
        </div>

        <div
          className={`transition-all duration-700 transform ${
            phase === 'reveal'
              ? 'translate-y-0 opacity-100 scale-100'
              : 'translate-y-3 opacity-80 scale-95'
          }`}
        >
          <h1
            className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.06em] neli-gradient-text drop-shadow-[0_12px_36px_rgba(255,30,138,0.4)]"
            style={{ lineHeight: 1.02 }}
          >
            {appName}
          </h1>

          {/* Glossy floor mirror reflection */}
          <div
            aria-hidden="true"
            className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.06em] neli-gradient-text opacity-20 scale-y-[-0.42] -mt-4 blur-[2px] pointer-events-none select-none"
          >
            {appName}
          </div>

          <div className="mt-1 flex items-center justify-center gap-4 text-[11px] sm:text-xs font-semibold tracking-[0.42em] text-neutral-300 uppercase">
            <span className="h-[1px] w-10 bg-gradient-to-r from-transparent to-pink-500/70" />
            <span>READY TO PLAY</span>
            <span className="h-[1px] w-10 bg-gradient-to-l from-transparent to-cyan-400/70" />
          </div>
        </div>

        {/* Minimal Skip & Audio Controls */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-8 flex items-center gap-3"
        >
          <button
            type="button"
            onClick={onComplete}
            className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 text-neutral-200 hover:text-white text-xs font-semibold backdrop-blur-md transition active:scale-95 cursor-pointer"
          >
            Ruka Utangulizi
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !audioEnabled;
              setAudioEnabled(next);
              if (next) playCinematicSound();
            }}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 text-neutral-300 hover:text-white transition cursor-pointer"
            title={audioEnabled ? 'Zima Sauti ya Intro' : 'Washa Sauti ya Intro'}
            aria-label={audioEnabled ? 'Zima Sauti ya Intro' : 'Washa Sauti ya Intro'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
