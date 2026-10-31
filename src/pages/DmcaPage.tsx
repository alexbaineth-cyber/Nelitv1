import React from 'react';
import { ShieldAlert, Mail, AlertTriangle, CheckCircle, ArrowLeft, ExternalLink } from 'lucide-react';

interface DmcaPageProps {
  onBack?: () => void;
}

export const DmcaPage: React.FC<DmcaPageProps> = ({ onBack }) => {
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
                <ShieldAlert className="w-6 h-6 text-pink-500" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Sera ya DMCA & Hakimiliki (Copyright Disclaimer)
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Digital Millennium Copyright Act Notice & Takedown Policy · NeliTv
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-pink-950 text-pink-400 border border-pink-800/60 uppercase">
            DMCA Compliant
          </span>
        </div>

        {/* Notice Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Tamko la Hakimiliki na Umiliki wa Maudhui
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                NeliTv inaheshimu haki miliki za wamiliki wa maudhui wote. Tovuti yetu inafanya kazi kama indexer na mwelekezi wa mawimbi ya mitiririko (streams) inayopatikana mtandaoni hadharani kutoka kwa vyanzo mbalimbali vya wahusika wengine (third-party CDNs). NeliTv haipangishi au kuhifadhi video zenye hakimiliki kwenye seva zetu moja kwa moja.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-neutral-300">
          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              1. Digital Millennium Copyright Act (Title 17, U.S.C. Section 512)
            </h3>
            <p>
              Ni sera ya NeliTv kujibu mara moja arifa zote sahihi za ukiukwaji wa hakimiliki kwa mujibu wa sheria ya Digital Millennium Copyright Act ("DMCA"). Ikiwa wewe ni mmiliki wa hakimiliki au mwakilishi aliyeidhinishwa kisheria, na unaamini kwamba maudhui au kiungo chochote kinachopatikana kwenye huduma yetu kinakiuka haki miliki yako, tafadhali wasilisha ombi la kuondolewa (Takedown Notice).
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              2. Taarifa Zinazohitajika Katika Arifa ya DMCA (Takedown Notice)
            </h3>
            <p>Ili arifa yako ifanyiwe kazi haraka (ndani ya masaa 24), tafadhali jumuisha maelezo yafuatayo:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-neutral-300">
              <li>Sahihi ya kielektroniki au kimwili ya mtu aliyeidhinishwa kutenda kwa niaba ya mmiliki wa hakimiliki.</li>
              <li>Maelezo kamili ya kazi au kituo chenye hakimiliki unachodai kimekiukwa.</li>
              <li>Anwani kamili ya URL (kiungo maalum) au jina la kituo kwenye tovuti ya NeliTv.</li>
              <li>Anwani yako ya makazi, namba ya simu, na anwani halali ya barua pepe.</li>
              <li>Taarifa kwamba una imani njema kuwa matumizi ya nyenzo yanayolalamikiwa hayajaidhinishwa na mwenye hakimiliki, wakala wake, au sheria.</li>
              <li>Taarifa iliyo chini ya adhabu ya kutoa ushahidi wa uongo kuwa taarifa zilizo kwenye arifa yako ni sahihi.</li>
            </ul>
          </section>

          <section className="space-y-3 p-5 rounded-2xl bg-neutral-900/80 border border-cyan-900/40">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" />
              Wasiliana na Afisa wa Hakimiliki (Designated DMCA Agent)
            </h3>
            <p className="text-neutral-300">
              Tafadhali tuma arifa zote za kisheria na maombi ya DMCA kwa anwani yetu ya barua pepe iliyotengwa:
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <a
                href="mailto:alexbaineth@gmail.com?subject=DMCA%20Notice%20-%20NeliTv"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
              >
                <Mail className="w-4 h-4" />
                <span>Tuma Barua Pepe ya DMCA (alexbaineth@gmail.com)</span>
              </a>
            </div>
            <p className="text-[11px] text-neutral-400 pt-1">
              Tutakagua na kuzuia upatikanaji wa maudhui yaliyolalamikiwa ndani ya masaa 24 - 48 kulingana na miongozo ya DMCA.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              3. Kanuni ya Wakiukaji Sugu (Repeat Infringers Policy)
            </h3>
            <p>
              Kwa mujibu wa DMCA na sheria zingine zinazohusika, NeliTv inatekeleza sera ya kusitisha mara moja akaunti, viungo au ufikiaji wa watumiaji au vyanzo vinavyothibitika kukiuka haki miliki mara kwa mara.
            </p>
          </section>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-neutral-800 text-center text-xs text-neutral-500">
          NeliTv Compliance Team · Ilisasishwa: Oktoba 2026
        </div>
      </div>
    </div>
  );
};

export default DmcaPage;
