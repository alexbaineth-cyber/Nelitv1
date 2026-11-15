import React from 'react';

interface NeliTvBrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

/**
 * Signature NeliTv Neon Monogram & Spectrum Wordmark
 * Matches the obsidian rounded-square N crest + multi-stop Amber-Magenta-Cyan spectrum.
 */
export const NeliTvBrandMark: React.FC<NeliTvBrandMarkProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const boxSize =
    size === 'lg'
      ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl'
      : size === 'sm'
      ? 'w-8 h-8 rounded-xl'
      : 'w-9 h-9 rounded-xl';

  const textSize =
    size === 'lg'
      ? 'text-4xl sm:text-5xl'
      : size === 'sm'
      ? 'text-lg'
      : 'text-xl sm:text-2xl';

  const gradientId = `neliLogoGrad-${size}`;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Neon-rimmed square N crest */}
      <div
        className={`${boxSize} p-[1.75px] shrink-0 shadow-[0_0_20px_rgba(255,30,138,0.35)]`}
        style={{
          background:
            'linear-gradient(135deg, #ff9d00 0%, #ff1e8a 42%, #7c3aed 72%, #00d4ff 100%)',
        }}
      >
        <div className="w-full h-full rounded-[inherit] bg-[#060713] flex items-center justify-center">
          <svg
            viewBox="0 0 64 64"
            className="w-[64%] h-[64%]"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff9d00" />
                <stop offset="45%" stopColor="#ff1e8a" />
                <stop offset="75%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#00d4ff" />
              </linearGradient>
            </defs>
            <path
              d="M14 50V14h9.5l17.5 23.8V14H50v36h-9.2L23 25.8V50H14z"
              fill={`url(#${gradientId})`}
            />
          </svg>
        </div>
      </div>

      {showWordmark && (
        <span
          className={`font-black italic tracking-tight whitespace-nowrap neli-gradient-text ${textSize}`}
        >
          NeliTv
        </span>
      )}
    </div>
  );
};
