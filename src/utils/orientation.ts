/**
 * Screen orientation and fullscreen helpers for NeliTv mobile and WebView
 * Forces landscape orientation when entering fullscreen mode on mobile devices
 */

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

export async function requestFullscreenWithLandscape(element: HTMLElement | null): Promise<void> {
  if (!element) return;
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if ((element as any).webkitRequestFullscreen) {
      await (element as any).webkitRequestFullscreen();
    } else if ((element as any).mozRequestFullScreen) {
      await (element as any).mozRequestFullScreen();
    } else if ((element as any).msRequestFullscreen) {
      await (element as any).msRequestFullscreen();
    }
  } catch (err) {
    console.warn('[Fullscreen] request error:', err);
  }

  // Force landscape orientation on mobile webviews and browsers
  await lockLandscapeOrientation();
}

export async function exitFullscreenAndUnlock(): Promise<void> {
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
}
