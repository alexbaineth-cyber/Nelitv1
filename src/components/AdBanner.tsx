import React from 'react';
import { AdsterraResponsiveBanner } from './AdsterraAds.tsx';

export const ADS_ENABLED = true;

interface AdBannerProps {
  className?: string;
  slotId?: string;
  mode?: 'full' | 'compact';
  label?: string;
}

/**
 * Responsive Adsterra Leaderboard Banner (728x90 / 468x60 / 320x50)
 * Automatically adapts to desktop, tablet, and mobile viewports.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  className = '',
  mode = 'full',
  label,
}) => {
  if (!ADS_ENABLED) {
    return null;
  }

  return (
    <AdsterraResponsiveBanner
      mode={mode}
      label={label}
      className={className}
    />
  );
};

export default AdBanner;
