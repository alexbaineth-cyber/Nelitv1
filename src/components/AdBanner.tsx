import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  className?: string;
  bannerId?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  className = '',
  bannerId = '2030681'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Attempt to invoke the ad network manager if already loaded on SPA navigation
    const triggerAdManager = () => {
      try {
        const win = window as any;
        if (win.a3klsam && typeof win.a3klsam.init === 'function') {
          win.a3klsam.init();
        }
      } catch (err) {
        // Silent fail - script will render when ready
      }
    };

    const timer = setTimeout(triggerAdManager, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full flex justify-center items-center my-3 overflow-hidden rounded-xl bg-neutral-900/40 border border-neutral-800/60 p-2 min-h-[60px] text-center transition-all ${className}`}
      aria-label="Matangazo"
    >
      <div
        data-banner-id={bannerId}
        className="w-full flex justify-center items-center"
      />
    </div>
  );
};

export default AdBanner;
