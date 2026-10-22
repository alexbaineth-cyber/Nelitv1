/**
 * Automatic Browser and Device Detection for NeliTv
 * Accurately detects:
 * - Browser: Chrome, Safari, Firefox, Edge, Samsung Internet, Opera, etc.
 * - WebViews: Android WebView, iOS WKWebView
 * - Platforms: Smart TV, Android Mobile/Tablet, iPhone/iPad, Desktop
 * - Responsive viewport capabilities
 */

export interface BrowserInfo {
  name: string; // 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'opera' | 'unknown'
  displayName: string;
  isWebView: boolean;
  isAndroidWebView: boolean;
  isIOSWebView: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmartTV: boolean;
  isTouch: boolean;
  isPWA: boolean;
  os: 'android' | 'ios' | 'windows' | 'mac' | 'linux' | 'tv' | 'unknown';
}

export function detectBrowserAndDevice(): BrowserInfo {
  if (typeof window === 'undefined') {
    return {
      name: 'chrome',
      displayName: 'Chrome',
      isWebView: false,
      isAndroidWebView: false,
      isIOSWebView: false,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isSmartTV: false,
      isTouch: false,
      isPWA: false,
      os: 'unknown',
    };
  }

  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';

  // Smart TV Detection (Samsung Tizen, LG WebOS, Android TV, Hisense VIDAA, Apple TV, etc.)
  const isSmartTV = /SmartTV|Tizen|Web0S|NetCast|HbbTV|BRAVIA|GoogleTV|AndroidTV|AppleTV|Roku|Viera|VIDAA|AFTT|AFTM|MiTV|Hisense/i.test(ua);

  // WebView Detection
  const isAndroidWebView = /wv|Version\/[\d.]+\s+Chrome/i.test(ua) && /Android/i.test(ua);
  const isIOSWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua) || (Boolean((window as any).webkit?.messageHandlers) && !/Safari/i.test(ua));
  const isWebView = isAndroidWebView || isIOSWebView;

  // OS Detection
  let os: BrowserInfo['os'] = 'unknown';
  if (isSmartTV) {
    os = 'tv';
  } else if (/Android/i.test(ua)) {
    os = 'android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'ios';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'mac';
  } else if (/Windows/i.test(ua)) {
    os = 'windows';
  } else if (/Linux/i.test(ua)) {
    os = 'linux';
  }

  // Device Form Factor
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isTablet = /(iPad|Tablet|(Android(?!.*Mobile)))/i.test(ua) || (os === 'mac' && isTouch);
  const isMobile = !isSmartTV && !isTablet && (/Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (window.innerWidth <= 768 && isTouch));
  const isDesktop = !isMobile && !isTablet && !isSmartTV;

  // PWA standalone check
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);

  // Browser Name Detection
  let name = 'unknown';
  let displayName = 'Browser';

  if (/SamsungBrowser/i.test(ua)) {
    name = 'samsung';
    displayName = 'Samsung Internet';
  } else if (/Edg([ea]|iOS)?\//i.test(ua)) {
    name = 'edge';
    displayName = 'Microsoft Edge';
  } else if (/OPR\/|Opera/i.test(ua)) {
    name = 'opera';
    displayName = 'Opera';
  } else if (/Firefox|FxiOS/i.test(ua)) {
    name = 'firefox';
    displayName = 'Mozilla Firefox';
  } else if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) {
    name = 'chrome';
    displayName = isAndroidWebView ? 'Android WebView (Chrome)' : 'Google Chrome';
  } else if (/Safari/i.test(ua) && /Apple/i.test(vendor)) {
    name = 'safari';
    displayName = isIOSWebView ? 'In-App Safari (WebKit)' : 'Apple Safari';
  }

  // Attach attributes to document root for automatic CSS & DOM optimizations
  try {
    const root = document.documentElement;
    root.setAttribute('data-browser', name);
    root.setAttribute('data-os', os);
    root.setAttribute('data-device', isSmartTV ? 'tv' : isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop');
    root.setAttribute('data-webview', isWebView ? 'true' : 'false');
    root.setAttribute('data-touch', isTouch ? 'true' : 'false');
  } catch {}

  return {
    name,
    displayName,
    isWebView,
    isAndroidWebView,
    isIOSWebView,
    isMobile,
    isTablet,
    isDesktop,
    isSmartTV,
    isTouch,
    isPWA,
    os,
  };
}
