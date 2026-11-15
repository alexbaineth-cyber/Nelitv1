import React from 'react';
import { InMobiAdSlot } from './InMobiAdSlot.tsx';

export const ADS_ENABLED = true;

interface AdBannerProps {
  className?: string;
  slotId?: string;
}

/**
 * InMobi WebX Production Banner Component (Placement ID: 10000869533)
 * Renders responsive banners and collapses automatically to zero height on no-fill/error.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  className = '',
  slotId,
}) => {
  if (!ADS_ENABLED) {
    return null;
  }

  return (
    <InMobiAdSlot
      format="banner"
      slotId={slotId}
      className={className}
    />
  );
};

export default AdBanner;
