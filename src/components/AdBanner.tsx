import React, { useEffect, useRef } from 'react';

/**
 * Global toggle for AdSense display.
 * The ad units are mounted into the DOM with zero-height collapsible containers.
 * When no ad is delivered by Google, they take 0 height and 0 margin (no empty boxes).
 * As soon as AdSense approves and serves ads, they automatically expand and render.
 */
export const ADS_ENABLED = true;

interface AdBannerProps {
  className?: string;
  slotId?: string;
}

/**
 * Google AdSense Ad Unit Component
 * Automatically detects approval & delivers responsive banners without blocking the video player or navigation.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  className = '',
  slotId
}) => {
  const pushedRef = useRef<boolean>(false);

  // Suppress ads completely on API portal and Embed pages
  const isEmbedOrApi = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/api') ||
    window.location.pathname.startsWith('/embed')
  );

  useEffect(() => {
    if (!ADS_ENABLED || isEmbedOrApi) return;
    if (pushedRef.current) return;
    try {
      const win = window as any;
      if (typeof win !== 'undefined') {
        win.adsbygoogle = win.adsbygoogle || [];
        win.adsbygoogle.push({});
        pushedRef.current = true;
      }
    } catch {
      // Graceful fallback handled by AdSense SDK
    }
  }, [isEmbedOrApi]);

  if (!ADS_ENABLED || isEmbedOrApi) {
    return null;
  }

  return (
    <div
      className={`w-full flex justify-center items-center overflow-hidden transition-all duration-300 min-h-0 [&:not(:has(iframe))]:h-0 [&:not(:has(iframe))]:my-0 [&:not(:has(iframe))]:py-0 ${className}`}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minHeight: 0 }}
        data-ad-client="ca-pub-7483821694512350"
        {...(slotId ? { 'data-ad-slot': slotId } : {})}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdBanner;

