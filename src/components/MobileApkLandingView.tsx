import React, { useState, useEffect } from 'react';
import {
  Download, CheckCircle2, ShieldCheck,
  Tv, ArrowRight, ExternalLink, Info, Globe
} from 'lucide-react';
import {
  DEFAULT_APK_DOWNLOAD_URL,
  LATEST_RELEASE_API,
  GITHUB_RELEASES_URL,
  APKPURE_LANDING_URL
} from './DownloadAppModal.tsx';

interface MobileApkLandingViewProps {
  onContinueInBrowser: () => void;
  onOpenPrivacyPolicy?: () => void;
}

export const MobileApkLandingView: React.FC<MobileApkLandingViewProps> = ({
  onContinueInBrowser,
  onOpenPrivacyPolicy
}) => {
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_APK_DOWNLOAD_URL);
  const [versionTag, setVersionTag] = useState<string>('v2.3.0');
  const [apkSize, setApkSize] = useState<string>('18.4 MB');
  const [appLogoSrc, setAppLogoSrc] = useState<string>('/app-logo.png');

  // Official download page must never load or retain third-party ad scripts
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document
        .querySelectorAll(
          'script[src*="capitalhospitals.org"], script[src*="czernik.org"], script[src*="highperformanceformat.com"]'
        )
        .forEach((el) => el.remove());
    }
  }, []);

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
            if (apkAsset) {
              if (apkAsset.browser_download_url) {
                setDownloadUrl(apkAsset.browser_download_url);
              }
              if (apkAsset.size) {
                setApkSize(`${(apkAsset.size / (1024 * 1024)).toFixed(1)} MB`);
              }
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

  return (
    <div className="min-h-screen bg-[#070A0F] text-neutral-100 flex flex-col justify-between px-4 py-8 relative overflow-y-auto touch-pan-y">
      {/* Background Neon Ambient Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-gradient-to-tr from-amber-500/20 via-pink-600/25 to-cyan-400/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-64 h-64 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

      {/* Main Single-Page Content */}
      <div className="relative z-10 max-w-md mx-auto w-full flex-1 flex flex-col items-center text-center justify-center pt-2">
        {/* 1. Official App Logo for APK */}
        <div className="relative mb-4 group">
          <div className="w-28 h-28 rounded-[28px] bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-[2.5px] shadow-[0_12px_40px_rgba(255,0,122,0.35)] ring-4 ring-neutral-900/60">
            <div className="w-full h-full rounded-[25px] bg-[#0c1017] flex items-center justify-center p-3 relative overflow-hidden">
              <img
                src={appLogoSrc}
                onError={() => {
                  if (appLogoSrc !== '/logo.png') {
                    setAppLogoSrc('/logo.png');
                  }
                }}
                alt="NeliTv App & APK Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(255,0,122,0.5)]"
              />
            </div>
          </div>

          <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-cyan-500 text-black shadow-lg">
            <Tv className="w-4 h-4" />
          </div>
        </div>

        {/* 2. App Name with Verified Blue/Cyan Tick */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-500 to-cyan-400">
              NeliTv App &amp; APK
            </h1>
            <div className="flex items-center justify-center p-0.5 rounded-full bg-cyan-500 text-black shadow-md shadow-cyan-500/40" title="Imethibitishwa na Salama">
              <CheckCircle2 className="w-5 h-5 fill-cyan-400 text-[#070A0F]" />
            </div>
          </div>

          <p className="text-xs font-semibold text-neutral-300">
            Ukurasa Rasmi wa Kupakua NeliTv APK — Android &amp; Smart TV (Bila Matangazo)
          </p>
        </div>

        {/* 3. Verified Security & Version Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          <span className="px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Official &amp; Ad-Free Download</span>
          </span>

          <span className="px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-700/60 text-neutral-300 text-[11px] font-mono font-semibold">
            {versionTag} • {apkSize}
          </span>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full grid grid-cols-2 gap-2.5 mb-5 text-left">
          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
              ⚽
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">Azam Sports HD</div>
              <div className="text-[10px] text-neutral-400 leading-tight">Ligi Kuu NBC Live</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              ⚡
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">Bila Kukwama</div>
              <div className="text-[10px] text-neutral-400 leading-tight">Live HD Streaming</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              🎬
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">Sinema Zetu</div>
              <div className="text-[10px] text-neutral-400 leading-tight">Filamu &amp; Burudani</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              📱
            </div>
            <div>
              <div className="text-xs font-bold text-white leading-tight">Data Saver</div>
              <div className="text-[10px] text-neutral-400 leading-tight">Inatumia MB kidogo</div>
            </div>
          </div>
        </div>

        {/* 4. PRIMARY DIRECT DOWNLOAD + APKPURE OFFICIAL LANDING PAGE */}
        <div className="w-full space-y-3 mb-5">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download="Nelitv.apk"
            onClick={() => {
              try {
                window.location.href = downloadUrl;
              } catch {}
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-600 to-cyan-500 hover:from-amber-400 hover:via-pink-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-[0_10px_30px_rgba(255,0,122,0.4)] flex items-center justify-center gap-3 transition transform active:scale-95 group cursor-pointer"
          >
            <Download className="w-5 h-5 group-hover:-translate-y-1 transition text-white" />
            <span>PAKUA NELITV APK ({versionTag})</span>
          </a>

          {/* APKPure.com Official Download Landing Page Card */}
          <div className="w-full p-3.5 rounded-2xl bg-emerald-950/35 border border-emerald-500/35 text-left space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Pakua Moja kwa Moja Kupitia APKPure.com</span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Unatafuta <strong>NeliTv App</strong> au <strong>NeliTv APK</strong>? Pia unaweza kupakua faili letu rasmi moja kwa moja kutoka <strong>APKPure</strong> kupitia ukurasa wetu wa APKPure:
                </p>
              </div>
            </div>

            <a
              href={APKPURE_LANDING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#04120b] font-extrabold text-xs flex items-center justify-between gap-2 transition active:scale-95"
            >
              <span>Pakua NeliTv APK kwenye APKPure (nelitv.apk.com)</span>
              <ExternalLink className="w-4 h-4 shrink-0" />
            </a>
          </div>

          <p className="text-[11px] text-neutral-400 flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Inafanya kazi kwenye simu zote za Android na Android / Smart TV</span>
          </p>
        </div>

        {/* 5. Official NeliTv App / APK Information (for users searching NeliTv App or APK) */}
        <div className="w-full p-4 rounded-2xl bg-neutral-900/75 border border-neutral-800 text-left mb-4 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Taarifa Rasmi za NeliTv App / NeliTv APK</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-neutral-300">
            <div>
              <span className="text-neutral-500 block">Jina la App:</span>
              <span className="font-semibold text-white">NeliTv (Nelitv.apk)</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Toleo &amp; Ukubwa:</span>
              <span className="font-mono text-amber-300">{versionTag} • {apkSize}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Ukurasa Rasmi:</span>
              <span className="font-mono text-neutral-200">nelitv.online/download</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Ukurasa wa APKPure:</span>
              <a
                href={APKPURE_LANDING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-emerald-400 hover:underline"
              >
                nelitv.apk.com
              </a>
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1 border-t border-neutral-800/80">
            Kuepuka app feki unapoulizia au kutafuta <strong>NeliTv App</strong> au <strong>NeliTv APK</strong> mtandaoni, pakua pekee kupitia ukurasa huu rasmi (<strong>nelitv.online/download</strong>), <strong>APKPure (nelitv.apk.com)</strong>, au{' '}
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              GitHub Releases
            </a>.
          </p>
        </div>

        {/* 6. 3-Step Simple Install Guide */}
        <div className="w-full p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 text-left mb-5 space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
            Jinsi ya Kuweka (Hatua 3 Rahisi):
          </div>
          <div className="space-y-1.5 text-xs text-neutral-400">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
              <span>Bofya <strong>PAKUA NELITV APK</strong> au pakua kupitia <strong>APKPure (nelitv.apk.com)</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
              <span>Fungua faili la <strong>Nelitv.apk</strong> kisha bofya <strong>Weka (Install)</strong>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
              <span>Fungua NeliTv na ufurahie mechi na vituo vyote bure!</span>
            </div>
          </div>
        </div>

        {/* 7. Option to open on Web View at the bottom */}
        <div className="w-full pt-1">
          <button
            onClick={onContinueInBrowser}
            className="w-full py-3.5 px-4 rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700/80 text-white hover:text-cyan-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-md cursor-pointer group"
          >
            <span>Fungua kwenye Web View (Endelea na Browser)</span>
            <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-[10px] text-neutral-400 mt-2">
            Bofya hapa kama unataka kutazama moja kwa moja kwenye kivinjari cha simu
          </p>
        </div>
      </div>

      {/* Footer Links */}
      <div className="pt-6 border-t border-neutral-900 flex items-center justify-between text-[11px] text-neutral-500 max-w-md mx-auto w-full">
        <span>© 2026 NeliTv. Haki zote zimehifadhiwa.</span>
        {onOpenPrivacyPolicy && (
          <button
            onClick={onOpenPrivacyPolicy}
            className="text-neutral-400 hover:text-cyan-400 underline transition cursor-pointer"
          >
            Sera ya Faragha
          </button>
        )}
      </div>
    </div>
  );
};
