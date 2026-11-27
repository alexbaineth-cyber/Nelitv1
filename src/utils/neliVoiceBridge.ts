export interface VoicePlayerCommandDetail {
  type:
    | 'SET_VOLUME'
    | 'STEP_VOLUME'
    | 'MUTE'
    | 'UNMUTE'
    | 'SET_BRIGHTNESS'
    | 'STEP_BRIGHTNESS'
    | 'SET_QUALITY'
    | 'STEP_QUALITY'
    | 'SET_LANGUAGE'
    | 'SET_FULLSCREEN'
    | 'PAUSE'
    | 'PLAY'
    | 'DUCK_AUDIO';
  value?: number;
  delta?: number;
  direction?: 'up' | 'down';
  quality?: 'auto' | '1080' | '720' | '480' | '360' | '240' | 'saver';
  language?: 'sw' | 'en';
  fullscreen?: boolean;
  ducked?: boolean;
}

export const NELI_VOICE_PLAYER_EVENT = 'nelitv:voice-player-command';

export function dispatchVoicePlayerCommand(detail: VoicePlayerCommandDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<VoicePlayerCommandDetail>(NELI_VOICE_PLAYER_EVENT, { detail }));
}
