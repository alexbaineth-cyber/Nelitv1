import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  Key,
  Copy,
  Check,
  Volume2,
  Mic,
  Play,
  ShieldCheck,
  Terminal,
  Database,
  Radio,
  Sparkles,
  LogOut,
  CheckCircle2,
  Tv,
  Smartphone,
  Globe
} from 'lucide-react';
import {
  pickYouthFemaleEnglishVoice,
  speakAsYouthFemaleEnglish,
  NELI_YOUTH_FEMALE_VOICE_PROFILE
} from '../utils/neliVoiceTts.ts';

interface NeliAiCenterPageProps {
  onBack: () => void;
}

interface AiCenterConfig {
  apiKey: string;
  immutable: boolean;
  deletable: boolean;
  createdAt: string;
  stats: {
    onlineChannels: number;
    firebaseMovies: number;
    firebaseSeries: number;
    firebaseEpisodes: number;
    faqCount: number;
    lastFirebaseSyncAt: string | null;
  };
  endpoints: {
    baseUrl: string;
    command: string;
    commandLegacy: string;
    knowledge: string;
    movies: string;
  };
}

const PORTAL_TOKEN_STORAGE_KEY = 'nelitv_portal_token';

export const NeliAiCenterPage: React.FC<NeliAiCenterPageProps> = ({ onBack }) => {
  const [portalToken, setPortalToken] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  const [config, setConfig] = useState<AiCenterConfig | null>(null);
  const [showApiKey, setShowApiKey] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string>('');

  // Free 10-14 yr Female English Voice preview state
  const [detectedVoiceName, setDetectedVoiceName] = useState<string>('Checking device voices...');
  const [isSpeakingSample, setIsSpeakingSample] = useState<boolean>(false);

  // Live Sandbox Tester
  const [testAppId, setTestAppId] = useState<'nelitv-android' | 'nelitv-tv' | 'nelitv-web'>('nelitv-android');
  const [testInput, setTestInput] = useState<string>('neli change channel to sinma setu');
  const [testResponse, setTestResponse] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Documentation language tab
  const [docTab, setDocTab] = useState<'curl' | 'kotlin' | 'web' | 'python'>('kotlin');

  const fetchCenterConfig = async (token: string) => {
    try {
      const res = await fetch('/api/neli-ai-center/config', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Portal-Token': token
        }
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.success) {
        setConfig(data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let active = true;
    const initCheck = async () => {
      try {
        const saved = sessionStorage.getItem(PORTAL_TOKEN_STORAGE_KEY);
        if (!saved) {
          if (active) setIsChecking(false);
          return;
        }
        const ok = await fetchCenterConfig(saved);
        if (active) {
          if (ok) {
            setPortalToken(saved);
            setIsUnlocked(true);
          } else {
            sessionStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
          }
        }
      } finally {
        if (active) setIsChecking(false);
      }
    };
    void initCheck();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refreshVoice = () => {
      const v = pickYouthFemaleEnglishVoice();
      setDetectedVoiceName(v ? v.name : 'English Female (Pitch 1.28 Free TTS)');
    };
    refreshVoice();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = refreshVoice;
    }
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
    setIsUnlocking(true);
    setUnlockError(null);
    try {
      const res = await fetch('/api/portal/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      });
      const data = await res.json();
      if (res.ok && data?.unlocked && data?.portalToken) {
        try {
          sessionStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, data.portalToken);
        } catch {}
        setPortalToken(data.portalToken);
        await fetchCenterConfig(data.portalToken);
        setIsUnlocked(true);
        setPasswordInput('');
      } else {
        setUnlockError(data?.error || 'Nenosiri si sahihi. Jaribu tena.');
      }
    } catch {
      setUnlockError('Hitilafu ya mtandao. Jaribu tena.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLock = () => {
    try {
      sessionStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
    } catch {}
    setPortalToken('');
    setIsUnlocked(false);
    setConfig(null);
    setPasswordInput('');
  };

  const copyText = (id: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2200);
  };

  const handleSpeakSample = (text: string) => {
    speakAsYouthFemaleEnglish(text, {
      onStart: () => setIsSpeakingSample(true),
      onEnd: () => setIsSpeakingSample(false),
      onError: () => setIsSpeakingSample(false)
    });
  };

  const runSandboxTest = async (customQuery?: string, speakResult = true) => {
    const q = (customQuery ?? testInput).trim();
    if (!q) return;
    if (customQuery) setTestInput(customQuery);
    setIsTesting(true);
    try {
      const caps =
        testAppId === 'nelitv-tv'
          ? ['live_tv', 'movies', 'series', 'player_controls', 'tv_free_mode']
          : testAppId === 'nelitv-android'
          ? ['live_tv', 'movies', 'series', 'player_controls', 'vip_support']
          : ['live_tv', 'vip_support'];

      const res = await fetch('/v1/neli-ai/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config?.apiKey || '',
          'X-App-Id': testAppId
        },
        body: JSON.stringify({
          app_id: testAppId,
          platform: testAppId === 'nelitv-tv' ? 'android-tv' : testAppId === 'nelitv-android' ? 'android' : 'web',
          capabilities: caps,
          user_locale: 'auto',
          input_mode: 'voice',
          input_text: q
        })
      });
      const json = await res.json();
      setTestResponse(json);
      if (speakResult && (json?.speech_text_en || json?.speech_text)) {
        handleSpeakSample(json.speech_text_en || json.speech_text);
      }
    } catch (err: any) {
      setTestResponse({ success: false, error: err?.message || 'Request failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const permanentKey = config?.apiKey || 'neli_ai_live_255_tanzania_center_key_01';
  const commandUrl = config?.endpoints.command || 'https://nelitv.online/v1/neli-ai/command';
  const knowledgeUrl = config?.endpoints.knowledge || 'https://nelitv.online/v1/neli-ai/knowledge';
  const moviesUrl = config?.endpoints.movies || 'https://nelitv.online/v1/neli-ai/movies';

  const codeSnippets: Record<'curl' | 'kotlin' | 'web' | 'python', string> = {
    curl: `curl -X POST "${commandUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${permanentKey}" \\
  -d '{
    "app_id": "nelitv-android",
    "platform": "android",
    "capabilities": ["live_tv", "movies", "series", "player_controls", "vip_support"],
    "user_locale": "auto",
    "input_mode": "voice",
    "input_text": "Neli, weka Azam Sports 1"
  }'`,
    kotlin: `// Android & Smart TV (Free 10-14 yr Female English Voice + Neli AI Brain)
val tts = TextToSpeech(context) { status ->
  if (status == TextToSpeech.SUCCESS) {
    tts.language = Locale.US
    tts.setPitch(1.28f)      // Sweet 10-14 yr female tone (100% Free)
    tts.setSpeechRate(1.04f) // Natural pacing
  }
}

// Send Voice Command to Neli AI Center
val body = JSONObject().apply {
  put("app_id", if (isSmartTv) "nelitv-tv" else "nelitv-android")
  put("platform", if (isSmartTv) "android-tv" else "android")
  put("capabilities", JSONArray(listOf("live_tv", "movies", "series", "player_controls")))
  put("input_mode", "voice")
  put("input_text", spokenText)
}
// Headers: "X-API-Key": "${permanentKey}"
// POST -> ${commandUrl}
// On Response:
// 1. tts.speak(res.optString("speech_text_en"), TextToSpeech.QUEUE_FLUSH, null, "neli")
// 2. Execute res.action.type -> PLAY_CHANNEL / OPEN_MOVIE / VOLUME_UP / NEXT_CHANNEL`,
    web: `const response = await fetch("${commandUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${permanentKey}"
  },
  body: JSON.stringify({
    app_id: "nelitv-web",
    platform: "web",
    capabilities: ["live_tv", "movies", "series", "player_controls", "vip_support"],
    input_mode: "voice",
    input_text: "neli change channel to sinma setu"
  })
});
const data = await response.json();
// Speak with free 10-14yr Female English voice (pitch 1.28, rate 1.04)
const utter = new SpeechSynthesisUtterance(data.speech_text_en);
utter.lang = "en-US";
utter.pitch = 1.28;
utter.rate = 1.04;
window.speechSynthesis.speak(utter);`,
    python: `import requests

resp = requests.post(
    "${commandUrl}",
    headers={"X-API-Key": "${permanentKey}"},
    json={
        "app_id": "neli-company",
        "platform": "web",
        "capabilities": ["live_tv", "movies", "series", "player_controls"],
        "input_mode": "voice",
        "input_text": "neli play neva a thif"
    },
    timeout=10
)
data = resp.json()
print("Action:", data["action"]["type"], data["action"]["target_name"])
print("Girl Voice EN:", data["speech_text_en"])`
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center text-slate-300 text-sm">
        Inahakiki ufikiaji wa Neli AI Center...
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-[#111622] border border-white/10 p-6 sm:p-8 shadow-2xl">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Rudi Nyumbani
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-[#1ce783]/15 border border-[#1ce783]/30 flex items-center justify-center text-[#1ce783]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white">NeliTv AI Data Center</h1>
              <p className="text-xs text-slate-400">Eneo Lililolindwa · /neli-ai</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Ingiza nenosiri lako la portal kufikia API ya kudumu ya Neli AI, mipangilio ya sauti ya kike (10–14 yrs), na muongozo kamili wa kuunganisha.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Weka nenosiri..."
                autoFocus
                className="w-full px-4 py-3 pr-11 rounded-xl bg-[#0b0e14] border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1ce783]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {unlockError && (
              <p className="text-xs text-rose-400 font-medium">{unlockError}</p>
            )}

            <button
              type="submit"
              disabled={isUnlocking || !passwordInput}
              className="w-full py-3 rounded-xl bg-[#1ce783] hover:bg-[#19cf75] disabled:opacity-50 text-[#04120b] font-bold text-sm transition cursor-pointer"
            >
              {isUnlocking ? 'Inafungua...' : 'Fungua Neli AI Center'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
              aria-label="Rudi"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  NeliTv <span className="text-[#1ce783]">AI Data Center</span>
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-[#1ce783]/15 border border-[#1ce783]/30 text-[10px] font-bold text-[#1ce783] uppercase">
                  Zero Paid LLM · Free TTS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                API ya Kudumu Isiyofutika · Sauti ya Kike ya Kiingereza (10–14 yrs) · Utambuzi wa Miss-Spell
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLock}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Funga Center
          </button>
        </div>

        {/* Live Data Knowledge Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#121722] border border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Tv className="w-4 h-4 text-[#1ce783]" />
              Live TV Channels
            </div>
            <div className="text-2xl font-extrabold text-white">{config?.stats.onlineChannels ?? 53}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Healthy EPG &amp; Streams</div>
          </div>

          <div className="rounded-xl bg-[#121722] border border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Database className="w-4 h-4 text-[#1ce783]" />
              Firebase Movies
            </div>
            <div className="text-2xl font-extrabold text-white">{config?.stats.firebaseMovies ?? 133}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              +{config?.stats.firebaseSeries ?? 2} Series · 15m Sync
            </div>
          </div>

          <div className="rounded-xl bg-[#121722] border border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Volume2 className="w-4 h-4 text-[#1ce783]" />
              Free Voice Profile
            </div>
            <div className="text-base font-extrabold text-white">Girl 10–14 yrs</div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">English · Pitch 1.28</div>
          </div>

          <div className="rounded-xl bg-[#121722] border border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#1ce783]" />
              API Status
            </div>
            <div className="text-base font-extrabold text-[#1ce783]">Immutable &amp; Active</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Never Resets / Undeleted</div>
          </div>
        </div>

        {/* Ready-to-Use Permanent API Key & Endpoints */}
        <section className="rounded-2xl bg-[#121722] border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-[#1ce783]" />
              <div>
                <h2 className="text-base font-bold text-white">Ready-to-Use Permanent API Key</h2>
                <p className="text-xs text-slate-400">
                  Ufunguo huu umeunganishwa moja kwa moja kwenye seva na haubadiliki wala kufutwa.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Unchanged &amp; Permanent
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-[#0b0e14] border border-white/15 font-mono text-xs sm:text-sm text-[#1ce783] flex items-center justify-between gap-2 overflow-x-auto">
              <span>{showApiKey ? permanentKey : '•'.repeat(permanentKey.length)}</span>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
                title={showApiKey ? 'Ficha' : 'Onyesha'}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyText('apikey', permanentKey)}
              className="px-4 py-3 rounded-xl bg-[#1ce783] hover:bg-[#19cf75] text-[#04120b] font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedId === 'apikey' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedId === 'apikey' ? 'Imenakiliwa!' : 'Copy API Key'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            {[
              { id: 'cmd', label: 'Voice / Text Command (POST)', url: commandUrl },
              { id: 'know', label: 'Knowledge Sync (GET)', url: knowledgeUrl },
              { id: 'mov', label: 'Firebase Movies API (GET)', url: moviesUrl }
            ].map((ep) => (
              <div
                key={ep.id}
                className="rounded-xl bg-[#0b0e14] border border-white/10 p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-400">{ep.label}</div>
                  <div className="text-xs font-mono text-slate-200 truncate mt-0.5">{ep.url}</div>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(ep.id, ep.url)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white shrink-0 cursor-pointer"
                >
                  {copiedId === ep.id ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Free 10-14 yr Female English Voice Studio */}
        <section className="rounded-2xl bg-[#121722] border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Radio className="w-5 h-5 text-[#1ce783]" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Free Voice Engine: English Female (10–14 Years Old)
                </h2>
                <p className="text-xs text-slate-400">
                  Sauti Active Kwenye Kifaa: <span className="text-white font-semibold">{detectedVoiceName}</span> · Pitch{' '}
                  {NELI_YOUTH_FEMALE_VOICE_PROFILE.pitch} · Rate {NELI_YOUTH_FEMALE_VOICE_PROFILE.rate}
                </p>
              </div>
            </div>
            {isSpeakingSample && (
              <span className="px-2.5 py-1 rounded-full bg-[#1ce783]/20 text-[#1ce783] text-xs font-bold animate-pulse">
                Inazungumza...
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() =>
                handleSpeakSample(
                  'Hi there! I am Neli, your free voice assistant on NeliTv. Tell me any channel or movie you want to watch!'
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1ce783]/15 hover:bg-[#1ce783]/25 border border-[#1ce783]/40 text-xs font-bold text-[#1ce783] transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Test Greeting Voice (10–14yr Girl EN)
            </button>

            <button
              type="button"
              onClick={() =>
                handleSpeakSample('I found closest channel Sinema Zetu, playing it for you right now.')
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#1ce783]" />
              Test Fuzzy Match Reply
            </button>
          </div>
        </section>

        {/* Live AI & Misspelling Sandbox Tester */}
        <section className="rounded-2xl bg-[#121722] border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-[#1ce783]" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Live Neli AI Tester (Misspelling &amp; Related Auto-Play)
                </h2>
                <p className="text-xs text-slate-400">
                  Jaribu maneno yaliyoandikwa/kusikika vibaya uone jinsi Neli anavyopata kituo au movie inayofanana na kucheza moja kwa moja.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-[#0b0e14] p-1 rounded-xl border border-white/10">
              {([
                { id: 'nelitv-android', label: 'Android', icon: Smartphone },
                { id: 'nelitv-tv', label: 'Smart TV', icon: Tv },
                { id: 'nelitv-web', label: 'Web', icon: Globe }
              ] as const).map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTestAppId(p.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      testAppId === p.id
                        ? 'bg-[#1ce783] text-[#04120b]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSandboxTest();
              }}
              placeholder="Andika amri au neno lililokosewa (mfano: neli change channel to sinma setu)"
              className="flex-1 px-4 py-3 rounded-xl bg-[#0b0e14] border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#1ce783]"
            />
            <button
              type="button"
              onClick={() => void runSandboxTest()}
              disabled={isTesting}
              className="px-5 py-3 rounded-xl bg-[#1ce783] hover:bg-[#19cf75] text-[#04120b] font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              {isTesting ? 'Inachakata...' : 'Test Command & Speak'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              'neli change channel to sinma setu',
              'neli asama tu',
              'neli play neva a thif',
              'neli prisna of wa',
              'Mechi gani iko live sasa?',
              'Nalipiaje VIP?'
            ].map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => void runSandboxTest(sample)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
              >
                “{sample}”
              </button>
            ))}
          </div>

          {testResponse && (
            <pre className="p-4 rounded-xl bg-[#070a10] border border-white/10 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-80">
              {JSON.stringify(testResponse, null, 2)}
            </pre>
          )}
        </section>

        {/* Integration Documentation */}
        <section className="rounded-2xl bg-[#121722] border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-5 h-5 text-[#1ce783]" />
              <div>
                <h2 className="text-base font-bold text-white">Documentation: Jinsi ya Kuunganisha Neli AI</h2>
                <p className="text-xs text-slate-400">
                  Nakili msimbo huu kuunganisha NeliTv Android APK, Smart TV (Leanback), Web App, au app mpya za Neli Company.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-xl border border-white/10">
              {(['kotlin', 'web', 'curl', 'python'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDocTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                    docTab === tab ? 'bg-[#1ce783] text-[#04120b]' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => copyText('doc', codeSnippets[docTab])}
              className="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
            >
              {copiedId === 'doc' ? <Check className="w-3.5 h-3.5 text-[#1ce783]" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === 'doc' ? 'Copied' : 'Copy Code'}
            </button>
            <pre className="p-4 pt-12 rounded-xl bg-[#070a10] border border-white/10 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed">
              {codeSnippets[docTab]}
            </pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs text-slate-300">
            <div className="p-4 rounded-xl bg-[#0b0e14] border border-white/10 space-y-1.5">
              <div className="font-bold text-white">Supported Executable Actions</div>
              <p className="text-slate-400 leading-relaxed font-mono text-[11px]">
                PLAY_CHANNEL · OPEN_MOVIE · OPEN_SERIES · NEXT_CHANNEL · PREV_CHANNEL · VOLUME_UP · VOLUME_DOWN · MUTE · PAUSE · RESUME · SET_BRIGHTNESS · SET_QUALITY · OPEN_PREMIUM · OPEN_APP_LINK
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#0b0e14] border border-white/10 space-y-1.5">
              <div className="font-bold text-white">Misspelling &amp; Voice Rules</div>
              <p className="text-slate-400 leading-relaxed">
                Mtumiaji akikosea kutamka (mfano <span className="text-white">"sinma setu"</span> au <span className="text-white">"neva a thif"</span>), AI inalinganisha kwa fonetiki kwenye vituo + filamu za Firebase na kucheza matokeo ya karibu moja kwa moja.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
