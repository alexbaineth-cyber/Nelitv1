import { Channel, VIFURUSHI_PLANS } from '../data/channels.ts';
import type { FirebaseMovieItem, NeliPlatform } from './neliAiBrain.ts';

export interface GroqHybridSuggestion {
  intent: string;
  actionType:
    | 'PLAY_CHANNEL'
    | 'OPEN_MOVIE'
    | 'OPEN_SERIES'
    | 'NEXT_CHANNEL'
    | 'PREV_CHANNEL'
    | 'VOLUME_UP'
    | 'VOLUME_DOWN'
    | 'MUTE'
    | 'UNMUTE'
    | 'PAUSE'
    | 'RESUME'
    | 'SET_QUALITY'
    | 'STEP_BRIGHTNESS'
    | 'OPEN_PREMIUM'
    | 'OPEN_DOWNLOAD'
    | 'OPEN_SEARCH'
    | 'OPEN_APP_LINK'
    | 'NONE';
  targetId?: string;
  targetName?: string;
  query?: string;
  quality?: 'auto' | '1080' | '720' | '480' | '360' | '240' | 'saver';
  direction?: 'up' | 'down';
  replySw: string;
  replyEn: string;
  speechEn: string;
  recommendedIds: string[];
}

// External Groq API is paused by default so Neli AI trains and runs 100% locally without outside APIs
const GROQ_ENABLED = process.env.NELI_ENABLE_GROQ === 'true';

export function isGroqConfigured(): boolean {
  return GROQ_ENABLED && Boolean((process.env.GROQ_API_KEY || '').trim());
}

export function getGroqModelConfig() {
  return {
    configured: isGroqConfigured(),
    paused: !GROQ_ENABLED,
    chatModel: (process.env.GROQ_MODEL || 'llama-3.3-70b-versatile').trim(),
    whisperModel: (process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo').trim()
  };
}

export async function askGroqGroundedReasoner(params: {
  query: string;
  language: 'sw' | 'en';
  appId: string;
  platform: NeliPlatform;
  capabilities: string[];
  isTvFreeMode: boolean;
  canPlayMoviesInApp: boolean;
  channels: Channel[];
  movies: FirebaseMovieItem[];
}): Promise<GroqHybridSuggestion | null> {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) return null;

  const { chatModel } = getGroqModelConfig();

  const compactChannels = params.channels.slice(0, 60).map((c) => ({
    id: c.id,
    name: c.name,
    cat: c.category.slice(0, 2).join(','),
    epg: c.currentProgram || ''
  }));

  // Pick top relevant or featured movies to fit compact prompt budget cleanly
  const qWords = params.query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  const scoredMovies = params.movies
    .filter((m) => !/\b(adult|18\+|erotic|xxx|porn)\b/i.test(`${m.title} ${m.genres.join(' ')}`))
    .map((m) => {
      const hay = `${m.title} ${m.genres.join(' ')} ${m.overview}`.toLowerCase();
      let s = m.featured ? 5 : 0;
      if (m.narrated) s += 2;
      for (const w of qWords) {
        if (hay.includes(w)) s += 10;
      }
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 28)
    .map(({ m }) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      narrated: m.narrated,
      genres: m.genres.slice(0, 3),
      year: m.year || null
    }));

  const vipSummary = params.isTvFreeMode
    ? 'Smart TV Mode is 100% FREE with NO login and NO VIP payments. Never mention VIP prices on TV.'
    : `VIP plans (Mobile Money M-Pesa/TigoPesa/Airtel/Halopesa, no mandatory login): ${VIFURUSHI_PLANS.map((p) => `${p.name}=${p.priceTsh} TZS`).join(', ')}.`;

  const webMovieRule =
    params.appId === 'nelitv-web' && !params.canPlayMoviesInApp
      ? 'Platform is Web WITHOUT movies capability: if user wants a movie, use actionType OPEN_APP_LINK and also recommend Sinema Zetu live channel.'
      : 'Platform supports playing both Live TV channels (PLAY_CHANNEL) and Firebase movies/series (OPEN_MOVIE / OPEN_SERIES).';

  const systemPrompt = [
    'You are Neli AI, the hands-free voice assistant for NeliTv (Live TV, Sports, and Firebase Movies/Series in Tanzania).',
    'STRICTLY ground every channel ID, movie ID, and fact ONLY in the provided JSON catalog below. NEVER invent channel or movie names.',
    'If the user misspelled or mispronounced a channel or movie name, pick the closest real match from the catalog and play it.',
    vipSummary,
    webMovieRule,
    'Also answer spoken replies cleanly in speechEn suitable for a friendly 10-14 year old female English voice (short, 1-2 crisp sentences).',
    'Respond ONLY with a valid JSON object matching keys:',
    '{ "intent": string, "actionType": "PLAY_CHANNEL"|"OPEN_MOVIE"|"OPEN_SERIES"|"NEXT_CHANNEL"|"PREV_CHANNEL"|"VOLUME_UP"|"VOLUME_DOWN"|"MUTE"|"UNMUTE"|"PAUSE"|"RESUME"|"SET_QUALITY"|"STEP_BRIGHTNESS"|"OPEN_PREMIUM"|"OPEN_DOWNLOAD"|"OPEN_SEARCH"|"OPEN_APP_LINK"|"NONE", "targetId": string, "targetName": string, "query": string, "quality": "auto"|"1080"|"720"|"480"|"360"|"240"|"saver", "direction": "up"|"down", "replySw": string, "replyEn": string, "speechEn": string, "recommendedIds": string[] }'
  ].join('\n');

  const userPayload = JSON.stringify({
    app_id: params.appId,
    platform: params.platform,
    detected_language: params.language,
    user_query: params.query,
    live_channels: compactChannels,
    firebase_movies: scoredMovies
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: chatModel,
        temperature: 0.15,
        max_tokens: 380,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload }
        ]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return null;

    const parsed = JSON.parse(content);
    return {
      intent: String(parsed.intent || 'GROQ_ASSIST'),
      actionType: String(parsed.actionType || 'NONE') as GroqHybridSuggestion['actionType'],
      targetId: parsed.targetId ? String(parsed.targetId) : undefined,
      targetName: parsed.targetName ? String(parsed.targetName) : undefined,
      query: parsed.query ? String(parsed.query) : '',
      quality: parsed.quality,
      direction: parsed.direction === 'down' ? 'down' : parsed.direction === 'up' ? 'up' : undefined,
      replySw: String(parsed.replySw || parsed.replyEn || 'Nipo tayari kukusaidia.'),
      replyEn: String(parsed.replyEn || parsed.replySw || 'Ready to help.'),
      speechEn: String(parsed.speechEn || parsed.replyEn || 'Ready to help.'),
      recommendedIds: Array.isArray(parsed.recommendedIds) ? parsed.recommendedIds.map(String) : []
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function transcribeAudioWithGroqWhisper(params: {
  audioBuffer: Buffer;
  mimeType?: string;
  language?: string;
}): Promise<{ text: string; model: string } | null> {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey || !params.audioBuffer.length) return null;

  const { whisperModel } = getGroqModelConfig();
  const mime = (params.mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'webm';

  const form = new FormData();
  const uint8 = new Uint8Array(params.audioBuffer);
  form.append('file', new Blob([uint8], { type: mime }), `voice.${ext}`);
  form.append('model', whisperModel);
  if (params.language && params.language !== 'auto') {
    form.append('language', params.language.slice(0, 2));
  }
  form.append('prompt', 'Neli, NeliTv, Azam Sports, Azam Two, Sinema Zetu, Wasafi TV, ZBC 2, TBC, open channel, change channel to, fungua, ongeza sauti, movie ya Kiswahili');
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: form,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const json = await resp.json();
    const text = typeof json?.text === 'string' ? json.text.trim() : '';
    return text ? { text, model: whisperModel } : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
