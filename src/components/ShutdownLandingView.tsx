import React, { useState, useEffect } from 'react';
import {
  Download, QrCode, Smartphone, Tv, Monitor,
  ShieldCheck, AlertTriangle, Copy, Check, ExternalLink,
  Sparkles, Radio, Film, Trophy, ArrowRight
} from 'lucide-react';

export const DEFAULT_APK_DOWNLOAD_URL = 'https://github.com/baynith1/Nelitv/releases/download/v3.2.0/Nelitv.apk';
export const GITHUB_RELEASES_URL = 'https://github.com/baynith1/Nelitv/releases';
export const LATEST_RELEASE_API = 'https://api.github.com/repos/baynith1/Nelitv/releases/latest';

export const ShutdownLandingView: React.FC = () => {
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_APK_DOWNLOAD_URL);
  const [versionTag, setVersionTag] = useState<string>('v3.2.0');
  const [apkSize, setApkSize] = useState<string>('29.5 MB');
  const [copied, setCopied] = useState<boolean>(false);

  // Device detection state: default to mobile if mobile UA or small screen
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const ua = navigator.userAgent || '';
    const isTV = /SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|GoogleTV|AppleTV|HbbTV|Roku/i.test(ua);
    if (isTV) return 'desktop';
    const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i.test(ua);
    const isSmallScreen = window.innerWidth <= 768;
    return (isMobileUA || isSmallScreen) ? 'mobile' : 'desktop';
  });

  // Fetch latest GitHub APK release
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
          ? data.assets.find((a: any) => a.name?.toLowerCase().endsWith('.apk') || a.browser_download_url?.endsWith('.apk'))
          : null;

        if (apkAsset && apkAsset.browser_download_url) {
          setDownloadUrl(apkAsset.browser_download_url);
          if (apkAsset.size) {
            setApkSize(`${(apkAsset.size / (1024 * 1024)).toFixed(1)} MB`);
          }
        } else if (data.tag_name) {
          setDownloadUrl(`https://github.com/baynith1/Nelitv/releases/download/${data.tag_name}/Nelitv.apk`);
        }
      } catch (err) {
        console.warn('Failed to fetch latest GitHub release, using fallback:', err);
      }
    };

    fetchLatestRelease();
    return () => { isMounted = false; };
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  const handleDownload = () => {
    try {
      window.location.href = downloadUrl;
    } catch {
      window.open(downloadUrl, '_blank');
    }
  };

  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(downloadUrl)}`;

  return (
    <div className="min-h-screen w-full bg-[#060913] text-neutral-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-rose-500/10 via-cyan-500/10 to-transparent blur-3xl opacity-60" />
        <div className="absolute -bottom-32 right-1/4 w-[500px] h-[400px] bg-blue-600/10 blur-3xl opacity-40" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex flex-col items-center">
        {/* 1. TOP LOGO SECTION */}
        <div className="flex flex-col items-center text-center mb-8 sm:mb-10 animate-fade-in">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-[2.5px] shadow-2xl shadow-cyan-500/20 mb-4 transform hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full rounded-[22px] bg-[#070A14] flex items-center justify-center p-3 overflow-hidden">
              <img
                src="/icon.svg"
                alt="NeliTv Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_4px_16px_rgba(255,0,128,0.5)]"
              />
            </div>
          </div>

          <div className="flex items-center tracking-tight">
            <span className="font-extrabold text-2xl sm:text-3xl text-white">Neli</span>
            <span className="font-black text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-400 ml-1">
              Tv
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-medium">
            Official Live TV & Sports Streaming App
          </p>
        </div>

        {/* 2. NOTICE BANNER / STATUS CARD */}
        <div className="w-full rounded-3xl bg-[#0c1122]/90 border border-white/10 backdrop-blur-xl p-6 sm:p-8 md:p-10 shadow-2xl relative overflow-hidden mb-6">
          {/* Subtle status tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold mb-4">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span>HUDUMA ZA WEB ZIMEFUNGWA · WEBSITE SHUT DOWN</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight mb-4">
            Tovuti Hii Imefungwa Rasmi, Lakini Unaweza Kuendelea Kutazama Kupitia Simu Yako
          </h1>

          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl">
            Huduma zote za matangazo ya moja kwa moja kwenye vivinjari vya web zimesitishwa rasmi. 
            Ili kuendelea kutazama bure chaneli zote za <strong className="text-white">Azam TV, Ligi Kuu ya NBC, UEFA, Super Sport, EPL League Tv, beIN Sports, sinema na vipindi vyote</strong>, 
            tafadhali tumia <span className="text-cyan-400 font-semibold">App yetu rasmi ya simu (NeliTv APK)</span>.
          </p>

          <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Bure 100% Milele</span>
            </div>
            <span>•</span>
            <span>Hakuna Malipo Wala Vifurushi</span>
            <span>•</span>
            <span>Matangazo ya Moja kwa Moja Saa 24</span>
          </div>
        </div>

        {/* 3. DEVICE-SPECIFIC DOWNLOAD EXPERIENCE */}
        {deviceType === 'mobile' ? (
          /* MOBILE PHONE EXPERIENCE: DIRECT DOWNLOAD BUTTON */
          <div className="w-full rounded-3xl bg-gradient-to-b from-[#0f172a] to-[#0a0f1d] border border-cyan-500/30 p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-4">
              <Smartphone className="w-7 h-7" />
            </div>

            <h2 className="text-lg sm:text-xl font-black text-white mb-2">
              Pakua App ya NeliTv Kwenye Simu Yako
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-md mb-6">
              Bofya kitufe hapa chini kuanza kupakua faili la APK moja kwa moja kutoka GitHub. Sakinisha kwenye simu yako ya Android na uanze kutazama papo hapo.
            </p>

            {/* Direct Download Button (Targeting real GitHub APK release) */}
            <a
              href={downloadUrl}
              download="Nelitv.apk"
              onClick={handleDownload}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-500 hover:opacity-95 text-white font-black text-base sm:text-lg flex items-center justify-center gap-3 shadow-xl shadow-pink-600/30 transform active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-6 h-6 animate-bounce" />
              <span>Pakua App Sasa (Download APK)</span>
            </a>

            {/* File & Version Metadata */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-neutral-400">
              <span className="text-cyan-300 font-semibold">{versionTag}</span>
              <span>•</span>
              <span>{apkSize}</span>
              <span>•</span>
              <span>Android 5.0+</span>
              <span>•</span>
              <span className="text-emerald-400">Nelitv.apk</span>
            </div>

            {/* Quick 3-Step Guide */}
            <div className="w-full mt-6 pt-6 border-t border-white/10 text-left">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3">
                Jinsi ya Kusakinisha kwenye Simu:
              </h3>
              <ol className="space-y-2 text-xs text-neutral-400">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                  <span>Bofya kitufe cha juu kupakua faili la <strong className="text-white">Nelitv.apk</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                  <span>Kikamilika, fungua faili kisha bofya <strong className="text-white">"Install" (Sakinisha)</strong>. Ikikuomba ruhusa ya "Install from unknown sources", ruhusu.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                  <span>Fungua NeliTv na ufurahie mechi na vituo vyote bure bila malipo!</span>
                </li>
              </ol>
            </div>
          </div>
        ) : (
          /* PC / SMART TV EXPERIENCE: SCAN TO DOWNLOAD QR CODE */
          <div className="w-full rounded-3xl bg-gradient-to-b from-[#0f172a] to-[#0a0f1d] border border-cyan-500/30 p-6 sm:p-8 md:p-10 shadow-2xl text-center flex flex-col items-center animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-4">
              <QrCode className="w-7 h-7" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
              Skani kwa Simu Yako Ili Kupakua App (Scan to Download)
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-lg mb-6">
              Kivinjari cha kompyuta au TV kimesitishwa. Elekeza kamera ya simu yako kwenye QR Code hapa chini ili kupakua App ya NeliTv moja kwa moja kwenye simu yako.
            </p>

            {/* QR Code Container */}
            <div className="p-4 sm:p-5 bg-white rounded-3xl shadow-2xl border-4 border-cyan-500/40 inline-block mb-6 relative group">
              <img
                src={qrCodeImageUrl}
                alt="Scan to Download NeliTv APK"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                loading="eager"
              />
              <div className="mt-2 text-center text-[11px] font-mono font-bold text-neutral-800">
                Nelitv.apk • {versionTag}
              </div>
            </div>

            {/* Scan Instructions */}
            <div className="max-w-md w-full bg-[#080d1a] border border-white/10 rounded-2xl p-4 text-left mb-6 text-xs text-neutral-300 space-y-2">
              <div className="font-bold text-white flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Hatua Rahisi za Kuskani:</span>
              </div>
              <div className="flex items-start gap-2 text-neutral-400">
                <span className="font-bold text-white">1.</span>
                <span>Fungua programu ya Kamera kwenye simu yako ya mkononi.</span>
              </div>
              <div className="flex items-start gap-2 text-neutral-400">
                <span className="font-bold text-white">2.</span>
                <span>Elekeza kamera kwenye QR Code iliyo hapo juu.</span>
              </div>
              <div className="flex items-start gap-2 text-neutral-400">
                <span className="font-bold text-white">3.</span>
                <span>Bofya kiungo (link) kitakachoonekana ili kupakua APK papo hapo.</span>
              </div>
            </div>

            {/* Secondary PC/TV Actions: Direct Download & Copy Link */}
            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <a
                href={downloadUrl}
                download="Nelitv.apk"
                className="py-3 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-white/15 transition active:scale-95 cursor-pointer"
                title="Pakua faili la APK moja kwa moja kwenye kifaa hiki"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Pakua Faili la APK Moja kwa Moja</span>
              </a>

              <button
                onClick={handleCopyLink}
                className="py-3 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-white/15 transition active:scale-95 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Kiungo Kimenakiliwa!' : 'Nakili Kiungo cha Kupakua'}</span>
              </button>

              <a
                href={GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <span>GitHub Releases</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* 4. MANUAL DEVICE VIEW SWITCHER */}
        <div className="mt-8 flex items-center gap-2 bg-[#0c1122] p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setDeviceType('mobile')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              deviceType === 'mobile'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mwonekano wa Simu (Mobile)</span>
          </button>

          <button
            onClick={() => setDeviceType('desktop')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              deviceType === 'desktop'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Mwonekano wa Kompyuta / TV (QR Code)</span>
          </button>
        </div>
      </div>

      {/* 5. QUIET FOOTER */}
      <footer className="relative z-10 border-t border-white/5 py-6 px-4 text-center text-xs text-neutral-500">
        <p className="font-semibold text-neutral-400">
          NeliTv © {new Date().getFullYear()} · Makao Makuu Mombasa, Kenya · Works in Tanzania Only
        </p>
        <p className="text-[11px] text-neutral-600 mt-1">
          Tovuti imefungwa rasmi. Huduma zote zinapatikana kupitia App rasmi ya NeliTv kwa watumiaji wa simu za Android.
        </p>
      </footer>
    </div>
  );
};
