import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  className?: string;
  slotId?: string;
}

/**
 * Google AdSense Ad Unit Component
 * Auto-activates once the AdSense account ca-pub-7483821694512350 is approved.
 * Remains completely unobtrusive, lightweight, and invisible until approved ads load.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  className = '',
  slotId
}) => {
  const adRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef<boolean>(false);

  // Suppress ads completely on API portal and Embed pages
  const isEmbedOrApi = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/api') ||
    window.location.pathname.startsWith('/embed')
  );

  useEffect(() => {
    if (isEmbedOrApi) return;
    // Only attempt push once per DOM node mount
    if (pushedRef.current) return;
    try {
      const win = window as any;
      if (typeof win !== 'undefined') {
        win.adsbygoogle = win.adsbygoogle || [];
        win.adsbygoogle.push({});
        pushedRef.current = true;
      }
    } catch (e) {
      // Ignored: AdSense will automatically serve auto-ads or populate once approved
    }
  }, []);

  if (isEmbedOrApi) {
    return null;
  }

  return (
    <div className={`w-full flex justify-center items-center my-2 overflow-hidden transition-all duration-300 ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', textAlign: 'center' }}
        data-ad-client="ca-pub-7483821694512350"
        {...(slotId ? { 'data-ad-slot': slotId } : {})}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdBanner;
