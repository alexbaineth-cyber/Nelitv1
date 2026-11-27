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
  const [supported, setSupported] = useState<boolean>(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [handsFreeWakeMode, setHandsFreeWakeMode] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [spokenBanner, setSpokenBanner] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const handsFreeRef = useRef<boolean>(false);
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

  const showTransientBanner = useCallback((text: string, ms = 3400) => {
    setSpokenBanner(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setSpokenBanner('');
      setLiveTranscript('');
    }, ms);
  }, []);

  const speakReply = useCallback(
    (text: string, lang: 'sw' | 'en') => {
      showTransientBanner(text, 3800);
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
    (data: NeliAiCommandResponse) => {
      const act = data.action;
      if (!act) return;

      switch (act.type) {
        case 'OPEN_CHANNEL':
        case 'NEXT_CHANNEL':
        case 'PREV_CHANNEL': {
          if (act.channel) {
            const found =
              channels.find((c) => c.id === act.channel?.id) ||
              channels.find((c) => c.name.toLowerCase() === act.channel?.name.toLowerCase());
            if (found) {
              onSelectChannel(found);
            }
          }
          break;
        }
        case 'OPEN_MOVIE': {
          if (act.movie && act.movie.streamUrl) {
            onOpenMovie(act.movie);
          }
          break;
        }
        case 'GO_HOME': {
          onNavigateHome();
          break;
        }
        case 'OPEN_DOWNLOAD': {
          onNavigateDownload();
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
            type: act.type,
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

      setStatus('processing');
      setLiveTranscript(cleaned);
      try {
        const resp = await fetch('/api/ai/command', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Id': 'nelitv-web'
          },
          body: JSON.stringify({
            transcript: cleaned,
            appId: 'nelitv-web',
            currentChannelId: currentChannel?.id,
            locale: 'auto'
          })
        });
        const data: NeliAiCommandResponse = await resp.json();
        if (data?.success) {
          executeBrainAction(data);
          speakReply(data.spokenReply, data.language || 'sw');
        } else {
          speakReply('Samahani, jaribu tena.', 'sw');
        }
      } catch {
        speakReply('Mtandao unasuasua kidogo, jaribu tena.', 'sw');
      }
    },
    [currentChannel?.id, executeBrainAction, speakReply]
  );

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
  }, []);

  const startRecognition = useCallback(
    (continuousWakeMode: boolean) => {
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) return;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
      }

      const rec = new SpeechRec();
      rec.lang = recognitionLangs[langIndexRef.current % recognitionLangs.length];
      rec.continuous = continuousWakeMode;
      rec.interimResults = !continuousWakeMode;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setStatus(continuousWakeMode ? 'wake-listening' : 'listening');
        if (!continuousWakeMode) {
          setLiveTranscript('');
        }
      };

      rec.onresult = (event: any) => {
        if (isSpeakingRef.current) return;
        const lastResult = event.results[event.results.length - 1];
        const transcript = String(lastResult?.[0]?.transcript || '').trim();
        if (!transcript) return;

        if (!continuousWakeMode) {
          setLiveTranscript(transcript);
          if (lastResult.isFinal) {
            try {
              rec.stop();
            } catch {}
            void sendTranscriptToBrain(transcript);
          }
        } else if (lastResult.isFinal) {
          // Wake-word guard in continuous hands-free mode ("Neli ...")
          const hasWake = /\b(neli|nelly|nely|hey neli|ok neli)\b/i.test(transcript);
          if (hasWake) {
            void sendTranscriptToBrain(transcript);
          }
        }
      };

      rec.onerror = (err: any) => {
        if (err?.error === 'language-not-supported' && langIndexRef.current === 0) {
          langIndexRef.current = 1;
        }
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          setHandsFreeWakeMode(false);
          handsFreeRef.current = false;
          setStatus('idle');
          showTransientBanner('Ruhusu maikrofoni kwenye kivinjari ili kutumia Neli Voice.', 3500);
          return;
        }
        if (!continuousWakeMode) {
          setStatus('idle');
        }
      };

      rec.onend = () => {
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
      } catch {
        setStatus('idle');
      }
    },
    [sendTranscriptToBrain, showTransientBanner]
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

  if (!supported) {
    return null;
  }

  const handlePrimaryMicTap = () => {
    if (status === 'listening') {
      stopRecognition();
      return;
    }
    if (handsFreeWakeMode) {
      // Single command boost while already in wake mode
      startRecognition(false);
      return;
    }
    startRecognition(false);
  };

  const handleToggleWakeWordMode = () => {
    const next = !handsFreeWakeMode;
    setHandsFreeWakeMode(next);
    handsFreeRef.current = next;
    if (next) {
      startRecognition(true);
      showTransientBanner('Neli Hands-Free imewashwa — sema "Neli fungua Azam Two"', 3500);
    } else {
      stopRecognition();
      setStatus('idle');
      showTransientBanner('Neli Hands-Free imezimwa', 2000);
    }
  };

  return (
    <div
      data-player-ui="true"
      className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 flex flex-col items-end gap-2 pointer-events-none"
    >
      {/* Pure Voice Status Pill (only visible while listening or speaking; NO chat interface) */}
      {(status === 'listening' || status === 'processing' || Boolean(liveTranscript) || Boolean(spokenBanner)) && (
        <div className="pointer-events-auto max-w-[280px] sm:max-w-xs px-3.5 py-2.5 rounded-2xl bg-[#0e1420]/95 backdrop-blur-md border border-[#1ce783]/35 shadow-2xl text-xs text-slate-100 flex items-center gap-2.5">
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
            <p className="text-xs text-white/95 truncate">
              {spokenBanner || liveTranscript || 'Sema amri kama: Open Azam Two...'}
            </p>
          </div>
        </div>
      )}

      {/* Voice-Only Control Cluster: Hands-Free Wake Toggle + Primary Mic Orb */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggleWakeWordMode}
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
          onClick={handlePrimaryMicTap}
          aria-label="Neli Voice Assistant"
          title="Bonyeza uzungumze na Neli (mfano: Neli open Azam Two)"
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
