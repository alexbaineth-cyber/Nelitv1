import React, { useEffect, useRef, useState, useCallback } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import { Channel, ALL_KNOWN_CLEAR_KEYS } from '../data/channels.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { getLiveCdnToken, buildPlayableStreamUrl } from '../utils/streamTokens.ts';
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

export type QualityOption = 'auto' | '1080' | '720' | '480' | '360';

interface VideoPlayerProps {
  channel: Channel;
  isFullPage?: boolean;
  onBack?: () => void;
  onSelectPlanClick?: (planId?: string) => void;
  onOpenLoginModal?: () => void;
  onPaymentInitiated?: (orderId: string, amount: number, phone: string, planName: string) => void;
  onToggleFullscreen?: (isFullscreen: boolean) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  isFullPage = false,
  onBack,
  onSelectPlanClick,
  onOpenLoginModal,
  onPaymentInitiated,
  onToggleFullscreen
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
  const activeTokenRef = useRef<string>('eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOiIxNzkyNTIxNTk3Iiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoiYzllODBkNTRjMjBjMzMwZiIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiI0ODQwODMyIiwiZGV2aWNlX2lkIjoiIiwibWF4X3Nlc3Npb25zIjowLCJzZXNzaW9uX2R1cmF0aW9uIjowLCJ1cmwiOiJodHRwczovLzEwMi4yMDguMjQ0LjkiLCJzZXNzaW9uX3RpbWVvdXQiOjAsImF1ZCI6IjciLCJzb3VyY2VzIjpbM119.8TkNI2HZfLClpNNOxnkqsbJpRtG7n7vXV7lxQqt96XD2zXpINzgBEqFhHTRegs3Voe22yHBC4R6CxvNAugs4ZQ==');
  const activeCdnHostRef = useRef<string>('https://cdnedgch2.azamtvltd.co.tz');

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [isUserPaused, setIsUserPaused] = useState<boolean>(false);
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
  const [isPaywallTriggered, setIsPaywallTriggered] = useState<boolean>(false);
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
        } catch {}
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

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
        const rawErr = data.error || '';
        if (/on\s*going\s*ussd|ongoing\s*ussd|another\s*on\s*going|rejecting/i.test(rawErr)) {
          setDirectPayError('Kuna ombi la USSD ambalo tayari lipo wazi kwenye simu yako! Angalia skrini ya simu yako na uweke PIN, au subiri sekunde 30 kabla ya kujaribu tena.');
        } else {
          setDirectPayError(rawErr || 'Imeshindikana kutuma ombi la malipo. Hakikisha namba ina salio.');
        }
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
    }, 3500);
  };

  const handlePlayerTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPaywallTriggered || (!hasActiveSubscription && trialCompleted)) {
      return;
    }
    if ((e.target as HTMLElement).closest('button, input, select, a, form')) {
      return;
    }
    // Attempt smooth un-mute on user tap if video was muted by browser autoplay policy
    if (videoRef.current && isMuted) {
      try {
        videoRef.current.muted = false;
        setIsMuted(false);
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

  // Check trial expiration & explicitly pause or destroy video source (audio stream)
  // when subscription overlay is visible, preventing audio leaks
  useEffect(() => {
    const isLocked = !hasActiveSubscription && trialCompleted;
    setIsPaywallTriggered(isLocked);

    if (isLocked) {
      // Exit HTML5 fullscreen immediately so input fields & payment modals work seamlessly!
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        try {
          exitFullscreenAndUnlock();
        } catch {}
      }
      setIsPlaying(false);
      setIsBuffering(false);

      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.muted = true;
          video.volume = 0;
          video.removeAttribute('src');
          video.load();
        } catch (e) {
          console.warn('Audio leak teardown note:', e);
        }
      }

      if (shakaPlayerRef.current) {
        try {
          shakaPlayerRef.current.unload().catch(() => {});
        } catch {}
      }

      if (hlsPlayerRef.current) {
        try {
          hlsPlayerRef.current.stopLoad();
          hlsPlayerRef.current.detachMedia();
        } catch {}
      }
    } else {
      // Audio Restore: When user pays or logs in, cleanly unmute and restore user volume!
      const video = videoRef.current;
      if (video) {
        try {
          video.muted = false;
          video.volume = volume || 1;
        } catch {}
      }
      setIsMuted(false);
    }
  }, [hasActiveSubscription, trialCompleted, volume]);

  const isEmbedded = channel.streamFormat === 'embed' || Boolean(channel.embedUrl);
  const isPaidChannel = Boolean(channel.requiredPackages?.includes('PAID') || channel.isAzam || channel.requiredPackages?.length);
  const showTrialBadge = !hasActiveSubscription && !isPaidChannel;

  // Embedded channels now open inline with the sidepanel just like standard channels

  // Timer to record trial usage while playing or watching embedded channel
  useEffect(() => {
    let interval: any = null;
    const shouldTick = !hasActiveSubscription && !trialCompleted && !isPaywallTriggered && (isEmbedded || isPlaying);
    if (shouldTick) {
      interval = setInterval(() => {
        recordTrialSecondWatched();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, isEmbedded, hasActiveSubscription, trialCompleted, isPaywallTriggered, recordTrialSecondWatched]);

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
      setIsUserPaused(false);

      // Automated instant play with muted policy fallback
      const attemptAutoPlay = async () => {
        if (!isMounted) return;
        setIsBuffering(false);
        const vid = videoRef.current;
        if (!vid) return;
        try {
          // Attempt unmuted play first
          vid.muted = false;
          await vid.play();
          setIsPlaying(true);
          setIsMuted(false);
        } catch {
          // If browser blocks unmuted audio, play muted without stopping
          try {
            vid.muted = true;
            setIsMuted(true);
            await vid.play();
            setIsPlaying(true);
          } catch (pErr) {
            console.warn('AutoPlay muted fallback note:', pErr);
          }
        }
      };

      // Never initialize or load video/audio stream if subscription paywall is active
      if (!hasActiveSubscription && trialCompleted) {
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.muted = true;
            videoRef.current.volume = 0;
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
          } catch {}
        }
        setIsBuffering(false);
        setIsPlaying(false);
        return;
      }

      const isAzam = channel.isAzam || channel.streamUrl.includes('azamtvltd.co.tz');
      let targetUrl = channel.streamUrl;

      // Always resolve latest valid CDN token for Azam TV to guarantee active playback
      if (isAzam) {
        try {
          const tokenData = await getLiveCdnToken(retryCount > 0);
          activeTokenRef.current = tokenData.token;
          activeCdnHostRef.current = tokenData.cdnHost;
          targetUrl = buildPlayableStreamUrl(channel, tokenData);
        } catch (e) {
          console.warn('Token resolution fallback:', e);
          targetUrl = channel.streamUrl;
        }
      }

      // Fast startup timeout: if stream is ready but waiting, trigger autoplay
      const stallTimer = setTimeout(async () => {
        if (isMounted && isBuffering && !errorMessage) {
          await attemptAutoPlay();
        }
      }, 3500);

      // 0. EMBEDDED STREAM (Baynith Sports 1 & 2, etc.)
      if (channel.streamFormat === 'embed' || channel.embedUrl) {
        setIsBuffering(false);
        setIsPlaying(true);
        return;
      }

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

            // Only exact 32-character hex pairs are valid for W3C ClearKey EME
            if (cleanK.length === 32 && cleanV.length === 32) {
              clearKeysConfig[cleanK] = cleanV;
            }
          }

          player.configure({
            drm: {
              clearKeys: clearKeysConfig,
              servers: {}
            },
            streaming: {
              bufferingGoal: 4,          // 4s buffer reservoir for instant live start (was 30s!)
              rebufferingGoal: 0.5,      // Quick resume in 0.5s (was 1.5s!)
              bufferBehind: 15,          // Keeps 15s behind in memory
              safeSeekOffset: 3,         // 3s delay from live encoder edge
              gapDetectionThreshold: 0.5, // Silently skips timestamp micro-gaps
              smallGapLimit: 0.5,
              jumpLargeGaps: true,
              stallEnabled: true,        // Detects browser decoder stalls
              stallThreshold: 1.0,
              stallSkip: 0.2,
              segmentPrefetchLimit: 2,   // Pre-fetches next 2 segments ahead of time
              ignoreTextStreamFailures: true,
              alwaysStreamText: false,
              retryParameters: {
                maxAttempts: 4,
                baseDelay: 150,
                backoffFactor: 1.2
              }
            },
            manifest: {
              defaultPresentationDelay: 4, // 4 seconds delay behind live TV broadcast for instant start
              dash: {
                autoCorrectDrift: true,
                ignoreMinBufferTime: true,
                ignoreSuggestedPresentationDelay: true,
                clockSyncUri: ''
              },
              retryParameters: {
                maxAttempts: 4,
                baseDelay: 150,
                backoffFactor: 1.2
              }
            },
            abr: {
              enabled: selectedQuality === 'auto',
              defaultBandwidthEstimate: 500000,   // Start on lightweight 360p/480p for instant startup
              switchInterval: 8,                  // Quick 8s observation window
              bandwidthDowngradeTarget: 0.95,     // Instant downshift on network dip
              bandwidthUpgradeTarget: 0.50
            }
          });

          // Register Shaka Request Filter for Azam TV:
          // Injects active CDN host and active token on ALL MPD manifest & media segment chunks
          player.getNetworkingEngine().clearAllRequestFilters();
          player.getNetworkingEngine().registerRequestFilter((_type: any, request: any) => {
            const currentToken = activeTokenRef.current;
            const currentHost = activeCdnHostRef.current;

            if (!request.uris || request.uris.length === 0) return;

            request.uris = request.uris.map((uri: string) => {
              let updatedUri = uri;
              if (updatedUri.includes('azamtvltd') || updatedUri.includes('azam')) {
                // 1. Force hostname to active CDN host
                try {
                  const targetHostUrl = new URL(currentHost);
                  const reqUrl = new URL(updatedUri);
                  reqUrl.hostname = targetHostUrl.hostname;
                  reqUrl.protocol = targetHostUrl.protocol;
                  if (targetHostUrl.port) reqUrl.port = targetHostUrl.port;
                  updatedUri = reqUrl.toString();
                } catch {}

                // 2. Inject token in path: replace /tok_.../ or insert before /live/eds/
                if (/\/tok_[^/]+\//.test(updatedUri)) {
                  updatedUri = updatedUri.replace(/\/tok_[^/]+\//, `/tok_${currentToken}/`);
                } else if (updatedUri.includes('/live/eds/')) {
                  updatedUri = updatedUri.replace('/live/eds/', `/tok_${currentToken}/live/eds/`);
                }

                // 3. Guarantee ?cdntoken= query param is set
                try {
                  const u = new URL(updatedUri);
                  u.searchParams.set('cdntoken', currentToken);
                  updatedUri = u.toString();
                } catch {}
              }
              return updatedUri;
            });
          });

          // Track current active resolution when ABR changes
          player.addEventListener('adaptation', () => {
            try {
              const tracks = player.getVariantTracks();
              const active = tracks.find((t: any) => t.active);
              if (active && active.height && isMounted) {
                setCurrentResolution(`${active.height}p`);
              }
            } catch {}
          });

          player.addEventListener('variantchanged', () => {
            try {
              const tracks = player.getVariantTracks();
              const active = tracks.find((t: any) => t.active);
              if (active && active.height && isMounted) {
                setCurrentResolution(`${active.height}p`);
              }
            } catch {}
          });

          // Track available audio languages
          player.addEventListener('trackschanged', () => {
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

          // Adaptive buffering handling: downshift quality immediately on stall, do not chase live edge
          player.addEventListener('buffering', (event: any) => {
            if (!isMounted) return;
            setIsBuffering(event.buffering);

            if (event.buffering) {
              // Immediately step down to lighter track to resume playback smoothly without loading
              try {
                const tracks = player.getVariantTracks();
                if (tracks && tracks.length > 0) {
                  const sorted = [...tracks].sort((a: any, b: any) => (a.bandwidth || 0) - (b.bandwidth || 0));
                  const lowest = sorted[0];
                  if (lowest && lowest.id !== undefined) {
                    player.selectVariantTrack(lowest, /* clearBuffer= */ false);
                    if (lowest.height) setCurrentResolution(`${lowest.height}p`);
                  }
                }
              } catch {}
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

            // 1. Handle DRM errors (Missing keys, 4012 in v4 or 6007/6008/6012 in v5) - auto heal
            if (err.code === 4012 || err.code === 6007 || err.code === 6008 || err.code === 6012) {
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
            if (isAzam || httpCode === 403 || httpCode === 401 || err?.code === 1001 || err?.code === 1002 || err?.code === 1003 || err?.code === 4032 || err?.code === 4001 || err?.code === 4002) {
              try {
                const freshToken = await getLiveCdnToken(true);
                activeTokenRef.current = freshToken.token;
                activeCdnHostRef.current = freshToken.cdnHost;
                const freshUrl = buildPlayableStreamUrl(channel, freshToken);
                await player.load(freshUrl);
                setIsBuffering(false);
                await video.play();
                setIsPlaying(true);
                return;
              } catch (reloadErr) {
                console.warn('Token auto-reload retry note:', reloadErr);
                // Proxy fallback attempt
                try {
                  const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}`;
                  await player.load(proxyUrl);
                  setIsBuffering(false);
                  await video.play();
                  setIsPlaying(true);
                  return;
                } catch {}
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
            await attemptAutoPlay();
          }
        } catch (error: any) {
          console.warn('Shaka load initial note:', error);
          if (shakaPlayerRef.current) {
            try {
              const freshToken = await getLiveCdnToken(true);
              activeTokenRef.current = freshToken.token;
              activeCdnHostRef.current = freshToken.cdnHost;
              const freshUrl = buildPlayableStreamUrl(channel, freshToken);
              await shakaPlayerRef.current.load(freshUrl);
              clearTimeout(stallTimer);
              if (isMounted) {
                await attemptAutoPlay();
                return;
              }
            } catch (retryErr) {
              // Proxy fallback attempt for cross-regional connection stability
              try {
                const proxyUrl = `/api/proxy-stream?url=${encodeURIComponent(targetUrl)}`;
                await shakaPlayerRef.current.load(proxyUrl);
                clearTimeout(stallTimer);
                if (isMounted) {
                  await attemptAutoPlay();
                  return;
                }
              } catch (proxyErr) {
                console.warn('Proxy fallback note:', proxyErr);
              }
            }
          }
          clearTimeout(stallTimer);
          if (isMounted) {
            setIsBuffering(false);
            setErrorMessage('Inaunganisha matangazo ya moja kwa moja...');
          }
        }
      }
      // 2. HLS STREAM (Low-latency startup)
      else if (channel.streamFormat === 'hls') {
        if (Hls.isSupported()) {
          const hls = new Hls({
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 6,
            lowLatencyMode: true,
            backBufferLength: 15,
            startLevel: 0, // Starts on lowest/fastest bandwidth level for instant startup without loading
            autoStartLoad: true,
            capLevelToPlayerSize: true,
            abrBandWidthFactor: 0.7,
            abrBandWidthUpFactor: 0.5,
          });
          hlsPlayerRef.current = hls;

          hls.loadSource(targetUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, async () => {
            if (!isMounted) return;
            await attemptAutoPlay();
          });

          hls.on(Hls.Events.BUFFER_STALLED, () => {
            if (!isMounted) return;
            try {
              if (hls.levels && hls.levels.length > 1) {
                hls.nextLevel = 0;
              }
            } catch {}
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
              await attemptAutoPlay();
            }
          });
        }
      }
      // 3. MP4 / Direct
      else {
        video.src = targetUrl;
        video.onloadeddata = async () => {
          if (isMounted) {
            await attemptAutoPlay();
          }
        };
        video.oncanplay = async () => {
          if (isMounted && !isPlaying) {
            await attemptAutoPlay();
          }
        };
      }
    };

    loadStream();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [channel.id, retryCount, hasActiveSubscription, trialCompleted]);

  // Video listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      if (isPaywallTriggered || (!hasActiveSubscription && trialCompleted)) {
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.muted = true;
            videoRef.current.volume = 0;
          } catch {}
        }
        setIsPlaying(false);
        return;
      }
      setIsPlaying(true);
    };

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

  // Quality Switcher with Automatic Internet Adaptation
  const handleSelectQuality = (q: QualityOption) => {
    setSelectedQuality(q);
    setShowQualityMenu(false);

    if (shakaPlayerRef.current) {
      const player = shakaPlayerRef.current;
      if (q === 'auto') {
        player.configure({
          abr: {
            enabled: true,
            defaultBandwidthEstimate: 850000,
            switchInterval: 4,
            bandwidthDowngradeTarget: 0.95,
            bandwidthUpgradeTarget: 0.70
          }
        });
        setCurrentResolution('Auto');
      } else {
        // Disable ABR and select specific variant track
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
      // Don't trigger if user is typing in an input or if subscription paywall is active
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (isPaywallTriggered || (!hasActiveSubscription && trialCompleted)) {
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
  }, [isPaywallTriggered, hasActiveSubscription, trialCompleted]);

  // Automatic Reconnect & Auto-Play Watchdog:
  // When internet reconnects after being offline, automatically resume and start playback
  // without waiting for the user to press the play button!
  useEffect(() => {
    const attemptAutoPlay = async () => {
      const video = videoRef.current;
      if (!video) return;
      if (isPaywallTriggered || (!hasActiveSubscription && trialCompleted)) return;

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
      if (isOffline || isPaywallTriggered || (!hasActiveSubscription && trialCompleted)) return;
      const video = videoRef.current;
      if (video && video.paused && !channel.streamFormat?.includes('embed') && !channel.embedUrl) {
        attemptAutoPlay();
      }
    }, 4000);

    return () => {
      window.removeEventListener('online', handleWindowOnline);
      clearInterval(watchdog);
    };
  }, [hasActiveSubscription, trialCompleted, isPaywallTriggered, isOffline, channel]);

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
      onMouseEnter={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      onClick={handlePlayerTap}
      className={`w-full bg-black overflow-hidden group select-none shadow-2xl transition-all duration-300 ${
        isEmbedded ? '' : 'cursor-pointer'
      } ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0 m-0 p-0'
          : isFullPage
          ? 'relative h-full flex-1 rounded-none border-0'
          : 'relative aspect-video rounded-2xl border border-neutral-900'
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
      {/* HTML5 Video Element or Embedded Iframe (Baynith Sports 1 & 2) */}
      {isEmbedded ? (
        (!isPaywallTriggered && (hasActiveSubscription || !trialCompleted)) ? (
          <iframe
            src={channel.embedUrl || channel.streamUrl}
            className="w-full h-full border-0 object-contain bg-black pointer-events-auto"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            title={channel.name}
          />
        ) : null
      ) : (
        <video
          ref={videoRef}
          playsInline
          autoPlay
          className="w-full h-full object-contain bg-black"
        />
      )}

      {/* Buffering Indicator - only for native video, NOT for embedded iframes */}
      {!isEmbedded && isBuffering && !errorMessage && !isPaywallTriggered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] pointer-events-none transition">
          <div className="w-12 h-12 rounded-full border-3 border-red-600 border-t-transparent animate-spin mb-3" />
          <span className="text-xs text-neutral-300 font-medium">Inaunganisha TV...</span>
        </div>
      )}

      {/* Big Center Play Button ONLY when user explicitly paused video */}
      {!isEmbedded && isUserPaused && !isBuffering && !isPaywallTriggered && !errorMessage && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setIsUserPaused(false);
            if (videoRef.current) {
              videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
                if (videoRef.current) {
                  videoRef.current.muted = true;
                  videoRef.current.play().then(() => setIsPlaying(true));
                }
              });
            }
          }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[1px] cursor-pointer"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-2xl transition transform hover:scale-110 active:scale-95">
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Tap to Unmute Banner when autoplay policy muted the video */}
      {!isEmbedded && isPlaying && isMuted && !isPaywallTriggered && !isOffline && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (videoRef.current) {
              videoRef.current.muted = false;
              setIsMuted(false);
            }
          }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-25 py-1.5 px-4 rounded-full bg-black/85 hover:bg-neutral-900 text-white border border-cyan-500/50 text-[11px] sm:text-xs font-bold flex items-center gap-2 shadow-2xl cursor-pointer animate-pulse transition"
        >
          <VolumeX className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Sauti imezimwa — Bonyeza hapa kufungua sauti 🔊</span>
        </div>
      )}



      {/* Offline Overlay - Keep <video> mounted in DOM so it immediately resumes upon reconnect without manual button press! */}
      {isOffline && !isPaywallTriggered && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-35 overflow-y-auto bg-[#070A0F]"
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

      {/* 1-MINUTE TRIAL PAYWALL OVERLAY */}
      {isPaywallTriggered && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center p-4 sm:p-6 bg-[#070A14] text-center animate-fade-in cursor-default"
        >
          {/* MOBILE VIEW (<sm): Clean paywall with direct phone input and quick 1,000 TSH payment */}
          <div className="block sm:hidden w-full max-w-[260px] space-y-3">
            <div className="w-10 h-10 mx-auto rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Lock className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-sm font-black text-white">Muda wa Majaribio Umekwisha</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Lipia kifurushi uendelee kutazama mubashara
              </p>
            </div>

            <form onSubmit={handleDirectPaySubmit} className="space-y-2.5 pt-1">
              <input
                type="tel"
                value={directPayPhone}
                onChange={(e) => setDirectPayPhone(e.target.value)}
                placeholder="07XXXXXXXX au 06XXXXXXXX"
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/20 text-white placeholder-neutral-500 font-mono text-xs focus:outline-none focus:border-blue-500 text-center"
              />

              {directPayError && (
                <div className="p-2 rounded-lg bg-red-950/60 border border-red-800/80 text-[10px] text-red-300">
                  {directPayError}
                </div>
              )}

              <button
                type="submit"
                disabled={isDirectPayLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-500 hover:opacity-95 active:scale-95 text-white font-black text-xs shadow-lg shadow-pink-600/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDirectPayLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Inatuma USSD...</span>
                  </>
                ) : (
                  <span>Lipa 1,000 TSH (Siku 2)</span>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-3 pt-1 text-[11px]">
              <button
                onClick={async () => {
                  if (document.fullscreenElement) {
                    try { await exitFullscreenAndUnlock(); } catch {}
                  }
                  onSelectPlanClick?.('plan_7days');
                }}
                className="text-neutral-400 hover:text-white transition underline cursor-pointer"
              >
                Vifurushi Vingine
              </button>

              {onOpenLoginModal && (
                <>
                  <span className="text-neutral-600">•</span>
                  <button
                    onClick={async () => {
                      if (document.fullscreenElement) {
                        try { await exitFullscreenAndUnlock(); } catch {}
                      }
                      onOpenLoginModal();
                    }}
                    className="text-neutral-400 hover:text-white transition underline cursor-pointer"
                  >
                    Ulishalipia? Ingia
                  </button>
                </>
              )}
            </div>
          </div>

          {/* DESKTOP & TABLET VIEW (>=sm): 3-Card Grid */}
          <div className="hidden sm:flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-pink-500/20 to-cyan-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 mb-3">
              <Lock className="w-7 h-7" />
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white mb-1.5 tracking-tight">
              Muda Wako wa Majaribio Umekwisha
            </h3>

            <p className="text-xs sm:text-sm text-neutral-300 max-w-md mb-5 leading-relaxed">
              Umetumia dakika 1 ya majaribio ya bure. Chagua kifurushi uendelee kutazama chaneli zote mubashara:
            </p>

            <div className="grid grid-cols-3 gap-3 w-full max-w-lg mb-5">
              <button
                onClick={async () => {
                  if (document.fullscreenElement) {
                    try { await exitFullscreenAndUnlock(); } catch {}
                  }
                  onSelectPlanClick?.('plan_2days');
                }}
                className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-pink-500 text-left transition group cursor-pointer"
              >
                <span className="text-[10px] text-neutral-400 block uppercase font-medium">Siku 2</span>
                <div className="text-base font-bold text-white group-hover:text-cyan-400">TZS 1,000</div>
              </button>

              <button
                onClick={async () => {
                  if (document.fullscreenElement) {
                    try { await exitFullscreenAndUnlock(); } catch {}
                  }
                  onSelectPlanClick?.('plan_7days');
                }}
                className="p-3 rounded-xl bg-gradient-to-br from-pink-950/40 to-cyan-950/40 border-2 border-pink-500 text-left transition relative cursor-pointer"
              >
                <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500 to-pink-500 text-white text-[9px] font-black uppercase">
                  BORA
                </span>
                <span className="text-[10px] text-pink-300 block uppercase font-medium">Wiki 1 (Siku 7)</span>
                <div className="text-base font-bold text-white">TZS 3,000</div>
              </button>

              <button
                onClick={async () => {
                  if (document.fullscreenElement) {
                    try { await exitFullscreenAndUnlock(); } catch {}
                  }
                  onSelectPlanClick?.('plan_30days');
                }}
                className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-cyan-500 text-left transition group cursor-pointer"
              >
                <span className="text-[10px] text-neutral-400 block uppercase font-medium">Mwezi 1 (Siku 30)</span>
                <div className="text-base font-bold text-white group-hover:text-cyan-400">TZS 10,000</div>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={async () => {
                  if (document.fullscreenElement) {
                    try { await exitFullscreenAndUnlock(); } catch {}
                  }
                  onSelectPlanClick?.('plan_7days');
                }}
                className="py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-pink-500 to-cyan-500 hover:opacity-95 text-white font-black text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center gap-2 transition cursor-pointer active:scale-95"
              >
                <span>Lipia kwa Simu Sasa</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {onOpenLoginModal && (
                <button
                  onClick={async () => {
                    if (document.fullscreenElement) {
                      try { await exitFullscreenAndUnlock(); } catch {}
                    }
                    onOpenLoginModal();
                  }}
                  className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
                >
                  Ulishalipia? Ingia
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIRECT PAY POPUP MODAL */}
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
            className="w-full max-w-xs rounded-2xl bg-[#0B1020] border border-blue-500/40 p-5 shadow-2xl relative space-y-4"
          >
            <button
              onClick={() => setShowDirectPayModal(false)}
              className="absolute top-3.5 right-3.5 p-1 text-neutral-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-neutral-700 text-white placeholder-neutral-500 font-mono text-sm focus:outline-none focus:border-blue-500 transition"
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
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
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

      {/* YouTube-Style Bottom Overlay Controls (Unified for both Native & Embedded Streams) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-all duration-300 ease-in-out ${
          showControls && !isPaywallTriggered
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: YouTube Volume Slider & Channel Name for Native, or Live indicator for Embedded */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!isEmbedded ? (
              <div
                className="flex items-center group/vol"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                    resetControlsTimeout();
                  }}
                  className="p-2 text-white hover:text-cyan-400 rounded-lg hover:bg-white/10 active:scale-95 transition cursor-pointer"
                  title={isMuted ? 'Washa Sauti (M)' : 'Zima Sauti (M)'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-red-500" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-5 h-5 text-cyan-300" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>

                {/* Smooth YouTube Volume Slider */}
                <div className="flex items-center transition-all duration-300 overflow-hidden w-0 group-hover/vol:w-20 sm:group-hover/vol:w-24 group-focus-within/vol:w-20 pl-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      e.stopPropagation();
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
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                  LIVE
                </span>
              </div>
            )}

            <span className="text-xs font-bold text-neutral-200 truncate max-w-[130px] sm:max-w-xs">
              {channel.name}
            </span>
          </div>

          {/* Right: Quality, Language, Single YouTube Fullscreen Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!isEmbedded && (
              <>
                {/* Quality Switcher */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQualityMenu((prev) => !prev);
                      resetControlsTimeout();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/10 cursor-pointer"
                    title="Badili Ubora wa Video"
                  >
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden xs:inline sm:inline">
                      {selectedQuality === 'auto' ? `Auto (${currentResolution})` : `${selectedQuality}p`}
                    </span>
                    <span className="xs:hidden sm:hidden">
                      {selectedQuality === 'auto' ? currentResolution : `${selectedQuality}p`}
                    </span>
                  </button>

                  {/* Floating Quality Menu */}
                  {showQualityMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-full right-0 mb-2 w-52 rounded-xl bg-[#0B1020] border border-neutral-700 shadow-2xl py-1.5 z-50 text-xs animate-fade-in"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 flex items-center justify-between">
                        <span>Ubora wa Video</span>
                        <span className="text-cyan-400 text-[9px] font-normal">Kulingana na mtandao</span>
                      </div>

                      <button
                        onClick={() => handleSelectQuality('auto')}
                        className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between transition cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-white">Auto (Kiotomatiki)</div>
                          <div className="text-[10px] text-neutral-400">Inabadilika na kasi ya intaneti</div>
                        </div>
                        {selectedQuality === 'auto' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>

                      <div className="my-1 border-t border-neutral-800" />

                      {[
                        { id: '1080', label: '1080p Full HD', desc: 'Ubora wa Juu' },
                        { id: '720', label: '720p HD', desc: 'Imependekezwa' },
                        { id: '480', label: '480p SD', desc: 'Kawaida' },
                        { id: '360', label: '360p Data Saver', desc: 'Inaokoa Bando' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectQuality(item.id as QualityOption)}
                          className="w-full px-3 py-1.5 text-left hover:bg-white/10 flex items-center justify-between transition cursor-pointer"
                        >
                          <div>
                            <div className="text-white font-medium">{item.label}</div>
                            <div className="text-[10px] text-neutral-500">{item.desc}</div>
                          </div>
                          {selectedQuality === item.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audio Language Switcher */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLanguage();
                    resetControlsTimeout();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/10 cursor-pointer"
                  title="Badili Lugha ya Sauti (Swahili / English)"
                >
                  <Languages className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedLanguage === 'sw' ? 'SW' : 'EN'}</span>
                </button>
              </>
            )}

            {/* Single YouTube Fullscreen Button (The only one!) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
                resetControlsTimeout();
              }}
              className={`p-2 rounded-lg active:scale-95 transition cursor-pointer ${
                isFullscreen
                  ? 'text-cyan-400 bg-cyan-600/30 hover:bg-cyan-600/40 border border-cyan-500/50'
                  : 'text-neutral-300 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title={isFullscreen ? 'Punguza Skrini (Exit Fullscreen / F)' : 'Skrini Nzima (Fullscreen / F)'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-cyan-400" /> : <Maximize2 className="w-5 h-5" />}
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
