import React, { useState, useEffect } from 'react';
import {
  Download, QrCode, Smartphone, Monitor,
  ShieldCheck, Copy, Check, ExternalLink, AlertCircle
} from 'lucide-react';
import { AdBanner } from './AdBanner';

export const DEFAULT_APK_DOWNLOAD_URL = 'https://github.com/baynith1/Nelitv/releases/download/v3.2.0/Nelitv.apk';
export const GITHUB_RELEASES_URL = 'https://github.com/baynith1/Nelitv/releases';
export const LATEST_RELEASE_API = 'https://api.github.com/repos/baynith1/Nelitv/releases/latest';

export const ShutdownLandingView: React.FC = () => {
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_APK_DOWNLOAD_URL);
  const [versionTag, setVersionTag] = useState<string>('v3.2.0');
  const [apkSize, setApkSize] = useState<string>('29.5 MB');
  const [copied, setCopied] = useState<boolean>(false);
  const [qrFailed, setQrFailed] = useState<boolean>(false);

  // Detect Smart TV or desktop-class viewport on resize so PC, "Desktop Site", and TV always show the 2-column layout
  const [isTvBrowser, setIsTvBrowser] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    return /SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|GoogleTV|AppleTV|HbbTV|Roku/i.test(
      navigator.userAgent || ''
    );
  });

  useEffect(() => {
    const checkTv = () => {
      if (typeof navigator === 'undefined') return;
      setIsTvBrowser(
        /SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|GoogleTV|AppleTV|HbbTV|Roku/i.test(
          navigator.userAgent || ''
        )
      );
    };
    window.addEventListener('resize', checkTv);
    return () => window.removeEventListener('resize', checkTv);
  }, []);

  // Fetch latest GitHub APK release automatically
  useEffect(() => {
    let isMounted = true;
    const fetchLatestRelease = async () => {
      try {
        const res = await fetch(LATEST_RELEASE_API, {
          headers: { Accept: 'application/vnd.github.v3+json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;

        if (data.tag_name) {
          setVersionTag(data.tag_name);
        }

        const apkAsset = Array.isArray(data.assets)
          ? data.assets.find(
              (a: any) =>
                a.name?.toLowerCase().endsWith('.apk') ||
                a.browser_download_url?.toLowerCase().endsWith('.apk')
            )
          : null;

        if (apkAsset?.browser_download_url) {
          setDownloadUrl(apkAsset.browser_download_url);
          setQrFailed(false);
          if (apkAsset.size) {
            setApkSize(`${(apkAsset.size / (1024 * 1024)).toFixed(1)} MB`);
          }
        } else if (data.tag_name) {
          setDownloadUrl(
            `https://github.com/baynith1/Nelitv/releases/download/${data.tag_name}/Nelitv.apk`
          );
          setQrFailed(false);
        }
      } catch {
        // Keep fallback GitHub release URL silently
      }
    };

    fetchLatestRelease();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(downloadUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => {});
  };

  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(downloadUrl)}`;

  return (
    <div className="min-h-screen w-full bg-[#060913] text-neutral-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Subtle Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[500px] bg-gradient-to-b from-rose-500/10 via-cyan-500/10 to-transparent blur-3xl opacity-60" />
        <div className="absolute -bottom-32 right-1/4 w-[500px] h-[400px] bg-blue-600/10 blur-3xl opacity-40" />
      </div>

      {/* Main Responsive Container */}
      <main className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-10 py-8 sm:py-12 flex-1 flex flex-col items-center justify-center">
        {/* TOP LOGO SECTION */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-[2.5px] shadow-2xl shadow-cyan-500/20 mb-3">
            <div className="w-full h-full rounded-[14px] sm:rounded-[21px] bg-[#070A14] flex items-center justify-center p-2.5 overflow-hidden">
              <img
                src="/icon.svg"
                alt="NeliTv Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_4px_14px_rgba(255,0,128,0.45)]"
              />
            </div>
          </div>

          <div className="flex items-center tracking-tight">
            <span className="font-extrabold text-2xl sm:text-3xl text-white">Neli</span>
            <span className="font-black text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-400 ml-1">
              Tv
            </span>
          </div>
        </div>

        {/* MOBILE VIEW (< md and non-TV): Concise Swahili closed message + Download Button */}
        {!isTvBrowser && (
          <section
            aria-label="Taarifa ya Simu"
            className="w-full max-w-md mx-auto md:hidden rounded-3xl bg-[#0c1122]/95 border border-white/10 p-6 shadow-2xl text-center space-y-5"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>TOVUTI IMEFUNGWA</span>
            </div>

            <div className="space-y-2.5">
              <h1 className="text-xl font-black text-white leading-snug">
                Tovuti Hii Imefungwa Sasa, Tumia App Kuendelea Kutazama
              </h1>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Huduma zote za matangazo ya moja kwa moja sasa zinapatikana kupitia App ya NeliTv pekee. Pakua App hapa chini uendelee kutazama bure.
              </p>
            </div>

            <a
              href={downloadUrl}
              download="Nelitv.apk"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-500 hover:opacity-95 text-white font-black text-base flex items-center justify-center gap-2.5 shadow-xl shadow-pink-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>Pakua App Sasa (Download)</span>
            </a>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-neutral-400 pt-1">
              <span className="text-cyan-300 font-semibold">{versionTag}</span>
              <span>•</span>
              <span>{apkSize}</span>
              <span>•</span>
              <span className="text-emerald-400">Nelitv.apk</span>
            </div>
          </section>
        )}

        {/* PC / DESKTOP SITE / SMART TV VIEW (>= md or Smart TV): 2-Column Split Layout */}
        <section
          aria-label="Mwonekano wa Kompyuta na QR Code"
          className={`w-full ${
            isTvBrowser ? 'grid grid-cols-1 sm:grid-cols-2' : 'hidden md:grid md:grid-cols-2'
          } gap-6 lg:gap-8 items-stretch`}
        >
          {/* LEFT PANEL: Website Closed Notice & Full Explanation */}
          <div className="rounded-3xl bg-[#0c1122]/90 border border-white/10 backdrop-blur-xl p-7 lg:p-9 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold mb-5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span>TOVUTI IMEFUNGWA RASMI · WEBSITE CLOSED</span>
              </div>

              <h1 className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight mb-4">
                Tovuti Hii Imefungwa Rasmi — Tumia App Ya Simu Kuendelea Kutazama
              </h1>

              <p className="text-sm lg:text-base text-neutral-300 leading-relaxed mb-5">
                Huduma zote za matangazo ya moja kwa moja kupitia kivinjari cha mtandao zimesitishwa rasmi. Ili kuendelea kutazama bure chaneli zote za <strong className="text-white">Azam TV, Ligi Kuu ya NBC, UEFA, Super Sport, EPL League Tv, beIN Sports, sinema na vipindi vyote</strong>, tafadhali pakua na utumie App yetu rasmi ya simu (<span className="text-cyan-400 font-semibold">NeliTv APK</span>).
              </p>

              <div className="space-y-2.5 p-4 rounded-2xl bg-[#070b17] border border-white/5 text-xs text-neutral-300">
                <div className="font-bold text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-cyan-400" />
                  <span>Unatumia Kompyuta au Smart TV?</span>
                </div>
                <p className="text-neutral-400 leading-relaxed">
                  Tumia kamera ya simu yako ya Android kuskani <strong className="text-white">QR Code</strong> iliyo upande wa kulia ili kupakua na kusakinisha NeliTv App moja kwa moja, au pakua faili la APK hapa chini.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Bure 100% Milele</span>
              </div>
              <span>•</span>
              <span>Hakuna Malipo Wala Vifurushi</span>
              <span>•</span>
              <span>Vituo Mubashara Saa 24</span>
            </div>
          </div>

          {/* RIGHT PANEL: QR Code Scan to Download */}
          <div className="rounded-3xl bg-gradient-to-b from-[#0f172a] to-[#0a0f1d] border border-cyan-500/30 p-7 lg:p-9 shadow-2xl flex flex-col items-center justify-between text-center">
            <div className="flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-bold mb-3">
                <QrCode className="w-3.5 h-3.5" />
                <span>SCAN TO DOWNLOAD</span>
              </div>

              <h2 className="text-xl lg:text-2xl font-black text-white mb-2">
                Skani QR Code Kwa Simu Yako
              </h2>
              <p className="text-xs lg:text-sm text-neutral-300 max-w-sm mb-5">
                Elekeza kamera ya simu yako kwenye QR Code hii kupakua NeliTv App moja kwa moja kutoka GitHub.
              </p>

              {/* QR Code Card */}
              <div className="p-3.5 bg-white rounded-2xl shadow-2xl border-4 border-cyan-500/40 inline-flex flex-col items-center mb-5">
                {!qrFailed ? (
                  <img
                    src={qrCodeImageUrl}
                    alt="Scan QR Code to Download NeliTv APK"
                    className="w-48 h-48 lg:w-56 lg:h-56 object-contain rounded-lg"
                    loading="eager"
                    onError={() => setQrFailed(true)}
                  />
                ) : (
                  <div className="w-48 h-48 lg:w-56 lg:h-56 flex flex-col items-center justify-center text-neutral-700 p-4 text-xs">
                    <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                    <span className="font-semibold">QR Code haikuweza kupakia. Tumia kitufe cha kupakua hapa chini.</span>
                  </div>
                )}
                <div className="mt-2 text-[11px] font-mono font-bold text-neutral-800">
                  Nelitv.apk • {versionTag} • {apkSize}
                </div>
              </div>
            </div>

            {/* Steps + Direct Actions */}
            <div className="w-full space-y-3">
              <div className="bg-[#080d1a] border border-white/10 rounded-xl p-3 text-left text-xs text-neutral-400 space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Hatua:</span>
                </div>
                <div>1. Fungua Kamera au QR Scanner kwenye simu yako.</div>
                <div>2. Elekeza kwenye QR Code hii kisha bofya link kupakua APK.</div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <a
                  href={downloadUrl}
                  download="Nelitv.apk"
                  rel="noopener noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pakua APK ({versionTag})</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 border border-white/15 transition active:scale-95 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Imenakiliwa</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Nakili Link</span>
                    </>
                  )}
                </button>

                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold flex items-center gap-1 transition"
                >
                  <span>Releases</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Non-disruptive InMobi WebX Banner Slot (auto-collapses if no-fill) */}
        <div className="w-full max-w-4xl mx-auto mt-6">
          <AdBanner slotId="inmobi-banner-shutdown-bottom" />
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 border-t border-white/5 py-5 px-4 text-center text-xs text-neutral-500">
        <p className="font-semibold text-neutral-400">
          NeliTv © {new Date().getFullYear()} · Huduma za Web Zimefungwa — Tumia App Rasmi ya Android
        </p>
      </footer>
    </div>
  );
};
