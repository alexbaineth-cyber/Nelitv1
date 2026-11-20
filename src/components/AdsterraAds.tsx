import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { RefreshCw, ShieldAlert, X } from 'lucide-react';

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

function buildBannerSrcDoc(cfg: BannerUnitConfig, uid: string): string {
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
    <script src="${cfg.scriptSrc}" onerror="window.parent.postMessage({type:'neli-frame-status',uid:'${uid}',filled:false},'*')"></script>
    <script>
      (function () {
        var uid = ${JSON.stringify(uid)};
        var checks = 0;
        var maxChecks = 16;
        function hasCreative() {
          var imgs = document.querySelectorAll('img');
          for (var i = 0; i < imgs.length; i++) {
            if (imgs[i].offsetWidth > 8 || imgs[i].naturalWidth > 8) return true;
          }
          var frames = document.querySelectorAll('iframe');
          for (var j = 0; j < frames.length; j++) {
            if (frames[j].offsetWidth > 12 && frames[j].offsetHeight > 12) return true;
          }
          var links = document.querySelectorAll('a, ins, canvas, video, object');
          for (var k = 0; k < links.length; k++) {
            if (links[k].offsetWidth > 8 || links[k].offsetHeight > 8) return true;
          }
          return document.body && document.body.scrollHeight > 16 && document.body.innerText.trim().length > 0;
        }
        var timer = setInterval(function () {
          checks++;
          if (hasCreative()) {
            clearInterval(timer);
            window.parent.postMessage({ type: 'neli-frame-status', uid: uid, filled: true }, '*');
          } else if (checks >= maxChecks) {
            clearInterval(timer);
            window.parent.postMessage({ type: 'neli-frame-status', uid: uid, filled: false }, '*');
          }
        }, 380);
      })();
    </script>
  </body>
</html>`;
}

interface AdsterraBannerProps {
  variant: AdsterraBannerVariant;
  className?: string;
  onStatusChange?: (status: 'probing' | 'filled' | 'empty') => void;
}

/**
 * Isolated iframe-hosted Adsterra banner unit.
 * Remains visually collapsed while probing, reveals cleanly when an ad renders,
 * and auto-hides completely (`return null`) when there is no fill.
 */
export const AdsterraBanner: React.FC<AdsterraBannerProps> = ({
  variant,
  className = '',
  onStatusChange,
}) => {
  const cfg = BANNER_UNITS[variant];
  const uid = useId();
  const [status, setStatus] = useState<'probing' | 'filled' | 'empty'>('probing');

  const srcDoc = useMemo(() => buildBannerSrcDoc(cfg, uid), [cfg, uid]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    setStatus('probing');

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'neli-frame-status' && data.uid === uid) {
        setStatus(data.filled ? 'filled' : 'empty');
      }
    };

    window.addEventListener('message', onMessage);
    const fallbackTimeout = setTimeout(() => {
      setStatus((prev) => (prev === 'probing' ? 'empty' : prev));
    }, 4500);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(fallbackTimeout);
    };
  }, [uid, variant]);

  if (status === 'empty') {
    return null;
  }

  return (
    <div
      className={
        status === 'filled'
          ? `w-full flex items-center justify-center transition-opacity duration-200 opacity-100 ${className}`
          : 'fixed -left-[9999px] top-0 w-px h-px overflow-hidden opacity-0 pointer-events-none m-0 p-0'
      }
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded-lg bg-[#141923] border border-white/[0.08]"
        style={{
          width: cfg.width,
          maxWidth: '100%',
          height: cfg.height,
        }}
      >
        <iframe
          title={`NeliTv Promotion ${variant}`}
          srcDoc={srcDoc}
          width={cfg.width}
          height={cfg.height}
          scrolling="no"
          frameBorder={0}
          referrerPolicy="no-referrer-when-downgrade"
          onError={() => setStatus('empty')}
          className="border-0 block max-w-full"
          style={{
            width: cfg.width,
            height: cfg.height,
            background: 'transparent',
          }}
        />
      </div>
    </div>
  );
};

interface AdsterraResponsiveBannerProps {
  className?: string;
  mode?: 'full' | 'compact';
}

/**
 * Selects optimal horizontal banner size per viewport width (728x90 / 468x60 / 320x50).
 * Auto-hides completely if no ad renders.
 */
export const AdsterraResponsiveBanner: React.FC<AdsterraResponsiveBannerProps> = ({
  className = '',
  mode = 'full',
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

  return <AdsterraBanner variant={variant} className={className} />;
};

interface AdsterraGridCardProps {
  className?: string;
}

/**
 * Inline ad unit placed after every channel in the channel grid
 * (e.g. TBC 1 -> Ad -> TBC 2 -> Ad -> Tanzania Safari Channel -> Ad ...).
 * Uses IntersectionObserver on its preceding ChannelCard for fast lazy loading,
 * occupies zero grid cells while probing, and auto-collapses (`return null`) if empty.
 */
export const AdsterraGridCard: React.FC<AdsterraGridCardProps> = ({
  className = '',
}) => {
  const uid = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [status, setStatus] = useState<'probing' | 'filled' | 'empty'>('probing');
  const [variant, setVariant] = useState<AdsterraBannerVariant>(() => {
    if (typeof window === 'undefined') return '300x250';
    return window.innerWidth >= 640 ? '300x250' : '320x50';
  });

  useEffect(() => {
    const update = () => {
      setVariant(window.innerWidth >= 640 ? '300x250' : '320x50');
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Observe preceding ChannelCard so only visible/nearby slots load iframes
  useEffect(() => {
    if (inView) return;
    const targetEl = hostRef.current?.previousElementSibling || hostRef.current;
    if (!targetEl || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '350px 0px' }
    );

    observer.observe(targetEl);
    return () => observer.disconnect();
  }, [inView]);

  const cfg = BANNER_UNITS[variant];
  const srcDoc = useMemo(() => buildBannerSrcDoc(cfg, uid), [cfg, uid]);

  useEffect(() => {
    if (!inView) return;
    setStatus('probing');

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'neli-frame-status' && data.uid === uid) {
        setStatus(data.filled ? 'filled' : 'empty');
      }
    };

    window.addEventListener('message', onMessage);
    const fallbackTimeout = setTimeout(() => {
      setStatus((prev) => (prev === 'probing' ? 'empty' : prev));
    }, 6800);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(fallbackTimeout);
    };
  }, [inView, uid, variant]);

  if (status === 'empty') {
    return null;
  }

  return (
    <div
      ref={hostRef}
      className={
        status === 'filled'
          ? `relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#141923] border border-white/[0.08] hover:border-white/30 transition-transform duration-150 hover:scale-[1.03] flex items-center justify-center ${className}`
          : 'fixed -left-[9999px] top-0 w-[300px] h-[250px] opacity-0 pointer-events-none overflow-hidden'
      }
    >
      {inView && (
        <iframe
          title="NeliTv Channel Item"
          srcDoc={srcDoc}
          width={cfg.width}
          height={cfg.height}
          scrolling="no"
          frameBorder={0}
          referrerPolicy="no-referrer-when-downgrade"
          onError={() => setStatus('empty')}
          className="border-0 block w-full h-full"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            background: 'transparent',
          }}
        />
      )}
    </div>
  );
};

interface AdsterraNativeBannerProps {
  className?: string;
  /**
   * 'dom' mounts #container-1f34e1dd1781212d8cccc0d2af939c1f directly in main DOM
   * (best for the primary 4:1 slot right above all channels).
   * 'iframe' isolates #container-1f34e1dd1781212d8cccc0d2af939c1f per slot so multiple
   * 4:1 native dividers can render cleanly between channel groups without ID collisions.
   */
  mode?: 'dom' | 'iframe';
}

function buildNativeSrcDoc(uid: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        background: transparent;
        color: #f1f5f9;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
      }
      #${ADSTERRA_NATIVE_CONTAINER_ID} {
        width: 100%;
        display: block;
      }
      #${ADSTERRA_NATIVE_CONTAINER_ID} a {
        color: #f8fafc;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div id="${ADSTERRA_NATIVE_CONTAINER_ID}"></div>
    <script async="async" data-cfasync="false" src="${ADSTERRA_NATIVE_SRC}" onerror="window.parent.postMessage({type:'neli-native-status',uid:'${uid}',filled:false,height:0},'*')"></script>
    <script>
      (function () {
        var uid = ${JSON.stringify(uid)};
        var container = document.getElementById(${JSON.stringify(ADSTERRA_NATIVE_CONTAINER_ID)});
        var checks = 0;
        var maxChecks = 22;
        var notifiedFilled = false;

        function measure() {
          if (!container) return { filled: false, height: 0 };
          var hasMedia = container.querySelector('iframe, img, a, ins');
          var h = Math.max(container.scrollHeight || 0, document.body.scrollHeight || 0);
          var filled = Boolean((hasMedia && h > 20) || h > 36);
          return { filled: filled, height: h };
        }

        function report() {
          var res = measure();
          if (res.filled) {
            notifiedFilled = true;
            window.parent.postMessage({
              type: 'neli-native-status',
              uid: uid,
              filled: true,
              height: res.height
            }, '*');
          }
          return res.filled;
        }

        if (typeof ResizeObserver !== 'undefined' && container) {
          var ro = new ResizeObserver(function () {
            report();
          });
          ro.observe(container);
        }

        if (typeof MutationObserver !== 'undefined' && container) {
          var mo = new MutationObserver(function () {
            report();
          });
          mo.observe(container, { childList: true, subtree: true });
        }

        var timer = setInterval(function () {
          checks++;
          if (report()) {
            if (checks > 10) clearInterval(timer);
          } else if (checks >= maxChecks && !notifiedFilled) {
            clearInterval(timer);
            window.parent.postMessage({
              type: 'neli-native-status',
              uid: uid,
              filled: false,
              height: 0
            }, '*');
          }
        }, 420);
      })();
    </script>
  </body>
</html>`;
}

const AdsterraNativeIframeSlot: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const uid = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [status, setStatus] = useState<'probing' | 'filled' | 'empty'>('probing');
  const [frameHeight, setFrameHeight] = useState<number>(190);
  const srcDoc = useMemo(() => buildNativeSrcDoc(uid), [uid]);

  useEffect(() => {
    if (inView) return;
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '420px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    setStatus('probing');

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'neli-native-status' && data.uid === uid) {
        if (data.filled) {
          setStatus('filled');
          if (typeof data.height === 'number' && data.height > 20) {
            setFrameHeight(Math.ceil(data.height) + 4);
          }
        } else {
          setStatus('empty');
        }
      }
    };

    window.addEventListener('message', onMessage);
    const fallbackTimer = setTimeout(() => {
      setStatus((prev) => (prev === 'probing' ? 'empty' : prev));
    }, 9500);

    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(fallbackTimer);
    };
  }, [inView, uid]);

  if (status === 'empty') {
    return null;
  }

  return (
    <div
      ref={hostRef}
      className={
        status === 'filled'
          ? `w-full rounded-xl bg-[#141923] border border-white/[0.08] p-2.5 sm:p-3 overflow-hidden transition-opacity duration-200 opacity-100 ${className}`
          : 'w-full h-px overflow-hidden opacity-0 pointer-events-none'
      }
    >
      {inView && (
        <iframe
          title="NeliTv Native Promotion"
          srcDoc={srcDoc}
          width="100%"
          height={status === 'filled' ? frameHeight : 220}
          scrolling="no"
          frameBorder={0}
          referrerPolicy="no-referrer-when-downgrade"
          onError={() => setStatus('empty')}
          className="border-0 block w-full"
          style={{
            height: status === 'filled' ? `${frameHeight}px` : '220px',
            background: 'transparent',
          }}
        />
      )}
    </div>
  );
};

const AdsterraNativeDomSlot: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'probing' | 'filled' | 'empty'>('probing');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setStatus('probing');

    const staleScripts = document.querySelectorAll(
      `script[src^="${ADSTERRA_NATIVE_SRC}"]`
    );
    staleScripts.forEach((s) => s.parentNode?.removeChild(s));

    const containerEl = document.getElementById(ADSTERRA_NATIVE_CONTAINER_ID);
    const checkContent = () => {
      if (!containerEl) return false;
      const hasMedia = containerEl.querySelector('iframe, img, a, ins');
      return Boolean(hasMedia || containerEl.scrollHeight > 24);
    };

    const observer = new MutationObserver(() => {
      if (checkContent()) {
        setStatus('filled');
      }
    });

    if (containerEl) {
      observer.observe(containerEl, { childList: true, subtree: true });
    }

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = ADSTERRA_NATIVE_SRC;
    script.onerror = () => setStatus('empty');
    host.appendChild(script);

    const pollInterval = setInterval(() => {
      if (checkContent()) {
        setStatus('filled');
        clearInterval(pollInterval);
      }
    }, 400);

    const hideTimeout = setTimeout(() => {
      if (!checkContent()) {
        setStatus('empty');
      }
      clearInterval(pollInterval);
    }, 9500);

    return () => {
      observer.disconnect();
      clearInterval(pollInterval);
      clearTimeout(hideTimeout);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  if (status === 'empty') {
    return null;
  }

  return (
    <div
      className={
        status === 'filled'
          ? `w-full rounded-xl bg-[#141923] border border-white/[0.08] p-2.5 sm:p-3 overflow-hidden transition-opacity duration-200 opacity-100 ${className}`
          : 'w-full min-h-0 max-h-px overflow-hidden opacity-0 pointer-events-none'
      }
    >
      <div ref={hostRef} className="w-full">
        <div id={ADSTERRA_NATIVE_CONTAINER_ID} className="w-full" />
      </div>
    </div>
  );
};

/**
 * Official Adsterra Native 4:1 Banner (#container-1f34e1dd1781212d8cccc0d2af939c1f).
 * Renders at full horizontal width (4 columns on desktop, clean responsive stack on mobile),
 * stays in visible document flow so Adsterra sees real container width, and auto-hides if empty.
 */
export const AdsterraNativeBanner: React.FC<AdsterraNativeBannerProps> = ({
  className = '',
  mode = 'dom',
}) => {
  if (mode === 'iframe') {
    return <AdsterraNativeIframeSlot className={className} />;
  }
  return <AdsterraNativeDomSlot className={className} />;
};

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

interface AdsterraFullscreenBannerProps {
  isFullscreen: boolean;
}

/**
 * Fullscreen-only bottom-above-timeline banner (728x90 on landscape/desktop,
 * scaling cleanly to 468x60 / 320x50 on narrow screens).
 * - Opens immediately each time user enters fullscreen.
 * - Closes immediately when user exits fullscreen.
 * - Includes an X close button; closing hides it for 15 minutes, then shows again.
 * - Auto-hides cleanly if no ad creative renders.
 */
export const AdsterraFullscreenBanner: React.FC<AdsterraFullscreenBannerProps> = ({
  isFullscreen,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [cycleKey, setCycleKey] = useState(0);
  const [bannerStatus, setBannerStatus] = useState<'probing' | 'filled' | 'empty'>('probing');
  const [variant, setVariant] = useState<AdsterraBannerVariant>(() => {
    if (typeof window === 'undefined') return '468x60';
    return window.innerWidth >= 490 ? '468x60' : '320x50';
  });

  useEffect(() => {
    const updateVariant = () => {
      setVariant(window.innerWidth >= 490 ? '468x60' : '320x50');
    };
    updateVariant();
    window.addEventListener('resize', updateVariant);
    return () => window.removeEventListener('resize', updateVariant);
  }, []);

  // Reset every time fullscreen toggles off/on so entering fullscreen always shows fresh
  useEffect(() => {
    if (!isFullscreen) {
      setDismissed(false);
      setBannerStatus('probing');
      return;
    }
    setDismissed(false);
    setCycleKey((k) => k + 1);
  }, [isFullscreen]);

  // Every 15 minutes while in fullscreen: automatically re-display banner even if closed
  useEffect(() => {
    if (!isFullscreen || !dismissed) return;
    const reopenTimer = setTimeout(() => {
      setDismissed(false);
      setBannerStatus('probing');
      setCycleKey((k) => k + 1);
    }, FIFTEEN_MINUTES_MS);

    return () => clearTimeout(reopenTimer);
  }, [isFullscreen, dismissed]);

  if (!isFullscreen || dismissed) {
    return null;
  }

  return (
    <div
      data-player-ui="true"
      className={
        bannerStatus === 'filled'
          ? 'absolute inset-x-0 bottom-[66px] sm:bottom-[74px] z-30 flex justify-center px-2 pointer-events-none'
          : 'fixed -left-[9999px] top-0 w-px h-px overflow-hidden opacity-0 pointer-events-none'
      }
    >
      <div className="relative pointer-events-auto max-w-full">
        {bannerStatus === 'filled' && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            title="Funga tangazo"
            aria-label="Funga tangazo"
            className="absolute -top-2.5 -right-2.5 z-40 w-6 h-6 rounded-full bg-[#0b0e14]/95 hover:bg-black text-white border border-white/30 flex items-center justify-center shadow-lg transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <AdsterraBanner
          key={`fs-${cycleKey}-${variant}`}
          variant={variant}
          onStatusChange={setBannerStatus}
        />
      </div>
    </div>
  );
};

interface AdsterraGlobalScriptsProps {
  enabled?: boolean;
}

/**
 * Injects Adsterra Popunder + Social Bar scripts once on main viewing routes,
 * and monitors if an AdBlocker is actively blocking ad delivery so users are prompted
 * cleanly to disable AdBlocker and allow ads.
 */
export const AdsterraGlobalScripts: React.FC<AdsterraGlobalScriptsProps> = ({
  enabled = true,
}) => {
  const [adBlockerDetected, setAdBlockerDetected] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/embed') || path.startsWith('/api')) return;

    let blockedByNetwork = false;
    let checkTimer: ReturnType<typeof setTimeout> | null = null;
    let bait: HTMLDivElement | null = null;

    // Defer ad script injection slightly so initial page & video stream load first without delay
    const bootTimer = setTimeout(() => {
      const existingPop = document.querySelector(`script[src^="${ADSTERRA_POPUNDER_SRC}"]`);
      if (existingPop && retrySeed > 0) existingPop.remove();
      if (!document.querySelector(`script[src^="${ADSTERRA_POPUNDER_SRC}"]`)) {
        const popunder = document.createElement('script');
        popunder.setAttribute('data-cfasync', 'false');
        popunder.src =
          retrySeed > 0 ? `${ADSTERRA_POPUNDER_SRC}?r=${retrySeed}` : ADSTERRA_POPUNDER_SRC;
        popunder.async = true;
        popunder.onerror = () => {
          blockedByNetwork = true;
          setAdBlockerDetected(true);
        };
        document.body.appendChild(popunder);
      }

      const existingSocial = document.querySelector(`script[src^="${ADSTERRA_SOCIAL_BAR_SRC}"]`);
      if (existingSocial && retrySeed > 0) existingSocial.remove();
      if (!document.querySelector(`script[src^="${ADSTERRA_SOCIAL_BAR_SRC}"]`)) {
        const socialBar = document.createElement('script');
        socialBar.setAttribute('data-cfasync', 'false');
        socialBar.src =
          retrySeed > 0 ? `${ADSTERRA_SOCIAL_BAR_SRC}?r=${retrySeed}` : ADSTERRA_SOCIAL_BAR_SRC;
        socialBar.async = true;
        socialBar.onerror = () => {
          blockedByNetwork = true;
          setAdBlockerDetected(true);
        };
        document.body.appendChild(socialBar);
      }

      // Cosmetic filter bait check to detect active AdBlock extensions
      bait = document.createElement('div');
      bait.className = 'adsbox ad-banner pub_300x250 pub_728x90 text-ad';
      bait.style.cssText =
        'width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;pointer-events:none;';
      bait.innerHTML = '&nbsp;';
      document.body.appendChild(bait);

      checkTimer = setTimeout(() => {
        try {
          if (!bait) return;
          const computed = window.getComputedStyle(bait);
          const hiddenByBlocker =
            bait.offsetHeight === 0 ||
            computed.display === 'none' ||
            computed.visibility === 'hidden';
          if (hiddenByBlocker || blockedByNetwork) {
            setAdBlockerDetected(true);
          } else {
            setAdBlockerDetected(false);
          }
        } catch {}
        if (bait?.parentNode) {
          bait.parentNode.removeChild(bait);
        }
      }, 1100);
    }, 450);

    return () => {
      clearTimeout(bootTimer);
      if (checkTimer) clearTimeout(checkTimer);
      if (bait?.parentNode) bait.parentNode.removeChild(bait);
    };
  }, [enabled, retrySeed]);

  if (!enabled || !adBlockerDetected || noticeDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-16 sm:bottom-4 right-3 sm:right-4 z-50 max-w-xs w-[calc(100vw-24px)] rounded-xl bg-[#141923]/95 backdrop-blur-md border border-white/15 p-3.5 shadow-2xl space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-400">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span className="text-xs font-bold text-white">Ruhusu Matangazo (AdBlocker)</span>
        </div>
        <button
          type="button"
          onClick={() => setNoticeDismissed(true)}
          aria-label="Funga"
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-slate-300 leading-relaxed">
        NeliTv inakuletea vituo vyote <strong>BURE 100%</strong>. Zima AdBlocker ili tusaidie kuendelea bila malipo.
      </p>
      <button
        type="button"
        onClick={() => {
          setAdBlockerDetected(false);
          setRetrySeed((s) => s + 1);
          window.location.reload();
        }}
        className="w-full py-2 px-3 rounded-lg bg-[#1ce783] hover:bg-[#19d377] text-[#04120b] font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Nimezima — Onyesha Matangazo</span>
      </button>
    </div>
  );
};
