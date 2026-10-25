/**
 * Screen orientation and fullscreen helpers for NeliTv mobile and WebView
 * Handles cross-platform fullscreen:
 * - Desktop/Android: HTML5 Fullscreen API with screen.orientation lock
 * - iPhone/iOS Safari: CSS Viewport Fullscreen + webkitEnterFullscreen video support
 */

export function isIPhoneOrIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isIPhone(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPod/i.test(ua);
}

export async function lockLandscapeOrientation(): Promise<boolean> {
  try {
    const orientation = window.screen?.orientation || (window.screen as any)?.mozOrientation || (window.screen as any)?.msOrientation;
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape').catch(() => {});
      return true;
    }
    const screenAny = window.screen as any;
    if (typeof screenAny?.lockOrientation === 'function') {
      screenAny.lockOrientation('landscape');
      return true;
    }
    if (typeof screenAny?.mozLockOrientation === 'function') {
      screenAny.mozLockOrientation('landscape');
      return true;
    }
    if (typeof screenAny?.msLockOrientation === 'function') {
      screenAny.msLockOrientation('landscape');
      return true;
    }
  } catch (err) {
    console.warn('[Orientation] Lock to landscape skipped or not supported by client environment:', err);
  }
  return false;
}

export function unlockScreenOrientation(): void {
  try {
    const orientation = window.screen?.orientation || (window.screen as any)?.mozOrientation || (window.screen as any)?.msOrientation;
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock();
      return;
    }
    const screenAny = window.screen as any;
    if (typeof screenAny?.unlockOrientation === 'function') {
      screenAny.unlockOrientation();
    }
  } catch {}
}

export async function requestFullscreenWithLandscape(
  element: HTMLElement | null,
  videoElement?: HTMLVideoElement | null
): Promise<boolean> {
  let didNativeFs = false;

  // 1. Try native HTML5 fullscreen on the container (Android, Desktop, iPadOS, Chrome)
  if (element) {
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        didNativeFs = true;
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
        didNativeFs = true;
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
        didNativeFs = true;
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
        didNativeFs = true;
      }
    } catch (err) {
      console.warn('[Fullscreen] Container request error:', err);
    }
  }

  // 2. On iPhone browsers where container fullscreen is blocked:
  // Try video element webkitEnterFullscreen if provided
  if (!didNativeFs && videoElement && typeof (videoElement as any).webkitEnterFullscreen === 'function') {
    try {
      (videoElement as any).webkitEnterFullscreen();
      didNativeFs = true;
    } catch (err) {
      console.warn('[Fullscreen] Video webkitEnterFullscreen error:', err);
    }
  }

  // 3. Force landscape orientation on mobile webviews and browsers
  await lockLandscapeOrientation();

  return didNativeFs;
}

export async function exitFullscreenAndUnlock(videoElement?: HTMLVideoElement | null): Promise<void> {
  unlockScreenOrientation();

  try {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    }
  } catch (err) {}

  if (videoElement && typeof (videoElement as any).webkitExitFullscreen === 'function') {
    try {
      (videoElement as any).webkitExitFullscreen();
    } catch {}
  }
}
