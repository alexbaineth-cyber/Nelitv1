import { CHANNELS_DATA, Channel, VIFURUSHI_PLANS } from '../data/channels.ts';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';
import { channelHealthGuardian } from './streamResilience.ts';

const PUBLIC_SITE_URL = (process.env.NELITV_PUBLIC_URL || 'https://nelitv.online').replace(/\/+$/, '');

export type NeliPlatform = 'android' | 'android-tv' | 'web';

export interface FirebaseMovieItem {
  id: string;
  title: string;
  originalTitle?: string;
  overview: string;
  genres: string[];
  streamUrl: string;
  posterPath: string;
  backdropPath?: string;
  narrated: boolean;
  narrationLanguage?: string;
  originalLanguage?: string;
  year?: number | null;
  rating?: number | null;
  runtime?: number | null;
  featured: boolean;
  published: boolean;
  type: 'movie' | 'series' | 'episode';
  seriesId?: string;
}

export interface NeliAiContextInput {
  current_screen?: string;
  current_channel_id?: string;
  is_vip?: boolean;
  phone?: string;
}

export interface NeliAiCommandRequest {
  transcript: string;
  appId?: string;
  platform?: NeliPlatform;
  capabilities?: string[];
  deviceId?: string;
  inputMode?: 'voice' | 'text';
  currentChannelId?: string;
  currentQuality?: string;
  volume?: number;
  brightness?: number;
  isFullscreen?: boolean;
  isVip?: boolean;
  locale?: 'sw' | 'en' | 'auto';
  context?: NeliAiContextInput;
}

export type StandardizedActionType =
  | 'PLAY_CHANNEL'
  | 'OPEN_CHANNEL'
  | 'OPEN_MOVIE'
  | 'OPEN_SERIES'
  | 'NEXT_CHANNEL'
  | 'PREV_CHANNEL'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'SET_VOLUME'
  | 'STEP_VOLUME'
  | 'MUTE'
  | 'UNMUTE'
  | 'PAUSE'
  | 'RESUME'
  | 'PLAY'
  | 'SET_BRIGHTNESS'
  | 'STEP_BRIGHTNESS'
  | 'SET_QUALITY'
  | 'STEP_QUALITY'
  | 'SET_LANGUAGE'
  | 'SET_FULLSCREEN'
  | 'OPEN_SEARCH'
  | 'OPEN_PREMIUM'
  | 'OPEN_APP_LINK'
  | 'GO_HOME'
  | 'OPEN_DOWNLOAD'
  | 'NONE';

export interface NeliAiAction {
  type: StandardizedActionType;
  target_id: string;
  target_name: string;
  query: string;
  deep_link: string;
  channel?: {
    id: string;
    slug: string;
    name: string;
    thumbnailUrl: string;
    streamFormat: string;
    currentProgram?: string;
  };
  movie?: FirebaseMovieItem;
  movies?: FirebaseMovieItem[];
  value?: number;
  delta?: number;
  quality?: 'auto' | '1080' | '720' | '480' | '360' | '240' | 'saver';
  direction?: 'up' | 'down';
  language?: 'sw' | 'en';
  fullscreen?: boolean;
}

export interface NeliAiRecommendation {
  content_type: 'channel' | 'movie' | 'series';
  id: string;
  title: string;
  subtitle: string;
  poster_url?: string;
  deep_link?: string;
}

export interface NeliAiCommandResponse {
  success: boolean;
  engine: 'nelitv-brain-v1';
  zeroExternalLlm: true;
  app_id: string;
  appId: string;
  platform: NeliPlatform;
  capabilities: string[];
  transcript: string;
  normalizedQuery: string;
  reply_text: string;
  speech_text: string;
  spokenReply: string;
  language: 'sw' | 'en';
  intent: string;
  confidence: number;
  action: NeliAiAction;
  actionAlias: string;
  recommendations: NeliAiRecommendation[];
  matchedChannel?: NeliAiAction['channel'] | null;
  matchedMovies?: FirebaseMovieItem[];
  knowledgeSummary: {
    onlineChannels: number;
    firebaseMovies: number;
    firebaseSeries: number;
    firebaseEpisodes: number;
    faqCount: number;
    lastFirebaseSyncAt: string | null;
  };
}

interface FaqEntry {
  id: string;
  patterns: RegExp[];
  swReply: string;
  swSpeech: string;
  enReply: string;
  enSpeech: string;
  tvSwSpeech?: string;
  tvEnSpeech?: string;
  actionType: StandardizedActionType;
  deepLink?: string;
  targetId?: string;
  targetName?: string;
}

const NELITV_FAQ_KNOWLEDGE_BASE: FaqEntry[] = [
  {
    id: 'faq_vip_payment',
    patterns: [
      /\b(vip|premium|kifurushi|vifurushi|malipo|lipia|nalipia|nalipiaje|bei|gharama|mpesa|m pesa|tigopesa|tigo pesa|airtel money|halopesa|subscribe|subscription|jiunge)\b/i
    ],
    swReply: `Vifurushi vya NeliTv VIP ni nafuu kupitia M-Pesa, Tigo Pesa, Airtel Money au Halopesa bila kulazimika ku-login: ${VIFURUSHI_PLANS.map((p) => `${p.name} TSh ${p.priceTsh.toLocaleString()}`).join(', ')}.`,
    swSpeech: 'Vifurushi vya NeliTv VIP vinaanzia shilingi elfu moja kwa siku mbili kupitia simu yako bila kuhitaji usajili.',
    enReply: `NeliTv VIP plans work via Mobile Money (M-Pesa, Tigo Pesa, Airtel Money, Halopesa) without mandatory login: ${VIFURUSHI_PLANS.map((p) => `${p.name} TSh ${p.priceTsh.toLocaleString()}`).join(', ')}.`,
    enSpeech: 'NeliTv VIP plans start at 1,000 shillings for 2 days via Mobile Money with no login required.',
    tvSwSpeech: 'NeliTv kwenye Smart TV ni bure asilimia mia moja bila usajili wala malipo.',
    tvEnSpeech: 'NeliTv on Smart TV is 100 percent free with no login or payment needed.',
    actionType: 'OPEN_PREMIUM',
    deepLink: `${PUBLIC_SITE_URL}/account`,
    targetId: 'vip_plans',
    targetName: 'NeliTv VIP'
  },
  {
    id: 'faq_smart_tv',
    patterns: [
      /\b(smart tv|android tv|leanback|weka kwenye tv|install.*tv|tv bure|tv free|sanikisha|remote)\b/i
    ],
    swReply: 'NeliTv APK moja inafanya kazi kwenye simu na Smart TV (Android TV). Kwenye Smart TV ni bure 100% bila login wala matangazo — pakua APK kutoka nelitv.online/download au APKPure (nelitv.apk.com).',
    swSpeech: 'NeliTv Smart TV ni bure bila login. Pakua APK moja kwenye nelitv dot online au APKPure.',
    enReply: 'The unified NeliTv APK runs on both Android phones and Smart TVs. Smart TV mode is 100% free with zero login or ads — get it at nelitv.online/download or APKPure (nelitv.apk.com).',
    enSpeech: 'NeliTv Smart TV is 100 percent free with no login. Download the APK at nelitv dot online.',
    actionType: 'OPEN_DOWNLOAD',
    deepLink: `${PUBLIC_SITE_URL}/download`,
    targetId: 'nelitv-apk',
    targetName: 'NeliTv Smart TV & Android APK'
  },
  {
    id: 'faq_troubleshooting',
    patterns: [
      /\b(inaganda|kukwama|haichezi|buffering|freezing|lag|error|502|not playing|shida ya mtandao|tatizo)\b/i
    ],
    swReply: 'Player ya NeliTv inatumia YouTube-style background ABR na proxy mbadala. Ukiona mtandao uko chini, niambie "punguza ubora" au "weka data saver" ili video icheze bila kukwama.',
    swSpeech: 'Jaribu kusema punguza ubora au weka data saver ili chaneli iendelee kucheza bila kukwama.',
    enReply: 'NeliTv uses YouTube-style silent background ABR plus proxy failover. If your network is slow, say "set data saver" or "lower quality" for smooth playback.',
    enSpeech: 'Try saying set data saver or lower quality for smooth playback.',
    actionType: 'NONE',
    deepLink: PUBLIC_SITE_URL,
    targetId: 'troubleshoot',
    targetName: 'Playback Help'
  },
  {
    id: 'faq_offline_download',
    patterns: [
      /\b(download movie|offline|pakua movie|pakua filamu|hifadhi movie|tazama bila bando|watch offline)\b/i
    ],
    swReply: 'Unaweza kupakua filamu na tamthilia kwa ajili ya kutazama offline moja kwa moja ndani ya NeliTv Android App (nelitv.online/download).',
    swSpeech: 'Upakuaji wa filamu za offline unapatikana ndani ya NeliTv Android App.',
    enReply: 'Offline movie downloads are available inside the NeliTv Android App (download at nelitv.online/download).',
    enSpeech: 'Offline movie downloads are supported inside the NeliTv Android App.',
    actionType: 'OPEN_DOWNLOAD',
    deepLink: `${PUBLIC_SITE_URL}/download`,
    targetId: 'offline-downloads',
    targetName: 'NeliTv Android App'
  }
];

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'neliplay';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

function unwrapFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return Array.isArray(val.arrayValue?.values)
      ? val.arrayValue.values.map(unwrapFirestoreValue)
      : [];
  }
  if ('mapValue' in val) {
    const fields = val.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = unwrapFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

function parseFirestoreDoc(doc: any, type: 'movie' | 'series' | 'episode'): FirebaseMovieItem | null {
  const f = doc?.fields;
  if (!f) return null;
  const get = (key: string) => unwrapFirestoreValue(f[key]);
  const title = String(get('title') || get('name') || get('originalTitle') || '').trim();
  const streamUrl = String(get('streamUrl') || get('videoUrl') || '').trim();
  const published = get('published') !== false;
  if (!title || !published) return null;
  if (type === 'movie' && !streamUrl) return null;

  const docIdFromName = typeof doc?.name === 'string' ? doc.name.split('/').pop() : '';
  return {
    id: String(get('id') || docIdFromName || title.toLowerCase().replace(/\s+/g, '-')),
    title,
    originalTitle: get('originalTitle') ? String(get('originalTitle')) : undefined,
    overview: String(get('overview') || get('description') || ''),
    genres: Array.isArray(get('genres')) ? get('genres').map(String) : get('genre') ? [String(get('genre'))] : [],
    streamUrl,
    posterPath: String(get('posterPath') || get('posterUrl') || get('backdropPath') || ''),
    backdropPath: get('backdropPath') ? String(get('backdropPath')) : undefined,
    narrated: Boolean(get('narrated')),
    narrationLanguage: get('narrationLanguage') ? String(get('narrationLanguage')) : undefined,
    originalLanguage: get('originalLanguage') ? String(get('originalLanguage')) : undefined,
    year: typeof get('year') === 'number' ? get('year') : null,
    rating: typeof get('rating') === 'number' ? get('rating') : null,
    runtime: typeof get('runtime') === 'number' ? get('runtime') : null,
    featured: Boolean(get('featured')),
    published,
    type,
    seriesId: get('seriesId') ? String(get('seriesId')) : undefined
  };
}

class NeliAiKnowledgeBase {
  private movies: FirebaseMovieItem[] = [];
  private series: FirebaseMovieItem[] = [];
  private episodes: FirebaseMovieItem[] = [];
  private lastSyncMs = 0;
  private lastSyncAtIso: string | null = null;
  private syncingPromise: Promise<void> | null = null;
  // Scheduled catalog refresh every 15 minutes (never per user prompt)
  private readonly syncTtlMs = 15 * 60 * 1000;

  start() {
    setTimeout(() => {
      void this.syncFirebaseCatalog(true);
    }, 1200);
    setInterval(() => {
      void this.syncFirebaseCatalog(true);
    }, this.syncTtlMs);
  }

  private async fetchFirestoreCollection(collectionName: string, maxPages = 6): Promise<any[]> {
    const docs: any[] = [];
    let pageToken = '';
    for (let page = 0; page < maxPages; page++) {
      const url = `${FIRESTORE_BASE}/${encodeURIComponent(collectionName)}?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) break;
        const json = await resp.json();
        if (Array.isArray(json.documents)) {
          docs.push(...json.documents);
        }
        if (!json.nextPageToken) break;
        pageToken = json.nextPageToken;
      } catch {
        clearTimeout(timeout);
        break;
      }
    }
    return docs;
  }

  async syncFirebaseCatalog(force = false): Promise<void> {
    if (!force && Date.now() - this.lastSyncMs < this.syncTtlMs && this.movies.length > 0) {
      return;
    }
    if (this.syncingPromise) return this.syncingPromise;

    this.syncingPromise = (async () => {
      try {
        const [movieDocs, seriesDocs, episodeDocs] = await Promise.all([
          this.fetchFirestoreCollection('movies', 6),
          this.fetchFirestoreCollection('series', 3),
          this.fetchFirestoreCollection('episodes', 3)
        ]);
        const parsedMovies = movieDocs
          .map((d) => parseFirestoreDoc(d, 'movie'))
          .filter((m): m is FirebaseMovieItem => Boolean(m));
        const parsedSeries = seriesDocs
          .map((d) => parseFirestoreDoc(d, 'series'))
          .filter((s): s is FirebaseMovieItem => Boolean(s));
        const parsedEpisodes = episodeDocs
          .map((d) => parseFirestoreDoc(d, 'episode'))
          .filter((e): e is FirebaseMovieItem => Boolean(e));

        if (parsedMovies.length > 0) this.movies = parsedMovies;
        if (parsedSeries.length > 0) this.series = parsedSeries;
        if (parsedEpisodes.length > 0) this.episodes = parsedEpisodes;
        this.lastSyncMs = Date.now();
        this.lastSyncAtIso = new Date().toISOString();
      } catch {
        // Keep last healthy cache on transient errors
      } finally {
        this.syncingPromise = null;
      }
    })();

    return this.syncingPromise;
  }

  getMovies(): FirebaseMovieItem[] {
    return this.movies;
  }

  getSeries(): FirebaseMovieItem[] {
    return this.series;
  }

  getEpisodes(): FirebaseMovieItem[] {
    return this.episodes;
  }

  getStats() {
    const snap = channelHealthGuardian.getSnapshot();
    return {
      onlineChannels: snap.onlineCount,
      firebaseMovies: this.movies.length,
      firebaseSeries: this.series.length,
      firebaseEpisodes: this.episodes.length,
      faqCount: NELITV_FAQ_KNOWLEDGE_BASE.length,
      lastFirebaseSyncAt: this.lastSyncAtIso
    };
  }
}

export const neliAiKnowledge = new NeliAiKnowledgeBase();

function normalizeSpeechText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWakeWord(text: string): string {
  return text
    .replace(/^(?:hey|ok|hello|habari|samahani|please|tafadhali|yo|eh|oy|basi)\s+/i, '')
    .replace(/^(?:neli|nelly|nelitv|neli tv|nely|nel)\b[\s,:-]*/i, '')
    .replace(/^(?:please|tafadhali|hebu|naomba)\s+/i, '')
    .trim();
}

function detectLanguage(raw: string, localeHint?: 'sw' | 'en' | 'auto'): 'sw' | 'en' {
  if (localeHint === 'sw' || localeHint === 'en') return localeHint;
  const swHints = /\b(fungua|weka|niwekee|ongeza|pandisha|punguza|zima|washa|badili|badilisha|hamia|kituo|sauti|mwanga|ubora|bando|okoa|nyumbani|rudi|tafuta|nipendekezee|filamu|tamthilia|kipindi|mechi|mpira|hewani|simamisha|endelea|skrini|lugha|kiswahili|inayofuata|nyuma|bure|pakua|habari|mambo|nani|gani|ipi|kifurushi|nalipia|nalipiaje|mapigano|ucheshi)\b/i;
  const enHints = /\b(open|play|watch|change|switch|next|previous|increase|decrease|turn up|turn down|raise|lower|mute|unmute|volume|brightness|quality|fullscreen|pause|resume|home|search|recommend|movie|movies|film|channel|live|match|download|english|language|premium|subscribe)\b/i;
  const swScore = (raw.match(new RegExp(swHints.source, 'gi')) || []).length;
  const enScore = (raw.match(new RegExp(enHints.source, 'gi')) || []).length;
  if (swScore > enScore) return 'sw';
  if (enScore > swScore) return 'en';
  return 'sw';
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

const PHONETIC_CHANNEL_SYNONYMS: Array<[RegExp, string]> = [
  [/\b(?:azam|hasan|adam|asan|azm)\s*(?:two|2|mbili|tu)\b/i, 'azam two'],
  [/\b(?:azam|hasan|adam|asan)\s*(?:one|1|moja)\b/i, 'azam one'],
  [/\b(?:azam|hasan)\s*(?:sports?|spot|spoti)?\s*(?:1|one|moja)\b/i, 'azam sports 1'],
  [/\b(?:azam|hasan)\s*(?:sports?|spot|spoti)?\s*(?:2|two|mbili)\b/i, 'azam sports 2'],
  [/\b(?:azam|hasan)\s*(?:sports?|spot|spoti)?\s*(?:3|three|tatu)\b/i, 'azam sports 3'],
  [/\b(?:azam|hasan)\s*(?:sports?|spot|spoti)?\s*(?:4|four|nne)\b/i, 'azam sports 4'],
  [/\b(?:sinema\s*zetu|cinema\s*zetu)\b/i, 'sinema zetu'],
  [/\b(?:zbc\s*2|zbc\s*two|zbc\s*mbili)\b/i, 'zbc 2'],
  [/\b(?:wasafi|wasafi\s*tv)\b/i, 'wasafi tv'],
  [/\b(?:itv)\b/i, 'itv'],
  [/\b(?:eatv|east\s*africa\s*tv)\b/i, 'eatv'],
  [/\b(?:mpira|football|soka|ligi\s*kuu|simba|yanga|nbc\s*premier)\b/i, 'azam sports 1'],
  [/\b(?:katuni|cartoon|watoto|kids)\b/i, 'cartoon network']
];

function normalizeChannelCandidate(query: string): string {
  let out = query
    .replace(/\b(open|fungua|weka|niwekee|cheza|play|watch|tazama|change|switch|put|turn|go|badili|badilisha|hamia|nenda|to|into|on|the|a|kwenda|kwenye|hadi|channel|chaneli|kituo|sasa|hivi|pliz|please)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of PHONETIC_CHANNEL_SYNONYMS) {
    if (pattern.test(out)) {
      out = replacement;
      break;
    }
  }
  return out.trim();
}

function getOnlineChannelPool(): Channel[] {
  const online = CHANNELS_DATA.filter((ch) => channelHealthGuardian.isChannelOnline(ch.id));
  return online.length > 0 ? online : CHANNELS_DATA;
}

function matchBestChannel(rawQuery: string): { channel: Channel; score: number } | null {
  const candidate = normalizeChannelCandidate(rawQuery);
  if (!candidate) return null;

  const pool = getOnlineChannelPool();
  const tokens = candidate.split(/\s+/).filter(Boolean);

  let best: { channel: Channel; score: number } | null = null;

  for (const ch of pool) {
    const nameNorm = normalizeSpeechText(ch.name);
    const slugNorm = getChannelRouteSlug(ch).replace(/-/g, ' ');
    const kwNorm = (ch.searchKeywords || []).map(normalizeSpeechText);

    let score = 0;

    if (nameNorm === candidate || slugNorm === candidate) {
      score = 100;
    } else if (nameNorm.includes(candidate) || slugNorm.includes(candidate)) {
      score = 86 - Math.min(18, Math.abs(nameNorm.length - candidate.length));
    } else if (candidate.includes(nameNorm) && nameNorm.length >= 3) {
      score = 80;
    } else {
      let tokenHits = 0;
      for (const tok of tokens) {
        if (tok.length < 2 && !/^\d+$/.test(tok)) continue;
        if (nameNorm.includes(tok) || slugNorm.includes(tok)) {
          tokenHits += 1;
        } else if (kwNorm.some((k) => k.includes(tok))) {
          tokenHits += 0.65;
        }
      }
      if (tokens.length > 0 && tokenHits > 0) {
        score = Math.round((tokenHits / tokens.length) * 76);
      }

      const dist = levenshtein(candidate, nameNorm.slice(0, candidate.length + 4));
      if (dist <= 2 && candidate.length >= 4) {
        score = Math.max(score, 74 - dist * 8);
      }
    }

    if (score >= 45 && (!best || score > best.score)) {
      best = { channel: ch, score };
    }
  }

  return best;
}

const GENRE_SYNONYMS: Record<string, string[]> = {
  mapigano: ['action', 'war', 'martial', 'fight'],
  ngumi: ['action', 'fighting'],
  vita: ['war', 'action'],
  ucheshi: ['comedy'],
  vichekesho: ['comedy'],
  mapenzi: ['romance', 'drama'],
  kutisha: ['horror', 'thriller'],
  uhalifu: ['crime', 'thriller'],
  watoto: ['animation', 'family', 'kids'],
  sayansi: ['sci-fi', 'science fiction'],
  adventure: ['adventure']
};

function matchFirebaseMovies(rawQuery: string): FirebaseMovieItem[] {
  const movies = [...neliAiKnowledge.getMovies(), ...neliAiKnowledge.getSeries()];
  if (movies.length === 0) return [];

  const wantsNarrated = /\b(kiswahili|swahili|narrated|tafsiri|dj|zilizotafsiriwa|iliyotafsiriwa|imetafsiriwa)\b/i.test(rawQuery);
  const q = rawQuery
    .replace(/\b(open|fungua|play|cheza|watch|tazama|niwekee|weka|tafuta|search|recommend|nipendekezee|nionyeshe|show|movie|movies|filamu|film|series|tamthilia|sinema|ya|za|zenye|ambazo|new|mpya|kiswahili|swahili|narrated|tafsiri|dj|zilizotafsiriwa|iliyotafsiriwa|imetafsiriwa)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wantsExplicit = /\b(adult|18\+|xxx|porn|erotic|wakubwa)\b/i.test(rawQuery);
  const rawTokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const expandedTokens = rawTokens.flatMap((t) => [t, ...(GENRE_SYNONYMS[t] || [])]);

  const scored = movies
    .filter((m) => {
      if (wantsExplicit) return true;
      const checkText = `${m.title} ${m.genres.join(' ')}`.toLowerCase();
      return !/\b(adult|18\+|erotic|xxx|porn|titty|fucking|juicy|hentai|nsfw)\b/i.test(checkText);
    })
    .map((m) => {
      let score = 0;
      const titleNorm = normalizeSpeechText(m.title);
      const origNorm = normalizeSpeechText(m.originalTitle || '');
      const genreText = normalizeSpeechText(m.genres.join(' '));
      const overviewNorm = normalizeSpeechText(m.overview);

      if (q && (titleNorm === q || origNorm === q)) {
        score += 100;
      } else if (q && (titleNorm.includes(q) || origNorm.includes(q))) {
        score += 75;
      } else if (expandedTokens.length > 0) {
        for (const tok of expandedTokens) {
          if (titleNorm.includes(tok) || origNorm.includes(tok)) score += 32;
          else if (genreText.includes(tok)) score += 26;
          else if (overviewNorm.includes(tok)) score += 12;
        }
      } else {
        score += (m.featured ? 25 : 10) + (m.rating || 0) * 2;
      }

      if (wantsNarrated) {
        if (m.narrated || (m.narrationLanguage || '').toLowerCase().includes('sw')) {
          score += 35;
        } else {
          score -= 10;
        }
      }

      return { movie: m, score };
    });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((s) => s.movie);
}

function extractNumericTarget(text: string): number | null {
  const m = text.match(/\b(\d{1,3})\s*%?\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function serializeChannelBrief(ch: Channel): NeliAiAction['channel'] {
  return {
    id: ch.id,
    slug: getChannelRouteSlug(ch),
    name: ch.name,
    thumbnailUrl: ch.thumbnailUrl,
    streamFormat: ch.streamFormat,
    currentProgram: ch.currentProgram
  };
}

function resolveDefaultPlatform(appId: string, platform?: string): NeliPlatform {
  if (platform === 'android' || platform === 'android-tv' || platform === 'web') return platform;
  if (appId.includes('tv')) return 'android-tv';
  if (appId.includes('android') || appId.includes('apk')) return 'android';
  return 'web';
}

function resolveCapabilities(appId: string, platform: NeliPlatform, caps?: string[]): string[] {
  if (Array.isArray(caps) && caps.length > 0) {
    return caps.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
  }
  if (platform === 'android-tv' || appId === 'nelitv-tv') {
    return ['live_tv', 'movies', 'series', 'player_controls', 'tv_free_mode'];
  }
  if (platform === 'android' || appId === 'nelitv-android') {
    return ['live_tv', 'movies', 'series', 'player_controls', 'vip_support'];
  }
  return ['live_tv', 'movies', 'series', 'player_controls', 'vip_support'];
}

function channelToRecommendation(ch: Channel): NeliAiRecommendation {
  const slug = getChannelRouteSlug(ch);
  return {
    content_type: 'channel',
    id: ch.id,
    title: ch.name,
    subtitle: ch.currentProgram || ch.description || 'Live TV',
    poster_url: ch.thumbnailUrl,
    deep_link: `${PUBLIC_SITE_URL}/watch/channel/${slug}`
  };
}

function movieToRecommendation(m: FirebaseMovieItem): NeliAiRecommendation {
  return {
    content_type: m.type === 'series' ? 'series' : 'movie',
    id: m.id,
    title: m.title,
    subtitle: [m.narrated ? 'Kiswahili' : null, ...m.genres.slice(0, 2)].filter(Boolean).join(' · ') || 'Movie',
    poster_url: m.posterPath,
    deep_link: `${PUBLIC_SITE_URL}/watch/movie/${encodeURIComponent(m.id)}`
  };
}

export async function processNeliVoiceCommand(req: NeliAiCommandRequest): Promise<NeliAiCommandResponse> {
  await neliAiKnowledge.syncFirebaseCatalog(false);

  const rawTranscript = String(req.transcript || '').trim();
  const appId = String(req.appId || 'nelitv-web').trim() || 'nelitv-web';
  const platform = resolveDefaultPlatform(appId, req.platform);
  const capabilities = resolveCapabilities(appId, platform, req.capabilities);
  const isTvFreeMode = platform === 'android-tv' || appId === 'nelitv-tv' || capabilities.includes('tv_free_mode');
  const canPlayMoviesInApp = capabilities.includes('movies') || capabilities.includes('series');
  const currentChannelId = req.currentChannelId || req.context?.current_channel_id;

  const norm = normalizeSpeechText(rawTranscript);
  const query = stripWakeWord(norm);
  const lang = detectLanguage(query || norm, req.locale);
  const knowledgeSummary = neliAiKnowledge.getStats();

  const toActionAlias = (t: StandardizedActionType): string => {
    switch (t) {
      case 'OPEN_CHANNEL':
        return 'PLAY_CHANNEL';
      case 'SET_VOLUME':
      case 'STEP_VOLUME':
      case 'VOLUME_UP':
      case 'VOLUME_DOWN':
        return 'VOLUME';
      case 'SET_BRIGHTNESS':
      case 'STEP_BRIGHTNESS':
        return 'BRIGHTNESS';
      case 'SET_QUALITY':
      case 'STEP_QUALITY':
        return 'QUALITY';
      case 'SET_FULLSCREEN':
        return 'FULLSCREEN';
      case 'PLAY':
        return 'RESUME';
      default:
        return t;
    }
  };

  const buildReply = (
    intent: string,
    confidence: number,
    replyText: string,
    partialAction: Partial<NeliAiAction> & { type: StandardizedActionType },
    options?: {
      speechText?: string;
      matchedChannel?: NeliAiAction['channel'] | null;
      matchedMovies?: FirebaseMovieItem[];
      recommendations?: NeliAiRecommendation[];
    }
  ): NeliAiCommandResponse => {
    const speech = options?.speechText || replyText;
    const action: NeliAiAction = {
      target_id: '',
      target_name: '',
      query: '',
      deep_link: PUBLIC_SITE_URL,
      ...partialAction
    };
    return {
      success: true,
      engine: 'nelitv-brain-v1',
      zeroExternalLlm: true,
      app_id: appId,
      appId,
      platform,
      capabilities,
      transcript: rawTranscript,
      normalizedQuery: query,
      reply_text: replyText,
      speech_text: speech,
      spokenReply: speech,
      language: lang,
      intent,
      confidence,
      action,
      actionAlias: toActionAlias(action.type),
      recommendations: options?.recommendations || [],
      matchedChannel: options?.matchedChannel ?? null,
      matchedMovies: options?.matchedMovies,
      knowledgeSummary
    };
  };

  if (!query) {
    const msg = lang === 'sw'
      ? (isTvFreeMode
        ? 'Nipo tayari. Niambie kituo au movie unayotaka.'
        : 'Nipo tayari. Niambie unataka kufungua kituo gani, movie, au kuongeza sauti.')
      : (isTvFreeMode
        ? 'Ready. Tell me what channel or movie to play.'
        : 'I am listening. Tell me which channel or movie to open, or adjust volume, brightness, or quality.');
    return buildReply('WAKE_GREETING', 0.95, msg, { type: 'NONE' });
  }

  // 1. MUTE / UNMUTE
  if (/\b(mute|zima sauti|nyamazisha|silence)\b/i.test(query) && !/\b(unmute|fungua sauti|washa sauti)\b/i.test(query)) {
    return buildReply(
      'MUTE',
      0.98,
      lang === 'sw' ? 'Sawa, nimezima sauti.' : 'Audio muted.',
      { type: 'MUTE', target_name: 'Audio Mute' }
    );
  }
  if (/\b(unmute|fungua sauti|washa sauti|rudisha sauti)\b/i.test(query)) {
    return buildReply(
      'UNMUTE',
      0.98,
      lang === 'sw' ? 'Sawa, nimewasha sauti.' : 'Audio unmuted.',
      { type: 'UNMUTE', target_name: 'Audio Unmute' }
    );
  }

  // 2. VOLUME CONTROLS
  if (/\b(volume|sauti|sound)\b/i.test(query)) {
    const exactNum = extractNumericTarget(query);
    if (exactNum !== null && /\b(set|weka|to|hadi|kwenye)\b/i.test(query)) {
      const clamped = Math.max(0, Math.min(100, exactNum));
      return buildReply(
        'SET_VOLUME',
        0.96,
        lang === 'sw' ? `Sauti imewekwa asilimia ${clamped}.` : `Volume set to ${clamped} percent.`,
        { type: 'SET_VOLUME', value: Number((clamped / 100).toFixed(2)), target_name: `Volume ${clamped}%` }
      );
    }
    if (/\b(down|lower|decrease|reduce|punguza|shusha|chini|less|quiet)\b/i.test(query)) {
      return buildReply(
        'VOLUME_DOWN',
        0.96,
        lang === 'sw' ? 'Nimepunguza sauti.' : 'Turning volume down.',
        { type: 'VOLUME_DOWN', direction: 'down', delta: -0.2, target_name: 'Volume Down' }
      );
    }
    return buildReply(
      'VOLUME_UP',
      0.96,
      lang === 'sw' ? 'Nimeongeza sauti.' : 'Turning volume up.',
      { type: 'VOLUME_UP', direction: 'up', delta: 0.2, target_name: 'Volume Up' }
    );
  }

  // 3. BRIGHTNESS CONTROLS
  if (/\b(brightness|bright|brighter|dim|mwanga|mwangaza)\b/i.test(query)) {
    const exactNum = extractNumericTarget(query);
    if (exactNum !== null && /\b(set|weka|to|hadi|kwenye)\b/i.test(query)) {
      const clamped = Math.max(40, Math.min(150, exactNum));
      return buildReply(
        'SET_BRIGHTNESS',
        0.96,
        lang === 'sw' ? `Mwanga umewekwa asilimia ${clamped}.` : `Brightness set to ${clamped} percent.`,
        { type: 'SET_BRIGHTNESS', value: Number((clamped / 100).toFixed(2)), target_name: `Brightness ${clamped}%` }
      );
    }
    if (/\b(down|lower|decrease|reduce|dim|punguza|shusha|giza)\b/i.test(query)) {
      return buildReply(
        'STEP_BRIGHTNESS_DOWN',
        0.96,
        lang === 'sw' ? 'Nimepunguza mwanga wa skrini.' : 'Lowering screen brightness.',
        { type: 'STEP_BRIGHTNESS', direction: 'down', delta: -0.15, target_name: 'Brightness Down' }
      );
    }
    return buildReply(
      'STEP_BRIGHTNESS_UP',
      0.96,
      lang === 'sw' ? 'Nimeongeza mwanga wa skrini.' : 'Increasing screen brightness.',
      { type: 'STEP_BRIGHTNESS', direction: 'up', delta: 0.15, target_name: 'Brightness Up' }
    );
  }

  // 4. QUALITY CONTROLS
  if (/\b(quality|resolution|ubora|hd|full hd|1080|720|480|360|240|data saver|okoa bando|saver)\b/i.test(query)) {
    if (/\b(1080|full hd)\b/i.test(query)) {
      return buildReply('SET_QUALITY_1080', 0.97, lang === 'sw' ? 'Nimeweka ubora wa 1080p Full HD.' : 'Quality set to 1080p Full HD.', { type: 'SET_QUALITY', quality: '1080', target_name: '1080p' });
    }
    if (/\b(720|hd)\b/i.test(query) && !/\b(increase|higher|up|ongeza|pandisha)\b/i.test(query)) {
      return buildReply('SET_QUALITY_720', 0.96, lang === 'sw' ? 'Nimeweka ubora wa 720p HD.' : 'Quality set to 720p HD.', { type: 'SET_QUALITY', quality: '720', target_name: '720p' });
    }
    if (/\b480\b/.test(query)) {
      return buildReply('SET_QUALITY_480', 0.96, lang === 'sw' ? 'Nimeweka ubora wa 480p.' : 'Quality set to 480p.', { type: 'SET_QUALITY', quality: '480', target_name: '480p' });
    }
    if (/\b360\b/.test(query)) {
      return buildReply('SET_QUALITY_360', 0.96, lang === 'sw' ? 'Nimeweka ubora wa 360p.' : 'Quality set to 360p.', { type: 'SET_QUALITY', quality: '360', target_name: '360p' });
    }
    if (/\b240\b/.test(query)) {
      return buildReply('SET_QUALITY_240', 0.96, lang === 'sw' ? 'Nimeweka ubora wa 240p.' : 'Quality set to 240p.', { type: 'SET_QUALITY', quality: '240', target_name: '240p' });
    }
    if (/\b(data saver|okoa bando|saver)\b/i.test(query)) {
      return buildReply('SET_QUALITY_SAVER', 0.96, lang === 'sw' ? 'Hali ya kuokoa bando imewashwa.' : 'Data saver quality enabled.', { type: 'SET_QUALITY', quality: 'saver', target_name: 'Data Saver' });
    }
    if (/\bauto\b/i.test(query)) {
      return buildReply('SET_QUALITY_AUTO', 0.96, lang === 'sw' ? 'Ubora umewekwa Auto kulingana na mtandao.' : 'Quality set to Auto.', { type: 'SET_QUALITY', quality: 'auto', target_name: 'Auto' });
    }
    if (/\b(down|lower|decrease|reduce|punguza|shusha)\b/i.test(query)) {
      return buildReply('STEP_QUALITY_DOWN', 0.94, lang === 'sw' ? 'Nimepunguza ubora wa video.' : 'Lowering video quality.', { type: 'STEP_QUALITY', direction: 'down', target_name: 'Quality Down' });
    }
    return buildReply('STEP_QUALITY_UP', 0.94, lang === 'sw' ? 'Nimepandisha ubora wa video.' : 'Increasing video quality.', { type: 'STEP_QUALITY', direction: 'up', target_name: 'Quality Up' });
  }

  // 5. FULLSCREEN / PAUSE / RESUME / LANGUAGE / HOME / DOWNLOAD
  if (/\b(exit fullscreen|leave fullscreen|minimize|punguza skrini|toa fullscreen)\b/i.test(query)) {
    return buildReply('EXIT_FULLSCREEN', 0.95, lang === 'sw' ? 'Nimepunguza skrini.' : 'Exiting fullscreen.', { type: 'SET_FULLSCREEN', fullscreen: false });
  }
  if (/\b(fullscreen|full screen|skrini nzima|panua skrini)\b/i.test(query)) {
    return buildReply('ENTER_FULLSCREEN', 0.95, lang === 'sw' ? 'Nimeweka skrini nzima.' : 'Entering fullscreen.', { type: 'SET_FULLSCREEN', fullscreen: true });
  }
  if (/\b(pause|simamisha|simama)\b/i.test(query)) {
    return buildReply('PAUSE', 0.95, lang === 'sw' ? 'Video imesimamishwa.' : 'Playback paused.', { type: 'PAUSE' });
  }
  if (/^(play|resume|endelea|anza)$/i.test(query)) {
    return buildReply('RESUME', 0.93, lang === 'sw' ? 'Inaendelea kucheza.' : 'Resuming playback.', { type: 'RESUME' });
  }
  if (/\b(switch language|change language|badili lugha|lugha)\b/i.test(query)) {
    const targetLang: 'sw' | 'en' = /\b(english|kiingereza)\b/i.test(query) ? 'en' : 'sw';
    return buildReply('SET_LANGUAGE', 0.93, targetLang === 'sw' ? 'Lugha imewekwa Kiswahili.' : 'Audio language switched to English.', { type: 'SET_LANGUAGE', language: targetLang });
  }
  if (/\b(go home|home page|nyumbani|rudi mwanzo|rudi nyumbani)\b/i.test(query)) {
    return buildReply('GO_HOME', 0.94, lang === 'sw' ? 'Narudi ukurasa wa nyumbani.' : 'Going to home screen.', { type: 'GO_HOME', deep_link: PUBLIC_SITE_URL });
  }
  if (/\b(download|apk|apkpure|pakua)\b/i.test(query) && !/\b(movie|movies|filamu|film)\b/i.test(query)) {
    return buildReply(
      'OPEN_DOWNLOAD',
      0.92,
      lang === 'sw'
        ? 'Unaweza kupakua NeliTv APK bure kwenye ukurasa wa download au kupitia nelitv.apk.com kwenye APKPure.'
        : 'Opening the official NeliTv APK download page, also available on APKPure at nelitv.apk.com.',
      { type: 'OPEN_DOWNLOAD', target_id: 'nelitv-apk', target_name: 'NeliTv APK', deep_link: `${PUBLIC_SITE_URL}/download` }
    );
  }

  // 6. CONNECTOR 3 — VIP SUPPORT & FAQ HELP (Strictly TV Free-Mode aware!)
  for (const faq of NELITV_FAQ_KNOWLEDGE_BASE) {
    if (faq.patterns.some((p) => p.test(query))) {
      if (faq.id === 'faq_vip_payment' && isTvFreeMode) {
        return buildReply(
          'TV_FREE_MODE_INFO',
          0.95,
          lang === 'sw' ? (faq.tvSwSpeech || faq.swSpeech) : (faq.tvEnSpeech || faq.enSpeech),
          { type: 'NONE', target_name: 'Smart TV Free Mode', deep_link: PUBLIC_SITE_URL }
        );
      }
      return buildReply(
        'FAQ_SUPPORT',
        0.92,
        lang === 'sw' ? faq.swReply : faq.enReply,
        {
          type: faq.actionType,
          target_id: faq.targetId || faq.id,
          target_name: faq.targetName || 'NeliTv Support',
          deep_link: faq.deepLink || PUBLIC_SITE_URL
        },
        { speechText: lang === 'sw' ? faq.swSpeech : faq.enSpeech }
      );
    }
  }

  // 7. NEXT / PREVIOUS / CHANGE CHANNEL (generic)
  if (/\b(previous channel|prev channel|last channel|kituo kilichopita|rudi channel)\b/i.test(query)) {
    const pool = getOnlineChannelPool();
    const curIdx = pool.findIndex((c) => c.id === currentChannelId);
    const prevIdx = curIdx > 0 ? curIdx - 1 : pool.length - 1;
    const target = pool[prevIdx];
    const brief = serializeChannelBrief(target);
    const slug = getChannelRouteSlug(target);
    return buildReply(
      'PREV_CHANNEL',
      0.95,
      lang === 'sw' ? `Narudi kwenye ${target.name}.` : `Switching back to ${target.name}.`,
      {
        type: 'PREV_CHANNEL',
        target_id: target.id,
        target_name: target.name,
        deep_link: `${PUBLIC_SITE_URL}/watch/channel/${slug}`,
        channel: brief
      },
      { matchedChannel: brief, recommendations: pool.slice(0, 3).map(channelToRecommendation) }
    );
  }
  if (/^(?:please\s+)?(?:next|next\s+(?:the\s+)?channel|change\s+(?:the\s+)?channel|switch\s+(?:the\s+)?channel|other\s+channel|badili\s+kituo|kituo\s+kingine|badili\s+channel|channel\s+inayofuata)$/i.test(query)) {
    const pool = getOnlineChannelPool();
    const curIdx = pool.findIndex((c) => c.id === currentChannelId);
    const nextIdx = curIdx >= 0 ? (curIdx + 1) % pool.length : 0;
    const target = pool[nextIdx];
    const brief = serializeChannelBrief(target);
    const slug = getChannelRouteSlug(target);
    return buildReply(
      'NEXT_CHANNEL',
      0.95,
      lang === 'sw' ? `Nafungua ${target.name}.` : `Switching to ${target.name}.`,
      {
        type: 'NEXT_CHANNEL',
        target_id: target.id,
        target_name: target.name,
        deep_link: `${PUBLIC_SITE_URL}/watch/channel/${slug}`,
        channel: brief
      },
      { matchedChannel: brief, recommendations: pool.slice(0, 3).map(channelToRecommendation) }
    );
  }

  // 8. FIREBASE MOVIES / SERIES VOICE SEARCH & CAPABILITY-AWARE PLAYBACK
  const explicitMovieRequest = /\b(movie|movies|filamu|film|series|tamthilia)\b/i.test(query);
  if (explicitMovieRequest) {
    const matchedMovies = matchFirebaseMovies(query);
    const sinemaZetu = getOnlineChannelPool().find((c) => c.id.includes('sinema') || c.name.toLowerCase().includes('sinema'));

    // Capability Check (Section 4): If caller explicitly declares Web WITHOUT movies/series capability
    if (appId === 'nelitv-web' && !canPlayMoviesInApp) {
      const topMovie = matchedMovies[0];
      const liveRecs = sinemaZetu ? [channelToRecommendation(sinemaZetu)] : [];
      const movieRecs = matchedMovies.slice(0, 3).map(movieToRecommendation);
      const replyText = topMovie
        ? (lang === 'sw'
          ? `Filamu za Firebase kama "${topMovie.title}" zinapatikana kwenye NeliTv Android App. Kwenye wavuti unaweza kutazama ${sinemaZetu?.name || 'Sinema Zetu'} sasa au kufungua app.`
          : `Movies like "${topMovie.title}" are hosted in the NeliTv Android App. On web you can watch ${sinemaZetu?.name || 'Sinema Zetu'} live or open the app.`)
        : (lang === 'sw'
          ? `Maktaba ya filamu za Firebase inapatikana kwenye NeliTv Android App. Kwenye wavuti tuna chaneli ya ${sinemaZetu?.name || 'Sinema Zetu'} masaa 24.`
          : `Our Firebase movie library lives in the NeliTv Android App. On web you can watch ${sinemaZetu?.name || 'Sinema Zetu'} 24/7.`);

      return buildReply(
        'OPEN_MOVIE_IN_APP',
        0.91,
        replyText,
        {
          type: 'OPEN_APP_LINK',
          target_id: topMovie?.id || 'nelitv-android',
          target_name: topMovie?.title || 'NeliTv Android App',
          query: query,
          deep_link: topMovie
            ? `${PUBLIC_SITE_URL}/watch/movie/${encodeURIComponent(topMovie.id)}`
            : `${PUBLIC_SITE_URL}/download`,
          channel: sinemaZetu ? serializeChannelBrief(sinemaZetu) : undefined,
          movie: topMovie,
          movies: matchedMovies
        },
        {
          speechText: lang === 'sw'
            ? (topMovie ? `Filamu ya ${topMovie.title} inapatikana kwenye NeliTv App, au tazama Sinema Zetu hapa.` : 'Filamu zinapatikana kwenye NeliTv App, au tazama Sinema Zetu hapa.')
            : replyText,
          matchedChannel: sinemaZetu ? serializeChannelBrief(sinemaZetu) : null,
          matchedMovies,
          recommendations: [...liveRecs, ...movieRecs]
        }
      );
    }

    if (matchedMovies.length > 0) {
      const top = matchedMovies[0];
      const isSeries = top.type === 'series';
      const wantsPlay = /\b(open|fungua|play|cheza|watch|tazama|niwekee|weka)\b/i.test(query) || matchedMovies.length === 1;
      const actionType: StandardizedActionType = isSeries ? 'OPEN_SERIES' : 'OPEN_MOVIE';
      const recs = matchedMovies.slice(0, 4).map(movieToRecommendation);

      if (wantsPlay && top.streamUrl) {
        const reply = lang === 'sw'
          ? `Nafungua ${isSeries ? 'tamthilia' : 'filamu'} ya ${top.title}${top.year ? ` ya mwaka ${top.year}` : ''}.`
          : `Opening ${isSeries ? 'series' : 'movie'} ${top.title}.`;
        return buildReply(
          actionType,
          0.92,
          reply,
          {
            type: actionType,
            target_id: top.id,
            target_name: top.title,
            query,
            deep_link: `${PUBLIC_SITE_URL}/watch/movie/${encodeURIComponent(top.id)}`,
            movie: top,
            movies: matchedMovies
          },
          {
            speechText: isTvFreeMode ? (lang === 'sw' ? `Nafungua ${top.title}.` : `Opening ${top.title}.`) : reply,
            matchedMovies,
            recommendations: recs
          }
        );
      }

      const topTitles = matchedMovies.slice(0, 3).map((m) => m.title).join(', ');
      return buildReply(
        'RECOMMEND_MOVIES',
        0.89,
        lang === 'sw'
          ? `Nimepata filamu ${matchedMovies.length}: ${topTitles}. Sema open kisha jina la movie kuicheza.`
          : `I found ${matchedMovies.length} movies including ${topTitles}. Say open followed by the title to play.`,
        {
          type: top.streamUrl ? actionType : 'OPEN_SEARCH',
          target_id: top.id,
          target_name: top.title,
          query,
          deep_link: `${PUBLIC_SITE_URL}/watch/movie/${encodeURIComponent(top.id)}`,
          movie: top.streamUrl ? top : undefined,
          movies: matchedMovies
        },
        {
          speechText: lang === 'sw' ? `Kuna ${topTitles}. Sema open kucheza.` : `Found ${topTitles}.`,
          matchedMovies,
          recommendations: recs
        }
      );
    }

    return buildReply(
      'MOVIE_NOT_FOUND',
      0.7,
      lang === 'sw'
        ? 'Samahani, sijapata filamu yenye jina hilo kwa sasa kwenye maktaba yetu.'
        : 'Sorry, I could not find a matching movie right now.',
      { type: 'OPEN_SEARCH', query, deep_link: `${PUBLIC_SITE_URL}/search` }
    );
  }

  // 9. LIVE CHANNEL MATCH ("neli change channel to azam two", "niwekee azam sports 1", etc.)
  const channelMatch = matchBestChannel(query);
  if (channelMatch) {
    const ch = channelMatch.channel;
    const brief = serializeChannelBrief(ch);
    const slug = getChannelRouteSlug(ch);
    const prog = ch.currentProgram ? ` — ${ch.currentProgram}` : '';
    const reply = lang === 'sw' ? `Sawa, nafungua ${ch.name}${prog}.` : `Opening ${ch.name}.`;
    return buildReply(
      'PLAY_LIVE_CHANNEL',
      Math.min(0.99, Number((channelMatch.score / 100).toFixed(2))),
      reply,
      {
        type: 'PLAY_CHANNEL',
        target_id: ch.id,
        target_name: ch.name,
        deep_link: `${PUBLIC_SITE_URL}/watch/channel/${slug}`,
        channel: brief
      },
      {
        speechText: lang === 'sw' ? `Sawa, nafungua ${ch.name}.` : `Opening ${ch.name}.`,
        matchedChannel: brief,
        recommendations: [channelToRecommendation(ch)]
      }
    );
  }

  // 10. SECONDARY CHECK: spoken movie title without saying "movie"
  if (/\b(open|fungua|play|cheza|watch|tazama|niwekee|weka)\b/i.test(query)) {
    const movieFallback = matchFirebaseMovies(query);
    if (movieFallback.length > 0 && movieFallback[0].streamUrl) {
      const top = movieFallback[0];
      if (appId === 'nelitv-web' && !canPlayMoviesInApp) {
        return buildReply(
          'OPEN_MOVIE_IN_APP',
          0.84,
          lang === 'sw' ? `Filamu ya ${top.title} inapatikana kwenye NeliTv Android App.` : `${top.title} is available in the NeliTv Android App.`,
          {
            type: 'OPEN_APP_LINK',
            target_id: top.id,
            target_name: top.title,
            deep_link: `${PUBLIC_SITE_URL}/watch/movie/${encodeURIComponent(top.id)}`,
            movie: top,
            movies: movieFallback
          },
          { matchedMovies: movieFallback, recommendations: movieFallback.slice(0, 3).map(movieToRecommendation) }
        );
      }
      return buildReply(
        'OPEN_MOVIE',
        0.84,
        lang === 'sw' ? `Nafungua filamu ya ${top.title}.` : `Opening ${top.title}.`,
        {
          type: 'OPEN_MOVIE',
          target_id: top.id,
          target_name: top.title,
          deep_link: `${PUBLIC_SITE_URL}/watch/movie/${encodeURIComponent(top.id)}`,
          movie: top,
          movies: movieFallback
        },
        { matchedMovies: movieFallback, recommendations: movieFallback.slice(0, 3).map(movieToRecommendation) }
      );
    }
  }

  // 11. LIVE SCHEDULE / EPG / MATCHES STATUS QUESTIONS
  if (/\b(what is live|whats live|mechi|vipindi|kipindi|hewani|online|channels|live sasa)\b/i.test(query)) {
    const pool = getOnlineChannelPool();
    const sports = pool
      .filter((c) => c.category.some((cat) => /sport|michezo/i.test(cat)))
      .slice(0, 3);
    const names = sports.map((s) => s.name).join(', ');
    const progDetails = sports.map((s) => `${s.name} (${s.currentProgram || 'Live'})`).join(', ');
    const msg = lang === 'sw'
      ? `Kwa sasa tuna vituo ${knowledgeSummary.onlineChannels} hewani. Kwenye michezo live sasa: ${progDetails}.`
      : `There are ${knowledgeSummary.onlineChannels} live channels online. Live sports right now: ${progDetails}.`;
    return buildReply(
      'LIVE_EPG_STATUS',
      0.89,
      msg,
      { type: 'NONE', deep_link: PUBLIC_SITE_URL },
      {
        speechText: lang === 'sw' ? `Vituo vya michezo live ni ${names}.` : `Live sports right now include ${names}.`,
        recommendations: sports.map(channelToRecommendation)
      }
    );
  }

  // 12. DEFAULT FALLBACK
  const fallbackSw = isTvFreeMode
    ? 'Sijakupata vizuri. Sema mfano: Neli weka Azam Sports 1, ongeza sauti, au badili chaneli.'
    : 'Sijakupata vizuri. Sema mfano: Neli fungua Azam Two, mechi gani iko live, ongeza sauti, au cheza movie.';
  const fallbackEn = 'I did not catch that. Try saying: Neli open Azam Two, increase volume, what is live, or play a movie.';
  return buildReply(
    'UNKNOWN',
    0.4,
    lang === 'sw' ? fallbackSw : fallbackEn,
    { type: 'NONE' }
  );
}
