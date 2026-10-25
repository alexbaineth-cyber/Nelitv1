import React, { useEffect, useState } from 'react';
import { useServiceWorkerOnline } from '../hooks/useServiceWorkerOnline.ts';
import { WifiOff, CheckCircle2 } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const { isOffline, wasOffline, checkConnectionNow, isReconnecting } = useServiceWorkerOnline();
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    if (!isOffline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOffline, wasOffline]);

  if (!isOffline && !showReconnected) {
    return null;
  }

  if (showReconnected) {
    return (
      <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-emerald-600/95 border border-emerald-400/40 px-4 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-fade-in">
        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
        <span>Umerudi Mtandaoni! (Muunganisho umerejea)</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-xl bg-neutral-900/95 border border-amber-500/50 px-4 py-2.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md animate-fade-in max-w-sm w-[90%] sm:w-auto">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
      </span>
      <div className="flex-1 truncate">
        <span className="text-amber-300 font-bold">Uko Nje ya Mtandao: </span>
        <span className="text-neutral-300">App shell imehifadhiwa</span>
      </div>
      <button
        onClick={() => checkConnectionNow()}
        disabled={isReconnecting}
        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
      >
        {isReconnecting ? 'Inachunguza...' : 'Jaribu'}
      </button>
    </div>
  );
};
