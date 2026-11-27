import React, { useEffect, useRef, useState, useCallback } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import { Channel, ALL_KNOWN_CLEAR_KEYS } from '../data/channels.ts';
import { getLiveCdnToken, getInstantCdnToken, recoverAlternateCdnToken, buildPlayableStreamUrl, prewarmChannelConnection } from '../utils/streamTokens.ts';
import {
  Volume2, Volume1, VolumeX, Maximize2, Minimize2,
  RefreshCw, AlertTriangle, Sparkles,
  Lock, ArrowRight, ArrowLeft, Languages, Radio, X, Play,
  Sliders, Check, Gauge
} from 'lucide-react';
import { QualityMeterModal } from './QualityMeterModal.tsx';
import {
  requestFullscreenWithLandscape,
  exitFullscreenAndUnlock,
  lockLandscapeOrientation,
  unlockScreenOrientation,
  isIPhoneOrIOS
} from '../utils/orientation.ts';
import { useServiceWorkerOnline } from '../hooks/useServiceWorkerOnline.ts';
import { OfflineWatchPlaceholder } from './OfflineWatchPlaceholder.tsx';
import { AdsterraFullscreenBanner } from './AdsterraAds.tsx';

// Install shaka polyfill once at module initialization
try {
  shaka.polyfill.installAll();
} catch {}

function hexToBase64(hexString: string): string {
  try {
    const clean = hexString.replace(/[^0-9a-fA-F]/g, '');
    let binary = '';
    for (let i = 0; i < clean.length; i += 2) {
      binary += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
    }
    return btoa(binary);
  } catch {
    return '';
  }
}

function hexToBase64Url(hexString: string): string {
  const b64 = hexToBase64(hexString);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type QualityOption = 'auto' | '1080' | '720' | '480' | '360' | '240' | 'saver';

interface VideoPlayerProps {
  channel: Channel;
  fallbackChannel?: Channel;
  onSwitchChannel?: (channel: Channel) => void;
  isFullPage?: boolean;
  onBack?: () => void;
  onSelectPlanClick?: (planId?: string) => void;
  onOpenLoginModal?: () => void;
  onPaymentInitiated?: (orderId: string, amount: number, phone: string, planName: string) => void;
  onToggleFullscreen?: (isFullscreen: boolean) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  fallbackChannel,
  onSwitchChannel,
  isFullPage = false,
  onBack,
  onSelectPlanClick,
  onOpenLoginModal,
  onPaymentInitiated,
  onToggleFullscreen
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

function getBalancedStartBandwidthEstimate(): number {
  try {
    const saved = Number(localStorage.getItem('nelitv_abr_bw_bps'));
    if (Number.isFinite(saved) && saved > 250_000) {
      // Clamp startup estimate to normal balanced range (~360p-576p) so playback starts cleanly without ladder reloads
      return Math.max(650_000, Math.min(1_550_000, Math.round(saved)));
    }
  } catch {}
  return 950_000;
}

function persistAbrBandwidthEstimate(bps: number) {
  if (!Number.isFinite(bps) || bps < 200_000) return;
  try {
    localStorage.setItem('nelitv_abr_bw_bps', String(Math.round(bps)));
  } catch {}
}

  const shakaPlayerRef = useRef<any>(null);
  const hlsPlayerRef = useRef<any>(null);
  const hlsAudioPlayerRef = useRef<any>(null);
  const initialToken = getInstantCdnToken();
  const activeTokenRef = useRef<string>(initialToken.token);
  const activeCdnHostRef = useRef<string>(initialToken.cdnHost);
  const activeProviderRef = useRef<string>(initialToken.provider || 'cdn77');
  const hasFirstFrameRef = useRef<boolean>(false);
  const useSegmentProxyRef = useRef<boolean>(false);
  const loadPercentRef = useRef<number>(12);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasFirstFrame, setHasFirstFrame] = useState<boolean>(false);
  const [loadPercent, setLoadPercent] = useState<number>(12);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [showRebufferBadge, setShowRebufferBadge] = useState<boolean>(false);
  const [isUserPaused, setIsUserPaused] = useState<boolean>(false);
  const [needsUserTapToPlay, setNeedsUserTapToPlay] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('nelitv_player_volume');
      return v !== null ? Math.max(0, Math.min(1, parseFloat(v))) : 1;
    } catch {
      return 1;
    }
  });
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const isPaywallTriggered = false; // Free forever: no paywall
  const [selectedLanguage, setSelectedLanguage] = useState<'sw' | 'en'>('sw');
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(['sw', 'en']);
  const [stallCount, setStallCount] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<any>(null);

  // Quality & Internet Stability state
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>('auto');
  const [currentResolution, setCurrentResolution] = useState<string>('Auto');

  // Offline & Service Worker connectivity check for watching
  const { isOffline, swStatus, checkConnectionNow, isReconnecting } = useServiceWorkerOnline();

  const handleOfflineRetry = useCallback(async () => {
    const isBack = await checkConnectionNow();
    if (isBack) {
      setRetryCount((prev) => prev + 1);
      setErrorMessage(null);
    }
  }, [checkConnectionNow]);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showQualityMeterModal, setShowQualityMeterModal] = useState<boolean>(false);
  const [bufferSeconds, setBufferSeconds] = useState<number>(30);
  const [bitrateKbps, setBitrateKbps] = useState<number>(1800);

  // Monitor real-time buffer health and bitrate
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current) {
        const vid = videoRef.current;
        const cur = vid.currentTime;
        let buf = 0;
        for (let i = 0; i < vid.buffered.length; i++) {
          if (vid.buffered.start(i) <= cur && cur <= vid.buffered.end(i)) {
            buf = Math.max(0, vid.buffered.end(i) - cur);
            break;
          }
        }
        setBufferSeconds(buf);
      }
      if (shakaPlayerRef.current) {
        try {
          const stats = shakaPlayerRef.current.getStats();
          if (stats && stats.streamBandwidth) {
            setBitrateKbps(Math.round(stats.streamBandwidth / 1000));
          } else if (stats && stats.estimatedBandwidth) {
            setBitrateKbps(Math.round(stats.estimatedBandwidth / 1000));
          }
          if (stats && stats.estimatedBandwidth && hasFirstFrameRef.current && videoRef.current && !videoRef.current.paused) {
            persistAbrBandwidthEstimate(stats.estimatedBandwidth);
          }
        } catch {}
      } else if (hlsPlayerRef.current) {
        try {
          const bw = hlsPlayerRef.current.bandwidthEstimate;
          if (Number.isFinite(bw) && bw > 0) {
            setBitrateKbps(Math.round(bw / 1000));
            if (hasFirstFrameRef.current && videoRef.current && !videoRef.current.paused) {
              persistAbrBandwidthEstimate(bw);
            }
          }
        } catch {}
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Only show mid-stream rebuffer badge if real playback stall persists >= 2.6s (never during background quality shifts)
  useEffect(() => {
    if (!hasFirstFrame || !isBuffering || errorMessage || isOffline || isUserPaused) {
      setShowRebufferBadge(false);
      return;
    }
    const timer = setTimeout(() => {
      const vid = videoRef.current;
      if (vid && vid.readyState < 3 && !vid.paused) {
        setShowRebufferBadge(true);
      }
    }, 2600);
    return () => clearTimeout(timer);
  }, [hasFirstFrame, isBuffering, errorMessage, isOffline, isUserPaused]);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const handlePlayerTap = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, a, form, [data-player-ui]')) {
      return;
    }
    // Attempt smooth un-mute on user tap if video was muted by browser autoplay policy
    if (videoRef.current && isMuted) {
      try {
        videoRef.current.muted = false;
        setIsMuted(false);
      } catch {}
    }
    if (audioRef.current && isMuted) {
      try {
        audioRef.current.muted = false;
      } catch {}
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

  // Dual-Stream Real-Time Synchronization for ESPN 7 (video + audio sync)
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !channel.audioUrl) return;

    const handlePlay = () => {
      audio.muted = video.muted;
      audio.volume = video.muted ? 0 : video.volume;
      audio.play().catch(() => {});
    };

    const handlePause = () => {
      audio.pause();
    };

    const handleVolume = () => {
      audio.muted = video.muted;
      audio.volume = video.muted ? 0 : video.volume;
    };

    const handleSeeking = () => {
      audio.currentTime = video.currentTime;
    };

    const handleTimeUpdate = () => {
      if (!audio.paused && !video.paused) {
        const drift = Math.abs(audio.currentTime - video.currentTime);
        if (drift > 0.35) {
          audio.currentTime = video.currentTime;
        }
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolume);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolume);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [channel.audioUrl]);

  const isEmbedded = channel.streamFormat === 'embed' || Boolean(channel.embedUrl);

  // Continuous token keeper for Azam channels so live streams never hit token expiration
  useEffect(() => {
    const isAzam =
      channel.isAzam ||
      channel.streamUrl.includes('azamtvltd.co.tz') ||
      channel.streamUrl.includes('cdn77.org');
    if (!isAzam) return;

    const keeper = setInterval(async () => {
      try {
        const fresh = await getLiveCdnToken(false);
        if (fresh?.token) {
          activeTokenRef.current = fresh.token;
          activeCdnHostRef.current = fresh.cdnHost || activeCdnHostRef.current;
          activeProviderRef.current = fresh.provider || activeProviderRef.current;
        }
      } catch {}
    }, 45 * 1000);

    return () => clearInterval(keeper);
  }, [channel.id, channel.isAzam, channel.streamUrl]);

  // Main Stream Loader - 0ms instant startup, background loading, live-edge safe, zero 1-min black screen
  useEffect(() => {
    let isMounted = true;
    const video = videoRef.current;
    if (!video) return;

    hasFirstFrameRef.current = false;
    useSegmentProxyRef.current = false;
    loadPercentRef.current = 12;
    setLoadPercent(12);
    setHasFirstFrame(false);
    setNeedsUserTapToPlay(false);
    setErrorMessage(null);
    setIsBuffering(false);
    prewarmChannelConnection(channel);

    let earlyNudgeTimer: ReturnType<typeof setTimeout> | null = null;
    let fastProxyFailoverTimer: ReturnType<typeof setTimeout> | null = null;
    let hardTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let progressTicker: ReturnType<typeof setInterval> | null = null;

    const advanceProgress = (minPct: number) => {
      if (!isMounted) return;
      if (minPct > loadPercentRef.current) {
        loadPercentRef.current = Math.min(100, Math.round(minPct));
        setLoadPercent(loadPercentRef.current);
      }
    };

    const clearWatchdogs = () => {
      if (earlyNudgeTimer) {
        clearTimeout(earlyNudgeTimer);
        earlyNudgeTimer = null;
      }
      if (fastProxyFailoverTimer) {
        clearTimeout(fastProxyFailoverTimer);
        fastProxyFailoverTimer = null;
      }
      if (hardTimeoutTimer) {
        clearTimeout(hardTimeoutTimer);
        hardTimeoutTimer = null;
      }
      if (progressTicker) {
        clearInterval(progressTicker);
        progressTicker = null;
      }
    };

    const markFrameReady = () => {
      if (!isMounted) return;
      advanceProgress(100);
      if (!hasFirstFrameRef.current) {
        hasFirstFrameRef.current = true;
        setHasFirstFrame(true);
      }
      setIsBuffering(false);
      clearWatchdogs();
    };

    // Smooth monotonic progress ticker while network packets & decoder warm up
    progressTicker = setInterval(() => {
      if (!isMounted || hasFirstFrameRef.current) return;
      const cur = loadPercentRef.current;
      const vid = videoRef.current;
      if (vid && vid.readyState >= 2) {
        markFrameReady();
        return;
      }
      if (cur < 35) {
        advanceProgress(cur + 6);
      } else if (cur < 68) {
        advanceProgress(cur + 4);
      } else if (cur < 88) {
        advanceProgress(cur + 2);
      } else if (cur < 96) {
        advanceProgress(cur + 1);
      }
    }, 180);

    const cleanup = async () => {
      clearWatchdogs();
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
      if (hlsAudioPlayerRef.current) {
        try {
          hlsAudioPlayerRef.current.destroy();
        } catch {}
        hlsAudioPlayerRef.current = null;
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        } catch {}
      }
      try {
        video.pause();
      } catch {}
    };

    const loadStream = async () => {
      // Only await cleanup when switching away from an already-initialized player
      if (shakaPlayerRef.current || hlsPlayerRef.current || hlsAudioPlayerRef.current) {
        await cleanup();
      } else {
        if (earlyNudgeTimer) { clearTimeout(earlyNudgeTimer); earlyNudgeTimer = null; }
        if (fastProxyFailoverTimer) { clearTimeout(fastProxyFailoverTimer); fastProxyFailoverTimer = null; }
        if (hardTimeoutTimer) { clearTimeout(hardTimeoutTimer); hardTimeoutTimer = null; }
      }
      if (!isMounted) return;
      setIsUserPaused(false);
      advanceProgress(24);

      // Automated instant play with muted policy fallback & explicit tap-to-play fallback
      const attemptAutoPlay = async () => {
        if (!isMounted) return;
        const vid = videoRef.current;
        if (!vid) return;
        if (vid.readyState >= 2) {
          markFrameReady();
        }
        try {
          vid.muted = false;
          await vid.play();
          setIsPlaying(true);
          setIsMuted(false);
          setNeedsUserTapToPlay(false);
          if (vid.readyState >= 2) markFrameReady();
        } catch {
          try {
            vid.muted = true;
            setIsMuted(true);
            await vid.play();
            setIsPlaying(true);
            setNeedsUserTapToPlay(false);
            if (vid.readyState >= 2) markFrameReady();
          } catch {
            if (isMounted) {
              setNeedsUserTapToPlay(true);
              if (vid.readyState >= 2) markFrameReady();
            }
          }
        }

        if (channel.audioUrl && audioRef.current) {
          try {
            audioRef.current.muted = vid.muted;
            audioRef.current.volume = vid.muted ? 0 : (volume || 1);
            await audioRef.current.play();
          } catch {}
        }
      };

      const isAzam =
        channel.isAzam ||
        channel.streamUrl.includes('azamtvltd.co.tz') ||
        channel.streamUrl.includes('cdn77.org');
      let targetUrl = channel.streamUrl;
      let hasTriedAlternateProvider = false;
      let hasTriedProxyFallback = false;

      // 0ms Instant Token/Host Resolution + Silent Background Refresh (never blocks player startup!)
      if (isAzam) {
        const instantToken = getInstantCdnToken();
        activeTokenRef.current = instantToken.token;
        activeCdnHostRef.current = instantToken.cdnHost;
        activeProviderRef.current = instantToken.provider || 'cdn77';
        targetUrl = buildPlayableStreamUrl(channel, instantToken);

        // Background token refresh — updates activeTokenRef seamlessly without delaying startup
        void getLiveCdnToken(retryCount > 0)
          .then((freshToken) => {
            if (!isMounted || !freshToken?.token) return;
            activeTokenRef.current = freshToken.token;
            activeCdnHostRef.current = freshToken.cdnHost || activeCdnHostRef.current;
            activeProviderRef.current = freshToken.provider || activeProviderRef.current;
          })
          .catch(() => {});
      }

      // 0. EMBEDDED STREAM (Baynith Sports 1 & 2, etc.)
      if (channel.streamFormat === 'embed' || channel.embedUrl) {
        markFrameReady();
        setIsPlaying(true);
        return;
      }

      // Background watchdogs to prevent 1-minute black screens
      earlyNudgeTimer = setTimeout(() => {
        if (isMounted && videoRef.current && videoRef.current.readyState >= 2) {
          markFrameReady();
          if (videoRef.current.paused) {
            void attemptAutoPlay();
          }
        }
      }, 1500);

      // 1. DASH STREAM (Shaka Player)
      if (channel.streamFormat === 'dash') {
        try {
          if (!shaka.Player.isBrowserSupported()) {
            throw new Error('Kivinjari hakitumii DASH player.');
          }

          const player = new shaka.Player();
          await player.attach(video);
          shakaPlayerRef.current = player;

          // Build clean ClearKey map (exact 32-character lowercase hex keys)
          const clearKeysConfig: Record<string, string> = {};
          const rawKeyMap = {
            ...ALL_KNOWN_CLEAR_KEYS,
            ...(channel.clearKeys || {})
          };

          for (const [k, v] of Object.entries(rawKeyMap)) {
            const cleanK = k.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            const cleanV = v.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
            if (cleanK.length === 32 && cleanV.length === 32) {
              clearKeysConfig[cleanK] = cleanV;
            }
          }

          player.configure({
            preferredAudioLanguage: selectedLanguage === 'en' ? 'en' : 'sw',
            drm: {
              clearKeys: clearKeysConfig,
              preferredKeySystems: ['org.w3.clearkey'],
              servers: {},
              retryParameters: {
                maxAttempts: 2,
                baseDelay: 150,
                backoffFactor: 1.3
              }
            },
            streaming: {
              bufferingGoal: 18,
              rebufferingGoal: 2.5,
              bufferBehind: 20,
              safeSeekOffset: 10,
              startAtSegmentBoundary: true,
              gapDetectionThreshold: 0.6,
              stallEnabled: true,
              stallThreshold: 1.5,
              stallSkip: 0.25,
              segmentPrefetchLimit: 2,
              ignoreTextStreamFailures: true,
              retryParameters: {
                maxAttempts: 3,
                baseDelay: 250,
                backoffFactor: 1.5,
                timeout: 9000
              }
            },
            manifest: {
              disableText: true,
              defaultPresentationDelay: 12,
              dash: {
                autoCorrectDrift: true,
                ignoreMinBufferTime: true,
                ignoreSuggestedPresentationDelay: false
              },
              retryParameters: {
                maxAttempts: 3,
                baseDelay: 250,
                backoffFactor: 1.5,
                timeout: 9000
              }
            },
            abr: {
              enabled: selectedQuality === 'auto',
              defaultBandwidthEstimate: getBalancedStartBandwidthEstimate(),
              switchInterval: 18,
              bandwidthDowngradeTarget: 0.90,
              bandwidthUpgradeTarget: 0.55
            }
          });

          // Register Shaka Request Filter for Permanent cdn77, Azam TV & Proxy Relay Failover
          player.getNetworkingEngine().clearAllRequestFilters();
          player.getNetworkingEngine().registerRequestFilter((_type: any, request: any) => {
            const currentToken = activeTokenRef.current;
            const currentHost = activeCdnHostRef.current || 'https://1445733302.rsc.cdn77.org';

            if (!request.uris || request.uris.length === 0) return;

            request.uris = request.uris.map((uri: string) => {
              let updatedUri = uri;
              if (updatedUri.includes('/api/proxy-stream') || updatedUri.includes('/api/proxy-relay/')) {
                return updatedUri;
              }
              if (
                updatedUri.includes('cdn77.org') ||
                updatedUri.includes('azamtvltd') ||
                updatedUri.includes('/live/eds/')
              ) {
                const useJwtAzam = currentHost.includes('azamtvltd') && currentToken.includes('.');
                const desiredHost = useJwtAzam
                  ? currentHost
                  : currentHost.includes('cdn77.org')
                  ? currentHost
                  : 'https://1445733302.rsc.cdn77.org';

                try {
                  const targetHostUrl = new URL(desiredHost);
                  const reqUrl = new URL(updatedUri);
                  reqUrl.hostname = targetHostUrl.hostname;
                  reqUrl.protocol = targetHostUrl.protocol;
                  if (targetHostUrl.port) reqUrl.port = targetHostUrl.port;
                  reqUrl.searchParams.delete('cdntoken');
                  if (useJwtAzam) {
                    if (/\/tok_[^/]+\//.test(reqUrl.pathname)) {
                      reqUrl.pathname = reqUrl.pathname.replace(/\/tok_[^/]+\//, `/tok_${currentToken}/`);
                    } else if (reqUrl.pathname.includes('/live/eds/')) {
                      reqUrl.pathname = reqUrl.pathname.replace('/live/eds/', `/tok_${currentToken}/live/eds/`);
                    }
                  } else {
                    reqUrl.pathname = reqUrl.pathname.replace(/^\/tok_[^/]+/, '');
                  }
                  updatedUri = reqUrl.toString();
                } catch {}

                if (useSegmentProxyRef.current) {
                  return `/api/proxy-stream?url=${encodeURIComponent(updatedUri)}&app=nelitv`;
                }
              }
              return updatedUri;
            });
          });

          // Background failover to clean ClearKey-normalized proxy MPD ONLY if direct CDN delivers zero bytes after 12s
          fastProxyFailoverTimer = setTimeout(async () => {
            if (!isMounted || hasFirstFrameRef.current || !shakaPlayerRef.current) return;
            const vid = videoRef.current;
            if (vid && (vid.readyState >= 1 || vid.buffered.length > 0)) {
              if (vid.readyState >= 2) markFrameReady();
              return;
            }
            if (!hasTriedProxyFallback) {
              hasTriedProxyFallback = true;
              useSegmentProxyRef.current = true;
              try {
                const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv`;
                await shakaPlayerRef.current.load(proxyUrl);
                if (isMounted) await attemptAutoPlay();
              } catch {}
            }
          }, 12000);

          // Hard timeout prevents infinite 96% hang if upstream & proxy both fail
          hardTimeoutTimer = setTimeout(() => {
            if (!isMounted || hasFirstFrameRef.current) return;
            if (videoRef.current && videoRef.current.readyState >= 2) {
              markFrameReady();
              return;
            }
            clearWatchdogs();
            setIsBuffering(false);
            setErrorMessage('Mkondo umechelewesha majibu kutoka mtandaoni. Bofya Jaribu Tena.');
          }, 20000);

          player.addEventListener('adaptation', () => {
            advanceProgress(72);
            try {
              const tracks = player.getVariantTracks();
              const active = tracks.find((t: any) => t.active);
              if (active && active.height && isMounted) {
                setCurrentResolution(`${active.height}p`);
              }
            } catch {}
          });

          player.addEventListener('variantchanged', () => {
            advanceProgress(78);
            try {
              const tracks = player.getVariantTracks();
              const active = tracks.find((t: any) => t.active);
              if (active && active.height && isMounted) {
                setCurrentResolution(`${active.height}p`);
              }
            } catch {}
          });

          player.addEventListener('trackschanged', () => {
            advanceProgress(55);
            try {
              const tracks = player.getVariantTracks();
              const langs = Array.from(new Set(tracks.map((t: any) => t.language).filter(Boolean))) as string[];
              if (langs.length > 0 && isMounted) {
                setAvailableLanguages(langs);
              }
              const active = tracks.find((t: any) => t.active);
              if (active && active.height && isMounted) {
                setCurrentResolution(`${active.height}p`);
              }
            } catch {}
          });

          // Track buffering quietly without panic-dropping quality or disabling ABR on minor network jitter
          player.addEventListener('buffering', (event: any) => {
            if (!isMounted) return;
            if (!event.buffering && videoRef.current && videoRef.current.readyState >= 2) {
              markFrameReady();
              return;
            }
            if (hasFirstFrameRef.current) {
              setIsBuffering(Boolean(event.buffering));
            }
          });

          const switchToProxyFast = async () => {
            if (hasTriedProxyFallback || !shakaPlayerRef.current) return false;
            hasTriedProxyFallback = true;
            useSegmentProxyRef.current = true;
            try {
              const fresh = await getLiveCdnToken(false);
              if (fresh?.token) {
                activeTokenRef.current = fresh.token;
                activeCdnHostRef.current = fresh.cdnHost || activeCdnHostRef.current;
                targetUrl = buildPlayableStreamUrl(channel, fresh);
              }
              const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv`;
              await shakaPlayerRef.current.load(proxyUrl);
              setErrorMessage(null);
              await attemptAutoPlay();
              return true;
            } catch {
              return false;
            }
          };

          let shakaStreamingRetries = 0;

          // Fast Error Recovery (Normalized ClearKey proxy first with auto-heal, then alternate provider, finite retries)
          player.addEventListener('error', async (event: any) => {
            const err = event.detail;
            if (!err) return;
            err.handled = true;

            if (err.severity === 1) return;
            if (!isMounted) return;

            // 1. Handle DRM missing keys specifically before generic DRM failover
            if (err.code === 6007 || err.code === 6008) {
              const missingKeys = (Array.isArray(err?.data) ? err.data[0] : err?.data?.[0]?.missingKeys) as string[] | string | undefined;
              if (missingKeys && missingKeys.length > 0 && channel.clearKeys) {
                const secretKey = Object.values(channel.clearKeys)[0];
                if (secretKey) {
                  const cleanSecret = secretKey.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
                  const updatedKeys: Record<string, string> = { ...clearKeysConfig };
                  const keyArr = Array.isArray(missingKeys) ? missingKeys : [missingKeys];
                  for (const mk of keyArr) {
                    const clean = mk.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
                    if (clean.length === 32 && cleanSecret.length === 32) {
                      updatedKeys[clean] = cleanSecret;
                    }
                  }
                  try {
                    player.configure({ drm: { clearKeys: updatedKeys, preferredKeySystems: ['org.w3.clearkey'] } });
                    await player.load(useSegmentProxyRef.current ? `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv` : targetUrl);
                    await attemptAutoPlay();
                    return;
                  } catch {}
                }
              }
            }

            // 2. Switch to normalized proxy MPD on DRM (6001-6012), MSE/Media (3014-3016), Manifest (4001-4032), or Network errors
            const httpCode = err?.data?.[1];
            const isDrmError = err?.code >= 6001 && err?.code <= 6012;
            const isMediaOrManifestError = (err?.code >= 3014 && err?.code <= 3016) || (err?.code >= 4001 && err?.code <= 4032);
            const isNetworkError = err?.code === 1001 || err?.code === 1002 || err?.code === 1003 || httpCode === 429 || httpCode === 403 || httpCode === 401;

            if (isDrmError || isMediaOrManifestError || isNetworkError || isAzam) {
              if (!hasTriedProxyFallback && (await switchToProxyFast())) return;

              if (isAzam && !hasTriedAlternateProvider) {
                hasTriedAlternateProvider = true;
                try {
                  const altToken = await recoverAlternateCdnToken(activeProviderRef.current);
                  activeTokenRef.current = altToken.token;
                  activeCdnHostRef.current = altToken.cdnHost;
                  activeProviderRef.current = altToken.provider || activeProviderRef.current;
                  targetUrl = buildPlayableStreamUrl(channel, altToken);
                  const reloadUrl = useSegmentProxyRef.current
                    ? `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv`
                    : targetUrl;
                  await player.load(reloadUrl);
                  setErrorMessage(null);
                  await attemptAutoPlay();
                  return;
                } catch {}
              }
            }

            if (shakaStreamingRetries < 2) {
              shakaStreamingRetries += 1;
              try {
                if (player.retryStreaming()) return;
              } catch {}
            }

            if (!hasFirstFrameRef.current && isMounted) {
              clearWatchdogs();
              setIsBuffering(false);
              setErrorMessage('Mkondo haujibu kwa sasa. Bofya Jaribu Tena.');
            }
          });

          await player.load(targetUrl);
          if (isMounted) {
            await attemptAutoPlay();
          }
        } catch {
          if (shakaPlayerRef.current && isMounted) {
            if (!hasTriedProxyFallback) {
              hasTriedProxyFallback = true;
              useSegmentProxyRef.current = true;
              try {
                const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv`;
                await shakaPlayerRef.current.load(proxyUrl);
                if (isMounted) {
                  await attemptAutoPlay();
                  return;
                }
              } catch {}
            }

            if (isAzam && !hasTriedAlternateProvider) {
              hasTriedAlternateProvider = true;
              try {
                const altToken = await recoverAlternateCdnToken(activeProviderRef.current);
                activeTokenRef.current = altToken.token;
                activeCdnHostRef.current = altToken.cdnHost;
                activeProviderRef.current = altToken.provider || activeProviderRef.current;
                targetUrl = buildPlayableStreamUrl(channel, altToken);
                await shakaPlayerRef.current.load(targetUrl);
                if (isMounted) {
                  await attemptAutoPlay();
                  return;
                }
              } catch {}
            }
          }

          clearWatchdogs();
          if (isMounted) {
            setIsBuffering(false);
            setErrorMessage('Mkondo una msongamano kwa sasa. Bofya Jaribu Tena.');
          }
        }
      }
      // 2. HLS STREAM (Instant lowest-level startup + automatic CORS proxy failover + finite retries)
      else if (channel.streamFormat === 'hls') {
        if (channel.preferProxy && !targetUrl.includes('/api/proxy-stream') && !targetUrl.startsWith('/')) {
          targetUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv`;
        }

        hardTimeoutTimer = setTimeout(() => {
          if (!isMounted || hasFirstFrameRef.current) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            markFrameReady();
            return;
          }
          clearWatchdogs();
          setIsBuffering(false);
          setErrorMessage('Mkondo umechelewesha majibu kutoka mtandaoni. Bofya Jaribu Tena.');
        }, 16000);

        if (Hls.isSupported()) {
          let hlsNetworkRetries = 0;
          let hlsMediaRetries = 0;
          let hasTriedHlsProxy = targetUrl.includes('/api/proxy-stream');

          const hls = new Hls({
            enableWorker: true,
            startLevel: -1,
            abrEwmaDefaultEstimate: getBalancedStartBandwidthEstimate(),
            abrEwmaSlowLive: 9.0,
            abrEwmaFastLive: 4.5,
            abrMaxWithRealBitrate: true,
            maxBufferLength: 20,
            maxMaxBufferLength: 36,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 8,
            lowLatencyMode: false,
            backBufferLength: 12,
            autoStartLoad: true,
            capLevelToPlayerSize: false,
            abrBandWidthFactor: 0.85,
            abrBandWidthUpFactor: 0.52,
            manifestLoadingTimeOut: 7500,
            manifestLoadingMaxRetry: 2,
            fragLoadingTimeOut: 8500,
            fragLoadingMaxRetry: 2,
          });
          hlsPlayerRef.current = hls;

          hls.loadSource(targetUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            if (!isMounted) return;
            // Start at balanced ~480p level while keeping Auto ABR active (prevents 240p->480p->720p ladder jumps)
            try {
              if (selectedQuality === 'auto' && hls.levels && hls.levels.length > 2) {
                let bestNormalIdx = Math.floor(hls.levels.length / 2);
                let bestDiff = 99999;
                hls.levels.forEach((lvl: any, idx: number) => {
                  const diff = Math.abs((lvl.height || 0) - 480);
                  if (lvl.height && diff < bestDiff) {
                    bestDiff = diff;
                    bestNormalIdx = idx;
                  }
                });
                hls.nextAutoLevel = bestNormalIdx;
              }
            } catch {}
            advanceProgress(58);
            setErrorMessage(null);
            await attemptAutoPlay();
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_e: any, data: any) => {
            if (!isMounted) return;
            try {
              const lvl = hls.levels?.[data.level];
              if (lvl?.height) {
                setCurrentResolution(`${lvl.height}p`);
              }
            } catch {}
          });

          hls.on(Hls.Events.FRAG_BUFFERED, () => {
            advanceProgress(88);
            if (isMounted && videoRef.current && videoRef.current.readyState >= 2) {
              markFrameReady();
            }
          });

          hls.on(Hls.Events.BUFFER_STALLED, () => {
            // Do not yank manual nextLevel = 0; allow YouTube-style smooth ABR buffer recovery in background
          });

          hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (!data.fatal || !isMounted) return;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (!hasTriedHlsProxy) {
                hasTriedHlsProxy = true;
                const proxiedHlsUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv`;
                targetUrl = proxiedHlsUrl;
                try {
                  hls.loadSource(proxiedHlsUrl);
                  hls.startLoad();
                  return;
                } catch {}
              }
              if (hlsNetworkRetries < 2) {
                hlsNetworkRetries += 1;
                hls.startLoad();
                return;
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              if (hlsMediaRetries === 0) {
                hlsMediaRetries += 1;
                hls.recoverMediaError();
                return;
              } else if (hlsMediaRetries === 1) {
                hlsMediaRetries += 1;
                try { hls.swapAudioCodec(); } catch {}
                hls.recoverMediaError();
                return;
              }
            }

            try {
              hls.destroy();
            } catch {}
            clearWatchdogs();
            setIsBuffering(false);
            if (isMounted && !hasFirstFrameRef.current) {
              setErrorMessage('Mkondo haujibu kwa sasa. Bofya Jaribu Tena.');
            }
          });

          if (channel.audioUrl && audioRef.current) {
            try {
              const audioHls = new Hls({
                maxBufferLength: 6,
                lowLatencyMode: true,
                autoStartLoad: true
              });
              hlsAudioPlayerRef.current = audioHls;
              audioHls.loadSource(channel.audioUrl);
              audioHls.attachMedia(audioRef.current);
            } catch {}
          }
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          let triedNativeProxy = targetUrl.includes('/api/proxy-stream');
          video.src = targetUrl;
          if (channel.audioUrl && audioRef.current) {
            audioRef.current.src = channel.audioUrl;
          }
          video.onloadedmetadata = async () => {
            if (isMounted) {
              advanceProgress(72);
              await attemptAutoPlay();
            }
          };
          video.onerror = () => {
            if (!isMounted) return;
            if (!triedNativeProxy) {
              triedNativeProxy = true;
              const proxied = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}&app=nelitv`;
              targetUrl = proxied;
              video.src = proxied;
              video.load();
              return;
            }
            clearWatchdogs();
            setIsBuffering(false);
            setErrorMessage('Mkondo haujibu kwa sasa. Bofya Jaribu Tena.');
          };
        }
      }
      // 3. MP4 / Direct
      else {
        hardTimeoutTimer = setTimeout(() => {
          if (!isMounted || hasFirstFrameRef.current) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            markFrameReady();
            return;
          }
          clearWatchdogs();
          setIsBuffering(false);
          setErrorMessage('Mkondo umechelewesha majibu kutoka mtandaoni. Bofya Jaribu Tena.');
        }, 16000);

        video.src = targetUrl;
        video.onloadeddata = async () => {
          if (isMounted) {
            markFrameReady();
            await attemptAutoPlay();
          }
        };
        video.oncanplay = async () => {
          if (isMounted) {
            markFrameReady();
            if (!isPlaying) await attemptAutoPlay();
          }
        };
        video.onerror = () => {
          if (!isMounted) return;
          clearWatchdogs();
          setIsBuffering(false);
          setErrorMessage('Mkondo haujibu kwa sasa. Bofya Jaribu Tena.');
        };
      }
    };

    void loadStream();

    return () => {
      isMounted = false;
      void cleanup();
    };
  }, [channel.id, retryCount]);

  // Video frame & buffering state listeners (clears loading immediately on first frame)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleFirstFrame = () => {
      hasFirstFrameRef.current = true;
      setHasFirstFrame(true);
      setIsBuffering(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setNeedsUserTapToPlay(false);
      if (video.readyState >= 2) handleFirstFrame();
    };

    const handlePause = () => {
      if (!isPaywallTriggered) {
        setIsPlaying(false);
      }
    };
    const handleWaiting = () => {
      if (hasFirstFrameRef.current) setIsBuffering(true);
    };
    const handlePlaying = () => {
      handleFirstFrame();
      setIsPlaying(true);
      setNeedsUserTapToPlay(false);
    };
    const handleTimeUpdate = () => {
      if (!hasFirstFrameRef.current && (video.currentTime > 0 || video.readyState >= 2)) {
        handleFirstFrame();
      }
    };

    video.addEventListener('loadeddata', handleFirstFrame);
    video.addEventListener('canplay', handleFirstFrame);
    video.addEventListener('canplaythrough', handleFirstFrame);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('loadeddata', handleFirstFrame);
      video.removeEventListener('canplay', handleFirstFrame);
      video.removeEventListener('canplaythrough', handleFirstFrame);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isPaywallTriggered, channel.id]);

  // Quality Switcher with Automatic Internet Adaptation (Optimized for Tanzania Networks)
  const handleSelectQuality = (q: QualityOption) => {
    setSelectedQuality(q);
    setShowQualityMenu(false);

    if (shakaPlayerRef.current) {
      const player = shakaPlayerRef.current;
      if (q === 'auto') {
        player.configure({
          abr: {
            enabled: true,
            defaultBandwidthEstimate: getBalancedStartBandwidthEstimate(),
            switchInterval: 18,
            bandwidthDowngradeTarget: 0.90,
            bandwidthUpgradeTarget: 0.55
          }
        });
        setCurrentResolution('Auto');
      } else if (q === 'saver') {
        // Data Saver Mode: Lock to lowest available track to save data
        player.configure({ abr: { enabled: false } });
        try {
          const tracks = player.getVariantTracks();
          const sorted = [...tracks].sort((a: any, b: any) => (a.bandwidth || 0) - (b.bandwidth || 0));
          const lowest = sorted[0];
          if (lowest) {
            player.selectVariantTrack(lowest, /* clearBuffer */ false);
            setCurrentResolution(`${lowest.height || 240}p Saver`);
          }
        } catch (err) {
          console.warn('Saver track selection note:', err);
        }
      } else {
        // Disable ABR and select specific variant track (240p, 360p, 480p, 720p, 1080p)
        player.configure({ abr: { enabled: false } });
        const targetHeight = parseInt(q, 10);
        try {
          const tracks = player.getVariantTracks();
          let bestTrack = tracks.find((t: any) => t.height === targetHeight);
          if (!bestTrack) {
            bestTrack = tracks.reduce((prev: any, curr: any) => {
              return Math.abs((curr.height || 0) - targetHeight) < Math.abs((prev.height || 0) - targetHeight) ? curr : prev;
            }, tracks[0]);
          }
          if (bestTrack) {
            player.selectVariantTrack(bestTrack, /* clearBuffer */ false);
            setCurrentResolution(`${bestTrack.height || targetHeight}p`);
          }
        } catch (err) {
          console.warn('Track selection note:', err);
        }
      }
    } else if (hlsPlayerRef.current) {
      const hls = hlsPlayerRef.current;
      if (q === 'auto') {
        hls.currentLevel = -1; // Auto ABR in HLS.js
        setCurrentResolution('Auto');
      } else if (q === 'saver') {
        // Data Saver in HLS: lock to level 0 (lowest bitrate)
        hls.currentLevel = 0;
        const levels = hls.levels || [];
        setCurrentResolution(`${levels[0]?.height || 240}p Saver`);
      } else {
        const targetHeight = parseInt(q, 10);
        const levels = hls.levels || [];
        let bestIdx = -1;
        let minDiff = 99999;
        levels.forEach((lvl: any, idx: number) => {
          const diff = Math.abs((lvl.height || 0) - targetHeight);
          if (diff < minDiff) {
            minDiff = diff;
            bestIdx = idx;
          }
        });
        if (bestIdx >= 0) {
          hls.currentLevel = bestIdx;
          setCurrentResolution(`${levels[bestIdx].height || targetHeight}p`);
        }
      }
    }
  };

  // Language Track Switcher (matches both 2-letter 'sw'/'en' and 3-letter 'swa'/'eng')
  const toggleLanguage = () => {
    const newLang = selectedLanguage === 'sw' ? 'en' : 'sw';
    setSelectedLanguage(newLang);
    if (shakaPlayerRef.current) {
      try {
        const langs: string[] = shakaPlayerRef.current.getAudioLanguages?.() || [];
        const candidates = newLang === 'sw' ? ['sw', 'swa'] : ['en', 'eng'];
        const matched = candidates.find((c) => langs.some((l) => l.toLowerCase().startsWith(c))) || candidates[0];
        shakaPlayerRef.current.selectAudioLanguage(matched);
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

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    const isFs = Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      isFullscreen
    );
    if (!isFs) {
      // 1. Activate Full-Page mode immediately (vital for iPhone Safari & mobile WebViews)
      setIsFullscreen(true);
      if (onToggleFullscreen) onToggleFullscreen(true);

      // Lock body scroll on iOS/Android to prevent background page scrolling
      try {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'relative';
      } catch {}

      // 2. Request native HTML5 / iOS video fullscreen with landscape orientation
      await requestFullscreenWithLandscape(containerRef.current, videoRef.current);
    } else {
      // Exit fullscreen
      setIsFullscreen(false);
      if (onToggleFullscreen) onToggleFullscreen(false);

      // Restore body scrolling
      try {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
      } catch {}

      await exitFullscreenAndUnlock(videoRef.current);
    }
  };

  // Fullscreen change listener to sync orientation and webkit native video events
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      if (isFs) {
        setIsFullscreen(true);
        if (onToggleFullscreen) onToggleFullscreen(true);
        lockLandscapeOrientation();
      } else if (!isFullscreen) {
        setIsFullscreen(false);
        if (onToggleFullscreen) onToggleFullscreen(false);
        unlockScreenOrientation();
      }
    };

    const video = videoRef.current;
    const handleWebkitBegin = () => {
      setIsFullscreen(true);
      if (onToggleFullscreen) onToggleFullscreen(true);
    };
    const handleWebkitEnd = () => {
      setIsFullscreen(false);
      if (onToggleFullscreen) onToggleFullscreen(false);
      try {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
      } catch {}
      unlockScreenOrientation();
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    if (video) {
      video.addEventListener('webkitbeginfullscreen', handleWebkitBegin);
      video.addEventListener('webkitendfullscreen', handleWebkitEnd);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', handleWebkitBegin);
        video.removeEventListener('webkitendfullscreen', handleWebkitEnd);
      }
    };
  }, [channel.id, isFullscreen, onToggleFullscreen]);

  const handleRetry = async () => {
    setErrorMessage(null);
    setIsBuffering(true);
    try {
      await getLiveCdnToken(true);
    } catch {}
    setRetryCount(prev => prev + 1);
  };

  // YouTube-style keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Fullscreen toggle ('f' or 'F') works across all streams (Native DASH, HLS, and Embedded Iframes)
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case 'm':
          toggleMute();
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
          // Resync to safe 30s buffer reservoir behind live edge
          if (shakaPlayerRef.current && videoRef.current) {
            try {
              const seekRange = shakaPlayerRef.current.seekRange();
              if (seekRange && Number.isFinite(seekRange.end)) {
                videoRef.current.currentTime = Math.max(seekRange.start, seekRange.end - 30);
              }
            } catch {}
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Automatic Reconnect & Auto-Play Watchdog:
  // When internet reconnects after being offline, automatically resume and start playback
  // without waiting for the user to press the play button!
  useEffect(() => {
    const attemptAutoPlay = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        await video.play();
        setIsPlaying(true);
        setIsBuffering(false);
      } catch {
        // Autoplay policy fallback: mute and play
        try {
          video.muted = true;
          setIsMuted(true);
          await video.play();
          setIsPlaying(true);
          setIsBuffering(false);
        } catch {}
      }
    };

    const handleWindowOnline = async () => {
      setErrorMessage(null);
      setIsBuffering(true);

      // Re-trigger stream connection
      if (shakaPlayerRef.current) {
        try {
          await shakaPlayerRef.current.retryStreaming();
          setIsBuffering(false);
        } catch {
          setRetryCount((prev) => prev + 1);
        }
      } else if (hlsPlayerRef.current) {
        try {
          hlsPlayerRef.current.startLoad();
          setIsBuffering(false);
        } catch {
          setRetryCount((prev) => prev + 1);
        }
      } else {
        setRetryCount((prev) => prev + 1);
      }

      // Auto-start stream playback immediately
      setTimeout(() => {
        attemptAutoPlay();
      }, 400);
    };

    window.addEventListener('online', handleWindowOnline);

    // Watchdog: If online and stream paused unexpectedly, auto-resume
    const watchdog = setInterval(() => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (isOffline) return;
      const video = videoRef.current;
      if (video && video.paused && !channel.streamFormat?.includes('embed') && !channel.embedUrl) {
        attemptAutoPlay();
      }
    }, 4000);

    return () => {
      window.removeEventListener('online', handleWindowOnline);
      clearInterval(watchdog);
    };
  }, [isOffline, channel]);

  // Gentle stall recovery: only nudge active player after 14s of true freeze (readyState < 3 & empty buffer)
  // without forcibly reloading working direct CDN streams onto nelitv.online proxy on slow user networks.
  useEffect(() => {
    if (!hasFirstFrame || !isBuffering || isOffline || errorMessage || isUserPaused || isEmbedded) {
      return;
    }

    const startTimeSnapshot = videoRef.current?.currentTime ?? 0;
    const midStallTimer = setTimeout(() => {
      const vid = videoRef.current;
      if (!vid || vid.paused) return;
      const hasProgressed = Math.abs(vid.currentTime - startTimeSnapshot) > 0.2;
      if (hasProgressed || vid.readyState >= 3) return;

      if (shakaPlayerRef.current) {
        try {
          shakaPlayerRef.current.retryStreaming();
        } catch {}
      } else if (hlsPlayerRef.current) {
        try {
          hlsPlayerRef.current.startLoad(-1);
        } catch {}
      }
    }, 14000);

    return () => clearTimeout(midStallTimer);
  }, [hasFirstFrame, isBuffering, isOffline, errorMessage, isUserPaused, isEmbedded]);

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseEnter={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      onClick={handlePlayerTap}
      className={`w-full bg-[#03040a] overflow-hidden group select-none shadow-2xl transition-all duration-300 ${
        isEmbedded ? '' : 'cursor-pointer'
      } ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0 m-0 p-0'
          : isFullPage
          ? 'relative h-full flex-1 rounded-none border-0'
          : 'relative aspect-video rounded-2xl border border-purple-500/25'
      }`}
      style={
        isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              zIndex: 99999
            }
          : undefined
      }
    >
      {/* HTML5 Video Element or Embedded Iframe */}
      {isEmbedded ? (
        <iframe
          src={channel.embedUrl || channel.streamUrl}
          className="w-full h-full border-0 object-contain bg-black pointer-events-auto"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          title={channel.name}
        />
      ) : (
        <>
          {/* Ambient Channel Backdrop with Live Filling Percentage while stream connects */}
          {!hasFirstFrame && !needsUserTapToPlay && !errorMessage && !isOffline && (
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#0a0f1a]">
              {channel.thumbnailUrl && (
                <img
                  src={channel.thumbnailUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl scale-110"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060911]/95 via-[#0a0f1a]/60 to-[#060911]/85" />
              <div className="relative h-full w-full flex flex-col items-center justify-center gap-3 px-6">
                {channel.thumbnailUrl && (
                  <img
                    src={channel.thumbnailUrl}
                    alt={channel.name}
                    referrerPolicy="no-referrer"
                    className="h-14 sm:h-16 w-auto max-w-[160px] object-contain opacity-95 drop-shadow-[0_4px_20px_rgba(0,0,0,0.65)]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="text-xs sm:text-sm font-bold text-white/95 tracking-tight">
                  {channel.name}
                </span>

                {/* Filling Percentage Bar */}
                <div className="w-44 sm:w-56 space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-300">Inapakia...</span>
                    <span className="text-[#1ce783] font-bold tabular-nums">{loadPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#1ce783] transition-all duration-200 ease-out"
                      style={{ width: `${loadPercent}%` }}
                    />
                  </div>
                </div>
              </div>
              {/* Top synced hairline progress bar */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#1ce783] transition-all duration-200 ease-out"
                  style={{ width: `${loadPercent}%` }}
                />
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            playsInline
            autoPlay
            preload="auto"
            className={`relative z-[1] w-full h-full object-contain transition-opacity duration-300 ${
              hasFirstFrame ? 'opacity-100 bg-black' : 'opacity-0 bg-transparent'
            }`}
          />
          {channel.audioUrl && (
            <audio
              ref={audioRef}
              playsInline
              preload="auto"
              className="hidden"
            />
          )}
        </>
      )}

      {/* Subtle Top-Right NeliTv Spectrum Corner Mark */}
      {!errorMessage && !isPaywallTriggered && !isOffline && (
        <div
          className={`pointer-events-none select-none absolute top-3 right-3.5 z-10 transition-opacity duration-300 ${
            showControls || isUserPaused ? 'opacity-90' : 'opacity-45'
          }`}
        >
          <span className="font-black italic tracking-tight text-xs sm:text-sm neli-gradient-text drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            NeliTv
          </span>
        </div>
      )}

      {/* Subtle rebuffer indicator shown ONLY if playback truly stalls >= 2.6s (hidden during silent ABR switches) */}
      {!isEmbedded && hasFirstFrame && showRebufferBadge && !errorMessage && !isPaywallTriggered && !isOffline && (
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col gap-1 px-3 py-1.5 rounded-lg bg-black/75 border border-white/15 min-w-[130px]">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
            <span className="text-slate-200">Inapakia...</span>
            <span className="text-[#1ce783] font-bold tabular-nums">
              {Math.min(98, Math.max(25, Math.round((bufferSeconds / 2.5) * 100)))}%
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1ce783] transition-all duration-200 ease-out"
              style={{ width: `${Math.min(98, Math.max(25, Math.round((bufferSeconds / 2.5) * 100)))}%` }}
            />
          </div>
        </div>
      )}

      {/* Center Play Overlay when user explicitly paused or browser blocked autoplay */}
      {!isEmbedded && (isUserPaused || needsUserTapToPlay) && !isBuffering && !isPaywallTriggered && !errorMessage && !isOffline && (
        <div
          data-player-ui="true"
          onClick={() => {
            setIsUserPaused(false);
            setNeedsUserTapToPlay(false);
            if (videoRef.current) {
              videoRef.current.muted = false;
              setIsMuted(false);
              videoRef.current.play().then(() => {
                setIsPlaying(true);
                if (videoRef.current && videoRef.current.readyState >= 2) {
                  hasFirstFrameRef.current = true;
                  setHasFirstFrame(true);
                }
              }).catch(() => {
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  setIsMuted(true);
                  videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                }
              });
            }
          }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#03040a]/55 cursor-pointer"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-[#0b0e14] flex items-center justify-center shadow-xl transition transform hover:scale-105 active:scale-95">
            <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-[#0b0e14] ml-1" />
          </div>
          {needsUserTapToPlay && (
            <span className="px-3.5 py-1 rounded-full bg-black/75 border border-white/20 text-xs font-bold text-white">
              Bonyeza Kucheza
            </span>
          )}
        </div>
      )}

      {/* Tap to Unmute Banner when autoplay policy muted the video */}
      {!isEmbedded && isPlaying && isMuted && !isPaywallTriggered && !isOffline && (
        <div
          data-player-ui="true"
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = false;
              setIsMuted(false);
            }
          }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-25 py-1.5 px-4 rounded-lg bg-[#141923]/95 hover:bg-[#1b2230] text-white border border-white/20 text-[11px] sm:text-xs font-semibold flex items-center gap-2 shadow-lg cursor-pointer transition"
        >
          <VolumeX className="w-3.5 h-3.5 text-[#1ce783] shrink-0" />
          <span>Sauti imezimwa — Bonyeza hapa kufungua sauti</span>
        </div>
      )}

      {/* Offline Overlay */}
      {isOffline && !isPaywallTriggered && (
        <div
          data-player-ui="true"
          className="absolute inset-0 z-35 overflow-y-auto bg-[#050611]"
        >
          <OfflineWatchPlaceholder
            channel={channel}
            isFullPage={false}
            onRetry={handleOfflineRetry}
            onBack={onBack}
            swStatus={swStatus}
            isReconnecting={isReconnecting}
          />
        </div>
      )}

      {/* Error Overlay */}
      {errorMessage && !isPaywallTriggered && !isOffline && (
        <div
          data-player-ui="true"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-[#0b0e14]/95 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-400 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-sm text-slate-300 max-w-sm mb-5 leading-relaxed">
            {errorMessage}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => handleRetry()}
              className="py-2.5 px-6 rounded-xl bg-[#0072d2] hover:bg-[#0082ee] text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Jaribu Tena</span>
            </button>
            {fallbackChannel && onSwitchChannel && fallbackChannel.id !== channel.id && (
              <button
                onClick={() => onSwitchChannel(fallbackChannel)}
                className="py-2.5 px-5 rounded-xl bg-[#1ce783] hover:bg-[#18cf75] text-[#04120b] font-bold text-xs flex items-center gap-2 transition cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Tazama {fallbackChannel.name}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen-Only Bottom-Above-Timeline Banner (728x90 responsive, X close, reappears every 15 min) */}
      {!isEmbedded && (
        <AdsterraFullscreenBanner isFullscreen={isFullscreen} />
      )}

      {/* Bottom Overlay Controls */}
      <div
        data-player-ui="true"
        className={`absolute inset-x-0 bottom-0 z-20 pt-6 pb-3 px-3 sm:px-4 bg-gradient-to-t from-[#03040c]/95 via-[#050611]/75 to-transparent transition-all duration-300 ease-in-out ${
          showControls
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none translate-y-full'
        }`}
      >
        {/* Subtle Spectrum Live Progress Line */}
        <div className="relative h-[3px] w-full rounded-full bg-white/15 mb-2.5 overflow-hidden">
          <div className="h-full w-full neli-gradient-bg opacity-90" />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Left: Volume Slider & Channel Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!isEmbedded ? (
              <div
                className="flex items-center group/vol"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={() => {
                    toggleMute();
                    resetControlsTimeout();
                  }}
                  className="p-2 text-white hover:text-cyan-400 rounded-lg hover:bg-white/10 active:scale-95 transition cursor-pointer"
                  title={isMuted ? 'Washa Sauti (M)' : 'Zima Sauti (M)'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-pink-500" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-5 h-5 text-cyan-300" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>

                {/* Smooth Volume Slider */}
                <div className="flex items-center transition-all duration-300 overflow-hidden w-0 group-hover/vol:w-20 sm:group-hover/vol:w-24 group-focus-within/vol:w-20 pl-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      setIsMuted(val === 0);
                      if (videoRef.current) {
                        videoRef.current.volume = val;
                        videoRef.current.muted = val === 0;
                      }
                      try {
                        localStorage.setItem('nelitv_player_volume', String(val));
                      } catch {}
                    }}
                    className="w-16 sm:w-20 h-1 bg-white/30 hover:bg-white/50 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                    title={`Sauti: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-white shrink-0">
                <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                <span className="text-[#ff3b8d]">LIVE</span>
              </div>
            )}

            <span className="text-xs font-bold text-slate-200 truncate max-w-[140px] sm:max-w-xs">
              {channel.name}
            </span>
          </div>

          {/* Right: Quality, Language, Fullscreen */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isEmbedded && (
              <>
                {/* Quality Switcher */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowQualityMenu((prev) => !prev);
                      resetControlsTimeout();
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border whitespace-nowrap cursor-pointer ${
                      selectedQuality === 'saver'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/80 shadow-sm shadow-emerald-500/20'
                        : 'bg-[#0b0e24]/90 hover:bg-[#131838] text-white border-white/15 hover:border-white/35'
                    }`}
                    title="Badili Ubora wa Video / Okoa Bando"
                  >
                    <Sliders className={`w-3.5 h-3.5 ${selectedQuality === 'saver' ? 'text-emerald-400' : 'text-cyan-400'}`} />
                    <span className="hidden xs:inline sm:inline">
                      {selectedQuality === 'auto'
                        ? `Auto (${currentResolution})`
                        : selectedQuality === 'saver'
                        ? 'Okoa Bando'
                        : `${selectedQuality}p`}
                    </span>
                    <span className="xs:hidden sm:hidden">
                      {selectedQuality === 'auto'
                        ? currentResolution
                        : selectedQuality === 'saver'
                        ? 'Saver'
                        : `${selectedQuality}p`}
                    </span>
                  </button>

                  {/* Floating Quality Menu */}
                  {showQualityMenu && (
                    <div
                      data-player-ui="true"
                      className="absolute bottom-full right-0 mb-2 w-56 rounded-xl bg-[#141923] border border-white/15 shadow-2xl py-1.5 z-50 text-xs"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 flex items-center justify-between">
                        <span>Ubora wa Video</span>
                        <span className="text-[#1ce783] text-[9px] font-normal">Kasi ya Mtandao TZ</span>
                      </div>

                      <button
                        onClick={() => handleSelectQuality('auto')}
                        className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between transition cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-white">Auto (Kiotomatiki)</div>
                          <div className="text-[10px] text-slate-400">Inabadilika kulingana na kasi ya simu</div>
                        </div>
                        {selectedQuality === 'auto' && <Check className="w-3.5 h-3.5 text-[#1ce783]" />}
                      </button>

                      <div className="my-1 border-t border-white/10" />

                      {[
                        { id: '1080', label: '1080p Full HD', desc: 'Ubora wa Juu (Wi-Fi / 4G)' },
                        { id: '720', label: '720p HD', desc: 'Ubora Mzuri' },
                        { id: '480', label: '480p SD', desc: 'Kawaida (3G / 4G)' },
                        { id: '360', label: '360p Data Saver', desc: 'Bando Nafuu (Inaokoa MB)' },
                        { id: '240', label: '240p Okoa Bando Sana', desc: 'Chini Sana (Mtandao hafifu)' },
                        { id: 'saver', label: 'Hali ya Okoa Bando', desc: 'Inabana matumizi ya data hadi 75%' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectQuality(item.id as QualityOption)}
                          className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between transition cursor-pointer"
                        >
                          <div>
                            <div className={`font-medium ${item.id === 'saver' ? 'text-emerald-400 font-bold' : 'text-white'}`}>
                              {item.label}
                            </div>
                            <div className="text-[10px] text-slate-500">{item.desc}</div>
                          </div>
                          {selectedQuality === item.id && <Check className="w-3.5 h-3.5 text-[#1ce783]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audio Language Switcher */}
                <button
                  onClick={() => {
                    toggleLanguage();
                    resetControlsTimeout();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0b0e24]/90 hover:bg-[#131838] text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/15 hover:border-white/35 whitespace-nowrap cursor-pointer"
                  title="Badili Lugha ya Sauti (Swahili / English)"
                >
                  <Languages className="w-3.5 h-3.5 text-[#ffb020]" />
                  <span>{selectedLanguage === 'sw' ? 'SW' : 'EN'}</span>
                </button>
              </>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={() => {
                toggleFullscreen();
                resetControlsTimeout();
              }}
              className={`p-2 rounded-lg active:scale-95 transition cursor-pointer ${
                isFullscreen
                  ? 'text-[#1ce783] bg-[#1ce783]/15 hover:bg-[#1ce783]/25 border border-[#1ce783]/40'
                  : 'text-slate-200 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title={isFullscreen ? 'Punguza Skrini (Exit Fullscreen / F)' : 'Skrini Nzima (Fullscreen / F)'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-[#1ce783]" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Quality Meter Modal */}
      <QualityMeterModal
        isOpen={showQualityMeterModal}
        onClose={() => setShowQualityMeterModal(false)}
        resolution={currentResolution}
        bitrateKbps={bitrateKbps}
        bufferSeconds={bufferSeconds}
        selectedQuality={selectedQuality}
      />
    </div>
  );
};
