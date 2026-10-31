import React from 'react';
import { FileText, CheckCircle2, AlertCircle, ArrowLeft, Shield } from 'lucide-react';

interface TermsPageProps {
  onBack?: () => void;
}

export const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
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
                <FileText className="w-6 h-6 text-amber-400" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Masharti na Vigezo vya Huduma (Terms of Service)
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Kanuni za matumizi ya huduma na tovuti ya NeliTv · Ilisasishwa Oktoba 2026
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-amber-950 text-amber-400 border border-amber-800/60 uppercase">
            Legal Terms
          </span>
        </div>

        {/* Introduction */}
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <h2 className="font-bold text-white text-base">1. Kukubaliana na Masharti</h2>
          <p>
            Kwa kufungua, kutembelea au kutumia tovuti na programu ya <strong>NeliTv</strong>, unakubali kufungwa na Masharti haya na Vigezo vya Huduma. Ikiwa hukubaliani na sehemu yoyote ya masharti haya, unaombwa kutosherehekea au kutotumia huduma zetu.
          </p>
        </div>

        {/* Key Terms */}
        <div className="space-y-6 text-xs sm:text-sm leading-relaxed text-neutral-300">
          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              2. Matumizi ya Huduma na Wajibu wa Mtumiaji
            </h3>
            <p>
              Huduma za NeliTv zinatolewa kwa matumizi binafsi yasiyo ya kibiashara. Huruhusiwi:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-neutral-300">
              <li>Kunakili, kusambaza upya (re-broadcast), au kuuza viungo vya mitiririko (stream URLs).</li>
              <li>Kujaribu kuvunja au kuhujumu mifumo yetu ya ulinzi (DRM / reverse engineering).</li>
              <li>Kutumia roboti au programu zinazozidisha mzigo usio wa kawaida kwenye seva zetu.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              3. Vifurushi na Malipo
            </h3>
            <p>
              Vifurushi vya NeliTv vinapatikana kwa vipindi mbalimbali (Kuanzia siku 2, wiki 1, hadi mwezi mzima) kupitia njia za malipo za simu za mkononi (HarakaPay / M-Pesa / Tigo Pesa / Airtel Money). Malipo yanapokamilika, ufikiaji unaanza mara moja. Malipo hayarudishwi mara baada ya muda wa kifurushi kuanza kutumika isipokuwa huduma ikishindwa kupatikana kabisa kwa sababu zilizo chini ya uwezo wetu.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              4. Upatikanaji wa Mitandao na Vituo
            </h3>
            <p>
              NeliTv inajitahidi kutoa upatikanaji wa vituo 99.9% ya muda wote. Hata hivyo, kutokana na asili ya mitandao ya intaneti, kasi ya watoa huduma wa mawasiliano (ISPs), au matengenezo ya mara kwa mara, baadhi ya vituo vinaweza kupata hitilafu fupi.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              5. Mabadiliko ya Masharti
            </h3>
            <p>
              Tuna haki ya kurekebisha au kuboresha masharti haya wakati wowote. Tutawajulisha watumiaji kuhusu mabadiliko makubwa kupitia tovuti yetu au ujumbe kwenye programu.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-neutral-800 text-center text-xs text-neutral-500">
          NeliTv Legal · Ilisasishwa: Oktoba 2026
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
