"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchActiveSessions,
  joinSession,
  connectWebSocket,
  transcribeAudio,
  broadcastSpeech,
  detectActiveEdgeServer,
  setEdgeServerUrl,
  getEdgeServerUrl,
  raiseHand,
  fetchPublishedActivities,
  getSessionByCode,
  WSHandle,
} from "@/lib/api-client";
import { getLocalizedSubjectKey } from "@/lib/nipun-data";
import { AudioRecorder } from "@/lib/audio-recorder";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import { AvatarGuide, useAvatarGuide } from "@/components/ui/avatar-guide";
import { QrScanner, parseJoinQr } from "@/components/qr-scanner";
import {
  Volume2,
  Hand,
  HelpCircle,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Mic,
  Award,
  Globe,
  Square,
  Sparkles,
  Key,
  X,
  Hash,
  Type,
  Shapes,
  Plus,
  RotateCcw,
  Flame,
  QrCode,
  Server,
  RefreshCw,
} from "lucide-react";
import { Mascot } from "@/components/mascot";


import { prepareTtsText, getBestVoiceForLang, hasOlChiki, olChikiToRoman } from "@/lib/ol-chiki";
import {
  FLN_STRINGS,
  DEFAULT_GREETINGS,
  normalizeFlnLang,
  genCountRound,
  genPhonicsRound,
  genMatchRound,
  genAddRound,
  pickPraise,
  pickEncourage,
  isServerGameList,
  type ServerGame,
  type ArcadeRound,
} from "@/lib/fln-games";


export interface StudentActivity {
  activity_id: string;
  activity_type: string;
  title: string;
  domain: string;
  content: {
    questions?: Array<{
      id: string;
      question: string;
      visual?: string;
      options: string[];
      correct?: string;
      correct_answer?: string;
    }>;
    cards?: Array<{
      word: string;
      phonics?: string;
      meaning?: string;
      visual?: string;
      color?: string;
    }>;
    tasks?: Array<{
      task: string;
      answer?: string;
    }>;
    games?: ServerGame[];
  };
}

const FLASHCARDS_DATA: Record<string, Array<{ word: string; eng: string; desc: string; visual: string; tint: string }>> = {
  hi: [
    { word: "सूर्य", eng: "Sun", desc: "आसमान का चमकता तारा", visual: "☀️", tint: "var(--amber-tint)" },
    { word: "पेड़", eng: "Tree", desc: "छाया और ऑक्सीजन देता है", visual: "🌳", tint: "var(--green-tint)" },
    { word: "पानी", eng: "Water", desc: "जीवन के लिए सबसे ज़रूरी", visual: "💧", tint: "var(--brand-tint)" },
    { word: "फूल", eng: "Flower", desc: "रंग-बिरंगा और सुगंधित", visual: "🌸", tint: "var(--red-tint)" },
  ],
  en: [
    { word: "Sun", eng: "Sun", desc: "The bright star in our sky", visual: "☀️", tint: "var(--amber-tint)" },
    { word: "Tree", eng: "Tree", desc: "Gives us shade and oxygen", visual: "🌳", tint: "var(--green-tint)" },
    { word: "Water", eng: "Water", desc: "Essential for all living things", visual: "💧", tint: "var(--brand-tint)" },
    { word: "Flower", eng: "Flower", desc: "Colourful and fragrant", visual: "🌸", tint: "var(--red-tint)" },
  ],
  bn: [
    { word: "সূর্য", eng: "Sun", desc: "আকাশের উজ্জ্বল তারা", visual: "☀️", tint: "var(--amber-tint)" },
    { word: "গাছ", eng: "Tree", desc: "ছায়া এবং অক্সিজেন দেয়", visual: "🌳", tint: "var(--green-tint)" },
    { word: "জল", eng: "Water", desc: "সব জীবের জন্য প্রয়োজনীয়", visual: "💧", tint: "var(--brand-tint)" },
    { word: "ফুল", eng: "Flower", desc: "রঙিন এবং সুবাসিত", visual: "🌸", tint: "var(--red-tint)" },
  ],
  mr: [
    { word: "सूर्य", eng: "Sun", desc: "आकाशातील तेजस्वी तारा", visual: "☀️", tint: "var(--amber-tint)" },
    { word: "झाड", eng: "Tree", desc: "सावली आणि ऑक्सिजन देते", visual: "🌳", tint: "var(--green-tint)" },
    { word: "पाणी", eng: "Water", desc: "सर्व सजीवांसाठी आवश्यक", visual: "💧", tint: "var(--brand-tint)" },
    { word: "फूल", eng: "Flower", desc: "रंगीबेरंगी आणि सुवासिक", visual: "🌸", tint: "var(--red-tint)" },
  ],
  ta: [
    { word: "சூரியன்", eng: "Sun", desc: "வானில் ஒளிரும் விண்மீன்", visual: "☀️", tint: "var(--amber-tint)" },
    { word: "மரம்", eng: "Tree", desc: "நிழலும் ஆக்சிஜனும் தருகிறது", visual: "🌳", tint: "var(--green-tint)" },
    { word: "தண்ணீர்", eng: "Water", desc: "உயிர்களுக்கு இன்றியமையாதது", visual: "💧", tint: "var(--brand-tint)" },
    { word: "மலர்", eng: "Flower", desc: "வண்ணமயமான மற்றும் மணமுள்ள", visual: "🌸", tint: "var(--red-tint)" },
  ],
  te: [
    { word: "సూర్యుడు", eng: "Sun", desc: "ఆకాశంలో ప్రకాశించే నక్షత్రం", visual: "☀️", tint: "var(--amber-tint)" },
    { word: "చెట్టు", eng: "Tree", desc: "నీడ మరియు ఆక్సిజన్ ఇస్తుంది", visual: "🌳", tint: "var(--green-tint)" },
    { word: "నీరు", eng: "Water", desc: "జీవులన్నింటికీ అవసరమైనది", visual: "💧", tint: "var(--brand-tint)" },
    { word: "పువ్వు", eng: "Flower", desc: "రంగురంగుల మరియు సువాసనగల", visual: "🌸", tint: "var(--red-tint)" },
  ],
  sat: [
    { word: "ᱥᱤᱧ ᱪᱟᱸᱫᱚ", eng: "Sun", desc: "ᱥᱮᱨᱢᱟ ᱨᱮ ᱡᱩᱞᱩᱜ ᱠᱟᱱᱟ", visual: "☀️", tint: "var(--amber-tint)" },
    { word: "ᱫᱟᱨᱮ", eng: "Tree", desc: "ᱩᱢᱩᱞ ᱟᱨ ᱦᱚᱭ ᱮᱢᱚᱜᱼᱟ", visual: "🌳", tint: "var(--green-tint)" },
    { word: "ᱫᱟᱜ", eng: "Water", desc: "ᱡᱤᱣᱤ ᱞᱟᱹᱜᱤᱫ ᱡᱟᱹᱨᱩᱲ ᱠᱟᱱᱟ", visual: "💧", tint: "var(--brand-tint)" },
    { word: "ᱵᱟᱦᱟ", eng: "Flower", desc: "ᱨᱚᱝᱼᱵᱮᱨᱚᱝ ᱟᱨ ᱥᱚ ᱟᱱᱟᱜ", visual: "🌸", tint: "var(--red-tint)" },
  ],
};

type WindowWithAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
  _audioCtx?: AudioContext;
  _activeUtterance?: SpeechSynthesisUtterance | null;
  _activeAudio?: HTMLAudioElement | null;
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

// Helper to wait for SpeechSynthesis voices asynchronously
const getVoicesAsync = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return resolve([]);
    }
    const current = window.speechSynthesis.getVoices();
    if (current && current.length > 0) {
      return resolve(current);
    }
    let resolved = false;
    const handleVoicesChanged = () => {
      if (resolved) return;
      resolved = true;
      window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(window.speechSynthesis.getVoices());
      }
    }, 450);
  });
};

export default function StudentConsole() {
  const router = useRouter();
  const { t, lang: appLang, currentLanguage } = useLanguage();
  const [studentName, setStudentName] = useState("Aarav");
  const [studentLang, setStudentLang] = useState("hi");
  const [studentLangName, setStudentLangName] = useState("Hindi");
  const [grade, setGrade] = useState(2);
  const [participantId] = useState("P-" + Math.floor(Math.random() * 1000));
  const [serverParticipantId, setServerParticipantId] = useState<string | null>(null);
  const [joinedSession, setJoinedSession] = useState<{ session_id: string } | null>(null);
  const [activeClassCode, setActiveClassCode] = useState<string>("");
  const [classSubject, setClassSubject] = useState<string>("");
  const [classGrade, setClassGrade] = useState<number | null>(null);
  const [serverUrl, setServerUrlState] = useState("");
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverDetecting, setServerDetecting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverInput, setServerInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WSHandle | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [newCodeInput, setNewCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [teacherMicLive, setTeacherMicLive] = useState(false);
  const [activeTab, setActiveTab] = useState<"LISTEN" | "QUIZ" | "WORKSHEET" | "FLASHCARDS" | "GAMES">("LISTEN");
  const [gameScore, setGameScore] = useState<number>(0);
  // Arcade: teacher games render from activities; built-in arcade below is the offline fallback
  const [arcadeGame, setArcadeGame] = useState<"count" | "phonics" | "match" | "add" | null>(null);
  const [arcadeRound, setArcadeRound] = useState<ArcadeRound | null>(null);
  const [arcadeRoundKey, setArcadeRoundKey] = useState(0);
  const [arcadePicked, setArcadePicked] = useState<string | null>(null);
  const [arcadeStreak, setArcadeStreak] = useState(0);
  const [serverPicked, setServerPicked] = useState<Record<string, string>>({});

  // Avatar guide for quizzes, flashcards, worksheets
  const avatar = useAvatarGuide();

  // Teacher speech in teacher's language
  const [teacherSpeech, setTeacherSpeech] = useState(
    "Hello children, today we will learn new things in class."
  );
  const [teacherLang, setTeacherLang] = useState("en");

  // Translation in student's chosen language
  const [translatedSpeech, setTranslatedSpeech] = useState(
    "नमस्ते बच्चों, आज हम कक्षा में नई चीज़ें सीखेंगे।"
  );
  const studentLangRef = useRef(studentLang);
  const joinedSessionRef = useRef(joinedSession);
  // True once a real broadcast arrives — until then the card shows a
  // localized greeting so "replay" never speaks stale Hindi to an
  // English (or other-language) student.
  const hasLiveSpeechRef = useRef(false);

  useEffect(() => {
    studentLangRef.current = studentLang;
  }, [studentLang]);

  useEffect(() => {
    joinedSessionRef.current = joinedSession;
  }, [joinedSession]);

  // Sync with global LanguageProvider — fixes "language change not reflected in Flashcards/Quiz/Listen"
  useEffect(() => {
    if (appLang && appLang !== studentLang) {
      setStudentLang(appLang);
      const name = currentLanguage?.nativeName || appLang;
      setStudentLangName(name);
      try {
        localStorage.setItem("user_lang", appLang);
        localStorage.setItem("user_lang_name", currentLanguage?.name || appLang);
      } catch { }
    }
  }, [appLang, currentLanguage, studentLang]);

  // Keep the pre-broadcast greeting in the student's language.
  useEffect(() => {
    if (!hasLiveSpeechRef.current) {
      setTranslatedSpeech(DEFAULT_GREETINGS[normalizeFlnLang(studentLang)]);
    }
  }, [studentLang]);

  // Also listen to vs-lang-change custom event for same-tab immediate sync
  useEffect(() => {
    const onLangEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      if (detail && detail !== studentLangRef.current) {
        setStudentLang(detail);
      }
    };
    window.addEventListener("vs-lang-change", onLangEvt as EventListener);
    return () => window.removeEventListener("vs-lang-change", onLangEvt as EventListener);
  }, []);

  // ── Arcade round lifecycle ──────────────────────────────────────
  // New randomized round whenever the game, language, or grade changes,
  // or when the student asks for a new round. Language change therefore
  // re-renders the SAME game in the new language instead of going stale.
  useEffect(() => {
    if (!arcadeGame) {
      setArcadeRound(null);
      return;
    }
    const lang = normalizeFlnLang(studentLang);
    if (arcadeGame === "count") setArcadeRound(genCountRound(lang, grade));
    else if (arcadeGame === "phonics") setArcadeRound(genPhonicsRound(lang));
    else if (arcadeGame === "match") setArcadeRound(genMatchRound(lang));
    else setArcadeRound(genAddRound(grade));
    setArcadePicked(null);
  }, [arcadeGame, arcadeRoundKey, studentLang, grade]);

  const arcadeCorrect: string = !arcadeRound
    ? ""
    : arcadeRound.kind === "count"
      ? String(arcadeRound.count)
      : arcadeRound.kind === "add"
        ? arcadeRound.answer
        : arcadeRound.kind === "phonics"
          ? arcadeRound.letter
          : arcadeRound.word;
  const arcadeSolved = arcadeRound !== null && arcadePicked !== null && arcadePicked === arcadeCorrect;

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [ttfa, setTtfa] = useState<number | null>(null);
  const [raisedHand, setRaisedHand] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [handRejected, setHandRejected] = useState(false);
  const [isRecordingStudent, setIsRecordingStudent] = useState(false);
  const [studentMicStatus, setStudentMicStatus] = useState<string | null>(null);

  // Voice answering state for quizzes
  const [voiceListeningForQId, setVoiceListeningForQId] = useState<string | null>(null);
  const [voiceAnswerFeedback, setVoiceAnswerFeedback] = useState<Record<string, string>>({});

  // Pronunciation practice state for flashcards
  const [, setPracticingCardWord] = useState<string | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<Record<string, string>>({});

  const [recorder] = useState(() => (typeof window !== "undefined" ? new AudioRecorder() : null));
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [worksheetAnswers, setWorksheetAnswers] = useState<Record<string, Record<number, string>>>({});
  const [submittedScores, setSubmittedScores] = useState<Record<string, number>>({});

  const stopAudio = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        const win = window as WindowWithAudio;
        if (win._activeAudio) {
          win._activeAudio.pause();
          win._activeAudio = null;
        }
        win._activeUtterance = null;
      } catch { }
    }
    setIsPlayingAudio(false);
  }, []);

  // Robust Synthetic Audio Replay without beep/oscillator
  const playSyntheticAudio = useCallback(async (text: string, forceLang?: string) => {
    const targetLang = forceLang || studentLang;
    const rawText = text?.trim() || "Hello, welcome to class.";

    if (isPlayingAudio) {
      stopAudio();
      return;
    }

    // 1. Prepare phonetic text (Santali Ol Chiki -> Devanagari / Roman with hi-IN -> en-IN fallback)
    const prep = prepareTtsText(rawText, targetLang);
    let speechText = prep.speechText;
    let speechLang = prep.speechLang;

    setIsPlayingAudio(true);

    // 2. Browser native SpeechSynthesis (robust voice matching and keep-alive)
    const trySpeechSynthesis = async (): Promise<boolean> => {
      try {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        // If raw text still has Ol Chiki but prep returned empty, force Roman fallback
        if (hasOlChiki(rawText) && (!speechText || hasOlChiki(speechText))) {
          const romanFallback = olChikiToRoman(rawText);
          if (romanFallback && romanFallback.trim()) {
            speechText = romanFallback;
            speechLang = "en-IN";
          }
        }

        // Detect available voices before deciding which phonetics to use
        const voices = await getVoicesAsync();
        let chosenVoice = getBestVoiceForLang(voices, speechLang);

        // If we wanted hi-IN but no hi voice exists, automatically fall back to Roman + en-IN
        const hasHiVoice = voices.some((v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith("hi"));
        if ((targetLang === "sat" || hasOlChiki(rawText)) && speechLang === "hi-IN" && !hasHiVoice && prep.altText && prep.altLang) {
          speechText = prep.altText;
          speechLang = prep.altLang;
          chosenVoice = getBestVoiceForLang(voices, speechLang) || chosenVoice;
        }

        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = speechLang;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }

        const win = window as WindowWithAudio;
        win._activeUtterance = utterance;

        let finished = false;
        let resumeTimer: NodeJS.Timeout | null = null;
        let safetyTimer: NodeJS.Timeout | null = null;

        const finalize = () => {
          if (!finished) {
            finished = true;
            if (resumeTimer) clearInterval(resumeTimer);
            if (safetyTimer) clearTimeout(safetyTimer);
            win._activeUtterance = null;
            setIsPlayingAudio(false);
          }
        };

        utterance.onend = finalize;
        utterance.onerror = (e) => {
          console.warn("SpeechSynthesis utterance error:", e);
          finalize();
        };

        // Android WebView keep-alive
        resumeTimer = setInterval(() => {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
              finalize();
            } else {
              window.speechSynthesis.resume();
            }
          }
        }, 250);

        // Safety watchdog
        safetyTimer = setTimeout(() => {
          finalize();
        }, 9000);

        window.speechSynthesis.speak(utterance);
        return true;
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
        return false;
      }
    };

    const spokeNatively = await trySpeechSynthesis();
    if (spokeNatively) {
      return;
    }

    // 3. Fallback: Edge Neural TTS if SpeechSynthesis unavailable
    try {
      const serverUrl = getEdgeServerUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(
        `${serverUrl}/api/tts/speak?text=${encodeURIComponent(rawText)}&lang=${encodeURIComponent(targetLang)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 200) {
          const blobUrl = URL.createObjectURL(blob);
          const audio = new Audio(blobUrl);
          const win = window as WindowWithAudio;
          win._activeAudio = audio;

          audio.onended = () => {
            URL.revokeObjectURL(blobUrl);
            win._activeAudio = null;
            setIsPlayingAudio(false);
          };
          audio.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            win._activeAudio = null;
            setIsPlayingAudio(false);
          };

          await audio.play();
          return;
        }
      }
    } catch (err) {
      console.warn("Neural TTS fallback failed:", err);
    }

    // 4. Gracefully reset state without any oscillator beep!
    setIsPlayingAudio(false);
  }, [studentLang, isPlayingAudio, stopAudio]);

  // Connect to session using join code — NO silent LOCAL fallback.
  // Both devices must reach the same edge server first.
  const runServerDetect = useCallback(async (force = false) => {
    setServerDetecting(true);
    setServerError(null);
    try {
      const url = await detectActiveEdgeServer(force ? { force: true } : undefined);
      setServerUrlState(url);
      setServerOnline(true);
      setServerInput(url);
      return url;
    } catch {
      setServerOnline(false);
      try {
        setServerUrlState(getEdgeServerUrl());
      } catch { }
      setServerError(
        "Edge server not found. Join the same Wi-Fi/hotspot as the teacher, make sure the teacher started the server, then Retry — or enter http://<teacher-IP>:8000 manually."
      );
      return null;
    } finally {
      setServerDetecting(false);
    }
  }, []);

  const attachSessionWebSocket = useCallback(
    (targetSessionId: string, myServerPid: string) => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch { }
        wsRef.current = null;
      }
      setWsConnected(false);
      const handle = connectWebSocket(
        targetSessionId,
        (msg) => {
          if (msg.type === "SPEECH_TRANSLATED") {
            const origText = (msg.original_text as string) || "";
            const srcLang = (msg.source_lang as string) || "en";
            setTeacherSpeech(origText);
            setTeacherLang(srcLang);

            const trans = (msg.translations as Record<string, string>) || {};
            const curLang = studentLangRef.current || "hi";
            hasLiveSpeechRef.current = true;
            // If I speak the teacher's language, show the original — never fall
            // back to Hindi (server omits the source lang from translations).
            const myTrans =
              trans[curLang] || (srcLang === curLang ? origText : trans["hi"] || trans["en"] || origText);
            setTranslatedSpeech(myTrans);
            setTtfa((msg.ttfa_seconds as number) || 0.45);
            playSyntheticAudio(myTrans, curLang);
          } else if (msg.type === "SPEAKING_PERMISSION" || msg.type === "SPEAKING_PERMISSION_CHANGED") {
            // Server echoes the participant_id WE joined with (uuid), not the local P-xxx.
            if (msg.participant_id === myServerPid) {
              const isAllowed = Boolean(msg.can_speak ?? msg.allowed);
              setCanSpeak(isAllowed);
              if (isAllowed) {
                setRaisedHand(false);
                setHandRejected(false);
              } else {
                setHandRejected(true);
                setRaisedHand(false);
                setTimeout(() => setHandRejected(false), 5000);
              }
            }
          } else if (msg.type === "TEACHER_MIC_STATE") {
            setTeacherMicLive(Boolean(msg.is_live));
          } else if (msg.type === "ACTIVITY_APPROVED" || msg.type === "ACTIVITY_PUBLISHED_TO_CLASS") {
            const act = msg.activity as StudentActivity;
            if (act) {
              setActivities((prev) => [act, ...prev.filter((a) => a.activity_id !== act.activity_id)]);
            }
          } else if (msg.type === "SESSION_ENDED") {
            setConnectError("Teacher ended the class session.");
          }
        },
        {
          onOpen: () => setWsConnected(true),
          onClose: () => setWsConnected(false),
          shouldStayOpen: () => !!joinedSessionRef.current && joinedSessionRef.current.session_id === targetSessionId,
        }
      );
      wsRef.current = handle;
    },
    [playSyntheticAudio]
  );

  const connectToSession = useCallback(
    async (codeToUse?: string) => {
      setConnectError(null);
      const url = await runServerDetect();
      if (!url) {
        setJoinedSession(null);
        setConnectError("Not connected to any class — edge server unreachable. Fix the server connection first.");
        return;
      }
      try {
        const savedCode = codeToUse || localStorage.getItem("user_class_code") || "";
        const savedSessionId = localStorage.getItem("user_joined_session_id") || "";
        const savedPid = localStorage.getItem("user_server_participant_id") || "";
        let targetSessionId = "";

        if (savedCode.trim()) {
          try {
            const sess = await getSessionByCode(savedCode.trim());
            if (sess && sess.id) {
              targetSessionId = sess.id;
              setActiveClassCode(sess.join_code || savedCode.trim().toUpperCase());
              if (sess.course_name) setClassSubject(sess.course_name);
              if (sess.grade) setClassGrade(Number(sess.grade));
            }
          } catch (e) {
            console.warn("Class code lookup failed:", e);
            localStorage.removeItem("user_class_code");
            localStorage.removeItem("user_joined_session_id");
            setJoinedSession(null);
            setConnectError(`Class code "${savedCode.trim().toUpperCase()}" not found or session ended. Please enter the current Class Code from your teacher.`);
            return;
          }
        }

        if (!targetSessionId && savedSessionId && !String(savedSessionId).startsWith("LOCAL-")) {
          targetSessionId = savedSessionId;
        }

        if (!targetSessionId) {
          try {
            const res = await fetchActiveSessions();
            const activeList = res?.sessions || [];
            if (activeList.length > 0) {
              targetSessionId = activeList[0].id;
              if (activeList[0].join_code) {
                setActiveClassCode(activeList[0].join_code);
              }
              if (activeList[0].course_name) setClassSubject(activeList[0].course_name);
              if (activeList[0].grade) setClassGrade(Number(activeList[0].grade));
            }
          } catch (e) {
            console.warn("fetchActiveSessions failed:", e);
          }
        }

        if (targetSessionId) {
          try {
            // Re-join every time so the server knows this device + language.
            const joinRes = await joinSession(targetSessionId, {
              student_id: participantId,
              student_name: studentName,
              preferred_language: studentLang,
            });
            const srvPid: string = joinRes.participant_id;
            setServerParticipantId(srvPid);
            // Capture class metadata from join response
            if (joinRes.course_name) setClassSubject(joinRes.course_name);
            if (joinRes.grade) setClassGrade(Number(joinRes.grade));
            try {
              localStorage.setItem("user_server_participant_id", srvPid);
            } catch { }
            setJoinedSession({ session_id: targetSessionId });
            localStorage.setItem("user_joined_session_id", targetSessionId);

            try {
              const res = await fetchPublishedActivities(targetSessionId, studentLang);
              if (res && res.activities && res.activities.length > 0) {
                setActivities(res.activities as StudentActivity[]);
              }
            } catch (e) {
              console.warn("fetchPublishedActivities failed:", e);
            }

            attachSessionWebSocket(targetSessionId, srvPid);
            if (savedPid && savedPid !== srvPid) {
              console.log("Rotated participant id", savedPid, "->", srvPid);
            }
          } catch (joinErr) {
            console.warn("joinSession failed:", joinErr);
            localStorage.removeItem("user_joined_session_id");
            setJoinedSession(null);
            setConnectError("The class session is no longer active. Please ask your teacher for the new Class Code.");
          }
        } else {
          setJoinedSession(null);
          if (!savedCode.trim()) {
            setConnectError("No live class found on the server. Click 'Enter Class Code' above to join your teacher's class.");
          }
        }
      } catch (err) {
        console.error("Session connect error:", err);
        setJoinedSession(null);
        setConnectError(
          err instanceof Error && err.message === "EDGE_SERVER_NOT_FOUND"
            ? "Edge server unreachable — check Wi-Fi and server URL."
            : `Could not join class: ${err instanceof Error ? err.message : "unknown error"}`
        );
      }
    },
    [participantId, studentName, studentLang, runServerDetect, attachSessionWebSocket]
  );

  useEffect(() => {
    if (joinedSession?.session_id) {
      fetchPublishedActivities(joinedSession.session_id, studentLang)
        .then((res) => {
          if (res?.activities) {
            setActivities(res.activities as StudentActivity[]);
          }
        })
        .catch((e) => console.warn("Failed to refetch activities for lang:", e));
    }
  }, [joinedSession, studentLang]);

  useEffect(() => {
    // QR-code join: ?server=<edge-url>&code=<class-code> auto-fills both
    try {
      const qp = new URLSearchParams(window.location.search);
      const qrServer = qp.get("server");
      const qrCode = qp.get("code");
      if (qrServer) {
        try { setEdgeServerUrl(qrServer); } catch { }
      }
      if (qrCode) {
        const clean = qrCode.trim().toUpperCase();
        try { localStorage.setItem("user_class_code", clean); } catch { }
        setActiveClassCode(clean);
        setNewCodeInput(clean);
      }
    } catch { }
    const s = localStorage.getItem("user_name");
    const l = localStorage.getItem("user_lang") || "hi";
    const ln = localStorage.getItem("user_lang_name") || "Hindi";
    const g = localStorage.getItem("user_grade");
    const c = localStorage.getItem("user_class_code");
    const sp = (() => { try { return localStorage.getItem("user_server_participant_id") || ""; } catch { return ""; } })();
    if (s) setStudentName(s);
    if (l) setStudentLang(l);
    if (ln) setStudentLangName(ln);
    if (g) setGrade(Number(g));
    if (c) setActiveClassCode(c);
    if (sp) setServerParticipantId(sp);

    connectToSession();
    return () => {
      try { wsRef.current?.close(); } catch { }
    };
  }, [connectToSession]);

  const handleJoinNewCode = async (overrideCode?: string, overrideServer?: string) => {
    const raw = overrideCode ?? newCodeInput;
    if (!raw.trim()) return;
    setCodeError("");
    const code = raw.trim().toUpperCase();
    try {
      // QR scans carry the teacher's edge-server URL — adopt it first so the
      // code lookup hits the SAME server the QR was generated from.
      if (overrideServer) {
        try {
          setEdgeServerUrl(overrideServer);
        } catch { }
      }
      await runServerDetect();
      const sess = await getSessionByCode(code);
      if (sess && sess.id) {
        localStorage.setItem("user_class_code", code);
        localStorage.setItem("user_joined_session_id", sess.id);
        setActiveClassCode(code);
        setShowCodeModal(false);
        setShowScanner(false);
        setNewCodeInput("");
        await connectToSession(code);
      }
    } catch {
      setCodeError(t("sessionNotFoundError") || "Invalid class code or class is not active. Check server connection too.");
    }
  };

  const handleQrScanned = async (text: string) => {
    const parsed = parseJoinQr(text);
    if (!parsed) {
      setCodeError(t("qrInvalid", "That QR doesn't look like a class code. Try again or type the code."));
      setShowScanner(false);
      return;
    }
    setNewCodeInput(parsed.code);
    await handleJoinNewCode(parsed.code, parsed.server);
  };

  // Student Raise Hand — uses the SERVER participant id, not the local P-xxx
  const handleToggleRaiseHand = async () => {
    if (!joinedSession || String(joinedSession.session_id).startsWith("LOCAL-")) {
      setStudentMicStatus("Not connected to a live class yet.");
      setTimeout(() => setStudentMicStatus(null), 3000);
      return;
    }

    if (canSpeak) {
      if (isRecordingStudent) {
        setIsRecordingStudent(false);
        setStudentMicStatus("Transcribing question with Whisper AI…");
        try {
          const b64Pcm = await recorder?.stop();
          if (b64Pcm) {
            const res = await transcribeAudio(b64Pcm, studentLang);
            const questionText = res?.text || "Ma'am, please explain again.";
            setStudentMicStatus(`Question sent: "${questionText}"`);
            await broadcastSpeech({
              session_id: joinedSession.session_id,
              speaker_name: studentName,
              speaker_role: "STUDENT",
              original_text: questionText,
              source_lang: studentLang,
            });
          }
        } catch (err) {
          console.error("Student recording error:", err);
          setStudentMicStatus("Microphone error — question NOT sent (server unreachable?)");
        } finally {
          setCanSpeak(false);
          setRaisedHand(false);
          setTimeout(() => setStudentMicStatus(null), 4000);
        }
      } else {
        try {
          await recorder?.start();
          setIsRecordingStudent(true);
          setStudentMicStatus("Listening... Speak your question, then tap to send");
        } catch (err) {
          console.error("Student mic error:", err);
          setStudentMicStatus("Could not access microphone");
          setTimeout(() => setStudentMicStatus(null), 3000);
        }
      }
      return;
    }

    const nextState = !raisedHand;
    setRaisedHand(nextState);
    if (!nextState) setCanSpeak(false);
    const pid = serverParticipantId || (() => { try { return localStorage.getItem("user_server_participant_id") || ""; } catch { return ""; } })();
    if (!pid) {
      setStudentMicStatus("Not fully joined yet — retrying join…");
      await connectToSession().catch(() => { });
      return;
    }
    try {
      await raiseHand(joinedSession.session_id, pid, studentName, nextState);
    } catch (e) {
      console.error("Raise-hand failed:", e);
      setStudentMicStatus("Raise-hand NOT sent — server unreachable. Check connection.");
      setRaisedHand(!nextState);
      setTimeout(() => setStudentMicStatus(null), 4000);
    }
  };

  // Voice Answer for Quiz Questions
  const handleVoiceAnswer = async (questionId: string, options: string[]) => {
    if (voiceListeningForQId === questionId) {
      // Stop listening if already active
      setVoiceListeningForQId(null);
      return;
    }

    setVoiceListeningForQId(questionId);
    setVoiceAnswerFeedback((prev) => ({ ...prev, [questionId]: "Listening… Speak your answer" }));

    // Try Web Speech Recognition or fall back to AudioRecorder
    interface SpeechRecognitionLike {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
      onerror: (() => void) | null;
      start: () => void;
    }
    const win =
      typeof window !== "undefined"
        ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        const recognition = new SpeechRecognitionClass();
        const recogLangMap: Record<string, string> = {
          hi: "hi-IN",
          en: "en-IN",
          bn: "bn-IN",
          mr: "mr-IN",
          ta: "ta-IN",
          te: "te-IN",
          // No Santali voice exists — Hindi is the closest phonetic match
          sat: "hi-IN",
        };
        recognition.lang = recogLangMap[studentLang] || "hi-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 3;

        recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
          const spoken = event.results[0][0].transcript.trim().toLowerCase();
          // Match against options
          let bestMatch = options[0];
          for (const opt of options) {
            const optLower = opt.toLowerCase();
            if (spoken.includes(optLower) || optLower.includes(spoken)) {
              bestMatch = opt;
              break;
            }
          }
          setSelectedAnswers((prev) => ({ ...prev, [questionId]: bestMatch }));
          setVoiceAnswerFeedback((prev) => ({
            ...prev,
            [questionId]: `Heard: "${spoken}" → Selected: ${bestMatch} ✓`,
          }));
          setVoiceListeningForQId(null);
        };

        recognition.onerror = () => {
          setVoiceAnswerFeedback((prev) => ({ ...prev, [questionId]: "Could not detect speech. Tap to retry." }));
          setVoiceListeningForQId(null);
        };

        recognition.start();
        return;
      } catch { }
    }

    // Fallback: AudioRecorder with 3s record
    if (recorder) {
      try {
        await recorder.start();
        setTimeout(async () => {
          try {
            const b64 = await recorder.stop();
            if (b64) {
              const res = await transcribeAudio(b64, studentLang);
              const spoken = (res.text || "").trim().toLowerCase();
              let bestMatch = options[0];
              for (const opt of options) {
                if (spoken.includes(opt.toLowerCase())) {
                  bestMatch = opt;
                  break;
                }
              }
              setSelectedAnswers((prev) => ({ ...prev, [questionId]: bestMatch }));
              setVoiceAnswerFeedback((prev) => ({
                ...prev,
                [questionId]: `Heard: "${res.text}" → Selected: ${bestMatch} ✓`,
              }));
            }
          } catch {
            setVoiceAnswerFeedback((prev) => ({ ...prev, [questionId]: "Tap an option directly" }));
          } finally {
            setVoiceListeningForQId(null);
          }
        }, 3200);
      } catch {
        setVoiceListeningForQId(null);
      }
    }
  };

  // Flashcard Pronunciation Practice
  const handleVoicePractice = async (word: string) => {
    setPracticingCardWord(word);
    setPracticeFeedback((prev) => ({ ...prev, [word]: "Listening… Say the word!" }));
    try {
      if (recorder) {
        await recorder.start();
        setTimeout(async () => {
          try {
            const b64 = await recorder.stop();
            if (b64) {
              const res = await transcribeAudio(b64, studentLang);
              setPracticeFeedback((prev) => ({
                ...prev,
                [word]: `Heard: "${res.text || word}" — 🌟 Great pronunciation!`,
              }));
            }
          } catch {
            setPracticeFeedback((prev) => ({ ...prev, [word]: "🌟 Great job!" }));
          } finally {
            setPracticingCardWord(null);
          }
        }, 2800);
      }
    } catch {
      setPracticingCardWord(null);
    }
  };

  // ── Arcade + teacher-game answers ───────────────────────────────
  // Correct: +10 pts, streak up, praise spoken IN the student's language.
  // Wrong: streak resets, gentle encouragement spoken, retry allowed
  // (wrong taps are never silent — that felt broken).
  const answerArcade = (opt: string) => {
    if (!arcadeRound || arcadeSolved) return;
    const lang = normalizeFlnLang(studentLang);
    if (opt === arcadeCorrect) {
      setArcadePicked(opt);
      setGameScore((s) => s + 10);
      setArcadeStreak((s) => s + 1);
      const praise = pickPraise(lang);
      avatar.happy(praise);
      playSyntheticAudio(praise, studentLang);
      window.setTimeout(() => setArcadeRoundKey((k) => k + 1), 1500);
    } else {
      setArcadePicked(opt);
      setArcadeStreak(0);
      const enc = pickEncourage(lang);
      avatar.encourage(enc);
      playSyntheticAudio(enc, studentLang);
    }
  };

  const answerServerGame = (gid: string, game: ServerGame, opt: string) => {
    if (serverPicked[gid] === game.correct) return;
    const lang = normalizeFlnLang(studentLang);
    if (opt === game.correct) {
      setServerPicked((p) => ({ ...p, [gid]: opt }));
      setGameScore((s) => s + (game.points || 10));
      const praise = pickPraise(lang);
      avatar.happy(praise);
      playSyntheticAudio(praise, studentLang);
    } else {
      setServerPicked((p) => ({ ...p, [gid]: opt }));
      const enc = pickEncourage(lang);
      avatar.encourage(enc);
      playSyntheticAudio(enc, studentLang);
    }
  };

  const tabs = [
    { id: "LISTEN" as const, label: t("tabListen"), icon: <Volume2 className="w-4 h-4" /> },
    { id: "QUIZ" as const, label: t("quizTab"), icon: <HelpCircle className="w-4 h-4" /> },
    { id: "WORKSHEET" as const, label: t("worksheetsTab"), icon: <BookOpen className="w-4 h-4" /> },
    { id: "FLASHCARDS" as const, label: t("flashcardsTab"), icon: <Award className="w-4 h-4" /> },
    { id: "GAMES" as const, label: t("gamesTab"), icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen vs-bg flex flex-col">
      {/* ── App Bar (two rows — nothing gets cut off on phones) ────── */}
      <header className="vs-surface border-0 border-b border-[var(--border)] px-3 sm:px-6 py-2.5 space-y-2 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => router.push("/")}
              title="Back to Home"
              className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-[#0c1a2e] font-black text-sm flex items-center justify-center shadow-xs shrink-0">
              {studentName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-[var(--text-primary)] leading-none truncate">{studentName}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-medium truncate">
                {t("class")} {classGrade || grade}
                · <span className="text-[var(--brand-deep)] font-bold">{studentLangName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Server Status Button */}
            <button
              onClick={() => { setServerInput(serverUrl || "http://192.168.1.191:8000"); setShowServerModal(true); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)] text-[var(--text-primary)] text-xs font-bold transition shadow-2xs"
              title="Edge Server Status & Network Settings"
            >
              <span className={`w-2 h-2 rounded-full ${serverOnline ? "bg-[var(--green)]" : serverOnline === false ? "bg-[var(--red)]" : "bg-[var(--amber)] animate-pulse"}`} />
              <Server className="w-3.5 h-3.5 text-[var(--brand-deep)]" />
              <span className="hidden xs:inline text-[11px]">
                {serverDetecting ? "Detecting..." : serverOnline ? "Server Online" : "Server Offline"}
              </span>
            </button>
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-sub)]">
          {/* Class code — whole chip is tappable, opens the change-code modal */}
          <button
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-bold text-[var(--text-primary)] active:scale-95 transition min-w-0"
            title={t("changeCodeBtn") || "Change class code"}
          >
            <Key className="w-3 h-3 text-[var(--brand-deep)] shrink-0" />
            <span className="font-mono font-black text-[var(--brand-deep)] uppercase tracking-wider truncate">
              {activeClassCode || "—"}
            </span>
          </button>
          {classSubject ? (
            <span className="text-[11px] font-bold text-[var(--brand-deep)] truncate">
              {t(getLocalizedSubjectKey(classSubject), classSubject)}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)]">
              {wsConnected ? t("live") : t("offline")}
            </span>
          )}
        </div>
      </header>

      {/* ── Navigation Tabs ────────────────────────────────────────── */}
      <nav className="vs-surface border-0 border-b border-[var(--border)] px-3 py-2 flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap ${activeTab === tab.id
              ? "vs-btn-brand shadow-xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Main Content Area ──────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-4">
        {/* LISTEN TAB */}
        {activeTab === "LISTEN" && (
          <div className="space-y-4">
            {/* Teacher's Broadcasted Speech Card */}
            <div className="vs-surface rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-sub)]">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-bold">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${teacherMicLive
                    ? "bg-red-600 text-white animate-pulse shadow-sm"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]"
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${teacherMicLive ? "bg-white animate-ping" : "bg-gray-400"}`} />
                    {teacherMicLive
                      ? t("micLive") || "● LIVE MIC"
                      : t("teacherMuted") || "Teacher Mic OFF"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] uppercase">
                    {teacherLang}
                  </span>
                </div>
                {ttfa && (
                  <span className="text-[10px] text-[var(--text-muted)] font-mono font-medium">
                    ⚡ {ttfa.toFixed(2)}s translation
                  </span>
                )}
              </div>

              {/* Teacher Original Quote */}
              <p className="text-base font-semibold text-[var(--text-secondary)] italic leading-relaxed">
                &ldquo;{teacherSpeech}&rdquo;
              </p>

              {/* In Student's Language */}
              <div className="p-4 rounded-xl bg-[var(--brand-tint)]/40 border border-[var(--brand-tint2)] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--brand-deep)]">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>In your language ({studentLangName})</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 mt-1">
                  <p className="text-xl font-extrabold text-[var(--text-primary)] leading-relaxed flex-1">
                    &ldquo;{translatedSpeech}&rdquo;
                  </p>
                  {isPlayingAudio && (
                    <div className="shrink-0 -my-2 -mr-1 animate-fadeIn">
                      <Mascot src="/animations/sound-recognization.lottie" width={64} height={64} />
                    </div>
                  )}
                </div>
              </div>

              {/* Replay in Student's Language Button */}
              <button
                type="button"
                onClick={() => playSyntheticAudio(translatedSpeech, studentLang)}
                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${isPlayingAudio
                  ? "bg-[var(--red-tint)] border-2 border-[var(--red)] text-[var(--red)] animate-pulse shadow-xs"
                  : "vs-btn-brand shadow-xs"
                  }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>{t("playingAudioState") || "Playing…"} (Tap to Stop)</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>{t("replayInMyLang") || "Replay in my language"} ({studentLangName})</span>
                  </>
                )}
              </button>
            </div>

            {/* Speaking Options Card (Hand Raise Required) */}
            <div className="vs-surface rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="shrink-0 -ml-2">
                    <Mascot src="/animations/questionanimation.lottie" width={90} height={90} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      {t("wantToSpeak") || "Want to speak?"}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {t("speakOrRaiseHand") || "Raise your hand to request the microphone from your teacher"}
                    </p>
                  </div>
                </div>
                {raisedHand && !canSpeak && (
                  <span className="text-xs font-bold text-[var(--amber)] bg-[var(--amber-tint)] px-3 py-1 rounded-full animate-pulse">
                    {t("waitingState") || "Waiting for Teacher…"}
                  </span>
                )}
              </div>

              {handRejected && (
                <div className="text-xs p-3 rounded-xl bg-[var(--red-tint)] border border-[var(--red)] text-[var(--red)] font-bold animate-fadeIn flex items-center justify-between">
                  <span>⚠️ {t("handDenied")}</span>
                  <button onClick={() => setHandRejected(false)} className="p-1 text-xs">✕</button>
                </div>
              )}

              {/* Raise Hand Button (Only mic access path for students) */}
              <button
                onClick={handleToggleRaiseHand}
                className={`w-full py-4 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-sm ${isRecordingStudent
                  ? "bg-[var(--red)] text-white animate-pulse shadow-md"
                  : canSpeak
                    ? "bg-[var(--green)] text-white shadow-md animate-bounce"
                    : raisedHand
                      ? "bg-[var(--amber-tint)] text-[var(--amber)] border-2 border-[var(--amber)]"
                      : "vs-btn-brand"
                  }`}
              >
                <Hand className="w-5 h-5" />
                <span>
                  {isRecordingStudent
                    ? "Recording… Tap to send"
                    : canSpeak
                      ? "Teacher Approved! Tap to speak"
                      : raisedHand
                        ? t("handRaisedWaitingBtn") || "Hand Raised"
                        : t("raiseMyHandBtn") || "Raise Hand"}
                </span>
              </button>

              {studentMicStatus && (
                <div className="text-xs px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                  <span>{studentMicStatus}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUIZ TAB */}
        {activeTab === "QUIZ" && (
          <div className="space-y-4">
            {/* Avatar Guide for Quiz */}
            <AvatarGuide
              state={avatar.state}
              message={avatar.message}
              showHint={avatar.state === "hint"}
              hintText={avatar.hintText}
              className="w-full"
            />

            {(() => {
              const quizList = activities.filter(
                (a) => a.activity_type === "QUIZ" || Boolean(a.content?.questions && a.content.questions.length > 0)
              );
              if (quizList.length === 0) {
                return (
                  <div className="vs-surface rounded-2xl p-10 text-center space-y-4 border border-[var(--border)]">
                    <div className="flex justify-center mx-auto mb-4">
                      <Mascot src="/animations/owl-birdanimation.lottie" width={160} height={160} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-secondary)]">
                        {t("noQuizYet") || "No quiz assigned yet"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        {t("noQuizYetSub") || "When the teacher sends a quiz, it will appear here live."}
                      </p>
                    </div>
                  </div>
                );
              }

              return quizList.map((act, idx) => {
                const questions = act.content?.questions || [];
                const isSubmitted = submittedScores[act.activity_id] !== undefined;
                const scoreVal = submittedScores[act.activity_id] || 0;

                const handleScoreThisQuiz = () => {
                  let correctCount = 0;
                  questions.forEach((q) => {
                    const userAns = (selectedAnswers[q.id] || "").trim().toLowerCase();
                    const correctAns = (q.correct || q.correct_answer || "").trim().toLowerCase();
                    if (userAns && correctAns && userAns === correctAns) {
                      correctCount++;
                    }
                  });
                  const pct = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;
                  setSubmittedScores((prev) => ({ ...prev, [act.activity_id]: pct }));
                  if (pct >= 80) avatar.celebrate("Amazing! You nailed it! 🎉");
                  else if (pct >= 50) avatar.happy("Great effort! 🌟");
                  else avatar.encourage("Keep practicing! You'll get better! 💪");
                };

                return (
                  <div
                    key={act.activity_id || idx}
                    className="vs-surface rounded-2xl overflow-hidden shadow-xs border border-[var(--border)] space-y-4"
                  >
                    <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between bg-[var(--brand-tint)]/50">
                      <h2 className="text-sm font-extrabold text-[var(--brand-deep)]">{act.title}</h2>
                      <span className="text-[10px] font-bold text-[var(--brand-deep)] bg-[var(--surface)] px-2.5 py-1 rounded-full border border-[var(--brand-tint2)]">
                        {act.domain || "NIPUN FLN"}
                      </span>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      {questions.map((q, qIdx) => {
                        const isListening = voiceListeningForQId === q.id;
                        const feedback = voiceAnswerFeedback[q.id];

                        return (
                          <div
                            key={q.id}
                            className="space-y-3 p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-[var(--text-primary)]">
                                <span className="text-[var(--brand-deep)] mr-1">Q{qIdx + 1}:</span>
                                {q.question}
                              </p>

                              {/* Speak Answer with Mic Button */}
                              {!isSubmitted && (
                                <button
                                  type="button"
                                  onClick={() => handleVoiceAnswer(q.id, q.options || [])}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${isListening
                                    ? "bg-[var(--red)] text-white animate-pulse shadow-xs"
                                    : "bg-[var(--brand-tint)] text-[var(--brand-deep)] border border-[var(--brand-tint2)] hover:bg-[var(--brand-tint2)]"
                                    }`}
                                  title="Answer with Voice"
                                >
                                  <Mic className="w-3.5 h-3.5" />
                                  <span>{isListening ? "Listening…" : t("answerWithVoice") || "Speak Answer"}</span>
                                </button>
                              )}
                            </div>

                            {feedback && (
                              <p className="text-[11px] font-bold text-[var(--brand-deep)] bg-[var(--brand-tint)]/60 px-3 py-1.5 rounded-lg">
                                🎙️ {feedback}
                              </p>
                            )}

                            {q.options && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {q.options.map((opt) => (
                                  <button
                                    key={opt}
                                    disabled={isSubmitted}
                                    onClick={() => {
                                      setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt }));
                                      avatar.happy("Nice choice! 🌟");
                                    }}
                                    className={`p-3 rounded-xl font-bold text-xs text-left transition border-2 ${selectedAnswers[q.id] === opt
                                      ? "border-[var(--brand)] bg-[var(--brand)] text-[#0c1a2e] shadow-xs"
                                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--brand)]"
                                      }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {isSubmitted ? (
                        <div className="p-5 rounded-2xl bg-[var(--green-tint)] border border-[var(--green-tint)] text-center space-y-1.5 animate-fadeIn">
                          <Award className="w-8 h-8 text-[var(--green)] mx-auto" />
                          <p className="text-base font-black text-[var(--green)]">
                            {t("wellDoneTitle") || "Well Done! 🌟"}
                          </p>
                          <p className="text-xs text-[var(--green)] font-semibold">
                            Score: {scoreVal}%
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleScoreThisQuiz}
                          disabled={questions.some((q) => !selectedAnswers[q.id])}
                          className="w-full py-3.5 rounded-xl bg-[var(--green)] hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm shadow-xs transition flex items-center justify-center gap-2"
                        >
                          <span>{t("submitAnswers") || "Submit Answers"}</span>
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* WORKSHEET TAB */}
        {activeTab === "WORKSHEET" && (
          <div className="space-y-4">
            {/* Avatar Guide for Worksheets */}
            <AvatarGuide
              state={avatar.state}
              message={avatar.message}
              showHint={avatar.state === "hint"}
              hintText={avatar.hintText}
              className="w-full"
            />

            {(() => {
              const worksheetList = activities.filter(
                (a) => a.activity_type === "WORKSHEET" || Boolean((a.content as Record<string, unknown>)?.tasks)
              );
              if (worksheetList.length === 0) {
                return (
                  <div className="vs-surface rounded-2xl p-10 text-center space-y-4 border border-[var(--border)]">
                    <div className="flex justify-center mx-auto mb-4">
                      <Mascot src="/animations/learninganimation.lottie" width={140} height={140} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-secondary)]">No Worksheet Available</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Worksheets assigned by your teacher will appear here.
                      </p>
                    </div>
                  </div>
                );
              }
              return worksheetList.map((act, idx) => {
                const tasks = (((act.content as Record<string, unknown>)?.tasks as unknown[]) || []) as Array<{
                  task: string;
                  answer?: string;
                }>;
                const isSubmitted = submittedScores[act.activity_id] !== undefined;

                return (
                  <div
                    key={act.activity_id || idx}
                    className="vs-surface rounded-2xl overflow-hidden shadow-xs border border-[var(--border)]"
                  >
                    <div className="px-5 py-3.5 border-b border-[var(--border-sub)] bg-[var(--amber-tint)]/40 flex items-center justify-between">
                      <h2 className="text-sm font-bold text-[var(--amber)]">{act.title}</h2>
                      <span className="text-[10px] font-bold bg-[var(--surface)] px-2.5 py-1 rounded-full border border-[var(--border)]">
                        Tasks
                      </span>
                    </div>
                    <div className="p-4 sm:p-5 space-y-4">
                      {tasks.map((tItem, tIdx) => (
                        <div key={tIdx} className="space-y-2 p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            <span className="font-bold text-[var(--brand-deep)] mr-1">{tIdx + 1}.</span>
                            {tItem.task}
                          </p>
                          <input
                            type="text"
                            disabled={isSubmitted}
                            placeholder="Type your response here…"
                            value={worksheetAnswers[act.activity_id]?.[tIdx] || ""}
                            onChange={(e) =>
                              setWorksheetAnswers((prev) => ({
                                ...prev,
                                [act.activity_id]: {
                                  ...(prev[act.activity_id] || {}),
                                  [tIdx]: e.target.value,
                                },
                              }))
                            }
                            className="vs-input w-full px-3.5 py-2.5 rounded-xl text-xs font-medium"
                          />
                        </div>
                      ))}

                      <button
                        onClick={() => {
                          setSubmittedScores((prev) => ({ ...prev, [act.activity_id]: 100 }));
                          avatar.celebrate("Worksheet submitted! Great work! 🎉");
                        }}
                        disabled={isSubmitted}
                        className="w-full py-3 rounded-xl bg-[var(--green)] text-white font-bold text-xs transition hover:opacity-90 disabled:opacity-50"
                      >
                        {isSubmitted ? "Submitted ✓" : "Submit Worksheet"}
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* FLASHCARDS TAB */}
        {activeTab === "FLASHCARDS" && (
          <div className="space-y-4">
            {/* Avatar Guide for Flashcards */}
            <AvatarGuide
              state={avatar.state}
              message={avatar.message}
              showHint={avatar.state === "hint"}
              hintText={avatar.hintText}
              className="w-full"
            />

            {(() => {
              const cardActivities = activities.filter(
                (a) => a.activity_type === "FLASHCARD" || Boolean((a.content as Record<string, unknown>)?.cards)
              );

              if (cardActivities.length > 0) {
                return cardActivities.map((act, aIdx) => {
                  const cards = (act.content?.cards || []) as Array<{
                    word: string;
                    phonics?: string;
                    meaning?: string;
                    visual?: string;
                    color?: string;
                  }>;
                  return (
                    <div key={aIdx} className="space-y-3">
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">{act.title}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {cards.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="vs-surface rounded-2xl overflow-hidden shadow-xs border border-[var(--border)] p-4 space-y-2 flex flex-col justify-between"
                          >
                            <div>
                              <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-2"
                                style={{
                                  backgroundColor: c.color
                                    ? `color-mix(in srgb, ${c.color} 20%, transparent)`
                                    : "var(--brand-tint)",
                                }}
                              >
                                {c.visual || "📚"}
                              </div>
                              <p className="text-lg font-black text-[var(--text-primary)]">{c.word}</p>
                              {c.phonics && (
                                <p className="text-xs font-bold text-[var(--brand-deep)] tracking-wider">{c.phonics}</p>
                              )}
                              {c.meaning && (
                                <p className="text-[11px] text-[var(--text-secondary)] mt-1">{c.meaning}</p>
                              )}
                            </div>

                            <div className="flex gap-1.5 pt-2 border-t border-[var(--border-sub)]">
                              <button
                                type="button"
                                onClick={() => playSyntheticAudio(c.word, studentLang)}
                                className="flex-1 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--text-primary)] font-bold text-[11px] flex items-center justify-center gap-1 transition"
                              >
                                <Volume2 className="w-3 h-3" />
                                <span>{t("pronounce")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVoicePractice(c.word)}
                                className="flex-1 py-2 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-deep)] border border-[var(--brand-tint2)] font-bold text-[11px] flex items-center justify-center gap-1 transition"
                              >
                                <Mic className="w-3 h-3" />
                                <span>{t("practice")}</span>
                              </button>
                            </div>

                            {practiceFeedback[c.word] && (
                              <p className="text-[10px] font-bold text-[var(--green)] bg-[var(--green-tint)] px-2 py-1 rounded">
                                {practiceFeedback[c.word]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              }

              // Fallback to static flashcards
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(FLASHCARDS_DATA[studentLang] || FLASHCARDS_DATA["hi"]).map((card, i) => (
                    <div
                      key={i}
                      className="vs-surface rounded-2xl overflow-hidden shadow-xs border border-[var(--border)] p-4 flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                          style={{ backgroundColor: `color-mix(in srgb, ${card.tint} 60%, transparent)` }}
                        >
                          {card.visual}
                        </div>
                        <div>
                          <p className="text-xl font-black text-[var(--text-primary)]">{card.word}</p>
                          {studentLang === "en" && (
                            <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{card.eng}</p>
                          )}
                          <p className="text-[11px] text-[var(--text-secondary)]">{card.desc}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-3 mt-3 border-t border-[var(--border-sub)]">
                        <button
                          type="button"
                          onClick={() => playSyntheticAudio(card.word, studentLang)}
                          className="flex-1 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center gap-1 transition"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{t("pronounce")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVoicePractice(card.word)}
                          className="flex-1 py-2 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-deep)] border border-[var(--brand-tint2)] font-bold text-xs flex items-center justify-center gap-1 transition"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>{t("practice")}</span>
                        </button>
                      </div>

                      {practiceFeedback[card.word] && (
                        <p className="text-[10px] font-bold text-[var(--green)] bg-[var(--green-tint)] px-2 py-1 rounded mt-2">
                          {practiceFeedback[card.word]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* FLN GAMES — teacher-sent games first, arcade fallback */}
        {activeTab === "GAMES" && (
          <div className="space-y-4">
            <div className="vs-surface rounded-2xl p-5 border border-[var(--brand-tint2)] bg-[var(--brand-tint)]/40 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <Mascot src="/animations/owl-birdanimation.lottie" width={40} height={40} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[var(--brand-deep)]" />
                    <h3 className="text-sm font-extrabold text-[var(--brand-deep)]">
                      {t("nipunGamesTitle")}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {t("interactiveGamesDesc")} {grade} · <span className="font-bold">{studentLangName}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {arcadeStreak > 1 && (
                  <div className="px-3.5 py-1.5 rounded-xl bg-[var(--amber-tint)] border border-[var(--amber-tint)] text-xs font-black text-[var(--amber)] flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> {arcadeStreak} {FLN_STRINGS[normalizeFlnLang(studentLang)].streak}
                  </div>
                )}
                <div className="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--brand-tint2)] text-xs font-black text-[var(--brand-deep)] shadow-2xs">
                  ⭐ {gameScore} {t("stars")}
                </div>
              </div>
            </div>

            <AvatarGuide
              state={avatar.state}
              message={avatar.message}
              showHint={avatar.state === "hint"}
              hintText={avatar.hintText}
              className="w-full"
            />

            {(() => {
              const S = FLN_STRINGS[normalizeFlnLang(studentLang)];
              const serverGames: Array<{ gid: string; game: ServerGame }> = [];
              activities.forEach((a) => {
                const g = (a.content as unknown as { games?: unknown })?.games;
                if (isServerGameList(g)) {
                  g.forEach((game, gi) => serverGames.push({ gid: `${a.activity_id}-g${gi}`, game }));
                }
              });

              const optClass = (opt: string, correct: string, picked: string | null | undefined, big?: boolean) => {
                const isCorrect = opt === correct;
                const solved = picked === correct;
                return `rounded-xl border-2 transition active:scale-95 font-bold text-[var(--text-primary)] ${big ? "py-4 text-3xl" : "py-3.5 text-sm"
                  } ${solved && isCorrect
                    ? "border-[var(--green)] bg-[var(--green)] text-white shadow-xs"
                    : solved
                      ? "border-[var(--border)] bg-[var(--surface-2)] opacity-50"
                      : picked === opt
                        ? "border-[var(--red)] bg-[var(--red-tint)] text-[var(--red)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]"
                  }`;
              };

              const listenBtn = (text: string) => (
                <button
                  onClick={() => playSyntheticAudio(text, studentLang)}
                  className="mx-auto px-4 py-2 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-deep)] font-bold text-xs flex items-center gap-2 hover:bg-[var(--brand-tint2)] transition"
                >
                  <Volume2 className="w-4 h-4" /> {t("listenAudio")} · {S.listen}
                </button>
              );

              return (
                <>
                  {serverGames.length > 0 && (
                    <div className="space-y-3">
                      {serverGames.map(({ gid, game }) => {
                        const picked = serverPicked[gid] ?? null;
                        return (
                          <div key={gid} className="vs-surface rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
                            <div>
                              <h4 className="text-base font-black text-[var(--text-primary)]">{game.title}</h4>
                              {game.instruction && (
                                <p className="text-xs text-[var(--text-secondary)] mt-1">{game.instruction}</p>
                              )}
                            </div>
                            {game.visual && (
                              <div className="flex items-center justify-center gap-2 text-4xl py-5 bg-[var(--surface-2)] rounded-2xl border border-[var(--border)]">
                                {game.visual}
                              </div>
                            )}
                            {listenBtn(game.audio_text || game.instruction || game.title)}
                            <div className="grid grid-cols-2 gap-2">
                              {game.options.map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => answerServerGame(gid, game, opt)}
                                  className={optClass(opt, game.correct, picked)}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {arcadeGame === null ? (
                    <div className="vs-surface rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-3">
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">🎮 {S.pickGame}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(
                          [
                            { id: "count" as const, icon: <Hash className="w-5 h-5" />, name: S.countName, desc: S.countDesc, tint: "var(--brand-tint)" },
                            { id: "phonics" as const, icon: <Type className="w-5 h-5" />, name: S.phonicsName, desc: S.phonicsDesc, tint: "var(--violet-tint)" },
                            { id: "match" as const, icon: <Shapes className="w-5 h-5" />, name: S.matchName, desc: S.matchDesc, tint: "var(--green-tint)" },
                            { id: "add" as const, icon: <Plus className="w-5 h-5" />, name: S.addName, desc: S.addDesc, tint: "var(--amber-tint)" },
                          ]
                        ).map((g) => (
                          <button
                            key={g.id}
                            onClick={() => {
                              setArcadeGame(g.id);
                              setArcadeStreak(0);
                            }}
                            className="p-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)] text-left transition active:scale-95 space-y-1.5"
                          >
                            <span className="inline-flex p-2 rounded-xl" style={{ backgroundColor: g.tint }}>
                              {g.icon}
                            </span>
                            <span className="block text-sm font-black text-[var(--text-primary)]">{g.name}</span>
                            <span className="block text-[11px] text-[var(--text-muted)]">{g.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="vs-surface rounded-2xl p-5 sm:p-6 border border-[var(--border)] shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setArcadeGame(null)}
                          className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] font-bold text-xs"
                        >
                          ← {S.pickGame}
                        </button>
                        <button
                          onClick={() => setArcadeRoundKey((k) => k + 1)}
                          className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] font-bold text-xs flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> {S.newRound}
                        </button>
                      </div>

                      {arcadeRound?.kind === "count" && (
                        <div className="space-y-4 text-center">
                          <h4 className="text-lg font-black text-[var(--text-primary)]">
                            {S.howMany(arcadeRound.item)}
                          </h4>
                          <div className="flex flex-wrap items-center justify-center gap-2 text-3xl py-6 bg-[var(--surface-2)] rounded-2xl border border-[var(--border)]">
                            {Array.from({ length: arcadeRound.count }).map((_, i) => (
                              <span key={i}>{arcadeRound.emoji}</span>
                            ))}
                          </div>
                          {listenBtn(S.howMany(arcadeRound.item))}
                          <div className="grid grid-cols-4 gap-2">
                            {arcadeRound.options.map((num) => (
                              <button
                                key={num}
                                onClick={() => answerArcade(num)}
                                className={`${optClass(num, arcadeCorrect, arcadePicked)} text-xl`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {arcadeRound?.kind === "phonics" && (
                        <div className="space-y-4 text-center">
                          <h4 className="text-lg font-black text-[var(--text-primary)]">
                            {S.firstSound(arcadeRound.word)}
                          </h4>
                          <div className="py-6 bg-[var(--violet-tint)] rounded-2xl border border-[var(--violet-tint)] space-y-1">
                            <div className="text-5xl">{arcadeRound.emoji}</div>
                            <div className="text-2xl font-black text-[var(--text-primary)]">{arcadeRound.word}</div>
                          </div>
                          {listenBtn(S.firstSound(arcadeRound.word))}
                          <div className="grid grid-cols-3 gap-3">
                            {arcadeRound.options.map((ch) => (
                              <button
                                key={ch}
                                onClick={() => answerArcade(ch)}
                                className={optClass(ch, arcadeCorrect, arcadePicked, true)}
                              >
                                {ch}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {arcadeRound?.kind === "match" && (
                        <div className="space-y-4 text-center">
                          <h4 className="text-lg font-black text-[var(--text-primary)]">{S.pickWord}</h4>
                          <div className="text-6xl py-6 bg-[var(--green-tint)] rounded-2xl border border-[var(--green-tint)]">
                            {arcadeRound.emoji}
                          </div>
                          {listenBtn(S.pickWord)}
                          <div className="grid grid-cols-1 gap-2">
                            {arcadeRound.options.map((w) => (
                              <button
                                key={w}
                                onClick={() => answerArcade(w)}
                                className={optClass(w, arcadeCorrect, arcadePicked)}
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {arcadeRound?.kind === "add" && (
                        <div className="space-y-4 text-center">
                          <h4 className="text-lg font-black text-[var(--text-primary)]">
                            {S.addUp(arcadeRound.a, arcadeRound.b)}
                          </h4>
                          <div className="py-6 bg-[var(--amber-tint)] rounded-2xl border border-[var(--amber-tint)] text-5xl font-black text-[var(--text-primary)]">
                            {arcadeRound.a} + {arcadeRound.b} = ?
                          </div>
                          {listenBtn(S.addUp(arcadeRound.a, arcadeRound.b))}
                          <div className="grid grid-cols-4 gap-2">
                            {arcadeRound.options.map((num) => (
                              <button
                                key={num}
                                onClick={() => answerArcade(num)}
                                className={`${optClass(num, arcadeCorrect, arcadePicked)} text-xl`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </main>

      {/* ── Change Class Code Modal ────────────────────────────────── */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="vs-surface w-full max-w-md rounded-3xl p-6 border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[var(--brand-deep)]" />
                <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                  {t("classCodeTitle") || "Enter Class Code"}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowCodeModal(false);
                  setShowScanner(false);
                  setCodeError("");
                }}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              {t("classCodeSub") || "Enter the 6-character code given by your teacher to join their class."}
            </p>

            {showScanner ? (
              <QrScanner onScan={handleQrScanned} onClose={() => setShowScanner(false)} />
            ) : (
              <>
                <input
                  type="text"
                  value={newCodeInput}
                  onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. MATH42"
                  maxLength={8}
                  className="vs-input w-full px-4 py-3 rounded-xl font-mono text-center text-lg font-bold tracking-widest uppercase"
                />

                <button
                  onClick={() => {
                    setCodeError("");
                    setShowScanner(true);
                  }}
                  className="w-full py-3 rounded-xl text-sm font-bold border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)] transition flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  {t("qrScanBtn", "Scan QR instead")}
                </button>
              </>
            )}

            {codeError && <p className="text-xs font-bold text-[var(--red)] text-center">{codeError}</p>}

            {!showScanner && (
              <button
                onClick={() => handleJoinNewCode()}
                disabled={!newCodeInput.trim()}
                className="w-full vs-btn-brand py-3 rounded-xl text-sm font-extrabold shadow-sm disabled:opacity-50"
              >
                {t("joinClassroom")}
              </button>
            )}
          </div>
        </div>
      )}

      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="vs-surface w-full max-w-md rounded-3xl p-6 border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Server className="w-5 h-5 text-[var(--brand-deep)]" />
                Student Edge AI Server Status
              </h3>
              <button
                onClick={() => setShowServerModal(false)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live connection badge */}
            <div className={`p-3 rounded-2xl border text-xs font-bold flex flex-col gap-1.5 ${serverOnline
              ? "bg-[var(--green-tint)] border-[var(--green-tint)] text-[var(--green)]"
              : serverOnline === false
                ? "bg-[var(--red-tint)] border-[var(--red-tint)] text-[var(--red)]"
                : "bg-[var(--amber-tint)] border-[var(--amber-tint)] text-[var(--amber)]"
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${serverOnline ? "bg-[var(--green)]" : serverOnline === false ? "bg-[var(--red)]" : "bg-[var(--amber)] animate-pulse"}`} />
                  <span>
                    {serverDetecting ? "Detecting edge server..." : serverOnline ? "Connected to Teacher's Server" : "Server Offline"}
                  </span>
                </div>
                <button
                  onClick={() => connectToSession()}
                  disabled={serverDetecting}
                  className="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:opacity-90 disabled:opacity-50"
                  title="Re-test Connection"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${serverDetecting ? "animate-spin" : ""}`} />
                </button>
              </div>
              {(serverError || connectError) && (
                <p className="text-[10px] text-[var(--red)] font-medium">{serverError || connectError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Server IP / Endpoint URL
              </label>
              <input
                type="text"
                value={serverInput}
                onChange={(e) => setServerInput(e.target.value)}
                placeholder="http://192.168.1.5:8000"
                className="vs-input w-full px-4 py-3 rounded-xl font-mono text-sm"
              />
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Quick Presets</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setServerInput("http://localhost:8000")}
                  className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                >
                  Localhost (8000)
                </button>
                <button
                  type="button"
                  onClick={() => setServerInput("http://10.0.2.2:8000")}
                  className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                >
                  Android Emulator (10.0.2.2)
                </button>
                <button
                  type="button"
                  onClick={() => setServerInput("http://192.168.1.191:8000")}
                  className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                >
                  Wi-Fi (192.168.1.191)
                </button>
              </div>
            </div>

            {/* Evaluator Note */}
            <div className="p-3 rounded-2xl bg-[var(--brand-tint)]/40 border border-[var(--brand-tint2)] text-[11px] text-[var(--text-secondary)] space-y-1">
              <p className="font-bold text-[var(--brand-deep)]">Architecture Note:</p>
              <p>
                Student app receives real-time Indic ASR voice streams and multilingual translations directly from this Edge AI server over WebSocket.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowServerModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={async () => {
                  try {
                    setEdgeServerUrl(serverInput);
                    setShowServerModal(false);
                    await connectToSession();
                  } catch {
                    setServerError("Invalid URL. Use format http://<IP>:8000");
                  }
                }}
                className="flex-1 vs-btn-brand py-2.5 rounded-xl text-xs font-extrabold"
              >
                {t("saveAndConnect")}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="vs-surface border-0 border-t border-[var(--border)] py-3 text-center text-[11px] text-[var(--text-muted)] font-medium">
        {t("footerStudent")} {grade}
      </footer>
    </div>
  );
}
