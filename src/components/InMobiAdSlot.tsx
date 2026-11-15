import React, { useEffect, useId, useRef, useState } from 'react';
import {
  INMOBI_PRODUCTION_CONFIG,
  InMobiAdFormat,
  InMobiSlotStatus,
  inMobiCoordinator,
  shouldSuppressAdsOnCurrentRoute,
} from '../utils/inmobiWebX.ts';

interface InMobiAdSlotProps {
  format: InMobiAdFormat;
  slotId?: string;
  className?: string;
  label?: string;
}

/**
 * Responsive InMobi WebX Production Ad Slot
 * - Banner Placement ID: 10000869533
 * - Video Ads Placement ID: 10000869534
 * - Native Ads Placement ID: 10000869535
 *
 * Collapses cleanly to zero height on no-fill, timeout, offline, or SDK error
 * so it never blocks video playback or leaves empty boxes in the layout.
 */
export const InMobiAdSlot: React.FC<InMobiAdSlotProps> = ({
  format,
  slotId,
  className = '',
  label,
}) => {
  const reactId = useId().replace(/[:]/g, '');
  const containerId = slotId || `inmobi-${format}-${reactId}`;
  const placementId = INMOBI_PRODUCTION_CONFIG.placements[format];
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<InMobiSlotStatus>(() =>
    shouldSuppressAdsOnCurrentRoute() ? 'disabled' : 'loading'
  );

  // Responsive target dimensions for InMobi WebX getSlotSizeBounds()
  const [slotBounds, setSlotBounds] = useState<{ w: number; h: number }>(() => {
    if (typeof window === 'undefined') {
      return format === 'video'
        ? { w: 640, h: 360 }
        : format === 'native'
        ? { w: 300, h: 250 }
        : { w: 728, h: 90 };
    }
    const vw = window.innerWidth;
    if (format === 'video') {
      return vw < 640 ? { w: 320, h: 180 } : { w: 640, h: 360 };
    }
    if (format === 'native') {
      return vw < 640 ? { w: 300, h: 250 } : { w: 336, h: 280 };
    }
    if (vw < 640) return { w: 320, h: 50 };
    if (vw >= 1024) return { w: 728, h: 90 };
    return { w: 468, h: 60 };
  });

  useEffect(() => {
    const updateBounds = () => {
      const vw = window.innerWidth;
      if (format === 'video') {
        setSlotBounds(vw < 640 ? { w: 320, h: 180 } : { w: 640, h: 360 });
      } else if (format === 'native') {
        setSlotBounds(vw < 640 ? { w: 300, h: 250 } : { w: 336, h: 280 });
      } else {
        if (vw < 640) setSlotBounds({ w: 320, h: 50 });
        else if (vw >= 1024) setSlotBounds({ w: 728, h: 90 });
        else setSlotBounds({ w: 468, h: 60 });
      }
    };

    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, [format]);

  useEffect(() => {
    if (shouldSuppressAdsOnCurrentRoute()) {
      setStatus('disabled');
      return;
    }

    inMobiCoordinator.registerSlot(containerId, placementId, format, (nextStatus) => {
      setStatus(nextStatus);
    });

    // Observe injected InMobi render iframe/creative to expand immediately when delivered
    const el = containerRef.current;
    let observer: MutationObserver | null = null;
    if (el && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        const creative = el.querySelector('iframe, video, img');
        if (creative) {
          inMobiCoordinator.markRendered(containerId);
        }
      });
      observer.observe(el, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      inMobiCoordinator.unregisterSlot(containerId);
    };
  }, [containerId, placementId, format]);

  if (status === 'disabled' || status === 'no-fill' || status === 'error' || status === 'timeout') {
    return null;
  }

  const isRendered = status === 'rendered';

  const formatWrapperClasses =
    format === 'video'
      ? 'w-full max-w-[720px] mx-auto rounded-2xl overflow-hidden bg-[#0a0f1d] border border-white/10'
      : format === 'native'
      ? 'w-full rounded-2xl overflow-hidden bg-[#0c1120] border border-white/10 p-3 sm:p-4'
      : 'w-full max-w-[970px] mx-auto flex flex-col items-center justify-center overflow-hidden';

  const loadingDimensionsClass = isRendered
    ? format === 'video'
      ? 'min-h-[180px] sm:min-h-[260px]'
      : format === 'native'
      ? 'min-h-[180px] sm:min-h-[220px]'
      : 'min-h-[50px] sm:min-h-[90px]'
    : format === 'banner'
    ? 'min-h-[50px]'
    : 'min-h-[60px]';

  return (
    <div
      aria-hidden={!isRendered}
      className={`transition-all duration-300 ${
        isRendered
          ? `opacity-100 ${formatWrapperClasses} ${className}`
          : `w-full opacity-0 pointer-events-none overflow-hidden ${format === 'banner' ? 'max-w-[970px] mx-auto' : ''}`
      }`}
    >
      {isRendered && (
        <div className="w-full flex items-center justify-between px-1 pb-1.5 text-[10px] uppercase tracking-wider text-neutral-500">
          <span>{label || (format === 'native' ? 'Matangazo Yanayohusiana · Sponsored' : 'Tangazo · Sponsored')}</span>
        </div>
      )}

      <div
        ref={containerRef}
        id={containerId}
        data-inmobi-placement-id={placementId}
        data-inmobi-format={format}
        data-inmobi-slot-width={slotBounds.w}
        data-inmobi-slot-height={slotBounds.h}
        className={`w-full flex justify-center items-center ${loadingDimensionsClass}`}
      />
    </div>
  );
};

export default InMobiAdSlot;
