export interface YouthFemaleVoiceProfile {
  gender: 'female';
  age_group: '10-14';
  language: 'en-US';
  pitch: number;
  rate: number;
  free_tts: true;
  preferred_voices: string[];
}

export const NELI_YOUTH_FEMALE_VOICE_PROFILE: YouthFemaleVoiceProfile = {
  gender: 'female',
  age_group: '10-14',
  language: 'en-US',
  pitch: 1.28,
  rate: 1.04,
  free_tts: true,
  preferred_voices: [
    'Microsoft Ana Online (Natural) - English (United States)',
    'Microsoft Ana',
    'Microsoft Maisie Online (Natural) - English (United Kingdom)',
    'Microsoft Maisie',
    'Google UK English Female',
    'Google US English',
    'Samantha',
    'Victoria',
    'Karen',
    'Microsoft Zira'
  ]
};

const MALE_VOICE_BLOCKLIST =
  /\b(david|mark|daniel|george|guy|ryan|andrew|brian|alex|fred|tom|oliver|arthur|rishi|aaron|nick|james|john|paul|eric|christopher|steffan|roger|william|liam|connor)\b/i;

const FEMALE_YOUTH_PRIORITY = [
  /microsoft ana/i,
  /microsoft maisie/i,
  /google uk english female/i,
  /samantha/i,
  /ava|allison|zoe|emma|jenny|aria|sonia|libby/i,
  /google us english/i,
  /victoria|karen|tessa|serena|moira|kate|fiona|zira/i,
  /female|woman|girl/i
];

export function pickYouthFemaleEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const englishVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const candidates = englishVoices.length > 0 ? englishVoices : voices;

  // Prefer natural/neural/online female voices matching 10-14 yr girl tone
  for (const rx of FEMALE_YOUTH_PRIORITY) {
    const match = candidates.find(
      (v) => rx.test(v.name) && !MALE_VOICE_BLOCKLIST.test(v.name)
    );
    if (match) return match;
  }

  // Fallback to any non-male English voice
  const nonMale = candidates.find((v) => !MALE_VOICE_BLOCKLIST.test(v.name));
  return nonMale || candidates[0];
}

export function speakAsYouthFemaleEnglish(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): { voiceName: string } {
  const cleaned = text.trim();
  if (!cleaned || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onError?.();
    return { voiceName: 'System Default' };
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleaned);
    const voice = pickYouthFemaleEnglishVoice();
    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang || 'en-US';
    } else {
      utter.lang = 'en-US';
    }

    // Sweet 10-14 yr female English tone: slightly higher pitch for Microsoft Ana / standard female voices
    const isAnaOrMaisie = voice ? /\b(ana|maisie)\b/i.test(voice.name) : false;
    utter.pitch = isAnaOrMaisie ? 1.12 : NELI_YOUTH_FEMALE_VOICE_PROFILE.pitch;
    utter.rate = NELI_YOUTH_FEMALE_VOICE_PROFILE.rate;
    utter.volume = 1.0;

    options?.onStart?.();
    utter.onend = () => options?.onEnd?.();
    utter.onerror = () => options?.onError?.();
    window.speechSynthesis.speak(utter);

    return { voiceName: voice?.name || 'English Female (Pitch 1.28)' };
  } catch {
    options?.onError?.();
    return { voiceName: 'System Default' };
  }
}
