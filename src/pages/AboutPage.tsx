import React from 'react';
import { Tv, Sparkles, Zap, ShieldCheck, Heart, Users, Globe, ArrowLeft, Trophy } from 'lucide-react';

interface AboutPageProps {
  onBack?: () => void;
  onNavigateHome?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onBack, onNavigateHome }) => {
  return (
    <div className="min-h-screen bg-[#070A0F] text-neutral-200 py-8 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-6 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer"
                aria-label="Rudi Nyuma"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Tv className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Kuhusu NeliTv (About Us)
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Jukwaa Kiongozi la Moja kwa Moja la Televisheni na Michezo Tanzania
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
            Official
          </span>
        </div>

        {/* Hero Section */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-[#0c1322] border border-white/10 shadow-xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Burudani Isiyo na Kikomo</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug">
            Tazama Vituo Unavyovipenda popote ulipo kwa Ubora wa Juu (HD & 4K)
          </h2>
          <p className="text-sm sm:text-base text-neutral-300 leading-relaxed">
            <strong>NeliTv</strong> ni jukwaa la kidijitali lililobuniwa kuleta matangazo ya moja kwa moja ya televisheni (Live TV), mechi za soka la ndani na kimataifa (NBC Premier League, CAF, EPL, UEFA), habari, sinema na vipindi vya burudani kwa watazamaji wote nchini Tanzania na kote ulimwenguni.
          </p>
        </div>

        {/* Core Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Michezo ya Moja kwa Moja</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Matangazo ya moja kwa moja ya mechi zote za ligi kuu ya NBC Tanzania, mashindano ya Kombe la Shirikisho la Azam (ASFC), na mechi za kimataifa bila kukatika.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Kasi ya Juu & Utulivu</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Teknolojia ya kisasa ya uwasilishaji wa video ya Adaptive Bitrate Streaming (HLS & MPEG-DASH) inayojirekebisha kiotomatiki kulingana na kasi ya bando yako.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Ufikiaji wa Vifaa Vyote</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Inafanya kazi bila matatizo kwenye Simu za mkononi za Android na iOS, Smart TV zenye mfumo wa Android TV au Web Browser, Kompyuta za PC na Tablets.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Usalama & Uthabiti</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Uunganishaji salama kupitia njia za kisasa zilizosimbwa, malipo ya haraka kupitia simu za mkononi kwa USSD Push (M-Pesa, Tigo Pesa, Airtel Money, Halopesa).
            </p>
          </div>
        </div>

        {/* Mission & Vision */}
        <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-4 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            Lengo Letu (Our Mission)
          </h3>
          <p>
            Dhamira yetu kuu ni kuondoa vizuizi vya gharama kubwa na ugumu wa kupata taarifa na michezo kwa mashabiki wote wa Kitanzania na Afrika Mashariki. Tunaamini kila mtu ana haki ya kufurahia michezo na habari muhimu kwa urahisi popote anapokuwa.
          </p>
          <p>
            Tunajitahidi kuboresha miundombinu yetu kila siku ili kutoa huduma bora, yenye matumizi kidogo ya bando na uzoefu wa kirafiki wa mtumiaji.
          </p>
        </div>

        {/* Contact info bar */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-white text-sm">Je, una swali, maoni au pendekezo?</h4>
            <p className="text-xs text-neutral-400">Timu yetu ya usaidizi ipo tayari kukuhudumia saa 24/7.</p>
          </div>
          <a
            href="mailto:alexbaineth@gmail.com"
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
          >
            Wasiliana Nasi
          </a>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-neutral-800 text-center text-xs text-neutral-500">
          NeliTv Inc. · Haki zote zimehifadhiwa · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
