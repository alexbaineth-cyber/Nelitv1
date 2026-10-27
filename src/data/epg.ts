/**
 * Electronic Program Guide (EPG) Data for NeliTv Channels
 * Provides real schedules for Tanzania & East Africa live TV channels
 */

export interface EPGProgram {
  id: string;
  title: string;
  startTime: string; // e.g. "14:00"
  endTime: string;   // e.g. "16:00"
  category: 'Sports' | 'News' | 'Entertainment' | 'Movie' | 'Series' | 'Documentary' | 'Kids' | 'Music';
  duration: string;  // e.g. "Dakika 120"
  description: string;
  thumbnailUrl?: string;
  isLiveNow?: boolean;
}

export interface ChannelEPG {
  channelId: string;
  channelName: string;
  programs: EPGProgram[];
}

export const EPG_DATA: Record<string, EPGProgram[]> = {
  // Azam Sports 1 HD
  'azam-sports-1': [
    {
      id: 'as1-1',
      title: 'Mbashara: NBC Premier League (Simba SC vs Yanga SC)',
      startTime: '15:30',
      endTime: '18:00',
      category: 'Sports',
      duration: 'Dakika 150',
      description: 'Dabi ya Kariakoo mubashara kutoka Uwanja wa Benjamin Mkapa, Dar es Salaam.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'as1-2',
      title: 'Uchambuzi wa Mechi & Marudio ya Mabao',
      startTime: '18:00',
      endTime: '19:30',
      category: 'Sports',
      duration: 'Dakika 90',
      description: 'Uchambuzi wa kina na wataalamu wa soka kuhusu matukio ya mechi.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'as1-3',
      title: 'Azam Sports Extra Usiku',
      startTime: '19:30',
      endTime: '21:00',
      category: 'Sports',
      duration: 'Dakika 90',
      description: 'Habari zote za michezo kitaifa na kimataifa, mahojiano na wachezaji.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'as1-4',
      title: 'Ligi Kuu ya Zanzibar (PBZ Premier League)',
      startTime: '21:00',
      endTime: '23:00',
      category: 'Sports',
      duration: 'Dakika 120',
      description: 'Mechi ya usiku kutoka Visiwani Zanzibar.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Azam Sports 2 HD
  'azam-sports-2': [
    {
      id: 'as2-1',
      title: 'Mbashara: Championship League Tanzania',
      startTime: '16:00',
      endTime: '18:15',
      category: 'Sports',
      duration: 'Dakika 135',
      description: 'Ligi ya daraja la kwanza Tanzania bara, mapambano ya kupanda ligi kuu.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'as2-2',
      title: 'Kikapu & Ndondi (Tanzania Boxing Nights)',
      startTime: '18:15',
      endTime: '20:30',
      category: 'Sports',
      duration: 'Dakika 135',
      description: 'Mapambano ya ngumi za kulipwa na mashindano ya mpira wa kikapu.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'as2-3',
      title: 'Marudio ya Mechi za NBC Wiki Hii',
      startTime: '20:30',
      endTime: '22:30',
      category: 'Sports',
      duration: 'Dakika 120',
      description: 'Tazama tena matukio na mabao yote yaliyofungwa wikiendi.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1489944445391-11dd35574549?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Azam Sports 3 HD
  'azam-sports-3': [
    {
      id: 'as3-1',
      title: 'CAF Champions League Highlights',
      startTime: '16:00',
      endTime: '17:30',
      category: 'Sports',
      duration: 'Dakika 90',
      description: 'Mchezo na mabao ya klabu bingwa barani Afrika.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'as3-2',
      title: 'World Athletics & Marathon Series',
      startTime: '17:30',
      endTime: '19:30',
      category: 'Sports',
      duration: 'Dakika 120',
      description: 'Mashindano ya riadha ya kimataifa na wanariadha wa Afrika Mashariki.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Azam Sports 4 HD
  'azam-sports-4': [
    {
      id: 'as4-1',
      title: 'Motorsports & Extreme Sports Live',
      startTime: '15:00',
      endTime: '17:00',
      category: 'Sports',
      duration: 'Dakika 120',
      description: 'Mbio za magari, pikipiki na michezo ya kasi kutoka kote ulimwenguni.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'as4-2',
      title: 'International Friendly Matches',
      startTime: '17:00',
      endTime: '19:00',
      category: 'Sports',
      duration: 'Dakika 120',
      description: 'Mechi za kirafiki za kimataifa za timu za taifa.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Sinema Zetu
  'sinema-zetu': [
    {
      id: 'sz-1',
      title: 'Tamthilia: Huba (Msimu Mpya)',
      startTime: '15:00',
      endTime: '16:00',
      category: 'Series',
      duration: 'Dakika 60',
      description: 'Mfululizo wa tamthilia ya kusisimua ya mapenzi na changamoto za kifamilia.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'sz-2',
      title: 'Filamu ya Kibongo: Safari ya Mapenzi',
      startTime: '16:00',
      endTime: '18:00',
      category: 'Movie',
      duration: 'Dakika 120',
      description: 'Filamu ya kusisimua iliyoigizwa na mastaa wakubwa wa Bongo Movie.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'sz-3',
      title: 'Tamthilia: Sarafu',
      startTime: '18:00',
      endTime: '19:00',
      category: 'Series',
      duration: 'Dakika 60',
      description: 'Mikasa, misukosuko na siri nzito za biashara jijini Dar es Salaam.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'sz-4',
      title: 'Sinema ya Usiku: Kivuli cha Damu',
      startTime: '19:00',
      endTime: '21:00',
      category: 'Movie',
      duration: 'Dakika 120',
      description: 'Filamu ya upelelezi na matukio ya hatari.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Azam One
  'azam-one': [
    {
      id: 'ao-1',
      title: 'Taarifa ya Habari Azam News',
      startTime: '15:30',
      endTime: '16:30',
      category: 'News',
      duration: 'Dakika 60',
      description: 'Matukio makuu ya kitaifa, uchumi na jamii kutoka kote nchini.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'ao-2',
      title: 'Kipindi Maalum cha Uchambuzi wa Siasa',
      startTime: '16:30',
      endTime: '18:00',
      category: 'News',
      duration: 'Dakika 90',
      description: 'Wachambuzi wa siasa na viongozi wakijadili masuala mtambuka.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'ao-3',
      title: 'Kipindi cha Afya na Lishe Bora',
      startTime: '18:00',
      endTime: '19:00',
      category: 'Entertainment',
      duration: 'Dakika 60',
      description: 'Ushauri wa madaktari kuhusu afya ya jamii na mtindo bora wa maisha.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Azam Two
  'azam-two': [
    {
      id: 'at-1',
      title: 'Burudani ya Muziki wa Singeli & Bongo Flava',
      startTime: '15:00',
      endTime: '17:00',
      category: 'Music',
      duration: 'Dakika 120',
      description: 'Nyimbo mpya na mahojiano na wasanii wanaovuma Tanzania.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'at-2',
      title: 'Tamthilia ya Kihindi Iliyotafsiriwa Kiswahili',
      startTime: '17:00',
      endTime: '18:30',
      category: 'Series',
      duration: 'Dakika 90',
      description: 'Hadithi ya kusisimua ya mapenzi na mila za kiasili.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1578022761797-b8636ac1773c?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // UTV
  'utv': [
    {
      id: 'utv-1',
      title: 'Makala Maalum ya Maendeleo & Jamii',
      startTime: '15:00',
      endTime: '16:30',
      category: 'Documentary',
      duration: 'Dakika 90',
      description: 'Ujenzi wa miundombinu, miradi ya maji na umeme Tanzania.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'utv-2',
      title: 'Vichekesho & Vimbwanga vya Mitaani',
      startTime: '16:30',
      endTime: '18:00',
      category: 'Entertainment',
      duration: 'Dakika 90',
      description: 'Wachekeshaji wa Tanzania wakileta furaha kwenye nyumba yako.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // TBC 1
  'tbc-1': [
    {
      id: 'tbc1-1',
      title: 'Habari za Saa na Matukio ya Taifa',
      startTime: '15:00',
      endTime: '16:00',
      category: 'News',
      duration: 'Dakika 60',
      description: 'Taarifa kamili ya habari kutoka kituo cha taifa TBC 1.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'tbc1-2',
      title: 'Kipindi cha Kilimo na Biashara',
      startTime: '16:00',
      endTime: '17:30',
      category: 'Documentary',
      duration: 'Dakika 90',
      description: 'Mbinu za kisasa za kilimo, masoko ya mazao na mifugo.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'tbc1-3',
      title: 'Taarifa ya Habari Kuu ya Saa Mbili Usiku',
      startTime: '20:00',
      endTime: '21:00',
      category: 'News',
      duration: 'Dakika 60',
      description: 'Habari za kina, uchambuzi na matukio ya kitaifa na kimataifa.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // TBC 2
  'tbc-2': [
    {
      id: 'tbc2-1',
      title: 'Vijana Leo: Teknolojia & Ubunifu',
      startTime: '15:30',
      endTime: '17:00',
      category: 'Entertainment',
      duration: 'Dakika 90',
      description: 'Kipindi cha vijana, muziki mpya na fursa za kidijitali.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'tbc2-2',
      title: 'Michezo ya Shule na Vyuo',
      startTime: '17:00',
      endTime: '19:00',
      category: 'Sports',
      duration: 'Dakika 120',
      description: 'Ligi ya vyuo vikuu na michezo ya vijana.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Tanzania Safari Channel
  'safari-channel': [
    {
      id: 'saf-1',
      title: 'Mbuga za Serengeti: Uhamaji Mkubwa wa Wanyama',
      startTime: '15:00',
      endTime: '16:30',
      category: 'Documentary',
      duration: 'Dakika 90',
      description: 'Tazama uhamaji wa nyumbu, simba, chui na mandhari ya asili ya Serengeti.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'saf-2',
      title: 'Hifadhi ya Ngorongoro & Ziwa Manyara',
      startTime: '16:30',
      endTime: '18:00',
      category: 'Documentary',
      duration: 'Dakika 90',
      description: 'Uzuri wa volkano ya Ngorongoro na ndege wa flamingo Ziwa Manyara.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'saf-3',
      title: 'Kilele cha Mlima Kilimanjaro: Paa la Afrika',
      startTime: '18:00',
      endTime: '19:30',
      category: 'Documentary',
      duration: 'Dakika 90',
      description: 'Safari ya wapanda mlima kuelekea kilele cha Uhuru, Mlima Kilimanjaro.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1589553416260-f586c8f1514f?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Wasafi TV
  'wasafi-tv': [
    {
      id: 'wst-1',
      title: 'The Switch & Big Show Live',
      startTime: '15:00',
      endTime: '17:00',
      category: 'Music',
      duration: 'Dakika 120',
      description: 'Muziki mkali wa Bongo Flava, mahojiano na wasanii na umbeya wa mastaa.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'wst-2',
      title: 'Block 89 na Watangazaji wa Wasafi',
      startTime: '17:00',
      endTime: '19:00',
      category: 'Entertainment',
      duration: 'Dakika 120',
      description: 'Ucheshi, matukio ya kijamii na burudani ya jioni.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // Crown TV
  'crown-tv': [
    {
      id: 'crw-1',
      title: 'Crown Live Jam & Mahojiano Maalum',
      startTime: '15:30',
      endTime: '17:30',
      category: 'Entertainment',
      duration: 'Dakika 120',
      description: 'Muziki, sanaa na mahojiano na vijana wenye vipaji.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    }
  ],

  // KIX Movies
  'kix': [
    {
      id: 'kix-1',
      title: 'Action Movie: Shaolin Kung Fu Masters',
      startTime: '15:00',
      endTime: '17:00',
      category: 'Movie',
      duration: 'Dakika 120',
      description: 'Filamu ya mapigano ya martial arts kutoka bara la Asia.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    },
    {
      id: 'kix-2',
      title: 'Extreme Action: The Final Target',
      startTime: '17:00',
      endTime: '19:00',
      category: 'Movie',
      duration: 'Dakika 120',
      description: 'Mapambano ya silaha na uokoaji wa kusisimua.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80'
    }
  ],

  // ZBC 2
  'zbc-2': [
    {
      id: 'zbc2-1',
      title: 'Sanaa na Utamaduni wa Kizanzibari',
      startTime: '15:00',
      endTime: '16:30',
      category: 'Entertainment',
      duration: 'Dakika 90',
      description: 'Taarab asilia, vyakula vya marashi ya karafuu na mila za visiwa vya Zanzibar.',
      thumbnailUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=400&q=80',
      isLiveNow: true
    }
  ]
};

/**
 * Helper to fetch EPG for a channel by matching ID or name
 */
export function getChannelEPG(channelId: string, channelName?: string): EPGProgram[] {
  if (EPG_DATA[channelId]) {
    return EPG_DATA[channelId];
  }
  // Try matching by normalized name or aliases
  const cleanId = channelId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanName = (channelName || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const [key, programs] of Object.entries(EPG_DATA)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanId.includes(cleanKey) || cleanKey.includes(cleanId) || cleanName.includes(cleanKey)) {
      return programs;
    }
  }

  return [];
}
