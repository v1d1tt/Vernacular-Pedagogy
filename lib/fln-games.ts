/**
 * FLN Games engine — NIPUN-aligned arcade for Grades 1–3.
 * All strings are localized for the 7 classroom languages so the game
 * (titles, prompts, praise, spoken audio) ALWAYS matches the student's
 * selected language. Numbers are spoken as digits — every TTS voice
 * (hi-IN, bn-IN, en-IN…) renders those in its own language.
 */

export type FlnLang = "hi" | "en" | "sat" | "bn" | "mr" | "ta" | "te";

export function normalizeFlnLang(code: string): FlnLang {
  if (code === "hi" || code === "en" || code === "sat" || code === "bn" || code === "mr" || code === "ta" || code === "te") {
    return code;
  }
  return "hi";
}

export interface FlnWord {
  emoji: string;
  word: Record<FlnLang, string>;
}

// Vocabulary — emoji + word in all 7 languages.
// Santali forms reuse the spellings already used across the app.
export const FLN_WORDS: FlnWord[] = [
  { emoji: "🍎", word: { hi: "सेब", en: "apple", sat: "ᱥᱮᱣ", bn: "আপেল", mr: "सफरचंद", ta: "ஆப்பிள்", te: "యాపిల్" } },
  { emoji: "🥭", word: { hi: "आम", en: "mango", sat: "ᱩᱞ", bn: "আম", mr: "आंबा", ta: "மாம்பழம்", te: "మామిడి" } },
  { emoji: "🐘", word: { hi: "हाथी", en: "elephant", sat: "ᱦᱟᱹᱛᱤ", bn: "হাতি", mr: "हत्ती", ta: "யானை", te: "ఏనుగు" } },
  { emoji: "🐟", word: { hi: "मछली", en: "fish", sat: "ᱦᱟᱹᱠᱩ", bn: "মাছ", mr: "मासा", ta: "மீன்", te: "చేప" } },
  { emoji: "☀️", word: { hi: "सूरज", en: "sun", sat: "ᱥᱤᱸᱜᱤ", bn: "সূর্য", mr: "सूर्य", ta: "சூரியன்", te: "సూర్యుడు" } },
  { emoji: "🌳", word: { hi: "पेड़", en: "tree", sat: "ᱫᱟᱨᱮ", bn: "গাছ", mr: "झाड", ta: "மரம்", te: "చెట్టు" } },
  { emoji: "🐦", word: { hi: "चिड़िया", en: "bird", sat: "ᱪᱮᱬᱮ", bn: "পাখি", mr: "पक्षी", ta: "பறவை", te: "పక్షి" } },
  { emoji: "⚽", word: { hi: "गेंद", en: "ball", sat: "ᱵᱚᱞ", bn: "বল", mr: "चेंडू", ta: "பந்து", te: "బంతి" } },
  { emoji: "🌸", word: { hi: "फूल", en: "flower", sat: "ᱵᱟᱦᱟ", bn: "ফুল", mr: "फूल", ta: "மலர்", te: "పువ్వు" } },
  { emoji: "💧", word: { hi: "पानी", en: "water", sat: "ᱫᱟᱜ", bn: "জল", mr: "पाणी", ta: "தண்ணீர்", te: "నీరు" } },
];

export interface FlnStrings {
  pickGame: string;
  countName: string;
  countDesc: string;
  phonicsName: string;
  phonicsDesc: string;
  matchName: string;
  matchDesc: string;
  addName: string;
  addDesc: string;
  howMany: (item: string) => string;
  firstSound: (word: string) => string;
  pickWord: string;
  addUp: (a: number, b: number) => string;
  praise: string[];
  encourage: string[];
  streak: string;
  newRound: string;
  listen: string;
}

export const FLN_STRINGS: Record<FlnLang, FlnStrings> = {
  hi: {
    pickGame: "खेल चुनो",
    countName: "गिनती करो",
    countDesc: "चित्र में चीज़ें गिनो",
    phonicsName: "पहली आवाज़",
    phonicsDesc: "शब्द किस अक्षर से शुरू होता है?",
    matchName: "शब्द मिलाओ",
    matchDesc: "चित्र का सही शब्द चुनो",
    addName: "जोड़ करो",
    addDesc: "दो संख्याओं को जोड़ो",
    howMany: (item) => `कितने ${item} हैं?`,
    firstSound: (word) => `'${word}' किस अक्षर से शुरू होता है?`,
    pickWord: "सही शब्द चुनो",
    addUp: (a, b) => `${a} और ${b} मिलाकर कितने हुए?`,
    praise: ["शाबाश! बहुत बढ़िया!", "सही जवाब!", "कमाल कर दिया!"],
    encourage: ["कोई बात नहीं, फिर कोशिश करो", "ध्यान से देखो, तुम कर सकते हो"],
    streak: "लगातार",
    newRound: "नया राउंड",
    listen: "सुनो",
  },
  en: {
    pickGame: "Pick a game",
    countName: "Count It",
    countDesc: "Count the things in the picture",
    phonicsName: "First Sound",
    phonicsDesc: "Which letter does the word start with?",
    matchName: "Word Match",
    matchDesc: "Pick the right word for the picture",
    addName: "Add Up",
    addDesc: "Add two numbers together",
    howMany: (item) => `How many ${item}s?`,
    firstSound: (word) => `Which letter does '${word}' start with?`,
    pickWord: "Pick the correct word",
    addUp: (a, b) => `What is ${a} + ${b}?`,
    praise: ["Great job!", "Correct!", "Amazing work!"],
    encourage: ["No problem, try again", "Look carefully, you can do it"],
    streak: "Streak",
    newRound: "New round",
    listen: "Listen",
  },
  sat: {
    pickGame: "ᱮᱱᱮᱡ ᱵᱟᱪᱷᱟᱣ ᱢᱮ",
    countName: "ᱞᱮᱠᱷᱟ",
    countDesc: "ᱪᱤᱛᱟᱹᱨ ᱨᱮ ᱡᱤᱱᱤᱥ ᱞᱮᱠᱷᱟᱭ ᱢᱮ",
    phonicsName: "ᱯᱟᱹᱦᱤᱞ ᱥᱟᱰᱮ",
    phonicsDesc: "ᱟᱹᱲᱟᱹ ᱚᱠᱟ ᱟᱠᱷᱚᱨ ᱛᱮ ᱮᱦᱚᱵᱚᱜᱼᱟ?",
    matchName: "ᱟᱹᱲᱟᱹ ᱡᱚᱲᱟᱣ",
    matchDesc: "ᱪᱤᱛᱟᱹᱨ ᱞᱟᱹᱜᱤᱫ ᱥᱟᱹᱨᱤ ᱟᱹᱲᱟᱹ ᱵᱟᱪᱷᱟᱣ ᱢᱮ",
    addName: "ᱡᱚᱲ",
    addDesc: "ᱵᱟᱨᱭᱟ ᱮᱞᱠᱷᱟ ᱡᱚᱲᱟᱣ ᱢᱮ",
    howMany: (item) => `ᱛᱤᱱᱟᱹᱜ ${item} ᱢᱮᱱᱟᱜᱼᱟ?`,
    firstSound: (word) => `'${word}' ᱚᱠᱟ ᱟᱠᱷᱚᱨ ᱛᱮ ᱮᱦᱚᱵᱚᱜᱼᱟ?`,
    pickWord: "ᱥᱟᱹᱨᱤ ᱟᱹᱲᱟᱹ ᱵᱟᱪᱷᱟᱣ ᱢᱮ",
    addUp: (a, b) => `${a} ᱟᱨ ${b} ᱡᱚᱲ ᱞᱮᱠᱷᱟᱱ ᱛᱤᱱᱟᱹᱜ?`,
    praise: ["ᱟᱹᱰᱤ ᱵᱮᱥ!", "ᱥᱟᱹᱨᱤ ᱜᱮ!", "ᱟᱹᱰᱤ ᱱᱟᱯᱟᱭ!"],
    encourage: ["ᱪᱤᱱᱛᱟᱹ ᱟᱞᱚᱢ, ᱟᱨ ᱢᱤᱫ ᱫᱷᱟᱣ ᱠᱩᱨᱩᱢᱩᱴᱩ", "ᱥᱟᱹᱨᱤ ᱧᱮᱞ ᱢᱮ, ᱟᱢ ᱵᱟᱱᱟᱢᱟ!"],
    streak: "ᱞᱟᱦᱟ",
    newRound: "ᱱᱟᱶᱟ ᱮᱱᱮᱡ",
    listen: "ᱟᱸᱡᱚᱢ",
  },
  bn: {
    pickGame: "খেলা বেছে নাও",
    countName: "গণনা করো",
    countDesc: "ছবিতে জিনিস গুনো",
    phonicsName: "প্রথম ধ্বনি",
    phonicsDesc: "শব্দটি কোন অক্ষর দিয়ে শুরু?",
    matchName: "শব্দ মেলাও",
    matchDesc: "ছবির সঠিক শব্দ বেছে নাও",
    addName: "যোগ করো",
    addDesc: "দুটি সংখ্যা যোগ করো",
    howMany: (item) => `কয়টি ${item}?`,
    firstSound: (word) => `'${word}' কোন অক্ষর দিয়ে শুরু?`,
    pickWord: "সঠিক শব্দ বেছে নাও",
    addUp: (a, b) => `${a} + ${b} = কত?`,
    praise: ["সাবাশ! খুব ভালো!", "সঠিক উত্তর!", "দারুণ কাজ!"],
    encourage: ["কোনো ব্যাপার না, আবার চেষ্টা করো", "ভালো করে দেখো, তুমি পারবে"],
    streak: "ধারা",
    newRound: "নতুন রাউন্ড",
    listen: "শোনো",
  },
  mr: {
    pickGame: "खेळ निवडा",
    countName: "मोजणी करा",
    countDesc: "चित्रातील वस्तू मोजा",
    phonicsName: "पहिला आवाज",
    phonicsDesc: "शब्द कोणत्या अक्षराने सुरू होतो?",
    matchName: "शब्द जुळवा",
    matchDesc: "चित्रासाठी योग्य शब्द निवडा",
    addName: "बेरीज करा",
    addDesc: "दोन संख्या जोडा",
    howMany: (item) => `किती ${item}?`,
    firstSound: (word) => `'${word}' कोणत्या अक्षराने सुरू होतो?`,
    pickWord: "योग्य शब्द निवडा",
    addUp: (a, b) => `${a} + ${b} = किती?`,
    praise: ["शाब्बास! खूप छान!", "बरोबर उत्तर!", "छान काम!"],
    encourage: ["हरकत नाही, पुन्हा प्रयत्न करा", "नीट पाहा, तुम्ही करू शकता"],
    streak: "मालिका",
    newRound: "नवीन फेरी",
    listen: "ऐका",
  },
  ta: {
    pickGame: "விளையாட்டைத் தேர்ந்தெடு",
    countName: "எண்ணுங்கள்",
    countDesc: "படத்தில் உள்ளவற்றை எண்ணுங்கள்",
    phonicsName: "முதல் ஒலி",
    phonicsDesc: "சொல் எந்த எழுத்தில் தொடங்குகிறது?",
    matchName: "சொல் பொருத்து",
    matchDesc: "படத்திற்கான சரியான சொல்லைத் தேர்ந்தெடு",
    addName: "கூட்டல்",
    addDesc: "இரண்டு எண்களைக் கூட்டுங்கள்",
    howMany: (item) => `எத்தனை ${item}?`,
    firstSound: (word) => `'${word}' எந்த எழுத்தில் தொடங்குகிறது?`,
    pickWord: "சரியான சொல்லைத் தேர்ந்தெடு",
    addUp: (a, b) => `${a} + ${b} = எவ்வளவு?`,
    praise: ["அருமை! மிக நன்று!", "சரியான விடை!", "அற்புதம்!"],
    encourage: ["பரவாயில்லை, மீண்டும் முயற்சி செய்", "கவனமாகப் பார், உன்னால் முடியும்"],
    streak: "தொடர்",
    newRound: "புதிய சுற்று",
    listen: "கேள்",
  },
  te: {
    pickGame: "ఆటను ఎంచుకో",
    countName: "లెక్కించు",
    countDesc: "చిత్రంలోని వస్తువులను లెక్కించు",
    phonicsName: "మొదటి ధ్వని",
    phonicsDesc: "పదం ఏ అక్షరంతో మొదలవుతుంది?",
    matchName: "పదం జతచేయి",
    matchDesc: "చిత్రానికి సరైన పదాన్ని ఎంచుకో",
    addName: "కూడిక",
    addDesc: "రెండు సంఖ్యలను కూడించు",
    howMany: (item) => `ఎన్ని ${item}?`,
    firstSound: (word) => `'${word}' ఏ అక్షరంతో మొదలవుతుంది?`,
    pickWord: "సరైన పదాన్ని ఎంచుకో",
    addUp: (a, b) => `${a} + ${b} = ఎంత?`,
    praise: ["భేష్! చాలా బాగుంది!", "సరైన సమాధానం!", "అద్భుతం!"],
    encourage: ["పర్వాలేదు, మళ్లీ ప్రయత్నించు", "జాగ్రత్తగా చూడు, నువ్వు చేయగలవు"],
    streak: "వరుస",
    newRound: "కొత్త రౌండ్",
    listen: "విను",
  },
};

// ── Round generators (pure, grade-scaled) ─────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number, exclude?: (x: T) => boolean): T[] {
  const pool = shuffle(arr.filter((x) => (exclude ? !exclude(x) : true)));
  return pool.slice(0, n);
}

export interface CountRound {
  kind: "count";
  emoji: string;
  item: string;
  count: number;
  options: string[];
}

export function countRange(grade: number): [number, number] {
  if (grade <= 1) return [2, 5];
  if (grade === 2) return [4, 8];
  return [6, 12];
}

export function genCountRound(lang: FlnLang, grade: number): CountRound {
  const w = FLN_WORDS[randInt(0, FLN_WORDS.length - 1)];
  const [lo, hi] = countRange(grade);
  const count = randInt(lo, hi);
  const opts = new Set<string>([String(count)]);
  while (opts.size < 4) {
    const d = count + randInt(-2, 2);
    if (d >= 1 && d <= 15) opts.add(String(d));
  }
  return { kind: "count", emoji: w.emoji, item: w.word[lang], count, options: shuffle([...opts]) };
}

export interface PhonicsRound {
  kind: "phonics";
  emoji: string;
  word: string;
  letter: string;
  options: string[];
}

export function genPhonicsRound(lang: FlnLang): PhonicsRound {
  const w = FLN_WORDS[randInt(0, FLN_WORDS.length - 1)];
  const word = w.word[lang];
  const letter = word.charAt(0);
  // Distractors are first-letters of OTHER words in the SAME language —
  // always script-appropriate, never a foreign alphabet.
  const otherLetters = shuffle(
    FLN_WORDS.map((x) => x.word[lang].charAt(0)).filter((ch) => ch !== letter)
  );
  const opts = new Set<string>([letter]);
  for (const ch of otherLetters) {
    if (opts.size >= 3) break;
    opts.add(ch);
  }
  return { kind: "phonics", emoji: w.emoji, word, letter, options: shuffle([...opts]) };
}

export interface MatchRound {
  kind: "match";
  emoji: string;
  word: string;
  options: string[];
}

export function genMatchRound(lang: FlnLang): MatchRound {
  const w = FLN_WORDS[randInt(0, FLN_WORDS.length - 1)];
  const word = w.word[lang];
  const others = pickN(FLN_WORDS, 2, (x) => x.emoji === w.emoji).map((x) => x.word[lang]);
  return { kind: "match", emoji: w.emoji, word, options: shuffle([word, ...others]) };
}

export interface AddRound {
  kind: "add";
  a: number;
  b: number;
  answer: string;
  options: string[];
}

export function genAddRound(grade: number): AddRound {
  const max = grade <= 1 ? 3 : grade === 2 ? 8 : 9;
  const min = grade <= 1 ? 1 : 2;
  const a = randInt(min, max);
  const b = randInt(min, max);
  const ans = a + b;
  const opts = new Set<string>([String(ans)]);
  const deltas = shuffle([-2, -1, 1, 2, 3, -3]);
  for (const d of deltas) {
    if (opts.size >= 4) break;
    if (ans + d >= 0) opts.add(String(ans + d));
  }
  return { kind: "add", a, b, answer: String(ans), options: shuffle([...opts]) };
}

export type ArcadeRound = CountRound | PhonicsRound | MatchRound | AddRound;

export function pickPraise(lang: FlnLang): string {
  const arr = FLN_STRINGS[lang].praise;
  return arr[randInt(0, arr.length - 1)];
}

export function pickEncourage(lang: FlnLang): string {
  const arr = FLN_STRINGS[lang].encourage;
  return arr[randInt(0, arr.length - 1)];
}

// ── Default "no broadcast yet" greeting per language ──────────────────
// The Listen tab shows this until the first live broadcast arrives.
// (Previously a hardcoded Hindi string played even for English students.)
export const DEFAULT_GREETINGS: Record<FlnLang, string> = {
  hi: "नमस्ते बच्चों, आज हम कक्षा में नई चीज़ें सीखेंगे।",
  en: "Hello children, today we will learn new things in class.",
  sat: "ᱡᱚᱦᱟᱨ ᱜᱤᱫᱽᱨᱟᱹ, ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱱᱟᱶᱟ ᱡᱤᱱᱤᱥ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ᱾",
  bn: "নমস্কার বাচ্চারা, আজ আমরা নতুন কিছু শিখব।",
  mr: "नमस्कार मुलांनो, आज आपण नवीन गोष्टी शिकणार आहोत।",
  ta: "வணக்கம் குழந்தைகளே, இன்று நாம் புதிய விஷயங்களைக் கற்றுக்கொள்வோம்.",
  te: "నమస్కారం పిల్లలు, ఈరోజు మనం కొత్త విషయాలు నేర్చుకుందాం.",
};

// ── Teacher-generated (server) games ──────────────────────────────────

export interface ServerGame {
  id?: string;
  title: string;
  instruction?: string;
  visual?: string;
  audio_text?: string;
  options: string[];
  correct: string;
  points?: number;
  type?: string;
}

export function isServerGameList(v: unknown): v is ServerGame[] {
  return Array.isArray(v) && v.length > 0 && typeof (v[0] as Record<string, unknown>).correct === "string";
}
