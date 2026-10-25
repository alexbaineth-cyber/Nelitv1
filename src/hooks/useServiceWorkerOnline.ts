import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isActive: boolean;
  cacheName: string | null;
  lastChecked: number;
}

export function useServiceWorkerOnline() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [swStatus, setSwStatus] = useState<ServiceWorkerStatus>({
    isSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    isRegistered: false,
    isActive: false,
    cacheName: null,
    lastChecked: Date.now()
  });

  const probeTimeoutRef = useRef<any>(null);

  // Ping Service Worker to check caching & service worker lifecycle state
  const pingServiceWorker = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const hasReg = Boolean(reg);
      const isActive = Boolean(navigator.serviceWorker.controller);

      if (isActive && navigator.serviceWorker.controller) {
        const channel = new MessageChannel();
        const promise = new Promise<any>((resolve) => {
          const timer = setTimeout(() => resolve(null), 1500);
          channel.port1.onmessage = (event) => {
            clearTimeout(timer);
            resolve(event.data);
          };
        });

        navigator.serviceWorker.controller.postMessage(
          { type: 'PING_SW_STATUS' },
          [channel.port2]
        );

        const reply = await promise;
        setSwStatus({
          isSupported: true,
          isRegistered: hasReg,
          isActive: true,
          cacheName: reply?.cacheName || 'nelitv-pwa-v3',
          lastChecked: Date.now()
        });
        return true;
      }

      setSwStatus({
        isSupported: true,
        isRegistered: hasReg,
        isActive: false,
        cacheName: null,
        lastChecked: Date.now()
      });
      return false;
    } catch {
      return false;
    }
  }, []);

  // Actively test actual internet connection by fetching a tiny asset with no-cache
  const probeRealConnection = useCallback(async (): Promise<boolean> => {
    // If browser definitely reports offline, skip probe
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      setWasOffline(true);
      return false;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`/favicon.png?_probe=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timer);

      const online = res.status >= 200 && res.status < 400;
      setIsOnline(online);
      if (!online) setWasOffline(true);
      return online;
    } catch {
      // Network failed or timed out
      setIsOnline(false);
      setWasOffline(true);
      return false;
    }
  }, []);

  // Manual re-check trigger (e.g. "Jaribu Tena" button clicked)
  const checkConnectionNow = useCallback(async (): Promise<boolean> => {
    setIsReconnecting(true);
    await pingServiceWorker();
    const result = await probeRealConnection();
    setIsReconnecting(false);
    return result;
  }, [pingServiceWorker, probeRealConnection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Initial check
    pingServiceWorker();

    const handleWindowOnline = () => {
      setIsReconnecting(true);
      // Give connection a split second to stabilize then probe
      setTimeout(() => {
        probeRealConnection().finally(() => {
          setIsReconnecting(false);
        });
      }, 500);
    };

    const handleWindowOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleWindowOnline);
    window.addEventListener('offline', handleWindowOffline);

    // Periodic heartbeat probe every 12 seconds when page is visible
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible') {
        probeRealConnection();
      }
    }, 12000);

    return () => {
      window.removeEventListener('online', handleWindowOnline);
      window.removeEventListener('offline', handleWindowOffline);
      clearInterval(heartbeat);
      if (probeTimeoutRef.current) clearTimeout(probeTimeoutRef.current);
    };
  }, [pingServiceWorker, probeRealConnection]);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    isReconnecting,
    swStatus,
    checkConnectionNow,
    setOnlineManually: setIsOnline
  };
}
