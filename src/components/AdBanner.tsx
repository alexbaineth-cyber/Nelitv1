import React from 'react';
import { AdsterraResponsiveBanner } from './AdsterraAds.tsx';

export const ADS_ENABLED = true;

interface AdBannerProps {
  className?: string;
  slotId?: string;
  mode?: 'full' | 'compact';
}

/**
 * Responsive Adsterra Leaderboard Banner (728x90 / 468x60 / 320x50)
 * Automatically adapts to desktop, tablet, and mobile viewports and
 * auto-collapses completely when no ad fills.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  className = '',
  mode = 'full',
}) => {
  if (!ADS_ENABLED) {
    return null;
  }

  return <AdsterraResponsiveBanner mode={mode} className={className} />;
};

export default AdBanner;
