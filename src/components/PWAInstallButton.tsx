import React, { useState } from 'react';
import { Download, Monitor, Smartphone, Tv, Check, X, Info } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'banner' | 'card' | 'hero';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  className = ''
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [guidePlatform, setGuidePlatform] = useState<'ios' | 'tv' | 'pc'>('ios');

  // If already running inside standalone app, hide install trigger
  if (isInstalled) {
    return null;
  }

  const handleTrigger = () => {
    if (isInstallable) {
      install();
    } else if (isIOS) {
      setGuidePlatform('ios');
      setShowGuideModal(true);
    } else {
      // Show general device guide for TV or Desktop browser
      setGuidePlatform('pc');
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'navbar' && (
        <button
          onClick={handleTrigger}
          title="Sanikisha NeliTv kwenye Simu, PC au Smart TV"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 active:scale-95 text-white text-xs font-bold shadow-md transition ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sanikisha App</span>
          <span className="sm:hidden">App</span>
        </button>
      )}

      {variant === 'hero' && (
        <button
          onClick={handleTrigger}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 text-white text-sm font-bold shadow-lg transition backdrop-blur-md active:scale-95 ${className}`}
        >
          <Download className="w-4 h-4 text-red-500" />
          <span>Sanikisha Kwenye TV / PC</span>
        </button>
      )}

      {variant === 'banner' && (
        <div className={`w-full bg-gradient-to-r from-red-950 via-neutral-900 to-neutral-950 border-y border-red-900/40 px-4 py-2 flex items-center justify-between text-xs ${className}`}>
          <div className="flex items-center gap-2 text-neutral-200">
            <Tv className="w-4 h-4 text-red-500 shrink-0" />
            <span>
              <strong>NeliTv kwenye TV & PC:</strong> Sanikisha bila kupakua Play Store, inacheza moja kwa moja kwenye browser au app!
            </span>
          </div>
          <button
            onClick={handleTrigger}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shrink-0 ml-3 transition"
          >
            Sanikisha Sasa
          </button>
        </div>
      )}

      {/* Guide Modal for iOS, Smart TV, or PC browsers */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-neutral-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-600/40 flex items-center justify-center text-red-500">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Jinsi ya Kusanikisha NeliTv</h3>
                  <p className="text-[11px] text-neutral-400">PWA inafanya kazi kwenye TV, PC na Simu</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform switcher tabs */}
            <div className="flex gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
              <button
                onClick={() => setGuidePlatform('pc')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-medium transition ${guidePlatform === 'pc' ? 'bg-red-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>PC & TV</span>
              </button>
              <button
                onClick={() => setGuidePlatform('ios')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-medium transition ${guidePlatform === 'ios' ? 'bg-red-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
            </div>

            {/* Instruction content */}
            {guidePlatform === 'pc' ? (
              <div className="space-y-2.5 text-xs text-neutral-300 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/80">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                  <span>Kwenye Chrome au Edge (kwenye TV au PC), angalia sehemu ya kuandika link (URL bar).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                  <span>Bonyeza alama ya <strong>Install / Sakinisha App</strong> (ikoni ya kompyuta au mshale unaoshuka chini).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                  <span>Bonyeza <strong>Install</strong>. NeliTv itafunguka kama Programu kamili bila matangazo ya kivinjari!</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-neutral-300 bg-neutral-950/60 p-4 rounded-xl border border-neutral-800/80">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">1</span>
                  <span>Fungua Safari na bonyeza kitufe cha <strong>Share (Shiriki)</strong> chini katikati ya skrini.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">2</span>
                  <span>Shuka chini na uguse <strong>Add to Home Screen (Weka kwenye Skrini ya Mwanzo)</strong>.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">3</span>
                  <span>Bonyeza <strong>Add</strong>. Sasa NeliTv ipo kwenye skrini ya simu yako kama App rasmi!</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition"
            >
              Nimeelewa
            </button>
          </div>
        </div>
      )}
    </>
  );
};
