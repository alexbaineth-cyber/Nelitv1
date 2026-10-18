export interface ClearKeysMap {
  [keyId: string]: string;
}

export const ALL_KNOWN_CLEAR_KEYS: ClearKeysMap = {
  // Azam Sports 1 HD
  "c31df1600afc33799ecac543331803f2": "dd2101530e222f545997d4c553787f85",
  "c31df160-0afc-3379-9eca-c543331803f2": "dd2101530e222f545997d4c553787f85",
  // Azam Sports 2 HD
  "739e7499125b31cc9948da8057b84cf9": "1b7d44d798c351acc02f33ddfbb7682a",
  "739e7499-125b-31cc-9948-da8057b84cf9": "1b7d44d798c351acc02f33ddfbb7682a",
  // Azam Sports 3 HD
  "2f12d7b889de381a9fb5326ca3aa166d": "51c2d733a54306fdf89acd4c9d4f6005",
  "2f12d7b8-89de-381a-9fb5-326ca3aa166d": "51c2d733a54306fdf89acd4c9d4f6005",
  // Azam Sports 4 HD
  "fbcac74e355b3b5d9b6cbc56c7597dbf": "5f980e872b378d88b46f656a806205c3",
  "fbcac74e-355b-3b5d-9b6c-bc56c7597dbf": "5f980e872b378d88b46f656a806205c3",
  // Azam One
  "b5cbe1bb5acf3c7f9995be428245cfcd": "89f1188a11e5e000d4443eb27ca378e1",
  "b5cbe1bb-5acf-3c7f-9995-be428245cfcd": "89f1188a11e5e000d4443eb27ca378e1",
  // Azam Two
  "18f515fd536b3e728e9844e77d9f0fa8": "c96dfd9b65560f87a1a95b8aeda0432d",
  "18f515fd-536b-3e72-8e98-44e77d9f0fa8": "c96dfd9b65560f87a1a95b8aeda0432d",
  // Sinema Zetu
  "d628ae37a8f0336b970f250d9699461e": "1194c3d60bb494aabe9114ca46c2738e",
  "d628ae37-a8f0-336b-970f-250d9699461e": "1194c3d60bb494aabe9114ca46c2738e",
  // ZBC 2
  "f38b03549d023f3a883997328537bf4d": "90f9d2d9cc26009c437905692ad70730",
  "f38b0354-9d02-3f3a-8839-97328537bf4d": "90f9d2d9cc26009c437905692ad70730",
  // ZBC (Both Live KID 90215182... and legacy KID e91fec14...)
  "902151820a5d3092900813d64b469805": "79884fad0dbfcdc43d3e33c82a1f1cfa",
  "90215182-0a5d-3092-9008-13d64b469805": "79884fad0dbfcdc43d3e33c82a1f1cfa",
  "e91fec140bc5316f919b4dc9c16287d7": "79884fad0dbfcdc43d3e33c82a1f1cfa",
  "e91fec14-0bc5-316f-919b-4dc9c16287d7": "79884fad0dbfcdc43d3e33c82a1f1cfa",
  // UTV
  "31b8fc6289fe3ca698588a59d845160c": "f8c4e73f419cb80db3bdf4a974e31894",
  "31b8fc62-89fe-3ca6-9858-8a59d845160c": "f8c4e73f419cb80db3bdf4a974e31894",
  // Crown TV
  "e3eb6e0656ec3c22aa308aaa3f82c565": "a7634d6defd2c255135095c45bc442fb",
  "e3eb6e06-56ec-3c22-aa30-8aaa3f82c565": "a7634d6defd2c255135095c45bc442fb",
  // Wasafi TV
  "8714fe102679348e9c76cfd315dacaa0": "a8b86ceda831061c13c7c4c67bd77f8e",
  "8714fe10-2679-348e-9c76-cfd315dacaa0": "a8b86ceda831061c13c7c4c67bd77f8e",
  // KIX Movies
  "a7e155b282f33335ae8d553f169f443c": "c3fdcfd5d509f1ed8550d76a525e34e5",
  "a7e155b2-82f3-3335-ae8d-553f169f443c": "c3fdcfd5d509f1ed8550d76a525e34e5"
};

export interface Channel {
  id: string;
  name: string;
  description: string;
  streamUrl: string;
  tokenizedUrl?: string;
  streamFormat: 'dash' | 'hls' | 'mp4';
  thumbnailUrl: string;
  category: string[];
  language: string;
  isActive: boolean;
  isMaintenance: boolean;
  isAdult: boolean;
  order: number;
  viewerCount: number;
  totalViews: number;
  requiredPackages: string[];
  searchKeywords?: string[];
  encryptionType: 'clearkey' | 'none';
  clearKeys?: ClearKeysMap;
  isAzam?: boolean;
  isLiveEvent?: boolean;
  currentProgram?: string;
  nextProgram?: string;
  bandwidthSaverSupported?: boolean;
}

export let ACTIVE_AZAM_TOKEN = "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOiIxNzkyMzQ5OTAzIiwic2lwIjoiIiwicGF0aCI6IiIsInNlc3Npb25fY2RuX2lkIjoiYjA1ZGQxNjY1NWVlMDE2YSIsInNlc3Npb25faWQiOiIiLCJjbGllbnRfaWQiOiI0ODQwODMyIiwiZGV2aWNlX2lkIjoiIiwibWF4X3Nlc3Npb25zIjowLCJzZXNzaW9uX2R1cmF0aW9uIjowLCJ1cmwiOiJodHRwczovLzEwMi4yMDguMjQ0LjkiLCJzZXNzaW9uX3RpbWVvdXQiOjAsImF1ZCI6IjciLCJzb3VyY2VzIjpbM119.x54TtA7qL3fXQ81oZ4V57xLVROztNUdkbPg39O7F5mzTur3bniWhL2hfQ68rsfz-8PZjrmDQOptCG8dneFjjhQ==";

export function updateGlobalAzamToken(newToken: string) {
  if (newToken && newToken.length > 20) {
    ACTIVE_AZAM_TOKEN = newToken;
  }
}

export const makeAzamUrl = (slug: string) =>
  `https://cdnedgch2.azamtvltd.co.tz/tok_${ACTIVE_AZAM_TOKEN}/live/eds/${slug}/DASH/${slug}.mpd`;

export const CHANNELS_DATA: Channel[] = [
  {
    id: "R17JUvbCEzu2eTbjnE74",
    name: "Azam Sports 1 HD",
    description: "NBC Premier League, Mechi za moja kwa moja, uchambuzi na vipindi vya michezo",
    streamUrl: makeAzamUrl("AzamSport1"),
    tokenizedUrl: makeAzamUrl("AzamSport1"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/B29Xvb5P/azam-sport-1-01.png",
    category: ["sport", "entertainment", "tanzania"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 1,
    viewerCount: 1420,
    totalViews: 38200,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "c31df1600afc33799ecac543331803f2": "dd2101530e222f545997d4c553787f85"
    },
    isAzam: true,
    currentProgram: "NBC Premier League Live: Simba SC vs Yanga SC",
    nextProgram: "Kipenga Cha Mwisho & Uchambuzi",
    bandwidthSaverSupported: true
  },
  {
    id: "f74ba826-f031-4e64-9ec1-f7ffa4e6ec0f",
    name: "Azam Sports 2 HD",
    description: "Michezo ya ndani na nje, Kombe la Shirikisho, CAF Champions League",
    streamUrl: makeAzamUrl("AzamSport2"),
    tokenizedUrl: makeAzamUrl("AzamSport2"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/Y7Cj3Wtj/azam-sport-2-01.png",
    category: ["sport", "entertainment", "tanzania"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 2,
    viewerCount: 980,
    totalViews: 24500,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "739e7499125b31cc9948da8057b84cf9": "1b7d44d798c351acc02f33ddfbb7682a"
    },
    isAzam: true,
    currentProgram: "Championship Live: Azam FC vs Coastal Union",
    nextProgram: "Sports Highlight International",
    bandwidthSaverSupported: true
  },
  {
    id: "1c976127-e8a4-4bd6-8e73-5da0edce369b",
    name: "Azam Sports 3 HD",
    description: "Ngumi, riadha, basketball, na michuano ya kikanda Afrika Mashariki",
    streamUrl: makeAzamUrl("AzamSport3"),
    tokenizedUrl: makeAzamUrl("AzamSport3"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/2YfLQ545/1000221070.png",
    category: ["sport", "entertainment"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 3,
    viewerCount: 450,
    totalViews: 12400,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "2f12d7b889de381a9fb5326ca3aa166d": "51c2d733a54306fdf89acd4c9d4f6005"
    },
    isAzam: true,
    currentProgram: "World Boxing Championship Rewind",
    nextProgram: "Motorsport & Rally Special",
    bandwidthSaverSupported: true
  },
  {
    id: "244bcd50-b3bf-4d5e-8419-08cc7bad1a7c",
    name: "Azam Sports 4 HD",
    description: "Michezo ya kimataifa, Ligi za Ulaya, Makala za wachezaji",
    streamUrl: makeAzamUrl("AzamSport4"),
    tokenizedUrl: makeAzamUrl("AzamSport4"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/SwtFQNsh/1000221063.jpg",
    category: ["sport", "entertainment"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 4,
    viewerCount: 620,
    totalViews: 18100,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "fbcac74e355b3b5d9b6cbc56c7597dbf": "5f980e872b378d88b46f656a806205c3"
    },
    isAzam: true,
    currentProgram: "European League Matchday Live",
    nextProgram: "Tactical Talk Show",
    bandwidthSaverSupported: true
  },
  {
    id: "c405ae74-c4c5-4842-9f26-130ce380b307",
    name: "Azam One",
    description: "Tamthilia pendwa za Kitanzania, vipindi vya kijamii, muziki na burudani",
    streamUrl: makeAzamUrl("AzamOne"),
    tokenizedUrl: makeAzamUrl("AzamOne"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/8gtr1n42/1000221072.jpg",
    category: ["entertainment", "movies", "tanzania"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 5,
    viewerCount: 890,
    totalViews: 31200,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "b5cbe1bb5acf3c7f9995be428245cfcd": "89f1188a11e5e000d4443eb27ca378e1"
    },
    isAzam: true,
    currentProgram: "Tamthilia: Huba Sehemu ya 145",
    nextProgram: "Habari za Azam saa Mbili Kamili",
    bandwidthSaverSupported: true
  },
  {
    id: "008ffe6e-a30f-4ed1-9ddb-4033dde18576",
    name: "Azam Two",
    description: "Burudani ya familia, tamthilia za kimataifa zilizotafsiriwa Kiswahili",
    streamUrl: makeAzamUrl("AzamTwo"),
    tokenizedUrl: makeAzamUrl("AzamTwo"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/Z6sdp2tg/1000221074.jpg",
    category: ["entertainment", "movies"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 6,
    viewerCount: 540,
    totalViews: 19800,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "18f515fd536b3e728e9844e77d9f0fa8": "c96dfd9b65560f87a1a95b8aeda0432d"
    },
    isAzam: true,
    currentProgram: "Sultan: Mfalme Mkuu (Kiswahili Dub)",
    nextProgram: "Bongo Flava Top 10 Countdown",
    bandwidthSaverSupported: true
  },
  {
    id: "f56ca8c1-3d3f-4dd2-8d9d-b0b54b559f6e",
    name: "Sinema Zetu",
    description: "Filamu kali za Kibongo, vichekesho, drama na uzinduzi wa sinema mpya",
    streamUrl: makeAzamUrl("SinemaZetu"),
    tokenizedUrl: makeAzamUrl("SinemaZetu"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/twBGTs4s/1000221073.jpg",
    category: ["movies", "entertainment", "tanzania"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 7,
    viewerCount: 1100,
    totalViews: 45600,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "d628ae37a8f0336b970f250d9699461e": "1194c3d60bb494aabe9114ca46c2738e"
    },
    isAzam: true,
    currentProgram: "Sinema Kubwa: Jua Kali (Season Finale)",
    nextProgram: "Vichekesho vya Mizengwe",
    bandwidthSaverSupported: true
  },
  {
    id: "b502217f-a9d0-4aef-99e6-8a784adedc65",
    name: "ZBC 2",
    description: "Vipindi vya kijamii, utamaduni wa Zanzibar, dini na michezo",
    streamUrl: makeAzamUrl("ZBC2"),
    tokenizedUrl: makeAzamUrl("ZBC2"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.imgur.com/5HqOXH0.jpeg",
    category: ["tanzania", "entertainment"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 8,
    viewerCount: 310,
    totalViews: 9800,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "f38b03549d023f3a883997328537bf4d": "90f9d2d9cc26009c437905692ad70730"
    },
    isAzam: true,
    currentProgram: "Zanzibar Yetu: Mandhari na Historia",
    nextProgram: "Taarabu Asilia Live",
    bandwidthSaverSupported: true
  },
  {
    id: "101e9c3f-de90-47fb-a69c-342be8a0bb80",
    name: "ZBC",
    description: "Shirika la Utangazaji Zanzibar - Taarifa ya Habari na Matukio ya Visiwani",
    streamUrl: makeAzamUrl("ZBC"),
    tokenizedUrl: makeAzamUrl("ZBC"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/xtynWQsN/1000221078.png",
    category: ["tanzania", "news"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 9,
    viewerCount: 290,
    totalViews: 8600,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "902151820a5d3092900813d64b469805": "79884fad0dbfcdc43d3e33c82a1f1cfa",
      "90215182-0a5d-3092-9008-13d64b469805": "79884fad0dbfcdc43d3e33c82a1f1cfa",
      "e91fec140bc5316f919b4dc9c16287d7": "79884fad0dbfcdc43d3e33c82a1f1cfa",
      "e91fec14-0bc5-316f-919b-4dc9c16287d7": "79884fad0dbfcdc43d3e33c82a1f1cfa"
    },
    isAzam: true,
    currentProgram: "ZBC Habari za Saa",
    nextProgram: "Bunge la Wawakilishi Live",
    bandwidthSaverSupported: true
  },
  {
    id: "d7b415f7-d024-4c7f-a570-653367e8dc5c",
    name: "UTV",
    description: "Habari moto moto, mijadala ya kisiasa na kiuchumi nchini Tanzania",
    streamUrl: makeAzamUrl("UTV"),
    tokenizedUrl: makeAzamUrl("UTV"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/N2nCDLwD/1000221071.png",
    category: ["entertainment", "news", "tanzania"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 10,
    viewerCount: 420,
    totalViews: 14300,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "31b8fc6289fe3ca698588a59d845160c": "f8c4e73f419cb80db3bdf4a974e31894"
    },
    isAzam: true,
    currentProgram: "Meza ya Duara: Uchumi wa Kidijitali",
    nextProgram: "UTV Habari Leo",
    bandwidthSaverSupported: true
  },
  {
    id: "bba104f4-f5ac-41c9-aa36-7af71aaa1993",
    name: "Crown TV",
    description: "Muziki wa Bongo Flava, mahojiano na wasanii, burudani na mtindo wa maisha",
    streamUrl: makeAzamUrl("CrownTv"),
    tokenizedUrl: makeAzamUrl("CrownTv"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/GfWDtdQT/1000221075.png",
    category: ["music", "entertainment", "tanzania"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 11,
    viewerCount: 380,
    totalViews: 11200,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "e3eb6e0656ec3c22aa308aaa3f82c565": "a7634d6defd2c255135095c45bc442fb"
    },
    isAzam: true,
    currentProgram: "The Crown Show: Bongo Hits Nonstop",
    nextProgram: "Celeb Scoop Live",
    bandwidthSaverSupported: true
  },
  {
    id: "80e54146-1d9b-4c91-8f71-de0ea4866833",
    name: "Wasafi TV",
    description: "The Hottest Hits, Bongo Fleva, The Switch, na Tamthilia moto",
    streamUrl: makeAzamUrl("WasafiTV"),
    tokenizedUrl: makeAzamUrl("WasafiTV"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/W4PYYhRV/157731247083407-Y3-Jvc-Cwx-MTQ0-LDg5-NCww-LDU4-OA.png",
    category: ["music", "entertainment", "tanzania"],
    language: "sw",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 12,
    viewerCount: 790,
    totalViews: 32000,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "8714fe102679348e9c76cfd315dacaa0": "a8b86ceda831061c13c7c4c67bd77f8e"
    },
    isAzam: true,
    currentProgram: "The Switch: Live Studio Session",
    nextProgram: "Wasafi Night Beats",
    bandwidthSaverSupported: true
  },
  {
    id: "4f36f2d1-ff7f-467b-b4f2-6f303263f28b",
    name: "KIX Movies",
    description: "Action movies, martial arts, blockbuster cinema 24/7",
    streamUrl: makeAzamUrl("KIXMovies"),
    tokenizedUrl: makeAzamUrl("KIXMovies"),
    streamFormat: "dash",
    thumbnailUrl: "https://i.ibb.co/ch6qGQT3/KIX-logo-svg.png",
    category: ["movies", "entertainment"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 13,
    viewerCount: 510,
    totalViews: 15400,
    requiredPackages: ["PAID"],
    encryptionType: "clearkey",
    clearKeys: {
      "a7e155b282f33335ae8d553f169f443c": "c3fdcfd5d509f1ed8550d76a525e34e5"
    },
    isAzam: true,
    currentProgram: "Ultimate Action: Police Story Special",
    nextProgram: "Night Fighter Double Feature",
    bandwidthSaverSupported: true
  },
  {
    id: "ee2ba70e-c28b-40ce-8ba1-0c20f133d04c",
    name: "TNT Sports 1 HD",
    description: "UEFA Champions League, Premier League live matches and analysis",
    streamUrl: "https://cdn3.wowza.com/5/ZWQ1K2NYTmpFbGsr/BEK-WOWZA-1/smil:BEKPRIMEW.smil/playlist.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://i.ibb.co/R4NBCtMm/4ae6eef1-b7ab-4fcd-bc20-18ac49124d95.jpg",
    category: ["sport"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 14,
    viewerCount: 1250,
    totalViews: 41200,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Live Sports: Football Special & Matchday",
    nextProgram: "Sports Highlight International",
    bandwidthSaverSupported: true
  },
  {
    id: "ba2b232c-a79d-4130-b5d8-4883fbce7a1d",
    name: "TNT Sports 2 HD",
    description: "MotoGP, Rugby, UFC and live international sports coverage",
    streamUrl: "https://dpv6ceilvhyrw.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-7ufe851j0vqbg/playlist.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://i.ibb.co/R4NBCtMm/4ae6eef1-b7ab-4fcd-bc20-18ac49124d95.jpg",
    category: ["sport"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 15,
    viewerCount: 680,
    totalViews: 21900,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "World Championship Sports Roundup",
    nextProgram: "Action Replay & Highlights",
    bandwidthSaverSupported: true
  },
  {
    id: "68354b4a-d06c-4c8b-b6be-85cc3e95a43b",
    name: "Baby TV",
    description: "Vipindi vya elimu na burudani kwa watoto wachanga na wadogo",
    streamUrl: "https://stmv1.srvif.com/gospelcartoon/gospelcartoon/playlist.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://i.ibb.co/B0D1MgZ/Baby-TV-logo.png",
    category: ["kids"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 16,
    viewerCount: 190,
    totalViews: 7800,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Cuddlies & Friends Morning Rhymes",
    nextProgram: "Colors & Shapes with Oliver",
    bandwidthSaverSupported: true
  },
  {
    id: "80212719-1b5c-45b3-9e52-b59e533705f1",
    name: "Cartoon Network",
    description: "Ben 10, Teen Titans Go, Craig of the Creek na vibonzo vyote pendwa",
    streamUrl: "https://cdn4.skygo.mn/live/disk1/Cartoon_Network/HLSv3-FTA/Cartoon_Network.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://i.ibb.co/8gV4tq4g/1000221079.png",
    category: ["kids", "entertainment"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 17,
    viewerCount: 460,
    totalViews: 16300,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Teen Titans Go!: Pizza Apocalypse",
    nextProgram: "The Amazing World of Gumball",
    bandwidthSaverSupported: true
  },
  {
    id: "fbc3ebe6-29c5-418a-89cd-3aa17a05e337",
    name: "CBEEBIES",
    description: "Vipindi vya watoto kutoka BBC: Numberblocks, Hey Duggee",
    streamUrl: "https://cdn4.skygo.mn/live/disk1/Cbeebies/HLSv3-FTA/Cbeebies.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://i.ibb.co/FLXj9vtv/cbeebies-cbbc-television-channel-itv3-apps.jpg",
    category: ["kids"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 18,
    viewerCount: 220,
    totalViews: 8100,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Numberblocks: Ten Again",
    nextProgram: "Hey Duggee: The Badge Hour",
    bandwidthSaverSupported: true
  },
  {
    id: "9mFG4jZCtlXCEKfv5TF6",
    name: "BBC News",
    description: "Habari za uhakika kimataifa, uchumi na makala maalum masaa 24",
    streamUrl: "https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://yt3.googleusercontent.com/v4JamQ9B-PUiJHjmZQs9UwTaoLQW8vijJMMpV5QvA2wHQ6iwWM8Q1s6O4jgTl0dtDigVWAi7SA=s900-c-k-c0x00ffffff-no-rj",
    category: ["news"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 19,
    viewerCount: 530,
    totalViews: 20400,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "BBC World News Live Bulletin",
    nextProgram: "Focus on Africa",
    bandwidthSaverSupported: true
  },
  {
    id: "DBSsfqWBXJRSnbCtaImk",
    name: "CNN International",
    description: "Breaking news alerts, global market reports, and world in-depth features",
    streamUrl: "https://turnerlive.warnermediacdn.com/hls/live/586495/cnngo/cnn_slate/VIDEO_0_3564000.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://cdn-1.webcatalog.io/catalog/cnn-international/cnn-international-icon-unplated.png?v=1716987984587",
    category: ["news"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 20,
    viewerCount: 390,
    totalViews: 14700,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "CNN Newsroom Live",
    nextProgram: "Connect the World with Becky Anderson",
    bandwidthSaverSupported: true
  },
  {
    id: "sVQCJNWwkyHclXVuCPpL",
    name: "SABC News",
    description: "Habari za Kusini mwa Afrika na bara zima la Afrika masaa 24",
    streamUrl: "https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/chunklist_b250000_t64MjQwcA==.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://yt3.googleusercontent.com/x5Bgc7UBYZvOHvp3UG91lZbV6ND0YCOi2a026vLPDGIU5GF2qp5JnHnCeLyPegWhEjM5njpN=s900-c-k-c0x00ffffff-no-rj",
    category: ["news", "africa"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 21,
    viewerCount: 180,
    totalViews: 6500,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "African Eye News Bulletin",
    nextProgram: "Southern Africa Business Report",
    bandwidthSaverSupported: true
  },
  {
    id: "0d7274cb-6a3e-464d-8b8d-bc3c6d433cc2",
    name: "WWE Network TV",
    description: "Monday Night Raw, SmackDown, WrestleMania & classic wrestling fights",
    streamUrl: "https://dpv6ceilvhyrw.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-7ufe851j0vqbg/playlist.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://i.ibb.co/zW4Jvp6z/WWE-official-logo-svg.png",
    category: ["sport", "entertainment"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 22,
    viewerCount: 890,
    totalViews: 34100,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "WWE Raw: Championship Contenders",
    nextProgram: "SmackDown Classic Showdowns",
    bandwidthSaverSupported: true
  },
  {
    id: "8Q6H024OmdN8zIZTG4Zz",
    name: "1 KZN TV",
    description: "Vipindi vya kijamii, muziki na maisha kutoka Afrika Kusini",
    streamUrl: "https://cdn.freevisiontv.co.za/sttv/smil:1kzn.stream.smil/chunklist_b480000.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://starsat.co.za/wp-content/uploads/2023/08/1KZN-TV.png",
    category: ["africa", "entertainment"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 23,
    viewerCount: 140,
    totalViews: 5200,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "KZN Cultural Beats & Rhythm",
    nextProgram: "African Horizons",
    bandwidthSaverSupported: true
  },
  {
    id: "IoDxhM3b7jd3c7lU5vkI",
    name: "Cape Town TV",
    description: "Kituo cha jamii cha Cape Town: Sanaa, filamu za kujitegemea na mijadala",
    streamUrl: "https://cdn.freevisiontv.co.za/sttv/smil:ctv.stream.smil/chunklist_b480000.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://capetowntv.org/wp-content/uploads/2023/01/cropped-Web-icon.png",
    category: ["africa", "entertainment"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 24,
    viewerCount: 95,
    totalViews: 4100,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Cape Town Documentaries",
    nextProgram: "Voices of Africa",
    bandwidthSaverSupported: true
  },
  {
    id: "W7mBoCT7HiRMU5rHVL4J",
    name: "Soweto TV",
    description: "Kituo maarufu zaidi cha jamii cha Soweto: Utamaduni na muziki wa Kwaito",
    streamUrl: "https://cdn.freevisiontv.co.za/sttv/smil:soweto.stream.smil/chunklist_b480000.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHIRfIk1qiekejwXNifTZCXGm0hS1cLmxiqg&s",
    category: ["africa", "music"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 25,
    viewerCount: 110,
    totalViews: 4900,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Soweto Kwaito Legends",
    nextProgram: "Township Stories",
    bandwidthSaverSupported: true
  },
  {
    id: "Vshw4JeUaRpzDcNdlzcn",
    name: "Yahoo Finance Live",
    description: "Mabadiliko ya masoko ya hisa, biashara, uchumi na cryptocurrency",
    streamUrl: "https://d1ewctnvcwvvvu.cloudfront.net/240p-cc/index.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://images-cdn3.welcomesoftware.com/assets/yahoo+finance.jpg/Zz0yNWFjNTk0NjlkMmQxMWVmYjhlNjFlYTY2MTI5N2IyNg==?width=768&height=430",
    category: ["news", "other"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 26,
    viewerCount: 160,
    totalViews: 5900,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Market Movers & Bell Opening",
    nextProgram: "Tech Stocks Review",
    bandwidthSaverSupported: true
  },
  {
    id: "nTlfO9ki3eZrGmTmS8am",
    name: "WILD Network TV",
    description: "Wanyamapori wa Serengeti na Ngorongoro, makala za mazingira",
    streamUrl: "https://dfhsahpa45kk2.cloudfront.net/scheduler/scheduleMaster/476/variant/22100055.m3u8",
    streamFormat: "hls",
    thumbnailUrl: "https://yt3.googleusercontent.com/ZBZVBI42wYc6U1UTNnIkdjrdtB1WKUeAXDhbTwvDk8zjbeGIvMmdxAHOtzOzC75wHtITnqvSGw=s900-c-k-c0x00ffffff-no-rj",
    category: ["documentary", "other"],
    language: "en",
    isActive: true,
    isMaintenance: false,
    isAdult: false,
    order: 27,
    viewerCount: 210,
    totalViews: 7300,
    requiredPackages: ["PAID"],
    encryptionType: "none",
    currentProgram: "Serengeti Great Migration: Predators",
    nextProgram: "Ngorongoro Crater Secrets",
    bandwidthSaverSupported: true
  }
];

export const VIFURUSHI_PLANS = [
  {
    id: "plan_2days",
    name: "Kifurushi cha Siku 2",
    priceTsh: 1000,
    durationDays: 2,
    durationText: "Siku 2",
    badge: "Majaribio ya Wikendi",
    popular: false,
    description: "Inafaa kwa mechi za wikendi na watazamaji wa haraka",
    features: [
      "Chaneli zote za Azam Sports HD",
      "Mechi zote za NBC Premier League",
      "Sinema Zetu na Tamthilia za Azam One",
      "Ubora wa HD & Ulinzi wa Bando (Data Saver)",
      "Kutazama kwenye simu au kompyuta"
    ]
  },
  {
    id: "plan_7days",
    name: "Kifurushi cha Wiki 1",
    priceTsh: 3000,
    durationDays: 7,
    durationText: "Siku 7 (Wiki 1)",
    badge: "Kinachopendwa Zaidi",
    popular: true,
    description: "Bora zaidi kwa wiki nzima ya michezo na vipindi vya burudani",
    features: [
      "Chaneli zote 25+ za Live TV",
      "Azam Sports 1, 2, 3, 4 HD bila kikomo",
      "TNT Sports 1 & 2 kwa ajili ya UEFA",
      "Hali ya Bando Ndogo (Low Bandwidth)",
      "Usaidizi wa haraka saa 24 kupitia WhatsApp"
    ]
  },
  {
    id: "plan_30days",
    name: "Kifurushi cha Mwezi 1",
    priceTsh: 10000,
    durationDays: 30,
    durationText: "Siku 30 (Mwezi 1)",
    badge: "Faida Kubwa",
    popular: false,
    description: "Okoa zaidi kwa mwezi mzima wa burudani na michezo yote",
    features: [
      "Upatikanaji wa mwezi mzima bila kukatika",
      "Chaneli zote za Azam, News, Watoto na Michezo",
      "Tazama kwenye vifaa viwili (Multiple Devices)",
      "Kipaumbele cha server zenye kasi zaidi",
      "Kuthibitisha malipo papo hapo"
    ]
  }
];
