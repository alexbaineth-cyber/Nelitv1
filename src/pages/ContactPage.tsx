import React, { useState } from 'react';
import { Mail, Phone, MessageSquare, Send, CheckCircle2, ArrowLeft, Clock, MapPin } from 'lucide-react';

interface ContactPageProps {
  onBack?: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onBack }) => {
  const [name, setName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSent(true);
    setTimeout(() => {
      setName('');
      setEmailOrPhone('');
      setMessage('');
      setIsSent(false);
    }, 4000);
  };

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
                <Mail className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Wasiliana Nasi (Contact Us)
                </h1>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Tupo hapa kukusaidia na maswali, msaada wa akaunti au maoni
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
            Support 24/7
          </span>
        </div>

        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Barua Pepe (Email)</h3>
            <p className="text-xs text-neutral-400">Kwa masuala yote na usaidizi wa kiufundi:</p>
            <a
              href="mailto:alexbaineth@gmail.com"
              className="text-xs font-semibold text-cyan-400 hover:underline block break-all pt-1"
            >
              alexbaineth@gmail.com
            </a>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Masaa ya Kazi</h3>
            <p className="text-xs text-neutral-400">Timu yetu inafanya kazi:</p>
            <p className="text-xs font-semibold text-emerald-400 pt-1">
              Jumatatu – Jumapili: Masaa 24/7
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-sm">Eneo & Nchi</h3>
            <p className="text-xs text-neutral-400">Makao makuu ya kidijitali:</p>
            <p className="text-xs font-semibold text-pink-400 pt-1">
              Dar es Salaam, Tanzania
            </p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900/40 border border-neutral-800 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              <span>Tutumie Ujumbe Moja kwa Moja</span>
            </h2>
            <p className="text-xs text-neutral-400">
              Jaza fomu hii fupi na afisa msaidizi atakujibu haraka iwezekanavyo.
            </p>
          </div>

          {isSent ? (
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-bold text-sm">Ujumbe wako umepokelewa!</p>
                <p className="text-xs text-emerald-400/80">Ahsante kwa kuwasiliana na NeliTv, tutakujibu hivi punde.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Jina Lako (Hiari)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mfano: Juma Ally"
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs sm:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Barua Pepe au Namba ya Simu</label>
                  <input
                    type="text"
                    required
                    value={emailOrPhone}
                    onChange={(e) => setEmailOrPhone(e.target.value)}
                    placeholder="0712345678 au jina@gmail.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Ujumbe au Swali Lako</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Andika ujumbe wako hapa..."
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-cyan-500 focus:outline-none text-white text-xs sm:text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Tuma Ujumbe Sasa</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-neutral-800 text-center text-xs text-neutral-500">
          NeliTv Customer Support Team · Barua pepe: alexbaineth@gmail.com
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
