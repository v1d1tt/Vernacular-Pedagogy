/**
 * Ol Chiki (Santali script) phonetic converter for Text-To-Speech systems.
 * Standard Android TTS and Web SpeechSynthesis engines lack native Ol Chiki
 * Unicode font/phoneme tables. Transliterating to Devanagari/Roman phonetics
 * allows Indian English and Hindi TTS engines (hi-IN) to speak Santali naturally.
 */

const OL_CHIKI_TO_DEVANAGARI: Record<string, string> = {
  // Vowels
  '\u1C5A': 'अ', // LA / O
  '\u1C5F': 'आ', // LAA / A
  '\u1C64': 'इ', // LI / I
  '\u1C69': 'उ', // LU / U
  '\u1C6E': 'ए', // LE / E
  '\u1C73': 'ओ', // LO / O

  // Consonants
  '\u1C5B': 'त', // AT
  '\u1C5C': 'ग', // AG
  '\u1C5D': 'ं', // ANG
  '\u1C5E': 'ल', // AL
  '\u1C60': 'क', // AAK
  '\u1C61': 'ज', // AAJ
  '\u1C62': 'म', // AAM
  '\u1C63': 'व', // AAW
  '\u1C65': 'स', // IS
  '\u1C66': 'ह', // IH
  '\u1C67': 'ञ', // INY
  '\u1C68': 'र', // IR
  '\u1C6A': 'च', // UC
  '\u1C6B': 'द', // UD
  '\u1C6C': 'ण', // UNH
  '\u1C6D': 'य', // UY
  '\u1C6F': 'प', // EP
  '\u1C70': 'ड', // EDD
  '\u1C71': 'न', // EN
  '\u1C72': 'ड़', // ERR
  '\u1C74': 'ट', // OTT
  '\u1C75': 'ब', // OB
  '\u1C76': 'व', // OV
  '\u1C77': 'ह', // OH

  // Modifiers & Punctuation
  '\u1C78': 'ं', // MU TUNDAG (nasalization)
  '\u1C79': '',  // GAHLAD TUNDAG (low pitch modifier)
  '\u1C7A': '',  // MU-GAHLAD TUNDAG
  '\u1C7B': '',  // RELA (lengthening)
  '\u1C7C': '',  // PHAARKAA (glottal break)
  '\u1C7D': '',  // AHAD (checked consonant degenerator)
  '\u1C7E': '।', // PUNCTUATION MUCAAD (single bar)
  '\u1C7F': '॥', // PUNCTUATION DOUBLE MUCAAD (double bar)

  // Digits
  '\u1C50': '०',
  '\u1C51': '१',
  '\u1C52': '२',
  '\u1C53': '३',
  '\u1C54': '४',
  '\u1C55': '५',
  '\u1C56': '६',
  '\u1C57': '७',
  '\u1C58': '८',
  '\u1C59': '९',
};

const OL_CHIKI_TO_ROMAN: Record<string, string> = {
  '\u1C5A': 'o',
  '\u1C5F': 'a',
  '\u1C64': 'i',
  '\u1C69': 'u',
  '\u1C6E': 'e',
  '\u1C73': 'o',
  '\u1C5B': 't',
  '\u1C5C': 'g',
  '\u1C5D': 'ng',
  '\u1C5E': 'l',
  '\u1C60': 'k',
  '\u1C61': 'j',
  '\u1C62': 'm',
  '\u1C63': 'w',
  '\u1C65': 's',
  '\u1C66': 'h',
  '\u1C67': 'n',
  '\u1C68': 'r',
  '\u1C6A': 'ch',
  '\u1C6B': 'd',
  '\u1C6C': 'n',
  '\u1C6D': 'y',
  '\u1C6F': 'p',
  '\u1C70': 'd',
  '\u1C71': 'n',
  '\u1C72': 'r',
  '\u1C74': 't',
  '\u1C75': 'b',
  '\u1C76': 'v',
  '\u1C77': 'h',
  '\u1C78': 'n',
  '\u1C79': '',
  '\u1C7A': '',
  '\u1C7B': '',
  '\u1C7C': '',
  '\u1C7D': '',
  '\u1C7E': '.',
  '\u1C7F': '.',
  '\u1C50': '0',
  '\u1C51': '1',
  '\u1C52': '2',
  '\u1C53': '3',
  '\u1C54': '4',
  '\u1C55': '5',
  '\u1C56': '6',
  '\u1C57': '7',
  '\u1C58': '8',
  '\u1C59': '9',
};

export function hasOlChiki(text: string): boolean {
  return /[\u1C50-\u1C7F]/.test(text);
}

export function olChikiToDevanagari(text: string): string {
  return text
    .split("")
    .map((char) => OL_CHIKI_TO_DEVANAGARI[char] !== undefined ? OL_CHIKI_TO_DEVANAGARI[char] : char)
    .join("");
}

export function olChikiToRoman(text: string): string {
  return text
    .split("")
    .map((char) => OL_CHIKI_TO_ROMAN[char] !== undefined ? OL_CHIKI_TO_ROMAN[char] : char)
    .join("");
}

/**
 * Prepares any text for reliable speech synthesis.
 * If text contains Ol Chiki script, transliterates it to Devanagari so
 * Hindi/Indian TTS voices can articulate the Santali words phonetically.
 * Falls back to Roman phonetics when Devanagari would be empty or when
 * the caller detects that no hi-IN voice is available on the device.
 */
export function prepareTtsText(text: string, lang: string): { speechText: string; speechLang: string; altText?: string; altLang?: string } {
  if (lang === "sat" || hasOlChiki(text)) {
    const devText = olChikiToDevanagari(text);
    const roman = olChikiToRoman(text);
    const hasDev = devText.trim().length >= 2;
    // Primary: Devanagari + hi-IN (Piper / native Hindi voice)
    // Alternate: Roman + en-IN (guaranteed to exist on every device)
    if (hasDev) {
      return {
        speechText: devText.trim(),
        speechLang: "hi-IN",
        altText: roman.trim() || devText.trim(),
        altLang: "en-IN",
      };
    }
    return {
      speechText: roman.trim() || text,
      speechLang: "en-IN",
      altText: devText.trim() || roman.trim(),
      altLang: "hi-IN",
    };
  }

  const langCodeMap: Record<string, string> = {
    hi: "hi-IN",
    en: "en-IN",
    bn: "bn-IN",
    mr: "mr-IN",
    ta: "ta-IN",
    te: "te-IN",
    sat: "hi-IN",
  };

  return {
    speechText: text,
    speechLang: langCodeMap[lang] || "hi-IN",
  };
}

export function getBestVoiceForLang(voices: SpeechSynthesisVoice[], targetLang: string): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;
  const norm = (s: string) => (s || "").toLowerCase().replace("_", "-");
  const target = norm(targetLang);
  const prefix = target.split("-")[0];
  // 1. exact match e.g. hi-IN == hi-IN
  const exact = voices.find((v) => norm(v.lang) === target);
  if (exact) return exact;
  // 2. prefix match e.g. hi-IN matches hi
  const pref = voices.find((v) => norm(v.lang).startsWith(prefix));
  if (pref) return pref;
  // 3. any Indian voice for Santali / Hindi fallback chain
  if (prefix === "hi" || targetLang === "sat") {
    const indian = voices.find((v) => norm(v.lang).includes("-in") || norm(v.lang).includes("in"));
    if (indian) return indian;
    const hindiName = voices.find((v) => (v.name || "").toLowerCase().includes("hindi"));
    if (hindiName) return hindiName;
  }
  return voices[0];
}
