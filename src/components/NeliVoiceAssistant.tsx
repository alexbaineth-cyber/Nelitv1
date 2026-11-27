import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, Radio } from 'lucide-react';
import { Channel } from '../data/channels.ts';
import { dispatchVoicePlayerCommand } from '../utils/neliVoiceBridge.ts';
import type { FirebaseMovieItem, NeliAiCommandResponse } from '../server/neliAiBrain.ts';

interface NeliVoiceAssistantProps {
  channels: Channel[];
  currentChannel?: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  onOpenMovie: (movie: FirebaseMovieItem) => void;
  onNavigateHome: () => void;
  onNavigateDownload: () => void;
}

type VoiceStatus = 'idle' | 'listening' | 'wake-listening' | 'processing' | 'speaking';

function pickSpeechSynthesisVoice(lang: 'sw' | 'en'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  if (lang === 'sw') {
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith('sw')) ||
      voices.find((v) => v.lang.toLowerCase().includes('ke') || v.lang.toLowerCase().includes('tz')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      voices[0]
    );
  }
  return voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0];
}

export const NeliVoiceAssistant: React.FC<NeliVoiceAssistantProps> = ({
  channels,
  currentChannel,
  onSelectChannel,
  onOpenMovie,
  onNavigateHome,
  onNavigateDownload
}) => {
  const [supported, setSupported] = useState<boolean>(true);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [handsFreeWakeMode, setHandsFreeWakeMode] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [spokenBanner, setSpokenBanner] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const handsFreeRef = useRef<boolean>(false);
  const micUnlockedRef = useRef<boolean>(false);
  const latestTranscriptRef = useRef<string>('');
  const hasDispatchedRef = useRef<boolean>(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langIndexRef = useRef<number>(0);
  const recognitionLangs = ['en-US', 'sw-TZ'];

  useEffect(() => {
    handsFreeRef.current = handsFreeWakeMode;
  }, [handsFreeWakeMode]);

  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(Boolean(SpeechRec));
    try {
      window.speechSynthesis?.getVoices();
    } catch {}
  }, []);

  const showTransientBanner = useCallback((text: string, ms = 3600) => {
    setSpokenBanner(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setSpokenBanner('');
      setLiveTranscript('');
    }, ms);
  }, []);

  const speakReply = useCallback(
    (text: string, lang: 'sw' | 'en') => {
      showTransientBanner(text, 4000);
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const voice = pickSpeechSynthesisVoice(lang);
        if (voice) utter.voice = voice;
        utter.lang = lang === 'sw' ? 'sw-KE' : 'en-US';
        utter.rate = 1.04;
        utter.pitch = 1.02;
        isSpeakingRef.current = true;
        setStatus('speaking');
        utter.onend = () => {
          isSpeakingRef.current = false;
          setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
        };
        utter.onerror = () => {
          isSpeakingRef.current = false;
          setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
        };
        window.speechSynthesis.speak(utter);
      } catch {
        isSpeakingRef.current = false;
        setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
      }
    },
    [showTransientBanner]
  );

  const executeBrainAction = useCallback(
    (data: any) => {
      const act = data?.action;
      if (!act) return;
      const actType = String(act.type || '').toUpperCase();

      switch (actType) {
        case 'OPEN_CHANNEL':
        case 'PLAY_CHANNEL':
        case 'NEXT_CHANNEL':
        case 'PREV_CHANNEL': {
          const chanRef = act.channel || data.matchedChannel;
          const targetId = act.target_id || act.channelId || chanRef?.id;
          const targetSlug = act.slug || chanRef?.slug;
          const targetName = act.target_name || act.channelName || chanRef?.name;
          const found =
            channels.find((c) => targetId && c.id === targetId) ||
            channels.find((c) => targetSlug && c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === String(targetSlug).toLowerCase()) ||
            channels.find((c) => targetName && c.name.toLowerCase() === String(targetName).toLowerCase()) ||
            channels.find((c) => targetName && c.name.toLowerCase().includes(String(targetName).toLowerCase()));
          if (found) {
            onSelectChannel(found);
          }
          break;
        }
        case 'OPEN_MOVIE':
        case 'OPEN_SERIES':
        case 'PLAY_MOVIE': {
          const targetMovie = act.movie || data.matchedMovies?.[0];
          if (targetMovie && targetMovie.streamUrl) {
            onOpenMovie(targetMovie);
          }
          break;
        }
        case 'OPEN_APP_LINK': {
          if (act.channel) {
            const found = channels.find((c) => c.id === act.channel.id);
            if (found) onSelectChannel(found);
          } else {
            onNavigateDownload();
          }
          break;
        }
        case 'GO_HOME': {
          onNavigateHome();
          break;
        }
        case 'OPEN_DOWNLOAD':
        case 'OPEN_PREMIUM': {
          if (actType === 'OPEN_DOWNLOAD') {
            onNavigateDownload();
          } else if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/account');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
          break;
        }
        case 'OPEN_SEARCH': {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/search');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
          break;
        }
        case 'VOLUME_UP': {
          dispatchVoicePlayerCommand({ type: 'STEP_VOLUME', direction: 'up', delta: 0.2 });
          break;
        }
        case 'VOLUME_DOWN': {
          dispatchVoicePlayerCommand({ type: 'STEP_VOLUME', direction: 'down', delta: -0.2 });
          break;
        }
        case 'RESUME': {
          dispatchVoicePlayerCommand({ type: 'PLAY' });
          break;
        }
        case 'VOLUME': {
          const val = typeof act.value === 'number' ? act.value : undefined;
          const dir = act.direction === 'down' || (typeof act.delta === 'number' && act.delta < 0) ? 'down' : 'up';
          dispatchVoicePlayerCommand(
            val !== undefined
              ? { type: 'SET_VOLUME', value: val > 1 ? val / 100 : val }
              : { type: 'STEP_VOLUME', direction: dir, delta: dir === 'down' ? -0.2 : 0.2 }
          );
          break;
        }
        case 'BRIGHTNESS': {
          const val = typeof act.value === 'number' ? act.value : undefined;
          const dir = act.direction === 'down' || (typeof act.delta === 'number' && act.delta < 0) ? 'down' : 'up';
          dispatchVoicePlayerCommand(
            val !== undefined
              ? { type: 'SET_BRIGHTNESS', value: val > 2 ? val / 100 : val }
              : { type: 'STEP_BRIGHTNESS', direction: dir, delta: dir === 'down' ? -0.15 : 0.15 }
          );
          break;
        }
        case 'QUALITY': {
          if (act.quality) {
            dispatchVoicePlayerCommand({ type: 'SET_QUALITY', quality: act.quality });
          } else {
            dispatchVoicePlayerCommand({ type: 'STEP_QUALITY', direction: act.direction === 'down' ? 'down' : 'up' });
          }
          break;
        }
        case 'FULLSCREEN': {
          dispatchVoicePlayerCommand({
            type: 'SET_FULLSCREEN',
            fullscreen: typeof act.fullscreen === 'boolean' ? act.fullscreen : true
          });
          break;
        }
        case 'SET_VOLUME':
        case 'STEP_VOLUME':
        case 'MUTE':
        case 'UNMUTE':
        case 'SET_BRIGHTNESS':
        case 'STEP_BRIGHTNESS':
        case 'SET_QUALITY':
        case 'STEP_QUALITY':
        case 'SET_LANGUAGE':
        case 'SET_FULLSCREEN':
        case 'PAUSE':
        case 'PLAY': {
          dispatchVoicePlayerCommand({
            type: actType as any,
            value: act.value,
            delta: act.delta,
            direction: act.direction,
            quality: act.quality,
            language: act.language,
            fullscreen: act.fullscreen
          });
          break;
        }
        default:
          break;
      }
    },
    [channels, onSelectChannel, onOpenMovie, onNavigateHome, onNavigateDownload]
  );

  const sendTranscriptToBrain = useCallback(
    async (transcript: string) => {
      const cleaned = transcript.trim();
      if (!cleaned) return;

      const endpoint =
        (import.meta as any).env?.VITE_NELI_AI_COMMAND_URL || '/v1/neli-ai/command';

      setStatus('processing');
      setLiveTranscript(cleaned);
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Id': 'nelitv-web'
          },
          body: JSON.stringify({
            app_id: 'nelitv-web',
            platform: 'web',
            capabilities: ['live_tv', 'movies', 'series', 'player_controls', 'vip_support'],
            user_locale: 'auto',
            input_mode: 'voice',
            input_text: cleaned,
            transcript: cleaned,
            context: {
              current_screen: currentChannel ? 'player' : 'home',
              current_channel_id: currentChannel?.id
            }
          })
        });
        const data: NeliAiCommandResponse = await resp.json();
        if (data?.success || data?.reply_text || data?.speech_text) {
          executeBrainAction(data);
          speakReply(data.speech_text || data.spokenReply || data.reply_text, data.language || 'sw');
        } else {
          speakReply('Samahani, jaribu tena.', 'sw');
        }
      } catch {
        speakReply('Mtandao unasuasua kidogo, jaribu tena.', 'sw');
      }
    },
    [currentChannel, executeBrainAction, speakReply]
  );

  const ensureMicPermission = useCallback(async (): Promise<boolean> => {
    if (micUnlockedRef.current) return true;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      micUnlockedRef.current = true;
      return true;
    } catch (err: any) {
      const errName = String(err?.name || '');
      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        showTransientBanner('Hakuna maikrofoni iliyopatikana kwenye kifaa hiki.', 4000);
      } else {
        showTransientBanner(
          'Ruhusa ya maikrofoni imezuiwa. Ruhusu mic kwenye browser yako kisha jaribu tena.',
          4500
        );
      }
      return false;
    }
  }, [showTransientBanner]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    // If user tapped mic to stop while interim speech was already captured, run it immediately
    if (latestTranscriptRef.current && !hasDispatchedRef.current) {
      const captured = latestTranscriptRef.current;
      hasDispatchedRef.current = true;
      latestTranscriptRef.current = '';
      void sendTranscriptToBrain(captured);
      return;
    }
    setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
  }, [sendTranscriptToBrain]);

  const startRecognition = useCallback(
    (continuousWakeMode: boolean) => {
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        showTransientBanner(
          'Kivinjari hiki hakina Web Speech Mic (tumia Chrome, Edge, au NeliTv APK).',
          4500
        );
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
      }

      latestTranscriptRef.current = '';
      hasDispatchedRef.current = false;

      const rec = new SpeechRec();
      rec.lang = recognitionLangs[langIndexRef.current % recognitionLangs.length];
      rec.continuous = continuousWakeMode;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setStatus(continuousWakeMode ? 'wake-listening' : 'listening');
        if (!continuousWakeMode) {
          setLiveTranscript('');
          setSpokenBanner('');
        }
      };

      rec.onresult = (event: any) => {
        if (isSpeakingRef.current) return;
        const lastResult = event.results[event.results.length - 1];
        const transcript = String(lastResult?.[0]?.transcript || '').trim();
        if (!transcript) return;

        latestTranscriptRef.current = transcript;

        if (!continuousWakeMode) {
          setLiveTranscript(transcript);
          if (lastResult.isFinal && !hasDispatchedRef.current) {
            hasDispatchedRef.current = true;
            latestTranscriptRef.current = '';
            try {
              rec.stop();
            } catch {}
            void sendTranscriptToBrain(transcript);
          }
        } else if (lastResult.isFinal) {
          const hasWake = /\b(neli|nelly|nely|hey neli|ok neli)\b/i.test(transcript);
          if (hasWake) {
            latestTranscriptRef.current = '';
            void sendTranscriptToBrain(transcript);
          }
        }
      };

      rec.onerror = (err: any) => {
        const code = String(err?.error || '');
        if (code === 'aborted') {
          return;
        }
        if (code === 'language-not-supported' && langIndexRef.current === 0) {
          langIndexRef.current = 1;
          showTransientBanner('Inabadilisha lugha ya maikrofoni, bonyeza tena.', 3000);
          setStatus('idle');
          return;
        }
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          if (!micUnlockedRef.current) {
            void ensureMicPermission().then((granted) => {
              if (granted) {
                setTimeout(() => startRecognition(continuousWakeMode), 250);
              } else {
                setHandsFreeWakeMode(false);
                handsFreeRef.current = false;
                setStatus('idle');
              }
            });
            return;
          }
          micUnlockedRef.current = false;
          setHandsFreeWakeMode(false);
          handsFreeRef.current = false;
          setStatus('idle');
          showTransientBanner(
            'Ruhusu maikrofoni kwenye kivinjari (au fungua app kwenye tab mpya) ili Neli akusikie.',
            4500
          );
          return;
        }
        if (code === 'audio-capture') {
          setHandsFreeWakeMode(false);
          handsFreeRef.current = false;
          setStatus('idle');
          showTransientBanner('Maikrofoni haipatikani au inatumika na app nyingine.', 4000);
          return;
        }
        if (code === 'network') {
          setStatus('idle');
          showTransientBanner('Huduma ya kutambua sauti inahitaji mtandao thabiti.', 3800);
          return;
        }
        if (code === 'no-speech' && !continuousWakeMode) {
          setStatus('idle');
          showTransientBanner('Sikusikia sauti — bonyeza mic kisha sema amri yako.', 3000);
          return;
        }
        if (!continuousWakeMode) {
          setStatus('idle');
        }
      };

      rec.onend = () => {
        if (!continuousWakeMode && latestTranscriptRef.current && !hasDispatchedRef.current) {
          const captured = latestTranscriptRef.current;
          hasDispatchedRef.current = true;
          latestTranscriptRef.current = '';
          void sendTranscriptToBrain(captured);
          return;
        }
        if (handsFreeRef.current && continuousWakeMode) {
          setTimeout(() => {
            if (handsFreeRef.current && !isSpeakingRef.current) {
              startRecognition(true);
            }
          }, 450);
        } else if (!isSpeakingRef.current) {
          setStatus('idle');
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
      } catch (startErr: any) {
        setStatus('idle');
        showTransientBanner(
          startErr?.message || 'Imeshindwa kuwasha maikrofoni. Jaribu kubonyeza tena.',
          3500
        );
      }
    },
    [ensureMicPermission, sendTranscriptToBrain, showTransientBanner]
  );

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
      }
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const handlePrimaryMicTap = () => {
    if (!supported) {
      showTransientBanner(
        'Kivinjari hiki hakina sauti ya Web Speech (tumia Chrome, Edge, au NeliTv APK).',
        4500
      );
      return;
    }
    if (status === 'speaking') {
      try {
        window.speechSynthesis?.cancel();
      } catch {}
      isSpeakingRef.current = false;
    }
    if (status === 'listening') {
      stopRecognition();
      return;
    }
    // Preserve synchronous user gesture for SpeechRecognition.start()
    startRecognition(false);
  };

  const handleToggleWakeWordMode = () => {
    if (!supported) {
      showTransientBanner(
        'Kivinjari hiki hakina sauti ya Web Speech (tumia Chrome, Edge, au NeliTv APK).',
        4500
      );
      return;
    }
    const next = !handsFreeWakeMode;
    if (next) {
      setHandsFreeWakeMode(true);
      handsFreeRef.current = true;
      startRecognition(true);
      showTransientBanner('Neli Hands-Free imewashwa — sema "Neli fungua Azam Two"', 3500);
    } else {
      setHandsFreeWakeMode(false);
      handsFreeRef.current = false;
      stopRecognition();
      setStatus('idle');
      showTransientBanner('Neli Hands-Free imezimwa', 2000);
    }
  };

  return (
    <div
      data-player-ui="true"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100005] flex flex-col items-end gap-2 pointer-events-none"
    >
      {/* Pure Voice Status Pill (only visible while listening, processing, speaking, or reporting error) */}
      {(status === 'listening' || status === 'processing' || Boolean(liveTranscript) || Boolean(spokenBanner)) && (
        <div className="pointer-events-auto max-w-[300px] sm:max-w-xs px-3.5 py-2.5 rounded-2xl bg-[#0e1420]/95 backdrop-blur-md border border-[#1ce783]/35 shadow-2xl text-xs text-slate-100 flex items-center gap-2.5">
          {status === 'speaking' ? (
            <Volume2 className="w-4 h-4 text-[#1ce783] shrink-0 animate-pulse" />
          ) : (
            <Radio className="w-4 h-4 text-[#1ce783] shrink-0 animate-pulse" />
          )}
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#1ce783]">
              {status === 'listening'
                ? 'Neli Anasikiliza...'
                : status === 'processing'
                ? 'Inachakata...'
                : 'Neli Voice AI'}
            </div>
            <p className="text-xs text-white/95 line-clamp-2">
              {spokenBanner || liveTranscript || 'Sema amri kama: Change channel to Azam Two...'}
            </p>
          </div>
        </div>
      )}

      {/* Voice-Only Control Cluster: Hands-Free Wake Toggle + Primary Mic Orb */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleToggleWakeWordMode()}
          title={
            handsFreeWakeMode
              ? 'Zima Wake-Word ("Neli")'
              : 'Washa Wake-Word ("Neli ...")'
          }
          className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border shadow-lg transition cursor-pointer ${
            handsFreeWakeMode
              ? 'bg-[#1ce783]/20 text-[#1ce783] border-[#1ce783]/50'
              : 'bg-[#111622]/90 text-slate-300 border-white/15 hover:text-white hover:border-white/30'
          }`}
        >
          {handsFreeWakeMode ? 'Neli ON' : 'Hey Neli'}
        </button>

        <button
          type="button"
          onClick={() => void handlePrimaryMicTap()}
          aria-label="Neli Voice Assistant"
          title="Bonyeza uzungumze na Neli (mfano: Neli change channel to Azam Two)"
          className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-2xl border transition active:scale-95 cursor-pointer ${
            status === 'listening'
              ? 'bg-[#1ce783] text-[#04120b] border-white/40 ring-4 ring-[#1ce783]/30'
              : status === 'wake-listening'
              ? 'bg-[#131b2b] text-[#1ce783] border-[#1ce783]/60'
              : 'bg-[#131b2b]/95 hover:bg-[#1a2438] text-white border-white/20 hover:border-[#1ce783]/50'
          }`}
        >
          {status === 'listening' ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
          {(status === 'listening' || status === 'wake-listening') && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#1ce783] animate-ping" />
          )}
        </button>
      </div>
    </div>
  );
};
