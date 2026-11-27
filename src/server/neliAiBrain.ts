import { CHANNELS_DATA, Channel } from '../data/channels.ts';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';
import { channelHealthGuardian } from './streamResilience.ts';

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
  type: 'movie' | 'series';
}

export interface NeliAiCommandRequest {
  transcript: string;
  appId?: string;
  currentChannelId?: string;
  currentQuality?: string;
  volume?: number;
  brightness?: number;
  isFullscreen?: boolean;
  locale?: 'sw' | 'en' | 'auto';
}

export interface NeliAiAction {
  type:
    | 'OPEN_CHANNEL'
    | 'NEXT_CHANNEL'
    | 'PREV_CHANNEL'
    | 'OPEN_MOVIE'
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
    | 'GO_HOME'
    | 'OPEN_DOWNLOAD'
    | 'INFO_ONLY';
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

export interface NeliAiCommandResponse {
  success: boolean;
  engine: 'nelitv-brain-v1';
  zeroExternalLlm: true;
  appId: string;
  transcript: string;
  normalizedQuery: string;
  intent: string;
  confidence: number;
  language: 'sw' | 'en';
  spokenReply: string;
  action: NeliAiAction;
  actionAlias?: string;
  matchedChannel?: NeliAiAction['channel'] | null;
  matchedMovies?: FirebaseMovieItem[];
  knowledgeSummary: {
    onlineChannels: number;
    firebaseMovies: number;
    firebaseSeries: number;
    lastFirebaseSyncAt: string | null;
  };
}

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

function parseFirestoreDoc(doc: any, type: 'movie' | 'series'): FirebaseMovieItem | null {
  const f = doc?.fields;
  if (!f) return null;
  const get = (key: string) => unwrapFirestoreValue(f[key]);
  const title = String(get('title') || get('name') || get('originalTitle') || '').trim();
  const streamUrl = String(get('streamUrl') || '').trim();
  const published = get('published') !== false;
  if (!title || !published) return null;
  if (type === 'movie' && !streamUrl) return null;

  const docIdFromName = typeof doc?.name === 'string' ? doc.name.split('/').pop() : '';
  return {
    id: String(get('id') || docIdFromName || title.toLowerCase().replace(/\s+/g, '-')),
    title,
    originalTitle: get('originalTitle') ? String(get('originalTitle')) : undefined,
    overview: String(get('overview') || ''),
    genres: Array.isArray(get('genres')) ? get('genres').map(String) : [],
    streamUrl,
    posterPath: String(get('posterPath') || get('backdropPath') || ''),
    backdropPath: get('backdropPath') ? String(get('backdropPath')) : undefined,
    narrated: Boolean(get('narrated')),
    narrationLanguage: get('narrationLanguage') ? String(get('narrationLanguage')) : undefined,
    originalLanguage: get('originalLanguage') ? String(get('originalLanguage')) : undefined,
    year: typeof get('year') === 'number' ? get('year') : null,
    rating: typeof get('rating') === 'number' ? get('rating') : null,
    runtime: typeof get('runtime') === 'number' ? get('runtime') : null,
    featured: Boolean(get('featured')),
    published,
    type
  };
}

class NeliAiKnowledgeBase {
  private movies: FirebaseMovieItem[] = [];
  private series: FirebaseMovieItem[] = [];
  private lastSyncMs = 0;
  private lastSyncAtIso: string | null = null;
  private syncingPromise: Promise<void> | null = null;
  private readonly syncTtlMs = 5 * 60 * 1000;

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
        const [movieDocs, seriesDocs] = await Promise.all([
          this.fetchFirestoreCollection('movies', 6),
          this.fetchFirestoreCollection('series', 3)
        ]);
        const parsedMovies = movieDocs
          .map((d) => parseFirestoreDoc(d, 'movie'))
          .filter((m): m is FirebaseMovieItem => Boolean(m));
        const parsedSeries = seriesDocs
          .map((d) => parseFirestoreDoc(d, 'series'))
          .filter((s): s is FirebaseMovieItem => Boolean(s));

        if (parsedMovies.length > 0) {
          this.movies = parsedMovies;
        }
        if (parsedSeries.length > 0) {
          this.series = parsedSeries;
        }
        this.lastSyncMs = Date.now();
        this.lastSyncAtIso = new Date().toISOString();
      } catch {
        // Keep last healthy cache on transient network errors
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

  getStats() {
    const snap = channelHealthGuardian.getSnapshot();
    return {
      onlineChannels: snap.onlineCount,
      firebaseMovies: this.movies.length,
      firebaseSeries: this.series.length,
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
    .replace(/^(?:hey|ok|hello|habari|samahani|please|tafadhali|yo|eh)\s+/i, '')
    .replace(/^(?:neli|nelly|nelitv|neli tv|nely|nel)\b[\s,:-]*/i, '')
    .replace(/^(?:please|tafadhali|hebu|naomba)\s+/i, '')
    .trim();
}

function detectLanguage(raw: string, localeHint?: 'sw' | 'en' | 'auto'): 'sw' | 'en' {
  if (localeHint === 'sw' || localeHint === 'en') return localeHint;
  const swHints = /\b(fungua|weka|niwekee|ongeza|pandisha|punguza|zima|washa|badili|kituo|sauti|mwanga|ubora|bando|okoa|nyumbani|rudi|tafuta|nipendekezee|filamu|tamthilia|kipindi|mechi|mpira|hewani|simamisha|endelea|skrini|lugha|kiswahili|inayofuata|nyuma|bure|pakua|habari|mambo|nani|gani|ipi)\b/i;
  const enHints = /\b(open|play|watch|change|switch|next|previous|increase|decrease|turn up|turn down|raise|lower|mute|unmute|volume|brightness|quality|fullscreen|pause|resume|home|search|recommend|movie|movies|film|channel|live|match|download|english|language)\b/i;
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
    .replace(/\b(open|fungua|weka|niwekee|cheza|play|watch|tazama|change|switch|put|turn|go|badili|badilisha|hamia|nenda|to|into|on|the|a|kwenda|kwenye|hadi|channel|chaneli|kituo)\b/gi, ' ')
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

      // Phonetic typo tolerance against full channel name
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

function matchFirebaseMovies(rawQuery: string): FirebaseMovieItem[] {
  const movies = [...neliAiKnowledge.getMovies(), ...neliAiKnowledge.getSeries()];
  if (movies.length === 0) return [];

  const wantsNarrated = /\b(kiswahili|swahili|narrated|tafsiri|dj|zilizotafsiriwa|iliyotafsiriwa|imetafsiriwa)\b/i.test(rawQuery);
  const q = rawQuery
    .replace(/\b(open|fungua|play|cheza|tafuta|search|recommend|nipendekezee|nionyeshe|show|movie|movies|filamu|film|series|tamthilia|sinema|ya|za|zenye|ambazo|new|mpya|kiswahili|swahili|narrated|tafsiri|dj|zilizotafsiriwa|iliyotafsiriwa|imetafsiriwa)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const wantsExplicit = /\b(adult|18\+|xxx|porn|erotic|wakubwa)\b/i.test(rawQuery);
  const queryTokens = q.split(/\s+/).filter((t) => t.length >= 2);

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
    } else if (queryTokens.length > 0) {
      for (const tok of queryTokens) {
        if (titleNorm.includes(tok) || origNorm.includes(tok)) score += 32;
        else if (genreText.includes(tok)) score += 26;
        else if (overviewNorm.includes(tok)) score += 12;
      }
    } else {
      // Generic movie request ("recommend a movie") -> rank featured / latest / high-rated
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

export async function processNeliVoiceCommand(req: NeliAiCommandRequest): Promise<NeliAiCommandResponse> {
  await neliAiKnowledge.syncFirebaseCatalog(false);

  const rawTranscript = String(req.transcript || '').trim();
  const appId = String(req.appId || 'nelitv-web').trim() || 'nelitv-web';
  const norm = normalizeSpeechText(rawTranscript);
  const query = stripWakeWord(norm);
  const lang = detectLanguage(query || norm, req.locale);
  const knowledgeSummary = neliAiKnowledge.getStats();

  const toActionAlias = (t: NeliAiAction['type']): string => {
    switch (t) {
      case 'OPEN_CHANNEL':
        return 'PLAY_CHANNEL';
      case 'SET_VOLUME':
      case 'STEP_VOLUME':
        return 'VOLUME';
      case 'SET_BRIGHTNESS':
      case 'STEP_BRIGHTNESS':
        return 'BRIGHTNESS';
      case 'SET_QUALITY':
      case 'STEP_QUALITY':
        return 'QUALITY';
      case 'SET_FULLSCREEN':
        return 'FULLSCREEN';
      default:
        return t;
    }
  };

  const buildReply = (
    intent: string,
    confidence: number,
    spokenReply: string,
    action: NeliAiAction,
    matchedChannel?: NeliAiAction['channel'] | null,
    matchedMovies?: FirebaseMovieItem[]
  ): NeliAiCommandResponse => ({
    success: true,
    engine: 'nelitv-brain-v1',
    zeroExternalLlm: true,
    appId,
    transcript: rawTranscript,
    normalizedQuery: query,
    intent,
    confidence,
    language: lang,
    spokenReply,
    action,
    actionAlias: toActionAlias(action.type),
    matchedChannel: matchedChannel ?? null,
    matchedMovies,
    knowledgeSummary
  });

  if (!query) {
    return buildReply(
      'WAKE_GREETING',
      0.95,
      lang === 'sw'
        ? 'Nipo tayari. Niambie unataka kufungua kituo gani, kuongeza sauti, mwanga au ubora.'
        : 'I am listening. Tell me which channel or movie to open, or adjust volume, brightness, or quality.',
      { type: 'INFO_ONLY' }
    );
  }

  // 1. MUTE / UNMUTE
  if (/\b(mute|zima sauti|nyamazisha|silence)\b/i.test(query) && !/\b(unmute|fungua sauti|washa sauti)\b/i.test(query)) {
    return buildReply(
      'MUTE',
      0.98,
      lang === 'sw' ? 'Sawa, nimezima sauti.' : 'Audio muted.',
      { type: 'MUTE' }
    );
  }
  if (/\b(unmute|fungua sauti|washa sauti|rudisha sauti)\b/i.test(query)) {
    return buildReply(
      'UNMUTE',
      0.98,
      lang === 'sw' ? 'Sawa, nimewasha sauti.' : 'Audio unmuted.',
      { type: 'UNMUTE' }
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
        { type: 'SET_VOLUME', value: Number((clamped / 100).toFixed(2)) }
      );
    }
    if (/\b(down|lower|decrease|reduce|punguza|shusha|chini|less|quiet)\b/i.test(query)) {
      return buildReply(
        'STEP_VOLUME_DOWN',
        0.96,
        lang === 'sw' ? 'Nimepunguza sauti.' : 'Turning volume down.',
        { type: 'STEP_VOLUME', direction: 'down', delta: -0.2 }
      );
    }
    return buildReply(
      'STEP_VOLUME_UP',
      0.95,
      lang === 'sw' ? 'Nimeongeza sauti.' : 'Turning volume up.',
      { type: 'STEP_VOLUME', direction: 'up', delta: 0.2 }
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
        { type: 'SET_BRIGHTNESS', value: Number((clamped / 100).toFixed(2)) }
      );
    }
    if (/\b(down|lower|decrease|reduce|dim|punguza|shusha|giza)\b/i.test(query)) {
      return buildReply(
        'STEP_BRIGHTNESS_DOWN',
        0.96,
        lang === 'sw' ? 'Nimepunguza mwanga wa skrini.' : 'Lowering screen brightness.',
        { type: 'STEP_BRIGHTNESS', direction: 'down', delta: -0.15 }
      );
    }
    return buildReply(
      'STEP_BRIGHTNESS_UP',
      0.96,
      lang === 'sw' ? 'Nimeongeza mwanga wa skrini.' : 'Increasing screen brightness.',
      { type: 'STEP_BRIGHTNESS', direction: 'up', delta: 0.15 }
    );
  }

  // 4. QUALITY CONTROLS
  if (/\b(quality|resolution|ubora|hd|full hd|1080|720|480|360|240|data saver|okoa bando|saver)\b/i.test(query)) {
    if (/\b(1080|full hd)\b/i.test(query)) {
      return buildReply(
        'SET_QUALITY_1080',
        0.97,
        lang === 'sw' ? 'Nimeweka ubora wa 1080p Full HD.' : 'Quality set to 1080p Full HD.',
        { type: 'SET_QUALITY', quality: '1080' }
      );
    }
    if (/\b(720|hd)\b/i.test(query) && !/\b(increase|higher|up|ongeza|pandisha)\b/i.test(query)) {
      return buildReply(
        'SET_QUALITY_720',
        0.96,
        lang === 'sw' ? 'Nimeweka ubora wa 720p HD.' : 'Quality set to 720p HD.',
        { type: 'SET_QUALITY', quality: '720' }
      );
    }
    if (/\b480\b/.test(query)) {
      return buildReply(
        'SET_QUALITY_480',
        0.96,
        lang === 'sw' ? 'Nimeweka ubora wa 480p.' : 'Quality set to 480p.',
        { type: 'SET_QUALITY', quality: '480' }
      );
    }
    if (/\b360\b/.test(query)) {
      return buildReply(
        'SET_QUALITY_360',
        0.96,
        lang === 'sw' ? 'Nimeweka ubora wa 360p.' : 'Quality set to 360p.',
        { type: 'SET_QUALITY', quality: '360' }
      );
    }
    if (/\b240\b/.test(query)) {
      return buildReply(
        'SET_QUALITY_240',
        0.96,
        lang === 'sw' ? 'Nimeweka ubora wa 240p.' : 'Quality set to 240p.',
        { type: 'SET_QUALITY', quality: '240' }
      );
    }
    if (/\b(data saver|okoa bando|saver)\b/i.test(query)) {
      return buildReply(
        'SET_QUALITY_SAVER',
        0.96,
        lang === 'sw' ? 'Hali ya kuokoa bando imewashwa.' : 'Data saver quality enabled.',
        { type: 'SET_QUALITY', quality: 'saver' }
      );
    }
    if (/\bauto\b/i.test(query)) {
      return buildReply(
        'SET_QUALITY_AUTO',
        0.96,
        lang === 'sw' ? 'Ubora umewekwa Auto kulingana na mtandao.' : 'Quality set to Auto.',
        { type: 'SET_QUALITY', quality: 'auto' }
      );
    }
    if (/\b(down|lower|decrease|reduce|punguza|shusha)\b/i.test(query)) {
      return buildReply(
        'STEP_QUALITY_DOWN',
        0.94,
        lang === 'sw' ? 'Nimepunguza ubora wa video.' : 'Lowering video quality.',
        { type: 'STEP_QUALITY', direction: 'down' }
      );
    }
    return buildReply(
      'STEP_QUALITY_UP',
      0.94,
      lang === 'sw' ? 'Nimepandisha ubora wa video.' : 'Increasing video quality.',
      { type: 'STEP_QUALITY', direction: 'up' }
    );
  }

  // 5. FULLSCREEN / PAUSE / PLAY / LANGUAGE / HOME / DOWNLOAD
  if (/\b(exit fullscreen|leave fullscreen|minimize|punguza skrini|toa fullscreen)\b/i.test(query)) {
    return buildReply(
      'EXIT_FULLSCREEN',
      0.95,
      lang === 'sw' ? 'Nimepunguza skrini.' : 'Exiting fullscreen.',
      { type: 'SET_FULLSCREEN', fullscreen: false }
    );
  }
  if (/\b(fullscreen|full screen|skrini nzima|panua skrini)\b/i.test(query)) {
    return buildReply(
      'ENTER_FULLSCREEN',
      0.95,
      lang === 'sw' ? 'Nimeweka skrini nzima.' : 'Entering fullscreen.',
      { type: 'SET_FULLSCREEN', fullscreen: true }
    );
  }
  if (/\b(pause|simamisha|simama)\b/i.test(query)) {
    return buildReply(
      'PAUSE',
      0.95,
      lang === 'sw' ? 'Video imesimamishwa.' : 'Playback paused.',
      { type: 'PAUSE' }
    );
  }
  if (/^(play|resume|endelea|anza)$/i.test(query)) {
    return buildReply(
      'PLAY',
      0.93,
      lang === 'sw' ? 'Inaendelea kucheza.' : 'Resuming playback.',
      { type: 'PLAY' }
    );
  }
  if (/\b(switch language|change language|badili lugha|lugha)\b/i.test(query)) {
    const targetLang: 'sw' | 'en' = /\b(english|kiingereza)\b/i.test(query) ? 'en' : 'sw';
    return buildReply(
      'SET_LANGUAGE',
      0.93,
      targetLang === 'sw' ? 'Lugha imewekwa Kiswahili.' : 'Audio language switched to English.',
      { type: 'SET_LANGUAGE', language: targetLang }
    );
  }
  if (/\b(go home|home page|nyumbani|rudi mwanzo|rudi nyumbani)\b/i.test(query)) {
    return buildReply(
      'GO_HOME',
      0.94,
      lang === 'sw' ? 'Narudi ukurasa wa nyumbani.' : 'Going to home screen.',
      { type: 'GO_HOME' }
    );
  }
  if (/\b(download|apk|apkpure|pakua)\b/i.test(query)) {
    return buildReply(
      'OPEN_DOWNLOAD',
      0.92,
      lang === 'sw'
        ? 'Unaweza kupakua NeliTv APK bure kwenye ukurasa wa download au kupitia nelitv.apk.com kwenye APKPure.'
        : 'Opening the official NeliTv APK download page, also available on APKPure at nelitv.apk.com.',
      { type: 'OPEN_DOWNLOAD' }
    );
  }

  // 6. NEXT / PREVIOUS / CHANGE CHANNEL (generic)
  if (/\b(previous channel|prev channel|last channel|kituo kilichopita|rudi channel)\b/i.test(query)) {
    const pool = getOnlineChannelPool();
    const curIdx = pool.findIndex((c) => c.id === req.currentChannelId);
    const prevIdx = curIdx > 0 ? curIdx - 1 : pool.length - 1;
    const target = pool[prevIdx];
    const brief = serializeChannelBrief(target);
    return buildReply(
      'PREV_CHANNEL',
      0.95,
      lang === 'sw' ? `Narudi kwenye ${target.name}.` : `Switching back to ${target.name}.`,
      { type: 'PREV_CHANNEL', channel: brief },
      brief
    );
  }
  if (/^(?:please\s+)?(?:next|next\s+(?:the\s+)?channel|change\s+(?:the\s+)?channel|switch\s+(?:the\s+)?channel|other\s+channel|badili\s+kituo|kituo\s+kingine|badili\s+channel|channel\s+inayofuata)$/i.test(query)) {
    const pool = getOnlineChannelPool();
    const curIdx = pool.findIndex((c) => c.id === req.currentChannelId);
    const nextIdx = curIdx >= 0 ? (curIdx + 1) % pool.length : 0;
    const target = pool[nextIdx];
    const brief = serializeChannelBrief(target);
    return buildReply(
      'NEXT_CHANNEL',
      0.95,
      lang === 'sw' ? `Nafungua ${target.name}.` : `Switching to ${target.name}.`,
      { type: 'NEXT_CHANNEL', channel: brief },
      brief
    );
  }

  // 7. FIREBASE MOVIES / SERIES VOICE SEARCH & PLAYBACK
  const explicitMovieRequest = /\b(movie|movies|filamu|film|series|tamthilia)\b/i.test(query);
  if (explicitMovieRequest) {
    const matchedMovies = matchFirebaseMovies(query);
    if (matchedMovies.length > 0) {
      const top = matchedMovies[0];
      const wantsPlay = /\b(open|fungua|play|cheza|watch|tazama|niwekee|weka)\b/i.test(query) || matchedMovies.length === 1;
      if (wantsPlay && top.streamUrl) {
        return buildReply(
          'OPEN_MOVIE',
          0.91,
          lang === 'sw'
            ? `Nafungua filamu ya ${top.title}${top.year ? ` ya mwaka ${top.year}` : ''}.`
            : `Opening movie ${top.title}.`,
          { type: 'OPEN_MOVIE', movie: top, movies: matchedMovies },
          null,
          matchedMovies
        );
      }
      const topTitles = matchedMovies.slice(0, 3).map((m) => m.title).join(', ');
      return buildReply(
        'RECOMMEND_MOVIES',
        0.89,
        lang === 'sw'
          ? `Nimepata filamu ${matchedMovies.length} kwenye Firebase, ikiwemo ${topTitles}. Sema open kisha jina la movie kuicheza.`
          : `I found ${matchedMovies.length} movies in Firebase including ${topTitles}. Say open followed by the movie name to watch.`,
        { type: 'OPEN_MOVIE', movie: top.streamUrl ? top : undefined, movies: matchedMovies },
        null,
        matchedMovies
      );
    }
    return buildReply(
      'MOVIE_NOT_FOUND',
      0.7,
      lang === 'sw'
        ? 'Samahani, sijapata filamu yenye jina hilo kwa sasa kwenye maktaba ya Firebase.'
        : 'Sorry, I could not find a matching movie in Firebase right now.',
      { type: 'INFO_ONLY' }
    );
  }

  // 8. LIVE CHANNEL MATCH ("open azam two", "niwekee sinema zetu", "azam sports 1", etc.)
  const channelMatch = matchBestChannel(query);
  if (channelMatch) {
    const brief = serializeChannelBrief(channelMatch.channel);
    const prog = channelMatch.channel.currentProgram ? ` — ${channelMatch.channel.currentProgram}` : '';
    return buildReply(
      'OPEN_CHANNEL',
      Math.min(0.99, Number((channelMatch.score / 100).toFixed(2))),
      lang === 'sw'
        ? `Nafungua ${channelMatch.channel.name}${prog}.`
        : `Opening ${channelMatch.channel.name}.`,
      { type: 'OPEN_CHANNEL', channel: brief },
      brief
    );
  }

  // 9. SECONDARY CHECK: maybe user spoke a Firebase movie title without saying the word "movie"
  if (/\b(open|fungua|play|cheza|watch|tazama)\b/i.test(query)) {
    const movieFallback = matchFirebaseMovies(query);
    if (movieFallback.length > 0 && movieFallback[0].streamUrl) {
      const top = movieFallback[0];
      return buildReply(
        'OPEN_MOVIE',
        0.84,
        lang === 'sw' ? `Nafungua filamu ya ${top.title}.` : `Opening ${top.title}.`,
        { type: 'OPEN_MOVIE', movie: top, movies: movieFallback },
        null,
        movieFallback
      );
    }
  }

  // 10. LIVE SCHEDULE / STATUS QUESTIONS
  if (/\b(what is live|whats live|mechi|vipindi|kipindi|hewani|online|channels)\b/i.test(query)) {
    const pool = getOnlineChannelPool();
    const sports = pool.filter((c) => c.category.includes('sports')).slice(0, 3);
    const names = sports.map((s) => s.name).join(', ');
    return buildReply(
      'LIVE_STATUS',
      0.88,
      lang === 'sw'
        ? `Kwa sasa tuna vituo ${knowledgeSummary.onlineChannels} hewani na filamu ${knowledgeSummary.firebaseMovies}. Vituo vya michezo vilivyo live ni ${names}.`
        : `There are ${knowledgeSummary.onlineChannels} live channels and ${knowledgeSummary.firebaseMovies} movies available, including ${names}.`,
      { type: 'INFO_ONLY' }
    );
  }

  // 11. DEFAULT FALLBACK
  return buildReply(
    'UNKNOWN',
    0.4,
    lang === 'sw'
      ? 'Sijakupata vizuri. Sema mfano: Neli fungua Azam Two, ongeza sauti, ongeza mwanga, au cheza movie.'
      : 'I did not catch that. Try saying: Neli open Azam Two, increase volume, increase brightness, or play a movie.',
    { type: 'INFO_ONLY' }
  );
}
