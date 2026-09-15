/**
 * Language Dump — prompt pack for bootstrapping a NEW app language.
 * A native speaker reads each reference prompt aloud in-app; the export
 * bundle (reference text + 16kHz PCM recordings) is what developers use to
 * add TRANSLATIONS entries, transliterators, and ASR/TTS fine-tuning data.
 */

export interface DumpPrompt {
  id: string;
  category: "Greetings" | "Classroom" | "Numbers" | "Words" | "School";
  reference: string;
}

export const DUMP_PROMPTS: DumpPrompt[] = [
  // Greetings
  { id: "g1", category: "Greetings", reference: "Hello children" },
  { id: "g2", category: "Greetings", reference: "Good morning" },
  { id: "g3", category: "Greetings", reference: "How are you?" },
  { id: "g4", category: "Greetings", reference: "Thank you" },
  { id: "g5", category: "Greetings", reference: "Well done, excellent!" },
  // Classroom
  { id: "c1", category: "Classroom", reference: "Today we will learn addition in mathematics." },
  { id: "c2", category: "Classroom", reference: "How many apples are on the tree?" },
  { id: "c3", category: "Classroom", reference: "What do we get when we add two to three?" },
  { id: "c4", category: "Classroom", reference: "Please open your books." },
  { id: "c5", category: "Classroom", reference: "Raise your hand to speak." },
  { id: "c6", category: "Classroom", reference: "Listen carefully." },
  { id: "c7", category: "Classroom", reference: "Repeat after me." },
  { id: "c8", category: "Classroom", reference: "Class is over for today." },
  // Numbers
  { id: "n1", category: "Numbers", reference: "One" },
  { id: "n2", category: "Numbers", reference: "Two" },
  { id: "n3", category: "Numbers", reference: "Three" },
  { id: "n4", category: "Numbers", reference: "Four" },
  { id: "n5", category: "Numbers", reference: "Five" },
  { id: "n6", category: "Numbers", reference: "Six" },
  { id: "n7", category: "Numbers", reference: "Seven" },
  { id: "n8", category: "Numbers", reference: "Eight" },
  { id: "n9", category: "Numbers", reference: "Nine" },
  { id: "n10", category: "Numbers", reference: "Ten" },
  // Words
  { id: "w1", category: "Words", reference: "Sun" },
  { id: "w2", category: "Words", reference: "Tree" },
  { id: "w3", category: "Words", reference: "Water" },
  { id: "w4", category: "Words", reference: "Flower" },
  { id: "w5", category: "Words", reference: "Apple" },
  { id: "w6", category: "Words", reference: "Elephant" },
  { id: "w7", category: "Words", reference: "Fish" },
  { id: "w8", category: "Words", reference: "Bird" },
  // School tasks
  { id: "s1", category: "School", reference: "Read the sentence aloud." },
  { id: "s2", category: "School", reference: "Write two sentences." },
  { id: "s3", category: "School", reference: "Count the stars." },
  { id: "s4", category: "School", reference: "Draw a circle." },
];

export const DUMP_PROMPTS_HI: Record<string, string> = {
  g1: "नमस्ते बच्चों",
  g2: "सुप्रभात",
  g3: "आप कैसे हैं?",
  g4: "धन्यवाद",
  g5: "बहुत बढ़िया, अति उत्तम!",
  c1: "आज हम गणित में जोड़ना सीखेंगे।",
  c2: "पेड़ पर कितने सेब हैं?",
  c3: "दो में तीन जोड़ने पर क्या मिलेगा?",
  c4: "कृपया अपनी पुस्तकें खोलें।",
  c5: "बोलने के लिए हाथ उठाएं।",
  c6: "ध्यान से सुनें।",
  c7: "मेरे बाद दोहराएं।",
  c8: "आज की कक्षा समाप्त हुई।",
  n1: "एक",
  n2: "दो",
  n3: "तीन",
  n4: "चार",
  n5: "पांच",
  n6: "छह",
  n7: "सात",
  n8: "आठ",
  n9: "नौ",
  n10: "दस",
  w1: "सूरज",
  w2: "पेड़",
  w3: "पानी",
  w4: "फूल",
  w5: "सेब",
  w6: "हाथी",
  w7: "मछली",
  w8: "पक्षी",
  s1: "वाक्य को ज़ोर से पढ़ें।",
  s2: "दो वाक्य लिखें।",
  s3: "तारों की गिनती करें।",
  s4: "एक वृत्त बनाएं।",
};

export function getPromptReference(prompt: DumpPrompt, lang: string): string {
  if (lang === "hi") {
    return DUMP_PROMPTS_HI[prompt.id] || prompt.reference;
  }
  return prompt.reference;
}

export interface DumpRecording {
  audioBase64: string;
  recordedAt: string;
}

export type DumpRecordings = Record<string, DumpRecording>;

/**
 * Wraps 16kHz mono PCM16 base64 in a WAV container for in-app playback.
 */
export function pcmBase64ToWavUrl(base64Pcm: string, sampleRate = 16000): string {
  const binary = atob(base64Pcm);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + len, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, len, true);

  const blob = new Blob([buffer, bytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

export function buildDumpExport(
  langName: string,
  langCode: string,
  contributor: string,
  recordings: DumpRecordings
) {
  return {
    schema: "vaaniverse-language-dump/1",
    language: { name: langName.trim(), code: langCode.trim().toLowerCase() },
    contributor: contributor.trim(),
    exportedAt: new Date().toISOString(),
    sampleRate: 16000,
    encoding: "pcm16-base64-mono",
    prompts: DUMP_PROMPTS,
    recordings,
    recordedCount: Object.keys(recordings).length,
    totalPrompts: DUMP_PROMPTS.length,
  };
}
