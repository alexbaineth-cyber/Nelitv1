import React, { useEffect, useRef, useState, useCallback } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import { Channel, ALL_KNOWN_CLEAR_KEYS } from '../data/channels.ts';
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

export type QualityOption = 'auto' | '1080' | '720' | '480' | '360' | '240' | 'saver';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const shakaPlayerRef = useRef<any>(null);
  const hlsPlayerRef = useRef<any>(null);
  const hlsAudioPlayerRef = useRef<any>(null);
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
        } catch {}
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

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

        // Auto-play synced audio stream for ESPN 7 if present
        if (channel.audioUrl && audioRef.current) {
          try {
            audioRef.current.muted = vid.muted;
            audioRef.current.volume = vid.muted ? 0 : (volume || 1);
            await audioRef.current.play();
          } catch (aErr) {
            console.warn('Audio auto play fallback note:', aErr);
          }
        }
      };

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
              bufferingGoal: 4,          // 4s buffer reservoir for instant live start without delay
              rebufferingGoal: 0.5,      // Quick resume in 0.5s after pause or network dip
              bufferBehind: 10,          // Keeps 10s behind in memory (saves RAM & mobile battery)
              safeSeekOffset: 2.5,       // Fast 2.5s delay from live encoder edge
              gapDetectionThreshold: 0.5, // Silently skips timestamp micro-gaps
              stallEnabled: true,        // Detects browser decoder stalls
              stallThreshold: 0.8,
              stallSkip: 0.2,
              segmentPrefetchLimit: 2,   // Pre-fetches next 2 segments ahead of time
              ignoreTextStreamFailures: true,
              retryParameters: {
                maxAttempts: 5,
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
                maxAttempts: 5,
                baseDelay: 150,
                backoffFactor: 1.2
              }
            },
            abr: {
              enabled: selectedQuality === 'auto',
              defaultBandwidthEstimate: 350000,   // Low-bandwidth initial estimate (350kbps) for instant startup in Tanzania
              switchInterval: 5,                  // Responsive 5s observation window
              bandwidthDowngradeTarget: 0.95,     // Instant downshift on mobile network dip
              bandwidthUpgradeTarget: 0.65        // Conservative upgrade target to prevent buffering
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
            maxBufferLength: 8,
            maxMaxBufferLength: 16,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: 5,
            lowLatencyMode: true,
            backBufferLength: 10,
            startLevel: 0, // Starts on lowest/fastest bandwidth level for instant startup without loading
            autoStartLoad: true,
            capLevelToPlayerSize: true, // Caps bitrate to phone screen resolution to save data
            abrBandWidthFactor: 0.70,
            abrBandWidthUpFactor: 0.50,
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

          // ESPN 7 & Dual-stream audio player loader
          if (channel.audioUrl && audioRef.current) {
            try {
              const audioHls = new Hls({
                maxBufferLength: 8,
                lowLatencyMode: true,
                autoStartLoad: true
              });
              hlsAudioPlayerRef.current = audioHls;
              audioHls.loadSource(channel.audioUrl);
              audioHls.attachMedia(audioRef.current);
            } catch (aErr) {
              console.warn('Audio Hls attach note:', aErr);
            }
          }
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = targetUrl;
          if (channel.audioUrl && audioRef.current) {
            audioRef.current.src = channel.audioUrl;
          }
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
  }, [channel.id, retryCount]);

  // Video listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
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
            defaultBandwidthEstimate: 350000,
            switchInterval: 5,
            bandwidthDowngradeTarget: 0.95,
            bandwidthUpgradeTarget: 0.65
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
      {/* HTML5 Video Element or Embedded Iframe (Super Sport, EPL League Tv, etc.) */}
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
          <video
            ref={videoRef}
            playsInline
            autoPlay
            className="w-full h-full object-contain bg-black"
          />
          {channel.audioUrl && (
            <audio
              ref={audioRef}
              playsInline
              className="hidden"
            />
          )}
        </>
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

      {/* YouTube-Style Bottom Overlay Controls (Unified for both Native & Embedded Streams) */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-all duration-300 ease-in-out ${
          showControls
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
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border cursor-pointer ${
                      selectedQuality === 'saver'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/80 shadow-sm shadow-emerald-500/20'
                        : 'bg-neutral-900/90 hover:bg-neutral-800 text-white border-white/10'
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
                      onClick={(e) => e.stopPropagation()}
                      className="absolute bottom-full right-0 mb-2 w-56 rounded-xl bg-[#0B1020] border border-neutral-700 shadow-2xl py-1.5 z-50 text-xs animate-fade-in"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 flex items-center justify-between">
                        <span>Ubora wa Video</span>
                        <span className="text-cyan-400 text-[9px] font-normal">Kasi ya Mtandao TZ</span>
                      </div>

                      <button
                        onClick={() => handleSelectQuality('auto')}
                        className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center justify-between transition cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-white">Auto (Kiotomatiki)</div>
                          <div className="text-[10px] text-neutral-400">Inabadilika kulingana na kasi ya simu</div>
                        </div>
                        {selectedQuality === 'auto' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>

                      <div className="my-1 border-t border-neutral-800" />

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
