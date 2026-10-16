import React, { useEffect, useRef, useState, useCallback } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import { Channel, ALL_KNOWN_CLEAR_KEYS } from '../data/channels.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { getLiveCdnToken, buildPlayableStreamUrl } from '../utils/streamTokens.ts';
import {
  Volume2, VolumeX, Maximize2, Minimize2,
  RefreshCw, AlertTriangle, Sparkles,
  Lock, ArrowRight, Languages, Radio, X
} from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel;
  onSelectPlanClick?: (planId?: string) => void;
  onOpenLoginModal?: () => void;
  onPaymentInitiated?: (orderId: string, amount: number, phone: string, planName: string) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  onSelectPlanClick,
  onOpenLoginModal,
  onPaymentInitiated
}) => {
  const {
    phone,
    hasActiveSubscription,
    trialRemainingSeconds,
    trialCompleted,
    recordTrialSecondWatched
  } = useAuth();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const shakaPlayerRef = useRef<any>(null);
  const hlsPlayerRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isPaywallTriggered, setIsPaywallTriggered] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'sw' | 'en'>('sw');
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(['sw', 'en']);
  const [stallCount, setStallCount] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<any>(null);

  // Direct Pay popup state for mobile quick payment
  const [showDirectPayModal, setShowDirectPayModal] = useState<boolean>(false);
  const [directPayPhone, setDirectPayPhone] = useState<string>(phone || '');
  const [isDirectPayLoading, setIsDirectPayLoading] = useState<boolean>(false);
  const [directPayError, setDirectPayError] = useState<string | null>(null);

  const handleDirectPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectPayError(null);
    const targetPhone = directPayPhone.trim() || phone;
    if (!targetPhone) {
      setDirectPayError('Tafadhali andika namba ya simu');
      return;
    }
    const clean = targetPhone.replace(/\D/g, '');
    if (clean.length < 9) {
      setDirectPayError('Weka namba sahihi ya simu (mfano: 0712345678)');
      return;
    }

    setIsDirectPayLoading(true);
    try {
      const res = await fetch('/api/harakapay/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean,
          planId: 'plan_2days'
        })
      });
      const data = await res.json();
      if (data.success && data.orderId) {
        setShowDirectPayModal(false);
        if (onPaymentInitiated) {
          onPaymentInitiated(data.orderId, data.amount || 1000, clean, 'Kifurushi cha Siku 2');
        } else {
          onSelectPlanClick?.('plan_2days');
        }
      } else {
        setDirectPayError(data.error || 'Imeshindikana kutuma ombi la malipo. Hakikisha namba ina salio.');
      }
    } catch (err: any) {
      setDirectPayError('Hitilafu ya mtandao: ' + (err.message || 'Jaribu tena.'));
    } finally {
      setIsDirectPayLoading(false);
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  };

  const handlePlayerTap = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, a')) {
      return;
    }
    if (showControls) {
      setShowControls(false);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      resetControlsTimeout();
    }
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Install shaka polyfills once
  useEffect(() => {
    shaka.polyfill.installAll();
  }, []);

  // Check trial expiration
  useEffect(() => {
    if (!hasActiveSubscription && trialCompleted) {
      setIsPaywallTriggered(true);
      if (videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPaywallTriggered(false);
    }
  }, [hasActiveSubscription, trialCompleted]);

  // Timer to record trial usage while playing
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && !hasActiveSubscription && !trialCompleted && !isPaywallTriggered) {
      interval = setInterval(() => {
        recordTrialSecondWatched();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, hasActiveSubscription, trialCompleted, isPaywallTriggered, recordTrialSecondWatched]);

  // Main Stream Loader - fast startup, auto ABR, live sync
  useEffect(() => {
    let isMounted = true;
    let autoTokenRetried = false;
    const video = videoRef.current;
    if (!video) return;

    setErrorMessage(null);
    setIsBuffering(true);

    const cleanup = async () => {
      if (shakaPlayerRef.current) {
        try {
          await shakaPlayerRef.current.destroy();
        } catch {}
        shakaPlayerRef.current = null;
      }
      if (hlsPlayerRef.current) {
        try {
          hlsPlayerRef.current.destroy();
        } catch {}
        hlsPlayerRef.current = null;
      }
      try {
        video.pause();
      } catch {}
    };

    const loadStream = async () => {
      await cleanup();
      if (!isMounted) return;

      const isAzam = channel.isAzam || channel.streamUrl.includes('azamtvltd.co.tz');
      let targetUrl = channel.streamUrl;

      // Always resolve latest valid CDN token for Azam TV to guarantee active playback
      if (isAzam) {
        try {
          const tokenData = await getLiveCdnToken(retryCount > 0);
          targetUrl = buildPlayableStreamUrl(channel, tokenData);
        } catch (e) {
          console.warn('Token resolution fallback:', e);
          targetUrl = channel.streamUrl;
        }
      }

      // Safety timeout against infinite buffering
      const stallTimer = setTimeout(() => {
        if (isMounted && isBuffering && !errorMessage) {
          setIsBuffering(false);
        }
      }, 7000);

      // 1. DASH STREAM (Shaka Player)
      if (channel.streamFormat === 'dash') {
        try {
          if (!shaka.Player.isBrowserSupported()) {
            throw new Error('Kivinjari hakitumii DASH player.');
          }

          const player = new shaka.Player();
          await player.attach(video);
          shakaPlayerRef.current = player;

          // Build exhaustive ClearKey map (includes both hyphenated and unhyphenated IDs)
          const clearKeysConfig: Record<string, string> = {
            ...ALL_KNOWN_CLEAR_KEYS,
            ...(channel.clearKeys || {})
          };
          for (const [k, v] of Object.entries(clearKeysConfig)) {
            const clean = k.replace(/-/g, '').toLowerCase();
            clearKeysConfig[clean] = v;
            if (clean.length === 32) {
              const formatted = `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
              clearKeysConfig[formatted] = v;
            }
          }

          player.configure({
            drm: {
              clearKeys: clearKeysConfig,
              servers: {},
              preferredKeySystems: ['org.w3.clearkey']
            },
            streaming: {
              bufferingGoal: 4,          // Fast initial load
              rebufferingGoal: 2,        // Quick recovery from lag
              bufferBehind: 8,
              retryParameters: {
                maxAttempts: 4,
                baseDelay: 500,
                backoffFactor: 1.5
              }
            },
            manifest: {
              dash: {
                autoCorrectDrift: true
              },
              retryParameters: {
                maxAttempts: 4,
                baseDelay: 500,
                backoffFactor: 1.5
              }
            },
            abr: {
              enabled: true,             // Auto quality adaptation based on user network
              defaultBandwidthEstimate: 350000 // Start at fast low quality then scale up
            }
          });

          // Track available audio languages
          player.addEventListener('trackschanged', () => {
            try {
              const tracks = player.getVariantTracks();
              const langs = Array.from(new Set(tracks.map((t: any) => t.language).filter(Boolean))) as string[];
              if (langs.length > 0 && isMounted) {
                setAvailableLanguages(langs);
              }
            } catch {}
          });

          // Auto-recovery when stalled or buffering
          player.addEventListener('buffering', (event: any) => {
            if (!isMounted) return;
            setIsBuffering(event.buffering);

            // Auto-heal: if buffering in live stream, jump to live edge
            if (event.buffering) {
              const timer = setTimeout(() => {
                if (videoRef.current && isMounted && !videoRef.current.paused) {
                  try {
                    player.goToLive();
                  } catch {}
                }
              }, 2500);
              return () => clearTimeout(timer);
            }
          });

          // Error recovery with live token refresh and DRM auto-heal
          player.addEventListener('error', async (event: any) => {
            const err = event.detail;
            if (!err) return;
            // Mark error as handled so Shaka does not print unhandled error in console!
            err.handled = true;

            // If it is a severity 1 (recoverable) error, Shaka Player recovers internally
            if (err.severity === 1) {
              return;
            }

            console.warn('Player handled critical error event code:', err.code, err.message);

            if (!isMounted) return;
            clearTimeout(stallTimer);

            // 1. Handle DRM error 4012 (Missing keys) - auto heal
            if (err.code === 4012) {
              const missingKeys = err?.data?.[0]?.missingKeys as string[] | undefined;
              if (missingKeys && missingKeys.length > 0 && channel.clearKeys) {
                const secretKey = Object.values(channel.clearKeys)[0];
                if (secretKey) {
                  const updatedKeys: Record<string, string> = { ...clearKeysConfig };
                  for (const mk of missingKeys) {
                    const clean = mk.replace(/-/g, '').toLowerCase();
                    updatedKeys[mk] = secretKey;
                    updatedKeys[clean] = secretKey;
                    if (clean.length === 32) {
                      const fmt = `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
                      updatedKeys[fmt] = secretKey;
                    }
                  }
                  try {
                    player.configure({ drm: { clearKeys: updatedKeys } });
                    await player.load(targetUrl);
                    setIsBuffering(false);
                    await video.play();
                    setIsPlaying(true);
                    return;
                  } catch (e) {
                    console.warn('DRM key recovery attempt note:', e);
                  }
                }
              }
              setIsBuffering(false);
              return;
            }

            // 2. Handle CDN Token expiration / Network 1003 / 1001 / 1002 / 403 / 401
            const httpCode = err?.data?.[1];
            if (isAzam || httpCode === 403 || httpCode === 401 || err?.code === 1001 || err?.code === 1002 || err?.code === 1003) {
              try {
                const freshToken = await getLiveCdnToken(true);
                const freshUrl = buildPlayableStreamUrl(channel, freshToken);
                await player.load(freshUrl);
                setIsBuffering(false);
                await video.play();
                setIsPlaying(true);
                return;
              } catch (reloadErr) {
                console.warn('Token auto-reload retry:', reloadErr);
              }
            }

            // 3. Fallback streaming retry
            try {
              player.retryStreaming();
              setIsBuffering(false);
            } catch {
              setIsBuffering(false);
            }
          });

          await player.load(targetUrl);
          clearTimeout(stallTimer);

          if (isMounted) {
            setIsBuffering(false);
            try {
              await video.play();
              setIsPlaying(true);
            } catch {
              setIsPlaying(false);
            }
          }
        } catch (error: any) {
          console.warn('Shaka load initial note:', error);
          if (isAzam && !autoTokenRetried && shakaPlayerRef.current) {
            autoTokenRetried = true;
            try {
              const freshToken = await getLiveCdnToken(true);
              const freshUrl = buildPlayableStreamUrl(channel, freshToken);
              await shakaPlayerRef.current.load(freshUrl);
              clearTimeout(stallTimer);
              if (isMounted) {
                setIsBuffering(false);
                try {
                  await video.play();
                  setIsPlaying(true);
                } catch {
                  setIsPlaying(false);
                }
              }
              return;
            } catch (retryErr) {
              console.warn('Retry with fresh token note:', retryErr);
            }
          }
          clearTimeout(stallTimer);
          if (isMounted) {
            setIsBuffering(false);
            setErrorMessage('Inaunganisha matangazo ya moja kwa moja...');
          }
        }
      }
      // 2. HLS STREAM
      else if (channel.streamFormat === 'hls') {
        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 6,
            maxMaxBufferLength: 12,
            lowLatencyMode: true,
            backBufferLength: 4,
            liveSyncDurationCount: 2
          });
          hlsPlayerRef.current = hls;

          hls.loadSource(targetUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            if (!isMounted) return;
            setIsBuffering(false);
            try {
              await video.play();
              setIsPlaying(true);
            } catch {
              setIsPlaying(false);
            }
          });

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal) {
              hls.startLoad();
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = targetUrl;
          video.addEventListener('loadedmetadata', async () => {
            if (isMounted) {
              setIsBuffering(false);
              try {
                await video.play();
                setIsPlaying(true);
              } catch {}
            }
          });
        }
      }
      // 3. MP4 / Direct
      else {
        video.src = targetUrl;
        video.onloadeddata = async () => {
          if (isMounted) {
            setIsBuffering(false);
            try {
              await video.play();
              setIsPlaying(true);
            } catch {}
          }
        };
      }
    };

    loadStream();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [channel.id, retryCount]);

  // Video listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      // If it paused due to buffer stall, try auto resuming to live edge
      if (!isPaywallTriggered) {
        setIsPlaying(false);
      }
    };
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, [isPaywallTriggered]);

  // Language Track Switcher
  const toggleLanguage = () => {
    const newLang = selectedLanguage === 'sw' ? 'en' : 'sw';
    setSelectedLanguage(newLang);
    if (shakaPlayerRef.current) {
      try {
        shakaPlayerRef.current.selectAudioLanguage(newLang === 'sw' ? 'swa' : 'eng');
      } catch (e) {
        console.warn('Audio switch note:', e);
      }
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setIsBuffering(true);
    setRetryCount(prev => prev + 1);
  };

  // YouTube-style keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'k':
        case ' ':
          e.preventDefault();
          toggleMute(); // Realtime TV: mute/unmute instead of pause
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          video.muted = false;
          setIsMuted(false);
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          break;
        case 'arrowright':
        case 'l':
          // Resync to live edge
          if (shakaPlayerRef.current) {
            try { shakaPlayerRef.current.goToLive(); } catch {}
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const formatSeconds = (sec: number) => {
    const s = Math.max(0, sec);
    const mins = Math.floor(s / 60);
    const remainingSecs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      onClick={handlePlayerTap}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden group select-none shadow-2xl border border-neutral-900 cursor-pointer"
    >
      {/* HTML5 Video Element (Tap toggles controls, does not mute) */}
      <video
        ref={videoRef}
        playsInline
        className="w-full h-full object-contain bg-black"
      />

      {/* Buffering Indicator */}
      {isBuffering && !errorMessage && !isPaywallTriggered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none transition">
          <div className="w-12 h-12 rounded-full border-3 border-red-600 border-t-transparent animate-spin mb-3" />
          <span className="text-xs text-neutral-300 font-medium">Inaunganisha TV...</span>
        </div>
      )}

      {/* Top Left: Transparent subtle 1-Minute Trial Countdown (NO obstructive LIVE button) */}
      {!hasActiveSubscription && !isPaywallTriggered && (
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <div className="px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-[11px] font-medium text-neutral-200 flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-neutral-400">Majaribio:</span>
            <span className="font-mono font-bold text-amber-300">{formatSeconds(trialRemainingSeconds)}</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {errorMessage && !isPaywallTriggered && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/90 backdrop-blur-md text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-sm text-neutral-300 max-w-sm mb-5 leading-relaxed">
            {errorMessage}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            className="py-2.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Jaribu Tena</span>
          </button>
        </div>
      )}

      {/* 1-MINUTE TRIAL PAYWALL MODAL */}
      {isPaywallTriggered && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center p-4 sm:p-6 bg-black text-center animate-fade-in cursor-default"
        >
          {/* MOBILE VIEW (<sm): Pure black overlay, simple "Lipia kutazama", small responsive "1,000 TSH" button */}
          <div className="block sm:hidden w-full max-w-[220px] space-y-2.5">
            <p className="text-sm font-semibold text-neutral-200">
              Lipia kutazama
            </p>

            <button
              onClick={() => setShowDirectPayModal(true)}
              className="w-full py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs shadow-md transition"
            >
              1,000 TSH
            </button>

            <div className="flex items-center justify-center gap-3 pt-1 text-[11px]">
              <button
                onClick={() => onSelectPlanClick?.('plan_7days')}
                className="text-neutral-400 hover:text-white transition underline"
              >
                Vifurushi Vingine
              </button>

              {onOpenLoginModal && (
                <>
                  <span className="text-neutral-600">•</span>
                  <button
                    onClick={onOpenLoginModal}
                    className="text-neutral-400 hover:text-white transition underline"
                  >
                    Ulishalipia? Ingia
                  </button>
                </>
              )}
            </div>
          </div>

          {/* DESKTOP & TABLET VIEW (>=sm): 3-Card Grid */}
          <div className="hidden sm:flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500 mb-3">
              <Lock className="w-7 h-7" />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white mb-1.5 tracking-tight">
              Muda Wako wa Majaribio Umekwisha
            </h3>

            <p className="text-xs sm:text-sm text-neutral-300 max-w-md mb-6 leading-relaxed">
              Umetumia dakika 1 ya majaribio ya bure. Lipia kifurushi uendelee kutazama chaneli zote mubashara:
            </p>

            <div className="grid grid-cols-3 gap-3 w-full max-w-lg mb-6">
              <button
                onClick={() => onSelectPlanClick?.('plan_2days')}
                className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-red-600 text-left transition group"
              >
                <span className="text-[10px] text-neutral-400 block uppercase">Siku 2</span>
                <div className="text-base font-bold text-white group-hover:text-red-500">TZS 1,000</div>
              </button>

              <button
                onClick={() => onSelectPlanClick?.('plan_7days')}
                className="p-3 rounded-xl bg-red-600/15 border-2 border-red-600 text-left transition relative"
              >
                <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-black uppercase">
                  BORA
                </span>
                <span className="text-[10px] text-red-300 block uppercase">Wiki 1 (Siku 7)</span>
                <div className="text-base font-bold text-white">TZS 3,000</div>
              </button>

              <button
                onClick={() => onSelectPlanClick?.('plan_30days')}
                className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-red-600 text-left transition group"
              >
                <span className="text-[10px] text-neutral-400 block uppercase">Mwezi 1 (Siku 30)</span>
                <div className="text-base font-bold text-white group-hover:text-red-500">TZS 10,000</div>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onSelectPlanClick?.('plan_7days')}
                className="py-3 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-xl shadow-red-600/30 flex items-center gap-2 transition"
              >
                <span>Lipia kwa Simu Sasa</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onOpenLoginModal && (
                <button
                  onClick={onOpenLoginModal}
                  className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition"
                >
                  Ulishalipia? Ingia
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIRECT PAY POPUP MODAL (Opens directly when tapping 1,000 TSH on mobile) */}
      {showDirectPayModal && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowDirectPayModal(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl relative space-y-4"
          >
            <button
              onClick={() => setShowDirectPayModal(false)}
              className="absolute top-3.5 right-3.5 p-1 text-neutral-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Lipa Papo Hapo
              </div>
              <h3 className="text-base font-black text-white mt-0.5">
                1,000 TSH (Siku 2)
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Weka namba yako ya simu kwa ajili ya USSD push
              </p>
            </div>

            <form onSubmit={handleDirectPaySubmit} className="space-y-3.5">
              <div>
                <input
                  type="tel"
                  value={directPayPhone}
                  onChange={(e) => setDirectPayPhone(e.target.value)}
                  placeholder="07XXXXXXXX au 06XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white placeholder-neutral-500 font-mono text-sm focus:outline-none focus:border-red-500 transition"
                  autoFocus
                />
              </div>

              {directPayError && (
                <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-[11px] text-red-300">
                  {directPayError}
                </div>
              )}

              <button
                type="submit"
                disabled={isDirectPayLoading}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition disabled:opacity-50"
              >
                {isDirectPayLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Inatuma Ombi...</span>
                  </>
                ) : (
                  <span>Lipa 1,000 TSH</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* YouTube-Style Overlay Controls (Toggles on tap, auto-hides after 5s) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-all duration-300 ${
          showControls && !isPaywallTriggered
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none translate-y-2'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Volume & Channel Name */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
                resetControlsTimeout();
              }}
              className="p-2 text-white hover:text-red-500 rounded-lg hover:bg-white/10 active:scale-95 transition"
              title={isMuted ? 'Washa Sauti (M)' : 'Zima Sauti (M)'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <span className="text-xs font-semibold text-neutral-200 truncate max-w-[140px] sm:max-w-xs">
              {channel.name}
            </span>
          </div>

          {/* Right: Audio Language Switcher & Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Audio Language Switcher */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleLanguage();
                resetControlsTimeout();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-700 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              title="Badili Lugha ya Sauti (Swahili / English)"
            >
              <Languages className="w-3.5 h-3.5 text-amber-400" />
              <span>{selectedLanguage === 'sw' ? 'SW' : 'EN'}</span>
            </button>

            {/* Fullscreen */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
                resetControlsTimeout();
              }}
              className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-white/10 active:scale-95 transition"
              title="Skrini Nzima (F)"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
