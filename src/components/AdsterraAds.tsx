import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Official Adsterra Production Units for NeliTv (https://nelitv.online)
 * - Popunder: https://capitalhospitals.org/1/8008ba0787408faff66ee8d5ada03e21
 * - Native 4:1: https://czernik.org/21/1f34e1dd1781212d8cccc0d2af939c1f (#container-1f34e1dd1781212d8cccc0d2af939c1f)
 * - Social Bar: https://czernik.org/14/9fe2a775bc7ee28f27a1281a1852e705
 * - Smart Link (Share): https://budgetezy.org/4/a634a5fe9694372b2428af9e4c3dfcd9
 * - Banners: 728x90, 468x60, 320x50, 300x250, 160x300, 160x600
 */

export const ADSTERRA_SMART_LINK =
  'https://budgetezy.org/4/a634a5fe9694372b2428af9e4c3dfcd9';

export const ADSTERRA_POPUNDER_SRC =
  'https://capitalhospitals.org/1/8008ba0787408faff66ee8d5ada03e21';

export const ADSTERRA_SOCIAL_BAR_SRC =
  'https://czernik.org/14/9fe2a775bc7ee28f27a1281a1852e705';

export const ADSTERRA_NATIVE_SRC =
  'https://czernik.org/21/1f34e1dd1781212d8cccc0d2af939c1f';

export const ADSTERRA_NATIVE_CONTAINER_ID =
  'container-1f34e1dd1781212d8cccc0d2af939c1f';

export type AdsterraBannerVariant =
  | '728x90'
  | '468x60'
  | '320x50'
  | '300x250'
  | '160x300'
  | '160x600';

interface BannerUnitConfig {
  key: string;
  width: number;
  height: number;
  scriptSrc: string;
}

const BANNER_UNITS: Record<AdsterraBannerVariant, BannerUnitConfig> = {
  '728x90': {
    key: '11b93929c48c3a443ee067ad5bc8fe8c',
    width: 728,
    height: 90,
    scriptSrc: 'https://czernik.org/22/11b93929c48c3a443ee067ad5bc8fe8c',
  },
  '468x60': {
    key: '1a9056a6e78dc5de2f8ba185f4972993',
    width: 468,
    height: 60,
    scriptSrc: 'https://czernik.org/22/1a9056a6e78dc5de2f8ba185f4972993',
  },
  '320x50': {
    key: 'efe68bd010bd133714b2838f7cebcd77',
    width: 320,
    height: 50,
    scriptSrc: 'https://czernik.org/22/efe68bd010bd133714b2838f7cebcd77',
  },
  '300x250': {
    key: '2057aae4b8f2210d466181c42452fd24',
    width: 300,
    height: 250,
    scriptSrc: 'https://czernik.org/22/2057aae4b8f2210d466181c42452fd24',
  },
  '160x300': {
    key: 'b8eef5c9c284b1b069aff302292c1f79',
    width: 160,
    height: 300,
    scriptSrc: 'https://czernik.org/22/b8eef5c9c284b1b069aff302292c1f79',
  },
  '160x600': {
    key: '84d6627606385235074bf1296fd4820b',
    width: 160,
    height: 600,
    scriptSrc: 'https://czernik.org/22/84d6627606385235074bf1296fd4820b',
  },
};

function buildBannerSrcDoc(cfg: BannerUnitConfig): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <base target="_blank" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    </style>
  </head>
  <body>
    <script>
      atOptions = {
        'key' : '${cfg.key}',
        'format' : 'iframe',
        'height' : ${cfg.height},
        'width' : ${cfg.width},
        'params' : {}
      };
    </script>
    <script src="${cfg.scriptSrc}"></script>
  </body>
</html>`;
}

interface AdsterraBannerProps {
  variant: AdsterraBannerVariant;
  className?: string;
  label?: string;
}

/**
 * Isolated iframe-hosted Adsterra banner slot.
 * Gives every banner instance its own clean global `atOptions` context so
 * multiple ad sizes coexist seamlessly without script collisions.
 */
export const AdsterraBanner: React.FC<AdsterraBannerProps> = ({
  variant,
  className = '',
  label = 'Tangazo · Sponsored',
}) => {
  const cfg = BANNER_UNITS[variant];
  const [hasError, setHasError] = useState(false);

  const srcDoc = useMemo(() => buildBannerSrcDoc(cfg), [cfg]);

  if (hasError) {
    return null;
  }

  return (
    <div
      className={`w-full flex flex-col items-center justify-center ${className}`}
      data-adsterra-variant={variant}
      data-adsterra-key={cfg.key}
    >
      <div className="relative max-w-full rounded-2xl neli-card-surface border border-purple-500/20 px-2.5 pt-2 pb-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-1 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-slate-400/80 select-none">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/75" />
            <span>{label}</span>
          </span>
          <span className="text-[9px] font-mono text-slate-500 tabular-nums">
            {cfg.width}×{cfg.height}
          </span>
        </div>

        <div
          className="flex items-center justify-center overflow-hidden rounded-xl bg-[#04050e]/90 border border-white/5"
          style={{
            width: cfg.width,
            maxWidth: '100%',
            height: cfg.height,
          }}
        >
          <iframe
            title={`NeliTv Ad ${variant}`}
            srcDoc={srcDoc}
            width={cfg.width}
            height={cfg.height}
            scrolling="no"
            frameBorder={0}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onError={() => setHasError(true)}
            className="border-0 block max-w-full"
            style={{
              width: cfg.width,
              height: cfg.height,
              background: 'transparent',
            }}
          />
        </div>
      </div>
    </div>
  );
};

interface AdsterraResponsiveBannerProps {
  className?: string;
  /** 'full' uses 728x90 / 468x60 / 320x50; 'compact' uses 468x60 / 320x50 */
  mode?: 'full' | 'compact';
  label?: string;
}

/**
 * Automatically selects the ideal Adsterra horizontal banner for the current viewport
 * so desktop, tablet, and mobile screens never overflow horizontally.
 */
export const AdsterraResponsiveBanner: React.FC<AdsterraResponsiveBannerProps> = ({
  className = '',
  mode = 'full',
  label,
}) => {
  const [variant, setVariant] = useState<AdsterraBannerVariant>(() => {
    if (typeof window === 'undefined') return mode === 'compact' ? '468x60' : '728x90';
    const w = window.innerWidth;
    if (mode === 'full' && w >= 780) return '728x90';
    if (w >= 510) return '468x60';
    return '320x50';
  });

  useEffect(() => {
    const updateVariant = () => {
      const w = window.innerWidth;
      if (mode === 'full' && w >= 780) {
        setVariant('728x90');
      } else if (w >= 510) {
        setVariant('468x60');
      } else {
        setVariant('320x50');
      }
    };

    updateVariant();
    window.addEventListener('resize', updateVariant);
    return () => window.removeEventListener('resize', updateVariant);
  }, [mode]);

  return <AdsterraBanner variant={variant} className={className} label={label} />;
};

interface AdsterraNativeBannerProps {
  className?: string;
}

/**
 * Official Adsterra Native 4:1 Banner (#container-1f34e1dd1781212d8cccc0d2af939c1f)
 * Styled seamlessly between channel listings ("katikati ya vipindi vya channel").
 */
export const AdsterraNativeBanner: React.FC<AdsterraNativeBannerProps> = ({
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Remove any previously injected copy of the native invoke script so SPA navigation re-renders cleanly
    const staleScripts = document.querySelectorAll(
      `script[src="${ADSTERRA_NATIVE_SRC}"]`
    );
    staleScripts.forEach((s) => s.parentNode?.removeChild(s));

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = ADSTERRA_NATIVE_SRC;
    host.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <section
      aria-label="Matangazo ya Washirika"
      className={`w-full rounded-2xl neli-card-surface border border-purple-500/25 p-3 sm:p-4 shadow-[0_12px_34px_rgba(0,0,0,0.45)] overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-purple-500/15 text-[11px] text-slate-400">
        <span className="flex items-center gap-2 font-bold text-slate-300">
          <span className="w-2 h-2 rounded-full neli-gradient-bg" />
          <span>Mapendekezo ya Washirika · Sponsored</span>
        </span>
        <span className="text-[10px] font-mono text-cyan-400/75 uppercase">4:1 Native</span>
      </div>

      <div ref={hostRef} className="w-full min-h-[100px] flex items-center justify-center">
        <div
          id={ADSTERRA_NATIVE_CONTAINER_ID}
          className="w-full"
        />
      </div>
    </section>
  );
};

interface AdsterraGlobalScriptsProps {
  enabled?: boolean;
}

/**
 * Injects Adsterra Popunder + Social Bar scripts once on main viewing routes.
 * Disabled automatically on /embed/* and /api/* views so external embeds remain pure.
 */
export const AdsterraGlobalScripts: React.FC<AdsterraGlobalScriptsProps> = ({
  enabled = true,
}) => {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/embed') || path.startsWith('/api')) return;

    if (!document.querySelector(`script[src="${ADSTERRA_POPUNDER_SRC}"]`)) {
      const popunder = document.createElement('script');
      popunder.setAttribute('data-cfasync', 'false');
      popunder.src = ADSTERRA_POPUNDER_SRC;
      popunder.async = true;
      document.body.appendChild(popunder);
    }

    if (!document.querySelector(`script[src="${ADSTERRA_SOCIAL_BAR_SRC}"]`)) {
      const socialBar = document.createElement('script');
      socialBar.setAttribute('data-cfasync', 'false');
      socialBar.src = ADSTERRA_SOCIAL_BAR_SRC;
      socialBar.async = true;
      document.body.appendChild(socialBar);
    }
  }, [enabled]);

  return null;
};
