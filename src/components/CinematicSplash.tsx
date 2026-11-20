import React, { useEffect } from 'react';
import { NeliTvBrandMark } from './NeliTvBrandMark.tsx';

interface CinematicSplashProps {
  onComplete: () => void;
  appName?: string;
}

/**
 * Lightweight, instant-feeling cinema splash intro (~900ms, zero heavy blurs)
 */
export const CinematicSplash: React.FC<CinematicSplashProps> = ({
  onComplete,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 400);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0e14] select-none cursor-pointer"
    >
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <NeliTvBrandMark size="lg" />
        <p className="text-xs font-medium tracking-widest uppercase text-slate-400">
          Live TV · Sports · Cinema
        </p>
      </div>
    </div>
  );
};
