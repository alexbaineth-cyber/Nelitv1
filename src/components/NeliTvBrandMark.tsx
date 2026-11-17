import React from 'react';

interface NeliTvBrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

/**
 * Clean Cinema Wordmark & Brand Crest for NeliTv
 */
export const NeliTvBrandMark: React.FC<NeliTvBrandMarkProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const boxSize =
    size === 'lg'
      ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl'
      : size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : 'w-9 h-9 rounded-xl';

  const textSize =
    size === 'lg'
      ? 'text-3xl sm:text-4xl'
      : size === 'sm'
      ? 'text-lg'
      : 'text-xl sm:text-2xl';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div
        className={`${boxSize} shrink-0 bg-[#0072d2] flex items-center justify-center shadow-sm border border-white/15`}
      >
        <svg
          viewBox="0 0 64 64"
          className="w-[62%] h-[62%]"
          aria-hidden="true"
        >
          <path
            d="M14 50V14h9.5l17.5 23.8V14H50v36h-9.2L23 25.8V50H14z"
            fill="#ffffff"
          />
        </svg>
      </div>

      {showWordmark && (
        <span
          className={`font-extrabold tracking-tight whitespace-nowrap text-white ${textSize}`}
        >
          Neli<span className="text-[#1ce783]">Tv</span>
        </span>
      )}
    </div>
  );
};
