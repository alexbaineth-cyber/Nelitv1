import React, { useState, useEffect } from 'react';
import { Download, QrCode, Smartphone, ExternalLink, X, ShieldCheck, Check, Sparkles, RefreshCw } from 'lucide-react';

interface DownloadAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'direct' | 'qr';
}

export const DEFAULT_APK_DOWNLOAD_URL = 'https://github.com/baynith1/Nelitv/releases/download/v2.3.0/Nelitv.apk';
export const GITHUB_RELEASES_URL = 'https://github.com/baynith1/Nelitv/releases';
export const LATEST_RELEASE_API = 'https://api.github.com/repos/baynith1/Nelitv/releases/latest';

export const DownloadAppModal: React.FC<DownloadAppModalProps> = ({ isOpen, onClose, initialTab = 'direct' }) => {
  const [downloadUrl, setDownloadUrl] = useState<string>(DEFAULT_APK_DOWNLOAD_URL);
  const [versionTag, setVersionTag] = useState<string>('v2.3.0');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'direct' | 'qr'>(initialTab);
  const [isLoadingLatest, setIsLoadingLatest] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Automatically fetch latest release tag and APK download URL from GitHub API
  useEffect(() => {
    let isMounted = true;
    const fetchLatestRelease = async () => {
      setIsLoadingLatest(true);
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
            // Find .apk asset
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
      } catch (err) {
        console.warn('Could not auto-fetch latest release from GitHub API, using fallback:', err);
      } finally {
        if (isMounted) setIsLoadingLatest(false);
      }
    };

    fetchLatestRelease();
    return () => { isMounted = false; };
  }, []);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl).catch(() => {});
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // QR Code URL using free reliable CDN image service with fallback
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(downloadUrl)}`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden relative"
      >
        {/* Header Header */}
        <div className="p-5 pb-3 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-950 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Pakua NeliTv App
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-mono font-bold">
                  {versionTag}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Android APK kwa Simu na Smart TV
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
            title="Funga"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers: Direct Download vs Scan QR */}
        <div className="grid grid-cols-2 p-2 bg-neutral-950/60 border-b border-neutral-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('direct')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'direct'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Pakua Moja kwa Moja</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'qr'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Scan kwa Simu (QR)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {activeTab === 'direct' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Jina la Faili:</span>
                  <span className="font-mono text-white font-semibold">Nelitv.apk</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Toleo la Sasa:</span>
                  <span className="font-mono text-amber-400 font-semibold">{versionTag}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Mfumo:</span>
                  <span className="text-neutral-200">Android 5.0+ (Simu & TV)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Usalama:</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Imethibitishwa
                  </span>
                </div>
              </div>

              {/* Main Download Button */}
              <a
                href={downloadUrl}
                download="Nelitv.apk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-sm shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 transition group"
              >
                <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition" />
                <span>Pakua Nelitv.apk ({versionTag})</span>
              </a>

              {/* Secondary Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 flex items-center justify-center gap-1.5 transition"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Link Imenakiliwa!</span>
                    </>
                  ) : (
                    <span>Nakili Link ya APK</span>
                  )}
                </button>

                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 flex items-center justify-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Releases</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-3">
              <p className="text-xs text-neutral-300">
                Elekeza kamera ya simu yako kwenye QR code hii ili kupakua moja kwa moja:
              </p>

              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-neutral-700">
                <img
                  src={qrCodeImageUrl}
                  alt="Scan QR Code to Download NeliTv APK"
                  className="w-48 h-48 object-contain"
                  onError={(e) => {
                    // Fallback to simple svg placeholder if offline
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <div className="text-[11px] text-neutral-400">
                Inaelekeza moja kwa moja kwenye:
                <div className="font-mono text-[10px] text-neutral-300 truncate max-w-xs mt-0.5">
                  {downloadUrl}
                </div>
              </div>
            </div>
          )}

          {/* Installation Steps */}
          <div className="p-3 rounded-xl bg-neutral-950/50 border border-neutral-800/80 text-[11px] text-neutral-400 space-y-1.5 leading-relaxed">
            <div className="font-semibold text-neutral-300 text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Jinsi ya Kusakinisha (Installation Guide):</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>Pakua faili la <strong>Nelitv.apk</strong> kwa kubonyeza kitufe hapo juu.</li>
              <li>Fungua faili ulilopakua kisha bofya <strong>"Install"</strong>.</li>
              <li>Kama simu ikiuliza, wezesha <em>"Allow from this source"</em>.</li>
              <li>Fungua app na ufurahie mechi na chaneli zote mubashara!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
