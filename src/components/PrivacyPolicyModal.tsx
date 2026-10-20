import React from 'react';
import { X, Shield, Lock, FileText, CheckCircle, Smartphone, Eye } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] bg-[#0c1017] border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-neutral-200"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-800/80 flex items-center justify-between bg-gradient-to-r from-neutral-900 to-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-pink-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <div className="w-full h-full rounded-[14px] bg-neutral-950 flex items-center justify-center">
                <Shield className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Sera ya Faragha (Privacy Policy)</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                  NeliTv
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Ilisasishwa: Oktoba 2026 • Inalinda taarifa na usalama wa watazamaji
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm leading-relaxed text-neutral-300">
          {/* Section 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <Lock className="w-4 h-4 text-pink-500" />
              <h3>1. Utangulizi & Ahadi ya Usalama</h3>
            </div>
            <p>
              Karibu kwenye <strong>NeliTv</strong> (inayopatikana kupitia tovuti yetu na programu ya Android APK). Tunatambua umuhimu wa faragha yako na tumejitolea kuhakikisha kuwa taarifa zote za watumiaji wetu zinalindwa kwa viwango vya juu vya usalama vya kimataifa (SSL/TLS Encryption).
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <h3>2. Taarifa Tunazokusanya</h3>
            </div>
            <p>
              Ili kukupatia huduma ya moja kwa moja ya matangazo ya runinga na vifurushi, tunakusanya taarifa chache zifuatazo:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
              <li>
                <strong className="text-neutral-200">Namba ya Simu:</strong> Inatumika pekee kuthibitisha malipo yako ya kifurushi kupitia USSD Push (M-Pesa, Tigo Pesa, Airtel Money, Halopesa) na kusawazisha (sync) kifurushi chako kwenye vifaa vyako vingine (Simu, Tablet, Smart TV, na Kompyuta).
              </li>
              <li>
                <strong className="text-neutral-200">Taarifa za Kifaa (Device Info):</strong> Aina ya kivinjari au mfumo wa uendeshaji (Android, Windows, Smart TV) kwa ajili ya kuboresha ubora wa video kulingana na kasi ya intaneti yako.
              </li>
              <li>
                <strong className="text-neutral-200">Muda wa Majaribio (Trial):</strong> Huwekwa kwenye kumbukumbu ya kifaa chako (localStorage) ili kuhakikisha mtumiaji anapata dakika ya majaribio ya bure kwa uadilifu.
              </li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <h3>3. Usalama wa Malipo (HarakaPay & Supabase)</h3>
            </div>
            <p>
              NeliTv <strong>HAINA</strong> na <strong>HAIHIFADHI</strong> namba za siri za kibenki, PIN za simu, wala kadi za benki. Malipo yote yanasindika moja kwa moja kwa njia salama kupitia lango rasmi la HarakaPay na mtandao wa simu husika. Taarifa za muda wa kifurushi zinasawazishwa kwa njia ya ulinzi thabiti wa Row Level Security (RLS) kwenye hifadhidata ya Supabase.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <Eye className="w-4 h-4 text-amber-400" />
              <h3>4. Haki za Mtumiaji na Kutoshiriki Taarifa</h3>
            </div>
            <p>
              Hatuuzi, hatukodishi, wala hatushiriki taarifa zako binafsi kwa makampuni ya matangazo au washirika wa tatu. Una haki ya kuomba taarifa zako zifutwe au kuboreshwa wakati wowote kwa kuwasiliana nasi.
            </p>
          </div>

          {/* Section 5 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-bold text-sm sm:text-base">
              <FileText className="w-4 h-4 text-purple-400" />
              <h3>5. Mawasiliano & Msaada</h3>
            </div>
            <p>
              Ikiwa una maswali yoyote kuhusu sera hii au msaada wa akaunti yako ya NeliTv, tafadhali wasiliana na kitengo chetu cha msaada:
            </p>
            <div className="p-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-mono text-xs">
              <div>Barua Pepe: support@nelitv.xyz</div>
              <div className="mt-1">Tovuti Rasmi: https://nelitv.xyz</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800/80 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-pink-600 to-cyan-600 hover:from-pink-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-pink-600/20 active:scale-95 transition"
          >
            Nimeelewa & Kubali
          </button>
        </div>
      </div>
    </div>
  );
};
