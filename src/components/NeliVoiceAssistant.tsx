import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, Radio } from 'lucide-react';
import { Channel } from '../data/channels.ts';
import { dispatchVoicePlayerCommand } from '../utils/neliVoiceBridge.ts';
import { speakAsYouthFemaleEnglish } from '../utils/neliVoiceTts.ts';
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const handsFreeRef = useRef<boolean>(false);
  const micUnlockedRef = useRef<boolean>(false);
  const dspStreamRef = useRef<MediaStream | null>(null);
  const lastDispatchAtRef = useRef<number>(0);
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
    const hasMediaRecorder = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    setSupported(Boolean(SpeechRec || hasMediaRecorder));
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
    (displayText: string, speechEnglishText?: string) => {
      showTransientBanner(displayText, 4000);
      const textToSpeak = (speechEnglishText || displayText).trim();
      dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: true });
      speakAsYouthFemaleEnglish(textToSpeak, {
        onStart: () => {
          isSpeakingRef.current = true;
          setStatus('speaking');
        },
        onEnd: () => {
          isSpeakingRef.current = false;
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
        },
        onError: () => {
          isSpeakingRef.current = false;
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
        }
      });
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

      const primaryEndpoint =
        (import.meta as any).env?.VITE_NELI_AI_COMMAND_URL || '/v1/neli-ai/command';
      const endpoints =
        primaryEndpoint === '/v1/neli-ai/command'
          ? ['/v1/neli-ai/command', '/api/ai/command']
          : [primaryEndpoint];

      const payload = JSON.stringify({
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
      });

      setStatus('processing');
      setLiveTranscript(cleaned);
      try {
        let data: NeliAiCommandResponse | null = null;
        for (const ep of endpoints) {
          const resp = await fetch(ep, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-App-Id': 'nelitv-web'
            },
            body: payload
          });
          const ct = resp.headers.get('content-type') || '';
          if (resp.ok && ct.includes('application/json')) {
            data = await resp.json();
            break;
          }
        }
        if (data && (data.success || data.reply_text || data.speech_text)) {
          executeBrainAction(data);
          speakReply(
            data.reply_text || data.speech_text || data.spokenReply,
            data.speech_text_en || data.speech_text || data.spokenReply || data.reply_text
          );
        } else {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          speakReply('Samahani, jaribu tena.', 'Sorry, please try again.');
        }
      } catch {
        dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
        speakReply('Mtandao unasuasua kidogo, jaribu tena.', 'Network is a bit slow, please try again.');
      }
    },
    [currentChannel, executeBrainAction, speakReply]
  );

  const releaseDspStream = useCallback(() => {
    if (dspStreamRef.current) {
      dspStreamRef.current.getTracks().forEach((t) => t.stop());
      dspStreamRef.current = null;
    }
  }, []);

  const ensureMicPermission = useCallback(async (keepNoiseSuppression = false): Promise<boolean> => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      showTransientBanner('Maikrofoni kwenye web inahitaji HTTPS salama.', 4500);
      return false;
    }
    if (micUnlockedRef.current && (!keepNoiseSuppression || dspStreamRef.current)) {
      return true;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      if (keepNoiseSuppression) {
        releaseDspStream();
        dspStreamRef.current = stream;
      } else {
        stream.getTracks().forEach((track) => track.stop());
      }
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
  }, [releaseDspStream, showTransientBanner]);

  const stopRecognition = useCallback(() => {
    dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
    if (mediaRecordTimerRef.current) {
      clearTimeout(mediaRecordTimerRef.current);
      mediaRecordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    releaseDspStream();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (latestTranscriptRef.current && !hasDispatchedRef.current) {
      const captured = latestTranscriptRef.current;
      hasDispatchedRef.current = true;
      latestTranscriptRef.current = '';
      void sendTranscriptToBrain(captured);
      return;
    }
    setStatus(handsFreeRef.current ? 'wake-listening' : 'idle');
  }, [releaseDspStream, sendTranscriptToBrain]);

  const startWhisperFallbackRecording = useCallback(async () => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      showTransientBanner('Maikrofoni kwenye web inahitaji HTTPS salama.', 4500);
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      showTransientBanner('Kivinjari hiki hakina sauti ya Mic (tumia Chrome, Edge, au NeliTv APK).', 4500);
      return;
    }

    try {
      dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: true });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      releaseDspStream();
      dspStreamRef.current = stream;
      micUnlockedRef.current = true;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      setStatus('listening');
      setLiveTranscript('');
      setSpokenBanner('Sema amri yako sasa (sekunde 4)...');

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = async () => {
        if (mediaRecordTimerRef.current) {
          clearTimeout(mediaRecordTimerRef.current);
          mediaRecordTimerRef.current = null;
        }
        releaseDspStream();
        mediaRecorderRef.current = null;

        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        if (blob.size < 800) {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          setStatus('idle');
          showTransientBanner('Sikusikia sauti — bonyeza mic kisha sema amri yako.', 3000);
          return;
        }

        setStatus('processing');
        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to read audio'));
            reader.readAsDataURL(blob);
          });

          const resp = await fetch('/v1/neli-ai/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-App-Id': 'nelitv-web'
            },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: blob.type || 'audio/webm',
              language: 'auto',
              autoExecute: true,
              app_id: 'nelitv-web',
              platform: 'web',
              capabilities: ['live_tv', 'movies', 'series', 'player_controls', 'vip_support'],
              context: {
                current_screen: currentChannel ? 'player' : 'home',
                current_channel_id: currentChannel?.id
              }
            })
          });

          const data = await resp.json().catch(() => null);
          if (resp.ok && data?.success && data.commandResult) {
            if (data.text) setLiveTranscript(data.text);
            executeBrainAction(data.commandResult);
            speakReply(
              data.commandResult.reply_text || data.commandResult.speech_text,
              data.commandResult.speech_text_en || data.commandResult.speech_text || data.commandResult.reply_text
            );
          } else if (data?.groqConfigured === false) {
            dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
            setStatus('idle');
            showTransientBanner('Kivinjari hiki hakina Web Speech; weka GROQ_API_KEY au tumia Chrome/APK.', 4500);
          } else {
            dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
            setStatus('idle');
            showTransientBanner('Sikusikia vizuri, jaribu kusema tena.', 3200);
          }
        } catch {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          setStatus('idle');
          showTransientBanner('Hitilafu ya mtandao kwenye maikrofoni.', 3500);
        }
      };

      recorder.start();
      mediaRecordTimerRef.current = setTimeout(() => {
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {}
        }
      }, 4200);
    } catch {
      dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
      setStatus('idle');
      showTransientBanner('Ruhusa ya maikrofoni imezuiwa. Ruhusu mic kwenye browser yako kisha jaribu tena.', 4500);
    }
  }, [currentChannel, executeBrainAction, releaseDspStream, showTransientBanner, speakReply]);

  const isBackgroundFillerNoise = (text: string): boolean => {
    const cleaned = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim();
    if (cleaned.length < 3) return true;
    return /^(uh+|um+|erm+|hmm+|mhm+|ah+|eh+|oh+|yeah|yea|ok|the|a|an|na|ni|ya)$/i.test(cleaned);
  };

  const startRecognition = useCallback(
    (continuousWakeMode: boolean) => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        showTransientBanner('Maikrofoni kwenye web inahitaji HTTPS salama.', 4500);
        return;
      }
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        if (!continuousWakeMode) {
          void startWhisperFallbackRecording();
        } else {
          showTransientBanner(
            'Kivinjari hiki hakina Web Speech Mic (tumia Chrome, Edge, au NeliTv APK).',
            4500
          );
        }
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

      if (!continuousWakeMode) {
        dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: true });
      }

      const rec = new SpeechRec();
      rec.lang = recognitionLangs[langIndexRef.current % recognitionLangs.length];
      rec.continuous = continuousWakeMode;
      rec.interimResults = true;
      rec.maxAlternatives = 3;

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
        if (!lastResult) return;

        // Inspect alternatives to filter background noise and pick clearest wake/command match
        const alts: Array<{ transcript: string; confidence: number }> = [];
        for (let i = 0; i < lastResult.length; i++) {
          const item = lastResult[i];
          const t = String(item?.transcript || '').trim();
          const c = typeof item?.confidence === 'number' ? item.confidence : 1;
          if (t) alts.push({ transcript: t, confidence: c });
        }
        if (alts.length === 0) return;

        const chosen = continuousWakeMode
          ? alts.find((a) => /\b(neli|nelly|nely|hey neli|ok neli)\b/i.test(a.transcript)) || alts[0]
          : alts[0];

        const transcript = chosen.transcript;
        const conf = chosen.confidence;

        // Suppress low-confidence room noise / background chatter on final transcripts
        if (lastResult.isFinal) {
          const minConf = continuousWakeMode ? 0.45 : 0.30;
          if ((conf > 0 && conf < minConf) || isBackgroundFillerNoise(transcript)) {
            return;
          }
        }

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
          const now = Date.now();
          if (hasWake && now - lastDispatchAtRef.current > 1800) {
            lastDispatchAtRef.current = now;
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
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          showTransientBanner('Inabadilisha lugha ya maikrofoni, bonyeza tena.', 3000);
          setStatus('idle');
          return;
        }
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          if (!micUnlockedRef.current) {
            void ensureMicPermission(false).then((granted) => {
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
          releaseDspStream();
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          setHandsFreeWakeMode(false);
          handsFreeRef.current = false;
          setStatus('idle');
          showTransientBanner('Maikrofoni haipatikani au inatumika na app nyingine.', 4000);
          return;
        }
        if (code === 'network') {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          if (!continuousWakeMode) {
            void startWhisperFallbackRecording();
            return;
          }
          setStatus('idle');
          showTransientBanner('Huduma ya kutambua sauti inahitaji mtandao thabiti.', 3800);
          return;
        }
        if (code === 'no-speech' && !continuousWakeMode) {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          setStatus('idle');
          showTransientBanner('Sikusikia sauti — bonyeza mic kisha sema amri yako.', 3000);
          return;
        }
        if (!continuousWakeMode) {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
          setStatus('idle');
        }
      };

      rec.onend = () => {
        if (!continuousWakeMode && latestTranscriptRef.current && !hasDispatchedRef.current && !isBackgroundFillerNoise(latestTranscriptRef.current)) {
          const captured = latestTranscriptRef.current;
          hasDispatchedRef.current = true;
          latestTranscriptRef.current = '';
          void sendTranscriptToBrain(captured);
          return;
        }
        if (!continuousWakeMode && !hasDispatchedRef.current) {
          dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
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
        dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
        setStatus('idle');
        showTransientBanner(
          startErr?.message || 'Imeshindwa kuwasha maikrofoni. Jaribu kubonyeza tena.',
          3500
        );
      }
    },
    [ensureMicPermission, releaseDspStream, sendTranscriptToBrain, showTransientBanner, startWhisperFallbackRecording]
  );

  useEffect(() => {
    return () => {
      dispatchVoicePlayerCommand({ type: 'DUCK_AUDIO', ducked: false });
      if (mediaRecordTimerRef.current) clearTimeout(mediaRecordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      releaseDspStream();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
      }
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [releaseDspStream]);

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
