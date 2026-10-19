import React, { useState, useEffect } from 'react';
import { Download, ShieldCheck, CheckCircle2, Smartphone, Sparkles, ChevronDown } from 'lucide-react';
import {
  DEFAULT_APK_DOWNLOAD_URL,
  LATEST_RELEASE_API,
  GITHUB_RELEASES_URL
} from './DownloadAppModal.tsx';

interface MobileAppDownloadHeroProps {
  onContinueInBrowser?: () => void;
}

export const MobileAppDownloadHero: React.FC<MobileAppDownloadHeroProps> = ({ onContinueInBrowser }) => {
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_APK_DOWNLOAD_URL);
  const [versionTag, setVersionTag] = useState<string>('v2.3.0');
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nelitv_mobile_hero_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Automatically fetch latest release from GitHub API
  useEffect(() => {
    let isMounted = true;
    const fetchLatestRelease = async () => {
      try {
        const res = await fetch(LATEST_RELEASE_API, {
          headers: { Accept: 'application/vnd.github.v3+json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && isMounted) {
            if (data.tag_name) {
              setVersionTag(data.tag_name);
            }
            const apkAsset = Array.isArray(data.assets)
              ? data.assets.find((a: any) => a.name?.toLowerCase().endsWith('.apk') || a.browser_download_url?.endsWith('.apk'))
              : null;
            if (apkAsset && apkAsset.browser_download_url) {
              setDownloadUrl(apkAsset.browser_download_url);
            } else if (data.tag_name) {
              setDownloadUrl(`https://github.com/baynith1/Nelitv/releases/download/${data.tag_name}/Nelitv.apk`);
            }
          }
        }
      } catch {
        // Fallback to DEFAULT_APK_DOWNLOAD_URL
      }
    };

    fetchLatestRelease();
    return () => { isMounted = false; };
  }, []);

  if (isDismissed) return null;

  return (
    <div className="block md:hidden px-4 pt-4 pb-2">
      <div className="relative rounded-3xl bg-gradient-to-b from-neutral-900 via-neutral-950 to-black border border-red-500/30 p-5 shadow-2xl text-center overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-red-600/20 blur-3xl pointer-events-none" />

        {/* 1. LOGO JUU (Top Logo) */}
        <div className="relative flex justify-center mb-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-950 p-0.5 shadow-xl shadow-red-600/40 ring-4 ring-neutral-900 flex items-center justify-center">
            <div className="w-full h-full rounded-[14px] bg-black/40 flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        {/* 2. JINA CHINI YA LOGO (App Name) */}
        <div className="space-y-1 mb-2">
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-black text-2xl tracking-tight text-white">NELI</span>
            <span className="font-black text-2xl tracking-tight text-red-600">TV</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 font-bold ml-1">
              App {versionTag}
            </span>
          </div>

          <p className="text-xs text-neutral-300 font-medium">
            Tanzania Live TV & Sports App
          </p>
        </div>

        {/* 3. VERIFIED TICK (Alama ya Uhakiki / Verified Tick) */}
        <div className="flex items-center justify-center gap-1.5 py-1 px-3 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold w-fit mx-auto mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
          <span>Imethibitishwa & Salama (Verified APK)</span>
        </div>

        <p className="text-[11px] text-neutral-400 mb-4 max-w-xs mx-auto leading-relaxed">
          Pakua app yetu rasmi ili kutazama mechi za ligi kuu na Azam TV bila kukwama kwenye simu yako ya Android.
        </p>

        {/* 4. DOWNLOAD BUTTON */}
        <div className="space-y-2.5">
          <a
            href={downloadUrl}
            download="Nelitv.apk"
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm shadow-xl shadow-red-600/30 flex items-center justify-center gap-2.5 transition active:scale-95 group"
          >
            <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition" />
            <span>Pakua NeliTv App ({versionTag})</span>
          </a>

          <button
            onClick={() => {
              setIsDismissed(true);
              try { sessionStorage.setItem('nelitv_mobile_hero_dismissed', 'true'); } catch {}
              if (onContinueInBrowser) onContinueInBrowser();
            }}
            className="w-full py-2.5 text-xs font-semibold text-neutral-400 hover:text-white transition flex items-center justify-center gap-1"
          >
            <span>Au endelea kutazama kwenye Browser</span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
