/**
 * InMobi WebX Production Advertising Coordinator for NeliTV (https://nelitv.online)
 *
 * Production Credentials:
 * - Website Key (Publisher ID): 10000252101
 * - Website Domain: nelitv.online
 * - Banner Placement ID: 10000869533
 * - Video Ads Placement ID: 10000869534
 * - Native Ads Placement ID: 10000869535
 */

export const INMOBI_PRODUCTION_CONFIG = {
  websiteKey: '10000252101',
  domain: 'nelitv.online',
  sdkUrl: 'https://app.inmobi.com/web-sdk?publisherId=10000252101',
  placements: {
    banner: '10000869533',
    video: '10000869534',
    native: '10000869535',
  },
  adTimeoutMs: 7500,
} as const;

export type InMobiAdFormat = 'banner' | 'video' | 'native';
export type InMobiSlotStatus = 'loading' | 'rendered' | 'no-fill' | 'error' | 'timeout' | 'disabled';

interface RegisteredSlot {
  containerId: string;
  placementId: string;
  format: InMobiAdFormat;
  onStatusChange: (status: InMobiSlotStatus) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
  status: InMobiSlotStatus;
}

declare global {
  interface Window {
    InMobiWebSDK?: {
      init: (config: {
        publisherId?: string;
        domain?: string;
        placement?: Array<{ placementId: string; containerId: string | string[] }>;
        placementId?: string;
        containerId?: string;
        keywords?: string;
      }) => unknown;
      destroy?: () => void;
    };
    __inmobiInstance?: {
      destroy?: () => void;
    };
  }
}

export function shouldSuppressAdsOnCurrentRoute(): boolean {
  if (typeof window === 'undefined') return true;
  const path = window.location.pathname || '';
  if (path.startsWith('/api') || path.startsWith('/embed')) {
    return true;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  return false;
}

class InMobiWebXCoordinator {
  private slots = new Map<string, RegisteredSlot>();
  private initDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listenersAttached = false;
  private scriptLoadPromise: Promise<boolean> | null = null;
  private lastInitSignature = '';

  private attachGlobalListeners() {
    if (this.listenersAttached || typeof window === 'undefined') return;
    this.listenersAttached = true;

    window.addEventListener('AD_RENDERED', (evt: Event) => {
      const detail = (evt as CustomEvent<{ slotId?: string; correlationId?: string }>).detail;
      const slotId = detail?.slotId;
      if (slotId && this.slots.has(slotId)) {
        this.updateSlotStatus(slotId, 'rendered');
      } else if (!slotId) {
        // Fallback: inspect containers to detect which slot actually received a rendered frame
        this.syncRenderedContainersFromDOM();
      }
    });

    window.addEventListener('NO_FILL', (evt: Event) => {
      const detail = (evt as CustomEvent<{ slotId?: string }>).detail;
      const slotId = detail?.slotId;
      if (slotId && this.slots.has(slotId)) {
        this.updateSlotStatus(slotId, 'no-fill');
      }
    });

    document.addEventListener('WEB_SDK_EVENTS', (evt: Event) => {
      const detail = (evt as CustomEvent<{ eventName?: string }>).detail;
      const eventName = detail?.eventName;
      if (!eventName) return;

      if (
        eventName === 'WEB_SDK_INITIALIZATION_FAILED' ||
        eventName === 'CONFIG_FETCH_FAIL' ||
        eventName === 'PREBID_LOAD_FAILED'
      ) {
        for (const [id, slot] of this.slots.entries()) {
          if (slot.status === 'loading') {
            this.updateSlotStatus(id, 'error');
          }
        }
      }
    });
  }

  private syncRenderedContainersFromDOM() {
    if (typeof document === 'undefined') return;
    for (const [id, slot] of this.slots.entries()) {
      const el = document.getElementById(id);
      if (!el) continue;
      const hasCreative = Boolean(
        el.querySelector('iframe.inmobi-render-iframe, iframe, video, img') &&
        el.getBoundingClientRect().height > 10
      );
      if (hasCreative && slot.status !== 'rendered') {
        this.updateSlotStatus(id, 'rendered');
      }
    }
  }

  private updateSlotStatus(containerId: string, status: InMobiSlotStatus) {
    const slot = this.slots.get(containerId);
    if (!slot) return;
    if (slot.timeoutId) {
      clearTimeout(slot.timeoutId);
      slot.timeoutId = null;
    }
    if (slot.status === status) return;
    slot.status = status;
    slot.onStatusChange(status);
  }

  private ensureSdkLoaded(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(false);
    }
    if (window.InMobiWebSDK && typeof window.InMobiWebSDK.init === 'function') {
      return Promise.resolve(true);
    }
    if (this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    this.scriptLoadPromise = new Promise<boolean>((resolve) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src*="app.inmobi.com/web-sdk"]'
      );

      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      const timeout = setTimeout(() => {
        finish(Boolean(window.InMobiWebSDK?.init));
      }, INMOBI_PRODUCTION_CONFIG.adTimeoutMs);

      if (existingScript) {
        const pollInterval = setInterval(() => {
          if (window.InMobiWebSDK?.init) {
            clearInterval(pollInterval);
            clearTimeout(timeout);
            finish(true);
          }
        }, 100);

        existingScript.addEventListener(
          'load',
          () => {
            clearInterval(pollInterval);
            clearTimeout(timeout);
            finish(Boolean(window.InMobiWebSDK?.init));
          },
          { once: true }
        );
        existingScript.addEventListener(
          'error',
          () => {
            clearInterval(pollInterval);
            clearTimeout(timeout);
            finish(false);
          },
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = INMOBI_PRODUCTION_CONFIG.sdkUrl;
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        finish(Boolean(window.InMobiWebSDK?.init));
      };
      script.onerror = () => {
        clearTimeout(timeout);
        finish(false);
      };
      document.head.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  registerSlot(
    containerId: string,
    placementId: string,
    format: InMobiAdFormat,
    onStatusChange: (status: InMobiSlotStatus) => void
  ) {
    this.attachGlobalListeners();

    if (shouldSuppressAdsOnCurrentRoute()) {
      onStatusChange('disabled');
      return;
    }

    const existing = this.slots.get(containerId);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    const slot: RegisteredSlot = {
      containerId,
      placementId,
      format,
      onStatusChange,
      status: 'loading',
      timeoutId: setTimeout(() => {
        const current = this.slots.get(containerId);
        if (current && current.status === 'loading') {
          // Verify DOM one last time before collapsing on timeout
          const el = document.getElementById(containerId);
          const hasFrame = Boolean(
            el?.querySelector('iframe.inmobi-render-iframe, iframe, video') &&
            (el?.getBoundingClientRect().height || 0) > 10
          );
          this.updateSlotStatus(containerId, hasFrame ? 'rendered' : 'timeout');
        }
      }, INMOBI_PRODUCTION_CONFIG.adTimeoutMs),
    };

    this.slots.set(containerId, slot);
    onStatusChange('loading');
    this.scheduleInit();
  }

  unregisterSlot(containerId: string) {
    const slot = this.slots.get(containerId);
    if (slot?.timeoutId) {
      clearTimeout(slot.timeoutId);
    }
    this.slots.delete(containerId);
    if (this.slots.size === 0) {
      this.lastInitSignature = '';
      try {
        window.__inmobiInstance?.destroy?.();
      } catch {}
    }
  }

  markRendered(containerId: string) {
    this.updateSlotStatus(containerId, 'rendered');
  }

  private scheduleInit() {
    if (this.initDebounceTimer) {
      clearTimeout(this.initDebounceTimer);
    }
    this.initDebounceTimer = setTimeout(() => {
      this.initDebounceTimer = null;
      void this.flushInit();
    }, 150);
  }

  private async flushInit() {
    if (shouldSuppressAdsOnCurrentRoute() || this.slots.size === 0) {
      return;
    }

    const activeEntries: Array<{ containerId: string; placementId: string }> = [];
    for (const [containerId, slot] of this.slots.entries()) {
      if (document.getElementById(containerId)) {
        activeEntries.push({ containerId, placementId: slot.placementId });
      }
    }

    if (activeEntries.length === 0) return;

    // Group containers by placementId so WebX maps every slot cleanly without duplicates
    const grouped = new Map<string, string[]>();
    for (const entry of activeEntries) {
      const list = grouped.get(entry.placementId) || [];
      if (!list.includes(entry.containerId)) {
        list.push(entry.containerId);
      }
      grouped.set(entry.placementId, list);
    }

    const placementPayload = Array.from(grouped.entries()).map(([placementId, containerIds]) => ({
      placementId,
      containerId: containerIds.length === 1 ? containerIds[0] : containerIds,
    }));

    const signature = JSON.stringify(placementPayload);
    if (signature === this.lastInitSignature) {
      return;
    }

    const sdkReady = await this.ensureSdkLoaded();
    if (!sdkReady || !window.InMobiWebSDK?.init) {
      for (const entry of activeEntries) {
        const s = this.slots.get(entry.containerId);
        if (s && s.status === 'loading') {
          this.updateSlotStatus(entry.containerId, 'error');
        }
      }
      return;
    }

    this.lastInitSignature = signature;

    try {
      window.InMobiWebSDK.init({
        publisherId: INMOBI_PRODUCTION_CONFIG.websiteKey,
        domain: INMOBI_PRODUCTION_CONFIG.domain,
        placement: placementPayload,
      });
    } catch {
      for (const entry of activeEntries) {
        const s = this.slots.get(entry.containerId);
        if (s && s.status === 'loading') {
          this.updateSlotStatus(entry.containerId, 'error');
        }
      }
    }
  }
}

export const inMobiCoordinator = new InMobiWebXCoordinator();
