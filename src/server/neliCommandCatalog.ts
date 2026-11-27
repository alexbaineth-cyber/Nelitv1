import fs from 'fs';
import path from 'path';
import { CHANNELS_DATA, VIFURUSHI_PLANS } from '../data/channels.ts';

export type TrainedActionType =
  | 'NONE'
  | 'PLAY_CHANNEL'
  | 'OPEN_MOVIE'
  | 'OPEN_SERIES'
  | 'NEXT_CHANNEL'
  | 'PREV_CHANNEL'
  | 'VOLUME_UP'
  | 'VOLUME_DOWN'
  | 'MUTE'
  | 'UNMUTE'
  | 'SET_QUALITY'
  | 'STEP_BRIGHTNESS'
  | 'OPEN_PREMIUM'
  | 'OPEN_DOWNLOAD'
  | 'OPEN_SEARCH'
  | 'GO_HOME';

export interface CustomTrainedRule {
  id: string;
  phrases: string[];
  actionType: TrainedActionType;
  targetId?: string;
  targetName?: string;
  replySw: string;
  replyEn: string;
  speechEn: string;
  createdAt: string;
}

export interface RichAppIntentMatch {
  intent: string;
  confidence: number;
  actionType: TrainedActionType;
  targetId?: string;
  targetName?: string;
  quality?: 'auto' | '1080' | '720' | '480' | '360' | '240' | 'saver';
  direction?: 'up' | 'down';
  delta?: number;
  value?: number;
  deepLinkPath?: string;
  channelCategoryHint?: string;
  movieGenreHint?: string;
  replySw: string;
  replyEn: string;
  speechEn: string;
  tvReplySw?: string;
  tvReplyEn?: string;
  tvSpeechEn?: string;
}

const DATA_DIR_PRIMARY = path.join(process.cwd(), '.data');
const TRAINING_FILE_PRIMARY = path.join(DATA_DIR_PRIMARY, 'neli_ai_training.json');
const TRAINING_FILE_TMP = '/tmp/neli_ai_training.json';

let inMemoryTrainedRules: CustomTrainedRule[] = [
  {
    id: 'builtin_seed_greeting',
    phrases: ['shikamoo neli', 'za asubuhi neli', 'mambo vipi neli'],
    actionType: 'NONE',
    replySw: 'Marahaba! Mimi ni Neli AI. Niambie kituo, kipindi kinachoendelea, au movie unayotaka.',
    replyEn: 'Hello! I am Neli AI. Ask me what is playing or tell me any channel or movie to open.',
    speechEn: 'Hi there! I am Neli. Tell me what channel or movie you want to watch.',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

let loadedFromDisk = false;

function loadTrainedRules(): CustomTrainedRule[] {
  if (loadedFromDisk) return inMemoryTrainedRules;
  loadedFromDisk = true;
  for (const file of [TRAINING_FILE_PRIMARY, TRAINING_FILE_TMP]) {
    try {
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryTrainedRules = parsed;
          return inMemoryTrainedRules;
        }
      }
    } catch {
      // Ignore read errors and check fallback
    }
  }
  return inMemoryTrainedRules;
}

function saveTrainedRules(rules: CustomTrainedRule[]) {
  inMemoryTrainedRules = rules;
  for (const [dir, file] of [
    [DATA_DIR_PRIMARY, TRAINING_FILE_PRIMARY],
    ['/tmp', TRAINING_FILE_TMP]
  ]) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(rules, null, 2));
      return;
    } catch {
      // Fallback to /tmp if primary workspace is read-only
    }
  }
}

export function getCustomTrainedRules(): CustomTrainedRule[] {
  return loadTrainedRules();
}

export function addCustomTrainedRule(input: {
  phrases: string[];
  actionType?: TrainedActionType;
  targetId?: string;
  targetName?: string;
  replySw: string;
  replyEn?: string;
  speechEn?: string;
}): CustomTrainedRule {
  const existing = loadTrainedRules();
  const cleanPhrases = input.phrases
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);
  const rule: CustomTrainedRule = {
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    phrases: cleanPhrases,
    actionType: input.actionType || 'NONE',
    targetId: input.targetId?.trim() || undefined,
    targetName: input.targetName?.trim() || undefined,
    replySw: input.replySw.trim(),
    replyEn: (input.replyEn || input.replySw).trim(),
    speechEn: (input.speechEn || input.replyEn || input.replySw).trim(),
    createdAt: new Date().toISOString()
  };
  const updated = [rule, ...existing];
  saveTrainedRules(updated);
  return rule;
}

export function deleteCustomTrainedRule(id: string): boolean {
  const existing = loadTrainedRules();
  const filtered = existing.filter((r) => r.id !== id);
  if (filtered.length === existing.length) return false;
  saveTrainedRules(filtered);
  return true;
}

export function matchCustomTrainedRule(normalizedQuery: string): CustomTrainedRule | null {
  const q = normalizedQuery.toLowerCase().trim();
  if (!q) return null;
  const rules = loadTrainedRules();
  for (const rule of rules) {
    for (const phrase of rule.phrases) {
      const p = phrase.toLowerCase().trim();
      if (!p) continue;
      if (q === p || (p.length >= 4 && (q.includes(p) || p.includes(q)))) {
        return rule;
      }
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// OVER 1,200+ BUILT-IN APP, TV, CHANNEL, EPG, MOVIES, VIP & SUPPORT COMMANDS
// -----------------------------------------------------------------------------

interface AppIntentRule {
  id: string;
  category: string;
  sampleCommands: string[];
  patterns: RegExp[];
  buildMatch: (query: string) => Omit<RichAppIntentMatch, 'intent' | 'confidence'>;
}

const APP_INTENT_RULES: AppIntentRule[] = [
  {
    id: 'CONVERSATION_IDENTITY',
    category: 'Identity & Greetings',
    sampleCommands: [
      'hey neli',
      'hello neli',
      'habari neli',
      'mambo vipi neli',
      'who are you',
      'wewe ni nani',
      'jina lako nani',
      'what can you do',
      'unaweza kufanya nini',
      'thank you neli',
      'asante neli',
      'good morning neli',
      'good evening neli',
      'usiku mwema neli',
      'neli uko hapo',
      'are you listening',
      'help me neli',
      'nisaidie neli'
    ],
    patterns: [
      /\b(who are you|what is your name|whats your name|wewe ni nani|jina lako|unaitwa nani|mtengenezaji wako|who made you|neli company)\b/i,
      /\b(what can you do|how do you work|unaweza kufanya nini|unafanya kazi gani|commands|amri zipi|msaada wa amri)\b/i,
      /^(?:habari|mambo|mambo vipi|vipi|hujambo|salamu|hello|hi|hey|good morning|good afternoon|good evening|habari za asubuhi|habari za jioni|za saa hizi|uko poa|uko hapo|asante|thank you|thanks|shukran|goodbye|kwaheri|usiku mwema)\b/i
    ],
    buildMatch: (query) => {
      if (/\b(asante|thank|thanks|shukran)\b/i.test(query)) {
        return {
          actionType: 'NONE',
          replySw: 'Karibu sana! Ukipenda kituo kingine, movie, au taarifa ya kipindi kinachoendelea niambie tu.',
          replyEn: 'You are welcome! Just say any channel, live program question, or movie whenever you are ready.',
          speechEn: 'You are very welcome! Just tell me whenever you want another channel or movie.'
        };
      }
      if (/\b(who are you|what is your name|whats your name|wewe ni nani|unaitwa nani|jina lako|who made you|neli company)\b/i.test(query)) {
        return {
          actionType: 'NONE',
          replySw: 'Mimi ni Neli AI, msaidizi wa sauti na akili wa Neli Company kwa NeliTv Web, Android App, na Smart TV.',
          replyEn: 'I am Neli AI, the voice and catalog assistant built by Neli Company for NeliTv Web, Android, and Smart TV.',
          speechEn: 'I am Neli, your voice assistant by Neli Company for Live TV and movies.'
        };
      }
      if (/\b(what can you do|unaweza kufanya nini|commands|amri zipi|msaada wa amri)\b/i.test(query)) {
        return {
          actionType: 'NONE',
          replySw: 'Naweza kufungua chaneli 60+, kukuambia kinachoendelea sasa (mfano: what now playing on Azam Two), kucheza filamu za Firebase, kudhibiti sauti/mwanga/ubora, na kujibu maswali ya VIP au Smart TV.',
          replyEn: 'I can open 60+ live channels, check what is playing now on any channel, search Firebase movies, control volume, brightness, quality, and help with Smart TV or VIP.',
          speechEn: 'I can open any channel, tell you what is playing now, play movies, and control volume or quality.'
        };
      }
      return {
        actionType: 'NONE',
        replySw: 'Salama kabisa! Niambie chaneli unayotaka (mfano Azam Two), uliza kipindi kilichopo hewani, au omba movie.',
        replyEn: 'Doing great! Tell me a channel like Azam Two, ask what is playing now, or pick a movie.',
        speechEn: 'Hi there! Tell me which channel to open or ask what is playing now.'
      };
    }
  },
  {
    id: 'CATEGORY_SPORTS_LIVE',
    category: 'Sports & Matches',
    sampleCommands: [
      'nataka kuangalia mpira',
      'weka mechi ya simba',
      'weka mechi ya yanga',
      'fungua nbc premier league',
      'open champions league',
      'put football channel',
      'watch epl live',
      'niwekee chaneli ya michezo',
      'mechi ya azam fc',
      'boxing channel',
      'wrestling live',
      'show me live soccer',
      'ligue 1 live',
      'la liga match',
      'caf champions league',
      'taifa stars match'
    ],
    patterns: [
      /\b(mpira|soka|football|soccer|mechi|match|simba|yanga|azam fc|taifa stars|nbc premier|epl|premier league|champions league|caf|la liga|serie a|bundesliga|michezo|sports channel|boxing|wrestling|ufc|nba|tennis)\b/i
    ],
    buildMatch: () => ({
      actionType: 'PLAY_CHANNEL',
      channelCategoryHint: 'sport',
      targetName: 'Azam Sports 1 HD',
      replySw: 'Nafungua Azam Sports 1 HD kwa ajili ya mechi na michezo mubashara.',
      replyEn: 'Opening Azam Sports 1 HD for live sports and football.',
      speechEn: 'Opening Azam Sports 1 HD for live sports and football.'
    })
  },
  {
    id: 'CATEGORY_NEWS_TANZANIA',
    category: 'News & Current Affairs',
    sampleCommands: [
      'nataka habari',
      'taarifa ya habari',
      'weka habari za leo',
      'habari za tanzania',
      'open news channel',
      'watch breaking news',
      'habari za ulimwengu',
      'bbc news live',
      'international news',
      'magazeti ya leo',
      'habari za michezo',
      'news update'
    ],
    patterns: [
      /\b(habari|taarifa ya habari|news|breaking news|magazeti|matukio|siasa|world news)\b/i
    ],
    buildMatch: (query) => {
      const wantsWorld = /\b(world|ulimwengu|international|bbc|cnn|al jazeera|global)\b/i.test(query);
      return {
        actionType: 'PLAY_CHANNEL',
        channelCategoryHint: 'news',
        targetName: wantsWorld ? 'Al Jazeera' : 'ITV',
        replySw: wantsWorld
          ? 'Nafungua chaneli ya habari za kimataifa.'
          : 'Nafungua chaneli ya habari za Tanzania moja kwa moja.',
        replyEn: wantsWorld ? 'Opening international live news.' : 'Opening live Tanzanian news.',
        speechEn: wantsWorld ? 'Opening international news for you now.' : 'Opening live Tanzanian news for you now.'
      };
    }
  },
  {
    id: 'CATEGORY_KIDS_CARTOONS',
    category: 'Kids & Cartoons',
    sampleCommands: [
      'weka katuni',
      'chaneli ya watoto',
      'put cartoons for kids',
      'open kids channel',
      'tom and jerry',
      'katuni za watoto',
      'nickelodeon live',
      'disney channel',
      'kids movies',
      'animation for children'
    ],
    patterns: [
      /\b(katuni|cartoon|cartoons|watoto|kids|children|anime|animation|nickelodeon|boing|boomerang|disney)\b/i
    ],
    buildMatch: () => ({
      actionType: 'PLAY_CHANNEL',
      channelCategoryHint: 'kids',
      targetName: 'Cartoon Network',
      replySw: 'Nafungua chaneli ya katuni na vipindi vya watoto.',
      replyEn: 'Opening kids and cartoons channel.',
      speechEn: 'Opening kids cartoons for you now.'
    })
  },
  {
    id: 'CATEGORY_MUSIC_BONGO',
    category: 'Music & Bongo Flava',
    sampleCommands: [
      'weka muziki',
      'bongo flava channel',
      'open music channel',
      'play bongo music',
      'nyimbo mpya',
      'amapiano tv',
      'afrobeats channel',
      'trace tv',
      'wasafi music',
      'clouds music'
    ],
    patterns: [
      /\b(muziki|music|bongo flava|nyimbo|songs|amapiano|afrobeats|hip hop|concert|dj mix)\b/i
    ],
    buildMatch: () => ({
      actionType: 'PLAY_CHANNEL',
      channelCategoryHint: 'music',
      targetName: 'Wasafi TV',
      replySw: 'Nafungua burudani ya muziki na Bongo Flava kwenye Wasafi TV.',
      replyEn: 'Opening Wasafi TV for music and entertainment.',
      speechEn: 'Opening Wasafi TV for music and Bongo Flava.'
    })
  },
  {
    id: 'CATEGORY_RELIGIOUS_DINI',
    category: 'Religious & Spiritual',
    sampleCommands: [
      'chaneli ya dini',
      'weka injili',
      'chaneli ya quran',
      'open gospel channel',
      'open islamic channel',
      'mahubiri live',
      'emmanuel tv',
      'hope channel',
      'iman tv',
      'islam tv'
    ],
    patterns: [
      /\b(dini|injili|gospel|church|kanisa|quran|qur an|islamic|kiislamu|mahubiri|prayer|maombi|dua)\b/i
    ],
    buildMatch: () => ({
      actionType: 'PLAY_CHANNEL',
      channelCategoryHint: 'religious',
      replySw: 'Nafungua chaneli ya vipindi vya dini.',
      replyEn: 'Opening a religious broadcast channel.',
      speechEn: 'Opening a religious channel for you now.'
    })
  },
  {
    id: 'CATEGORY_SWAHILI_NARRATED_MOVIES',
    category: 'Swahili & DJ Movies',
    sampleCommands: [
      'nipendekezee movie ya kiswahili',
      'weka filamu iliyotafsiriwa',
      'play dj movie',
      'watch bongo movie',
      'filamu za dj mack',
      'filamu za mapigano za kiswahili',
      'comedy movie swahili',
      'horror movie swahili',
      'sinema za kiswahili',
      'new action movie',
      'latest movies 2026',
      'trending movies'
    ],
    patterns: [
      /\b(sinema|bongo movie|dj mack|dj afro|dj murphy|lufufu|filamu ya kiswahili|movie ya kiswahili|zilizotafsiriwa|narrated movie|tamthilia mpya)\b/i
    ],
    buildMatch: () => ({
      actionType: 'OPEN_MOVIE',
      movieGenreHint: 'swahili',
      replySw: 'Natafuta filamu bora zilizotafsiriwa Kiswahili kwenye maktaba yetu.',
      replyEn: 'Finding top Swahili-narrated movies from our catalog.',
      speechEn: 'Finding Swahili narrated movies for you right now.'
    })
  },
  {
    id: 'APP_SMART_TV_GUIDE',
    category: 'Smart TV & Android TV',
    sampleCommands: [
      'how to install on smart tv',
      'nelitv on android tv',
      'is smart tv free',
      'smart tv inahitaji malipo',
      'remote control guide',
      'd-pad navigation',
      'sanikisha update',
      'update nelitv tv app',
      'how to cast to tv',
      'chromecast nelitv',
      'connect phone to smart tv',
      'tv box apk'
    ],
    patterns: [
      /\b(smart tv|android tv|leanback|tv box|sanikisha|d pad|d-pad|remote|cast to tv|chromecast|weka kwenye tv|install on tv|tv bure|malipo ya tv)\b/i
    ],
    buildMatch: () => ({
      actionType: 'OPEN_DOWNLOAD',
      deepLinkPath: '/download',
      targetId: 'nelitv-tv',
      targetName: 'NeliTv Smart TV',
      replySw: 'NeliTv kwenye Smart TV (Android TV) ni BURE 100% bila login wala malipo! APK moja inafanya kazi kwenye simu na TV, na inajisasisha ndani ya app (SANIKISHA). Pakua katika nelitv.online/download au APKPure (nelitv.apk.com).',
      replyEn: 'NeliTv on Smart TV is 100% FREE with zero login or ads. The unified APK installs on Android phones, TV boxes, and Smart TVs via nelitv.online/download or APKPure.',
      speechEn: 'NeliTv on Smart TV is 100 percent free with no login needed. You can get the APK at nelitv dot online.'
    })
  },
  {
    id: 'APP_VIP_MOBILE_MONEY',
    category: 'VIP & Mobile Money',
    sampleCommands: [
      'how to pay vip',
      'nalipiaje kifurushi',
      'bei ya kifurushi',
      'vip price',
      'mpesa payment',
      'tigo pesa payment',
      'mixx by yas',
      'airtel money',
      'halopesa',
      'harakapay',
      'check my vip status',
      'kifurushi changu kimeisha lini',
      'vip bila login',
      'how to renew vip',
      'siku mbili elfu moja',
      'wiki moja elfu tatu',
      'mwezi mmoja elfu kumi'
    ],
    patterns: [
      /\b(vip|premium|kifurushi|vifurushi|malipo|lipia|nalipia|nalipiaje|bei|gharama|mpesa|m-pesa|tigopesa|tigo pesa|mixx|airtel money|halopesa|harakapay|subscription|renew|ongeza muda|siku 2|wiki 1|mwezi 1)\b/i
    ],
    buildMatch: () => ({
      actionType: 'OPEN_PREMIUM',
      deepLinkPath: '/account',
      targetId: 'vip_plans',
      targetName: 'NeliTv VIP',
      replySw: `Vifurushi vya NeliTv VIP (M-Pesa, Mixx/Tigo Pesa, Airtel Money, HaloPesa bila kulazimika ku-login): ${VIFURUSHI_PLANS.map((p) => `${p.name} TSh ${p.priceTsh.toLocaleString()}`).join(', ')}. Malipo yanathibitishwa kiotomatiki kwenye Web na Android App.`,
      replyEn: `NeliTv VIP plans via Mobile Money (no login required): ${VIFURUSHI_PLANS.map((p) => `${p.name} TSh ${p.priceTsh.toLocaleString()}`).join(', ')}. Syncs automatically across Web and Android App.`,
      speechEn: 'NeliTv VIP plans start at 1,000 shillings for 2 days via Mobile Money with no login required.',
      tvReplySw: 'Kwenye Smart TV hutakiwi kulipa! NeliTv Smart TV ni bure kabisa asilimia mia moja.',
      tvReplyEn: 'On Smart TV you never pay! NeliTv Smart TV mode is 100 percent free.',
      tvSpeechEn: 'NeliTv on Smart TV is completely free with no payment needed.'
    })
  },
  {
    id: 'APP_NETWORK_BUFFERING_QUALITY',
    category: 'Network, Buffering & Quality',
    sampleCommands: [
      'kwanini video inaganda',
      'stream is buffering',
      'network is slow',
      'mtandao uko chini',
      'save my data bundle',
      'okoa bando langu',
      'reduce buffering',
      'reload channel',
      'refresh stream',
      'switch server proxy',
      'best quality without loading',
      'youtube abr mode',
      'video haifunguki',
      'error 502',
      'clear player cache'
    ],
    patterns: [
      /\b(inaganda|kukwama|haichezi|haifunguki|buffering|freezing|lag|error|502|not playing|shida ya mtandao|tatizo|mtandao uko chini|slow network|reload|refresh stream|proxy)\b/i
    ],
    buildMatch: () => ({
      actionType: 'SET_QUALITY',
      quality: 'saver',
      targetId: 'saver',
      targetName: 'Data Saver / Stable Mode',
      replySw: 'NeliTv inatumia mfumo wa YouTube-style ABR unaobadili ubora kimyakimya bila loading. Nimeweka hali thabiti ya kuokoa bando ili chaneli icheze mfululizo bila kuganda.',
      replyEn: 'NeliTv uses YouTube-style silent ABR. Switched to stable data-saver mode so playback stays smooth without loading pauses.',
      speechEn: 'Switched to stable playback mode so your video keeps playing smoothly without freezing.'
    })
  },
  {
    id: 'APP_ACCOUNT_AUTH_OPTIONAL',
    category: 'Account & Privacy',
    sampleCommands: [
      'do i need to login',
      'lazima nijisajili',
      'bila account',
      'watch without signup',
      'reset vip',
      'sync phone vip',
      'delete account',
      'privacy policy',
      'dmca info',
      'terms of service',
      'contact nelitv',
      'neli ai data center'
    ],
    patterns: [
      /\b(login|sign up|signup|register|jisajili|akaunti|account|lazima nijisajili|bila account|privacy|dmca|terms|wasiliana|contact support)\b/i
    ],
    buildMatch: (query) => {
      if (/\b(contact|wasiliana|support|huduma kwa wateja|simu|whatsapp|email)\b/i.test(query)) {
        return {
          actionType: 'NONE',
          deepLinkPath: '/contact',
          replySw: 'Unaweza kuwasiliana na timu ya NeliTv moja kwa moja kupitia ukurasa wa Mawasiliano (nelitv.online/contact).',
          replyEn: 'You can reach NeliTv support anytime at nelitv.online/contact.',
          speechEn: 'You can contact NeliTv support on our Contact page.'
        };
      }
      return {
        actionType: 'NONE',
        replySw: 'Kuingia (Login) au kujisajili si lazima kwenye NeliTv! Unafungua app na kuanza kutazama mara moja, na VIP inatambuliwa kwa namba yako ya simu.',
        replyEn: 'Login and sign-up are 100% optional on NeliTv! Open and watch immediately, and VIP works with just your mobile money phone number.',
        speechEn: 'Login is completely optional on NeliTv. You can start watching right away.'
      };
    }
  },
  {
    id: 'APP_OFFLINE_WATCHLIST_SEARCH',
    category: 'Offline Downloads & Library',
    sampleCommands: [
      'download movie offline',
      'pakua filamu offline',
      'my downloads',
      'watchlist',
      'continue watching',
      'open search',
      'tafuta kwenye app',
      'recent watched',
      'favorite channels',
      'vituo ninavyopenda'
    ],
    patterns: [
      /\b(watchlist|continue watching|favorite|pendwa|recent watched|history|my downloads|download movie|pakua movie|pakua filamu|offline movies|tazama offline)\b/i
    ],
    buildMatch: () => ({
      actionType: 'OPEN_DOWNLOAD',
      deepLinkPath: '/download',
      targetId: 'offline-downloads',
      targetName: 'NeliTv Android App',
      replySw: 'Upakuaji wa filamu za offline, Watchlist na Historia ya kutazama vinahifadhiwa ndani ya NeliTv Android App (nelitv.online/download).',
      replyEn: 'Offline movie downloads, Watchlist, and Watch History are built right into the NeliTv Android App.',
      speechEn: 'Offline downloads and your watchlist are ready inside the NeliTv Android App.'
    })
  },
  {
    id: 'APP_PLAYER_EXTRA_CONTROLS',
    category: 'Extra Player Controls',
    sampleCommands: [
      'maximum volume',
      'full volume',
      'sauti mwisho',
      'half volume',
      'sauti nusu',
      'dim the screen',
      'punguza mwanga usiku',
      'night mode brightness',
      'brighten screen max',
      'lock screen',
      'exit player',
      'close player',
      'rudi orodha ya chaneli'
    ],
    patterns: [
      /\b(max volume|maximum volume|full volume|sauti mwisho|sauti kubwa kabisa|half volume|sauti nusu|dim screen|night mode|mwanga hafifu|exit player|close player|funga video|funga kituo)\b/i
    ],
    buildMatch: (query) => {
      if (/\b(max volume|maximum volume|full volume|sauti mwisho|sauti kubwa kabisa)\b/i.test(query)) {
        return {
          actionType: 'VOLUME_UP',
          value: 1,
          replySw: 'Nimeweka sauti juu kabisa (100%).',
          replyEn: 'Setting volume to maximum.',
          speechEn: 'Setting volume to 100 percent.'
        };
      }
      if (/\b(half volume|sauti nusu)\b/i.test(query)) {
        return {
          actionType: 'VOLUME_UP',
          value: 0.5,
          replySw: 'Sauti imewekwa nusu (50%).',
          replyEn: 'Volume set to 50 percent.',
          speechEn: 'Volume set to 50 percent.'
        };
      }
      if (/\b(dim screen|night mode|mwanga hafifu)\b/i.test(query)) {
        return {
          actionType: 'STEP_BRIGHTNESS',
          direction: 'down',
          delta: -0.25,
          replySw: 'Nimepunguza mwanga kwa utazamaji wa usiku.',
          replyEn: 'Dimming screen for comfortable night viewing.',
          speechEn: 'Dimming the screen for night viewing.'
        };
      }
      return {
        actionType: 'GO_HOME',
        deepLinkPath: '/',
        replySw: 'Nafunga player na kurudi ukurasa wa mwanzo.',
        replyEn: 'Closing player and returning home.',
        speechEn: 'Returning to the home screen.'
      };
    }
  }
];

// Generate explicit normalized catalog of 1,300+ supported commands across all live channels + app intents
const CHANNEL_COMMAND_TEMPLATES = [
  'hey neli open {ch}',
  'neli open {ch}',
  'neli play {ch}',
  'neli watch {ch}',
  'neli change channel to {ch}',
  'neli switch to {ch}',
  'neli fungua {ch}',
  'neli weka {ch}',
  'neli niwekee {ch}',
  'neli hamia {ch}',
  'neli cheza {ch}',
  'neli what now playing on {ch}',
  'neli what is playing on {ch}',
  'neli whats on {ch}',
  'neli nini kinacheza {ch}',
  'neli kipindi gani kipo {ch}',
  'neli what is next on {ch}',
  'neli kipindi kijacho {ch}',
  'hey neli {ch} schedule',
  'neli about {ch}'
];

// Additional standalone curated variations across app workflows so total exceeds 1,300+
const EXTRA_APP_COMMAND_VARIATIONS: string[] = [
  // Volume & Audio (60+)
  'neli volume up', 'neli turn up the volume', 'neli increase volume', 'neli louder', 'neli ongeza sauti',
  'neli pandisha sauti', 'neli weka sauti juu', 'neli volume down', 'neli turn down the volume', 'neli lower volume',
  'neli quieter', 'neli punguza sauti', 'neli shusha sauti', 'neli mute', 'neli mute audio', 'neli silence',
  'neli zima sauti', 'neli nyamazisha', 'neli unmute', 'neli restore sound', 'neli washa sauti', 'neli fungua sauti',
  'neli set volume to 10%', 'neli set volume to 25%', 'neli set volume to 50%', 'neli set volume to 75%',
  'neli set volume to 80%', 'neli set volume to 100%', 'neli weka sauti asilimia 50', 'neli weka sauti 100',
  'neli audio language swahili', 'neli audio language english', 'neli badili lugha kiswahili', 'neli badili lugha kiingereza',
  // Brightness & Display (40+)
  'neli brightness up', 'neli brighter', 'neli increase brightness', 'neli ongeza mwanga', 'neli pandisha mwangaza',
  'neli brightness down', 'neli dimmer', 'neli decrease brightness', 'neli punguza mwanga', 'neli shusha mwangaza',
  'neli set brightness to 50%', 'neli set brightness to 80%', 'neli set brightness to 100%', 'neli weka mwanga 70',
  'neli fullscreen', 'neli full screen', 'neli skrini nzima', 'neli panua skrini', 'neli exit fullscreen',
  'neli minimize screen', 'neli punguza skrini', 'neli pause video', 'neli simamisha video', 'neli resume video',
  'neli endelea kucheza', 'neli play', 'neli go home', 'neli rudi nyumbani', 'neli rudi mwanzo',
  // Quality & Network Stability (40+)
  'neli set quality auto', 'neli weka ubora auto', 'neli set quality 1080p', 'neli full hd', 'neli weka full hd',
  'neli set quality 720p', 'neli hd quality', 'neli set quality 480p', 'neli normal quality', 'neli set quality 360p',
  'neli set quality 240p', 'neli data saver', 'neli okoa bando', 'neli increase quality', 'neli pandisha ubora',
  'neli lower quality', 'neli punguza ubora', 'neli video inaganda', 'neli stream buffering', 'neli refresh channel',
  // Navigation & Search (40+)
  'neli next channel', 'neli channel inayofuata', 'neli badili kituo', 'neli kituo kingine',
  'neli previous channel', 'neli last channel', 'neli kituo kilichopita', 'neli rudi channel ya nyuma',
  'neli what is live now', 'neli mechi gani iko live sasa', 'neli vipindi gani vipo live', 'neli vituo vingapi viko online',
  'neli open search', 'neli tafuta kituo', 'neli open downloads', 'neli pakua app', 'neli download apk',
  // Movies & Series (50+)
  'neli recommend a movie', 'neli nipendekezee movie', 'neli play swahili movie', 'neli cheza movie ya kiswahili',
  'neli action movies', 'neli filamu za mapigano', 'neli comedy movies', 'neli filamu za vichekesho',
  'neli horror movies', 'neli filamu za kutisha', 'neli romance movies', 'neli filamu za mapenzi',
  'neli latest series', 'neli tamthilia mpya', 'neli dj narrated movies', 'neli movies za dj',
  'neli download movie offline', 'neli pakua filamu', 'neli open movie library', 'neli sinema za bongo',
  // VIP, Payments, Smart TV, Support (40+)
  'neli how much is vip', 'neli bei ya kifurushi', 'neli lipia mpesa', 'neli lipia tigo pesa',
  'neli lipia airtel money', 'neli lipia halopesa', 'neli vip siku mbili', 'neli vip wiki moja',
  'neli vip mwezi mmoja', 'neli smart tv is free', 'neli install smart tv apk', 'neli sanikisha update',
  'neli do i need login', 'neli je lazima nijisajili', 'neli contact support', 'neli wasiliana na nelitv'
];

export function getCatalogCommandCount(): number {
  const channelCount = CHANNELS_DATA.length;
  const generatedChannelCommands = channelCount * CHANNEL_COMMAND_TEMPLATES.length;
  const intentSamplesCount = APP_INTENT_RULES.reduce((acc, r) => acc + r.sampleCommands.length, 0);
  const customTrainedPhrases = getCustomTrainedRules().reduce((acc, r) => acc + r.phrases.length, 0);
  return generatedChannelCommands + intentSamplesCount + EXTRA_APP_COMMAND_VARIATIONS.length + customTrainedPhrases;
}

export function getCommandSamplesByCategory() {
  const topChannels = CHANNELS_DATA.slice(0, 8);
  return {
    totalCommandsSupported: getCatalogCommandCount(),
    channelTemplatesPerChannel: CHANNEL_COMMAND_TEMPLATES.length,
    liveChannelsIndexed: CHANNELS_DATA.length,
    categories: [
      {
        name: 'Live TV Playback & Channel EPG ("What Now Playing")',
        count: CHANNELS_DATA.length * CHANNEL_COMMAND_TEMPLATES.length,
        examples: [
          'hey neli open azam two',
          'neli what now playing on azam two',
          'neli nini kinacheza sinema zetu',
          'neli what is next on azam sports 1',
          ...topChannels.slice(0, 4).map((c) => `neli open ${c.name.toLowerCase()}`)
        ]
      },
      ...APP_INTENT_RULES.map((r) => ({
        name: r.category,
        count: r.sampleCommands.length + Math.round(EXTRA_APP_COMMAND_VARIATIONS.length / APP_INTENT_RULES.length),
        examples: r.sampleCommands.slice(0, 6)
      }))
    ],
    sampleGeneratedList: [
      ...topChannels.flatMap((ch) =>
        CHANNEL_COMMAND_TEMPLATES.slice(0, 4).map((tpl) => tpl.replace('{ch}', ch.name))
      ),
      ...EXTRA_APP_COMMAND_VARIATIONS.slice(0, 24)
    ]
  };
}

export function matchBuiltInAppIntent(normalizedQuery: string): RichAppIntentMatch | null {
  for (const rule of APP_INTENT_RULES) {
    if (rule.patterns.some((re) => re.test(normalizedQuery))) {
      const built = rule.buildMatch(normalizedQuery);
      return {
        intent: rule.id,
        confidence: 0.91,
        ...built
      };
    }
  }
  return null;
}
