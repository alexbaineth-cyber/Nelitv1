import React, { useState, useEffect, useRef } from 'react';
import { Channel, CHANNELS_DATA } from '../data/channels.ts';
import {
  Play, Info, Tv, Check, ChevronLeft, ChevronRight, ArrowRight,
  Flame, Sparkles, Trophy, Film, Radio, Newspaper, Baby, Globe
} from 'lucide-react';
import { AdBanner } from '../components/AdBanner';
import { InMobiAdSlot } from '../components/InMobiAdSlot.tsx';
import { getChannelRouteSlug } from '../utils/channelRoute.ts';

interface HomePageProps {
  channels?: Channel[];
  onSelectChannel: (channel: Channel) => void;
  onNavigateToPremium: () => void;
}

const HERO_SLIDES_COUNT = 4;

/** Highlights the final word in warm gold-amber matching the streaming poster style */
function renderTwoToneTitle(title: string) {
  const parts = title.trim().split(/\s+/);
  if (parts.length <= 1) {
    return <span className="text-white">{title}</span>;
  }
  const lead = parts.slice(0, -1).join(' ');
  const tail = parts[parts.length - 1];
  return (
    <>
      <span className="text-white">{lead} </span>
      <span className="text-amber-400">{tail}</span>
    </>
  );
}

/** Picks a rich atmospheric neon radial/linear backdrop per channel category */
function getCardBackdropStyle(channel: Channel, idx: number): string {
  const cat = (channel.category || []).join(' ').toLowerCase();
  if (cat.includes('sport')) {
    return 'radial-gradient(circle at 80% 25%, rgba(0, 212, 255, 0.34), transparent 55%), radial-gradient(circle at 18% 80%, rgba(255, 30, 138, 0.28), transparent 55%), linear-gradient(145deg, #0b1636 0%, #070a1c 100%)';
  }
  if (cat.includes('movie') || channel.name.toLowerCase().includes('sinema')) {
    return 'radial-gradient(circle at 78% 20%, rgba(255, 157, 0, 0.32), transparent 55%), radial-gradient(circle at 18% 75%, rgba(255, 30, 138, 0.34), transparent 55%), linear-gradient(145deg, #1d0d2c 0%, #080917 100%)';
  }
  if (cat.includes('kids')) {
    return 'radial-gradient(circle at 75% 20%, rgba(56, 189, 248, 0.35), transparent 55%), radial-gradient(circle at 20% 78%, rgba(16, 185, 129, 0.28), transparent 55%), linear-gradient(145deg, #0c1f35 0%, #070b1a 100%)';
  }
  if (cat.includes('news')) {
    return 'radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.34), transparent 55%), radial-gradient(circle at 15% 80%, rgba(139, 92, 246, 0.3), transparent 55%), linear-gradient(145deg, #0c132d 0%, #060814 100%)';
  }
  return idx % 2 === 0
    ? 'radial-gradient(circle at 82% 22%, rgba(139, 92, 246, 0.35), transparent 55%), radial-gradient(circle at 15% 75%, rgba(255, 30, 138, 0.3), transparent 55%), linear-gradient(145deg, #170e33 0%, #070917 100%)'
    : 'radial-gradient(circle at 82% 22%, rgba(0, 212, 255, 0.3), transparent 55%), radial-gradient(circle at 15% 75%, rgba(255, 157, 0, 0.25), transparent 55%), linear-gradient(145deg, #0c1430 0%, #070815 100%)';
}

export const HomePage: React.FC<HomePageProps> = ({
  channels = CHANNELS_DATA,
  onSelectChannel,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [focusedChannelIndex, setFocusedChannelIndex] = useState<number>(-1);
  const [heroIndex, setHeroIndex] = useState<number>(0);

  // TV Quick Dial state: typing channel number (e.g. 1, 2, 10) + OK / Enter
  const [dialedNumber, setDialedNumber] = useState<string>('');
  const [dialedTargetChannel, setDialedTargetChannel] = useState<Channel | null>(null);
  const dialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allChannelsRef = useRef<HTMLDivElement>(null);

  // Categorize channels
  const sportsChannels = channels.filter(c => c.category.includes('sport'));
  const moviesChannels = channels.filter(c =>
    c.category.includes('movies') ||
    c.name.toLowerCase().includes('sinema') ||
    c.name.toLowerCase().includes('kix') ||
    c.name.toLowerCase().includes('movie') ||
    c.name.toLowerCase().includes('cinema') ||
    c.name.toLowerCase().includes('mbc')
  );
  const entertainmentChannels = channels.filter(c =>
    c.isAzam ||
    c.category.includes('entertainment') ||
    c.category.includes('tanzania') ||
    c.category.includes('music') ||
    c.name.toLowerCase().includes('comedy') ||
    c.name.toLowerCase().includes('trace')
  );
  const kidsChannels = channels.filter(c =>
    c.category.includes('kids') ||
    c.name.toLowerCase().includes('tom') ||
    c.name.toLowerCase().includes('pop') ||
    c.name.toLowerCase().includes('tiny') ||
    c.name.toLowerCase().includes('lego') ||
    c.name.toLowerCase().includes('bean')
  );
  const newsChannels = channels.filter(c =>
    c.category.includes('news') ||
    c.name.toLowerCase().includes('global') ||
    c.category.includes('religious') ||
    c.name.toLowerCase().includes('catholic')
  );
  const africaChannels = channels.filter(c =>
    c.category.includes('africa') ||
    c.category.includes('other') ||
    c.category.includes('documentary')
  );

  const genreCards = [
    {
      id: 'all',
      label: 'Vituo Vyote',
      count: channels.length,
      icon: Tv,
      gradient: 'from-violet-700/80 via-fuchsia-600/60 to-cyan-600/70',
      iconColor: 'text-cyan-300',
    },
    {
      id: 'sport',
      label: 'Michezo',
      count: sportsChannels.length,
      icon: Trophy,
      gradient: 'from-blue-700/80 via-cyan-600/60 to-indigo-800/80',
      iconColor: 'text-cyan-300',
    },
    {
      id: 'movies',
      label: 'Sinema',
      count: moviesChannels.length,
      icon: Film,
      gradient: 'from-rose-700/80 via-orange-600/60 to-amber-600/70',
      iconColor: 'text-amber-300',
    },
    {
      id: 'entertainment',
      label: 'Burudani',
      count: entertainmentChannels.length,
      icon: Sparkles,
      gradient: 'from-fuchsia-700/80 via-pink-600/60 to-purple-800/80',
      iconColor: 'text-pink-300',
    },
    {
      id: 'news',
      label: 'Habari',
      count: newsChannels.length,
      icon: Newspaper,
      gradient: 'from-sky-700/80 via-blue-700/60 to-slate-800/80',
      iconColor: 'text-sky-300',
    },
    {
      id: 'kids',
      label: 'Watoto',
      count: kidsChannels.length,
      icon: Baby,
      gradient: 'from-emerald-600/80 via-teal-600/60 to-sky-700/80',
      iconColor: 'text-emerald-300',
    },
    {
      id: 'africa',
      label: 'Afrika & Safari',
      count: africaChannels.length,
      icon: Globe,
      gradient: 'from-amber-600/80 via-rose-700/60 to-indigo-800/80',
      iconColor: 'text-amber-300',
    },
  ];

  const currentDisplayChannels =
    selectedCategory === 'all'
      ? channels
      : selectedCategory === 'sport'
      ? sportsChannels
      : selectedCategory === 'movies'
      ? moviesChannels
      : selectedCategory === 'entertainment'
      ? entertainmentChannels
      : selectedCategory === 'kids'
      ? kidsChannels
      : selectedCategory === 'news'
      ? newsChannels
      : africaChannels;

  const heroSlides = channels.slice(0, HERO_SLIDES_COUNT);
  const featuredChannel = heroSlides[heroIndex % Math.max(1, heroSlides.length)] || channels[0] || null;
  const trendingChannels = channels.slice(0, 5);

  const selectCategoryAndScroll = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setFocusedChannelIndex(-1);
    allChannelsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Auto-advance hero spotlight every 9 seconds cleanly
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const triggerChannelJump = (channel: Channel) => {
    if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
    setDialedNumber('');
    setDialedTargetChannel(null);
    onSelectChannel(channel);
  };

  // Keyboard, Smart TV Remote (0-9 Dialing, D-pad & OK/Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const nextDigits = (dialedNumber + e.key).slice(0, 3);
        setDialedNumber(nextDigits);

        const chNum = parseInt(nextDigits, 10);
        const match = channels[chNum - 1] || null;
        setDialedTargetChannel(match);

        if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
        dialTimerRef.current = setTimeout(() => {
          if (match) {
            triggerChannelJump(match);
          } else {
            setDialedNumber('');
            setDialedTargetChannel(null);
          }
        }, 2200);
        return;
      }

      if (e.key === 'Enter') {
        if (dialedNumber && dialedTargetChannel) {
          e.preventDefault();
          triggerChannelJump(dialedTargetChannel);
          return;
        }
        if (focusedChannelIndex >= 0 && focusedChannelIndex < currentDisplayChannels.length) {
          e.preventDefault();
          onSelectChannel(currentDisplayChannels[focusedChannelIndex]);
          return;
        }
      }

      if (e.key === 'Backspace' || e.key === 'Escape') {
        if (dialedNumber) {
          e.preventDefault();
          if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
          const sliced = dialedNumber.slice(0, -1);
          setDialedNumber(sliced);
          if (sliced) {
            const chNum = parseInt(sliced, 10);
            setDialedTargetChannel(channels[chNum - 1] || null);
          } else {
            setDialedTargetChannel(null);
          }
          return;
        }
      }

      const cols =
        window.innerWidth >= 1280 ? 5 : window.innerWidth >= 1024 ? 4 : window.innerWidth >= 640 ? 3 : 2;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = Math.min(currentDisplayChannels.length - 1, (prev < 0 ? 0 : prev) + 1);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = Math.max(0, prev - 1);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowDown') {
        if (focusedChannelIndex < 0) {
          e.preventDefault();
          setFocusedChannelIndex(0);
          scrollToChannelCard(0);
          return;
        }
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = Math.min(currentDisplayChannels.length - 1, prev + cols);
          scrollToChannelCard(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        if (focusedChannelIndex < cols) {
          setFocusedChannelIndex(-1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        e.preventDefault();
        setFocusedChannelIndex((prev) => {
          const next = prev - cols;
          if (next < 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return -1;
          }
          scrollToChannelCard(next);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (dialTimerRef.current) clearTimeout(dialTimerRef.current);
    };
  }, [dialedNumber, dialedTargetChannel, focusedChannelIndex, currentDisplayChannels, channels]);

  const scrollToChannelCard = (idx: number) => {
    try {
      const el = document.getElementById(`channel-card-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch {}
  };

  return (
    <div className="min-h-screen pb-28 sm:pb-20 text-neutral-100 touch-pan-y selection:bg-cyan-500 selection:text-black">
      {/* SMART TV CHANNEL NUMBER DIAL OSD */}
      {dialedNumber && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 animate-fade-in pointer-events-none">
          <div className="p-4 rounded-2xl neli-glass border-2 border-cyan-400/70 shadow-2xl shadow-cyan-500/30 flex items-center gap-3.5 text-white pointer-events-auto">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/60 p-1 flex items-center justify-center font-black font-mono text-2xl text-cyan-300 tabular-nums">
              {dialedNumber}
            </div>

            <div className="min-w-[150px]">
              <div className="text-[11px] text-cyan-300 font-semibold flex items-center gap-1">
                <Tv className="w-3.5 h-3.5" />
                <span>Nambari ya Kituo</span>
              </div>
              <div className="text-sm font-black text-white truncate max-w-[180px]">
                {dialedTargetChannel ? dialedTargetChannel.name : `Kituo #${dialedNumber} hakipatikani`}
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Bonyeza OK au subiri...
              </div>
            </div>

            {dialedTargetChannel && (
              <button
                onClick={() => triggerChannelJump(dialedTargetChannel)}
                className="py-2 px-3 rounded-full neli-gradient-bg text-white font-bold text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
              >
                <span>OK</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1. CINEMATIC NEON HERO SPOTLIGHT */}
      {featuredChannel && selectedCategory === 'all' && (
        <section className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-4 sm:pt-6">
          <div className="relative rounded-3xl overflow-hidden border border-purple-500/25 bg-[#070817] shadow-[0_24px_60px_rgba(0,0,0,0.65)] min-h-[300px] sm:min-h-[360px] flex items-center">
            {/* Atmospheric Neon Wave Backdrop matching mockups */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 12% 28%, rgba(255, 30, 138, 0.34), transparent 46%), radial-gradient(circle at 82% 45%, rgba(0, 212, 255, 0.28), transparent 48%), radial-gradient(circle at 52% 85%, rgba(124, 58, 237, 0.24), transparent 50%), linear-gradient(115deg, #070816 0%, #100b26 55%, #071026 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050611]/95 via-[#050611]/70 to-transparent pointer-events-none" />

            {/* Left / Right Hero Carousel Arrows */}
            {heroSlides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setHeroIndex((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)
                  }
                  aria-label="Kituo kilichopita"
                  className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/55 hover:bg-purple-600/60 border border-white/20 items-center justify-center text-white transition cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setHeroIndex((prev) => (prev + 1) % heroSlides.length)}
                  aria-label="Kituo kinachofuata"
                  className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/55 hover:bg-cyan-500/50 border border-white/20 items-center justify-center text-white transition cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="relative z-10 w-full px-6 sm:px-14 py-8 sm:py-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="max-w-xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300 mb-3">
                  <span className="inline-flex items-center gap-1.5 text-rose-400 font-bold">
                    <Radio className="w-3.5 h-3.5 animate-live-dot" />
                    <span>Mubashara Sasa</span>
                  </span>
                  <span aria-hidden="true" className="text-neutral-500">·</span>
                  <span className="font-mono text-cyan-300 tabular-nums">
                    Kituo #{channels.findIndex(c => c.id === featuredChannel.id) + 1}
                  </span>
                  <span aria-hidden="true" className="text-neutral-500">·</span>
                  <span>{featuredChannel.language === 'sw' ? 'Kiswahili' : 'English'}</span>
                  <span aria-hidden="true" className="text-neutral-500">·</span>
                  <span>Bure 100%</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black italic tracking-tight leading-[1.08] text-balance mb-3">
                  {renderTwoToneTitle(featuredChannel.name)}
                </h1>

                <p className="text-sm sm:text-base text-neutral-300 leading-relaxed line-clamp-2 max-w-lg mb-6">
                  {featuredChannel.currentProgram || featuredChannel.description}
                </p>

                {/* Two Signature Hero CTA Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => onSelectChannel(featuredChannel)}
                    className="py-3 px-6 rounded-full neli-gradient-bg hover:opacity-95 text-white font-bold text-sm flex items-center gap-2.5 shadow-[0_0_28px_rgba(255,30,138,0.45)] transition-transform duration-200 active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Tazama Sasa</span>
                  </button>

                  <button
                    onClick={() => allChannelsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="py-3 px-5 rounded-full bg-[#0b0f26]/80 hover:bg-[#13193b] border border-cyan-400/40 hover:border-cyan-300 text-neutral-100 font-semibold text-sm flex items-center gap-2 backdrop-blur-md transition active:scale-95 whitespace-nowrap cursor-pointer"
                  >
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span>Maelezo Zaidi</span>
                  </button>
                </div>

                {/* Slide Indicator Dots */}
                {heroSlides.length > 1 && (
                  <div className="flex items-center gap-2 mt-6">
                    {heroSlides.map((slide, idx) => (
                      <button
                        key={slide.id}
                        type="button"
                        onClick={() => setHeroIndex(idx)}
                        aria-label={`Onyesha ${slide.name}`}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === heroIndex
                            ? 'w-6 bg-gradient-to-r from-pink-500 to-cyan-400'
                            : 'w-2 bg-white/30 hover:bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right Spotlight Poster Emblem */}
              <div className="flex items-center justify-center self-center md:self-auto shrink-0">
                <div
                  onClick={() => onSelectChannel(featuredChannel)}
                  className="w-44 h-32 sm:w-56 sm:h-40 rounded-3xl p-[1.5px] cursor-pointer group transition-transform duration-300 hover:scale-105"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(255,157,0,0.7), rgba(255,30,138,0.8), rgba(0,212,255,0.8))',
                  }}
                >
                  <div className="w-full h-full rounded-[22px] bg-[#070918]/90 backdrop-blur-md flex flex-col items-center justify-center p-5 relative overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-30 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle at center, rgba(0, 212, 255, 0.45), transparent 70%)',
                      }}
                    />
                    <img
                      src={featuredChannel.thumbnailUrl}
                      alt={featuredChannel.name}
                      referrerPolicy="no-referrer"
                      className="relative z-10 max-h-20 sm:max-h-24 max-w-full object-contain filter drop-shadow-[0_6px_18px_rgba(0,0,0,0.85)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. TOP INMOBI PRODUCTION BANNER AD */}
      <div className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-4">
        <AdBanner slotId="inmobi-banner-home-top" />
      </div>

      {/* 3. TRENDING LIVE CHANNELS ROW (Matching "Filamu Zinazotazamika Sana") */}
      {selectedCategory === 'all' && trendingChannels.length > 0 && (
        <section className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-6 sm:pt-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-400 shrink-0" />
              <span>Vituo Vinavyotazamwa Sana</span>
            </h2>

            <button
              onClick={() => allChannelsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#5b21b6] to-[#4f46e5] hover:opacity-90 text-white text-xs font-bold flex items-center gap-1.5 shadow-[0_0_16px_rgba(99,102,241,0.35)] transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Ona Zote</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
            {trendingChannels.map((ch, idx) => (
              <ChannelCard
                key={`trending-${ch.id}`}
                channel={ch}
                channelNumber={idx + 1}
                index={idx}
                onSelectChannel={onSelectChannel}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. FILTER PILLS + ALL CHANNELS GRID */}
      <section
        ref={allChannelsRef}
        className="max-w-[1680px] mx-auto px-4 sm:px-8 lg:px-12 pt-8 sm:pt-10"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                {selectedCategory === 'all'
                  ? `Vituo Vyote vya NeliTv`
                  : genreCards.find(g => g.id === selectedCategory)?.label || 'Vituo'}
              </span>
              <span className="text-sm font-mono text-cyan-400 font-semibold tabular-nums">
                ({currentDisplayChannels.length})
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Bonyeza kituo kutazama moja kwa moja au tumia nambari ya remote (#1–#{channels.length}).
            </p>
          </div>

          {/* Interactive Category Filter Segmented Strip */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 touch-pan-x">
            {genreCards.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setFocusedChannelIndex(-1);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#5b21b6] via-[#6d28d9] to-[#4338ca] text-white border border-purple-400/60 shadow-[0_0_16px_rgba(124,58,237,0.45)]'
                      : 'bg-[#0b0e22] text-neutral-300 hover:text-white border border-purple-500/20 hover:border-cyan-400/45'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spacious 16:9 Neon Channel Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {currentDisplayChannels.map((channel, idx) => {
            const channelNumber = channels.findIndex(c => c.id === channel.id) + 1;
            const isFirstNative = idx === 4 && currentDisplayChannels.length > 6;
            const isSecondNative = idx === 24 && currentDisplayChannels.length > 26;
            return (
              <React.Fragment key={channel.id}>
                <ChannelCard
                  domId={`channel-card-${idx}`}
                  channel={channel}
                  channelNumber={channelNumber > 0 ? channelNumber : idx + 1}
                  index={idx}
                  isFocused={focusedChannelIndex === idx}
                  onSelectChannel={onSelectChannel}
                />
                {isFirstNative && (
                  <div className="col-span-full py-2">
                    <InMobiAdSlot format="native" slotId="inmobi-native-home-feed-1" />
                  </div>
                )}
                {isSecondNative && (
                  <div className="col-span-full py-2">
                    <InMobiAdSlot format="native" slotId="inmobi-native-home-feed-2" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* 5. DISCOVER BY GENRE / CATEGORY TILES (Matching "Gundua kwa Aina" / Genre Explorer) */}
        <div className="pt-10 sm:pt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Gundua kwa Aina
            </h2>
            <span className="text-xs text-neutral-400">Chagua kundi unalopenda</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {genreCards.map((genre) => {
              const Icon = genre.icon;
              const isSelected = selectedCategory === genre.id;
              return (
                <button
                  key={`tile-${genre.id}`}
                  onClick={() => selectCategoryAndScroll(genre.id)}
                  className={`group relative rounded-2xl p-4 overflow-hidden text-left transition-transform duration-200 hover:-translate-y-1 cursor-pointer border ${
                    isSelected
                      ? 'border-cyan-400 shadow-[0_0_24px_rgba(0,212,255,0.3)]'
                      : 'border-purple-500/25 hover:border-cyan-400/55'
                  }`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${genre.gradient} opacity-35 group-hover:opacity-55 transition-opacity`}
                  />
                  <div className="relative z-10 flex flex-col justify-between min-h-[76px]">
                    <div className="flex items-center justify-between">
                      <Icon className={`w-6 h-6 ${genre.iconColor}`} />
                      <span className="w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-white transition">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="text-sm font-bold text-white truncate">{genre.label}</div>
                      <div className="text-[11px] text-neutral-300 tabular-nums">
                        {genre.count} vituo
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. BOTTOM INMOBI BANNER AD */}
        <div className="pt-8 pb-4">
          <AdBanner slotId="inmobi-banner-home-bottom" />
        </div>
      </section>
    </div>
  );
};

interface ChannelCardProps {
  domId?: string;
  channel: Channel;
  channelNumber: number;
  index: number;
  isFocused?: boolean;
  onSelectChannel: (channel: Channel) => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
  domId,
  channel,
  channelNumber,
  index,
  isFocused,
  onSelectChannel,
}) => {
  const channelSlug = getChannelRouteSlug(channel);
  const backdrop = getCardBackdropStyle(channel, index);

  return (
    <a
      href={`/${channelSlug}`}
      id={domId}
      tabIndex={0}
      role="button"
      aria-label={`Tazama kituo cha ${channel.name}`}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      className={`group relative block aspect-[16/10] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 outline-none hover:-translate-y-1 active:scale-[0.98] select-none neli-card-surface ${
        isFocused ? 'ring-2 ring-cyan-400 scale-[1.02] z-10' : ''
      }`}
    >
      {/* Atmospheric Colored Backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: backdrop }}
      />

      {/* Centered Channel Crest Logo */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-5 pb-12 pointer-events-none">
        <img
          src={channel.thumbnailUrl}
          alt={channel.name}
          referrerPolicy="no-referrer"
          loading="lazy"
          className="max-h-14 sm:max-h-16 max-w-[130px] object-contain filter drop-shadow-[0_6px_16px_rgba(0,0,0,0.85)] transition-transform duration-200 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>

      {/* Measured Bottom Scrim + Title & Clean Metadata (Zero Pill Sandwiches) */}
      <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:p-3.5 bg-gradient-to-t from-[#04050d] via-[#04050d]/85 to-transparent pointer-events-none">
        <h3 className="font-extrabold italic text-xs sm:text-sm tracking-tight line-clamp-1">
          {renderTwoToneTitle(channel.name)}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-300 mt-0.5 truncate tabular-nums">
          <span className="text-cyan-300 font-semibold">CH {channelNumber}</span>
          <span aria-hidden="true">·</span>
          <span className="text-rose-400 font-semibold">Live</span>
          <span aria-hidden="true">·</span>
          <span>{channel.language === 'sw' ? 'Kiswahili' : 'English'}</span>
        </div>
      </div>

      {/* Play Hover Overlay */}
      <div className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/35 backdrop-blur-[1px] pointer-events-none">
        <div className="w-11 h-11 rounded-full neli-gradient-bg text-white flex items-center justify-center shadow-[0_0_24px_rgba(255,30,138,0.55)] transform scale-90 group-hover:scale-100 transition-transform">
          <Play className="w-5 h-5 fill-white ml-0.5" />
        </div>
      </div>
    </a>
  );
};
