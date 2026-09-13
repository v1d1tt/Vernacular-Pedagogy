"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchActiveSessions, joinSession, connectWebSocket, transcribeAudio, broadcastSpeech, detectActiveEdgeServer, getEdgeServerUrl, fetchPublishedActivities, getSessionByCode } from "@/lib/api-client";
import { AudioRecorder } from "@/lib/audio-recorder";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import { Volume2, Hand, HelpCircle, BookOpen, ArrowLeft, CheckCircle2, Mic, MicOff, Award, Globe, ChevronDown, Square } from "lucide-react";
import { MicWaveform } from "@/components/mic-waveform";
import { SUPPORTED_LANGUAGES } from "@/lib/nipun-data";
import { prepareTtsText } from "@/lib/ol-chiki";

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
};

export default function StudentConsole() {
  const router = useRouter();
  const { t } = useLanguage();
  const [studentName, setStudentName] = useState("Aarav");
  const [studentLang, setStudentLang] = useState("hi");
  const [studentLangName, setStudentLangName] = useState("Hindi");
  const [grade, setGrade] = useState(2);
  const [participantId] = useState("P-" + Math.floor(Math.random() * 1000));
  const [joinedSession, setJoinedSession] = useState<{ session_id: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"LISTEN" | "QUIZ" | "WORKSHEET" | "FLASHCARDS" | "GAMES">("LISTEN");
  const [gameScore, setGameScore] = useState<number>(0);
  const [activeGameIndex, setActiveGameIndex] = useState<number>(0);

  // Teacher speech in teacher's language (English default)
  const [teacherSpeech, setTeacherSpeech] = useState(
    "Hello children, today we will learn new things in mathematics."
  );
  const [teacherLang, setTeacherLang] = useState("en");

  // Translation in student's chosen language (from profile / signup)
  const [translatedSpeech, setTranslatedSpeech] = useState(
    "नमस्ते बच्चों, आज हम गणित में नई चीज़ें सीखेंगे।"
  );
  const [showLangPicker, setShowLangPicker] = useState(false);
  const studentLangRef = useRef(studentLang);
  const joinedSessionRef = useRef(joinedSession);

  useEffect(() => {
    studentLangRef.current = studentLang;
  }, [studentLang]);

  useEffect(() => {
    joinedSessionRef.current = joinedSession;
  }, [joinedSession]);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [ttfa, setTtfa] = useState<number | null>(null);
  const [raisedHand, setRaisedHand] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [isRecordingStudent, setIsRecordingStudent] = useState(false);
  const [studentMicStatus, setStudentMicStatus] = useState<string | null>(null);
  const [recorder] = useState(() => (typeof window !== "undefined" ? new AudioRecorder() : null));
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [worksheetAnswers, setWorksheetAnswers] = useState<Record<string, Record<number, string>>>({});
  const [submittedScores, setSubmittedScores] = useState<Record<string, number>>({});

  const handleSelectStudentLang = (code: string, name: string) => {
    setStudentLang(code);
    setStudentLangName(name);
    setShowLangPicker(false);
    try {
      localStorage.setItem("user_lang", code);
      localStorage.setItem("user_lang_name", name);
    } catch {}

    const initialGreetings: Record<string, string> = {
      hi: "नमस्ते बच्चों, आज हम कक्षा में नई चीज़ें सीखेंगे।",
      en: "Hello children, today we will learn new things in class.",
      bn: "নমস্কার বাচ্চারা, আজ আমরা ক্লাসে নতুন কিছু শিখব।",
      mr: "नमस्कार मुलांनो, आज आपण वर्गात नवीन गोष्टी शिकणार आहोत.",
      ta: "வணக்கம் குழந்தைகளே, இன்று நாம் வகுப்பில் புதிய விஷயங்களைக் கற்றுக்கொள்வோம்.",
      te: "నమస్కారం పిల్లలు, ఈరోజు మనం తరగతిలో కొత్త విషయాలు నేర్చుకుందాం.",
      sat: "ᱡᱚᱦᱟᱨ ᱜᱤᱫᱽᱨᱟᱹ, ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱪᱟᱱᱚᱪ ᱨᱮ ᱱᱟᱶᱟ ᱡᱤᱱᱤᱥ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ᱾",
    };
    if (initialGreetings[code]) {
      setTranslatedSpeech(initialGreetings[code]);
    }
  };

  // Pre-load SpeechSynthesis voices early
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.getVoices();
        const onVoices = () => {
          window.speechSynthesis.getVoices();
        };
        window.speechSynthesis.addEventListener("voiceschanged", onVoices);
        return () => {
          window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        };
      } catch {}
    }
  }, []);

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
      } catch {}
    }
    setIsPlayingAudio(false);
  }, []);

  const playSyntheticAudio = useCallback(async (text: string, forceLang?: string) => {
    const targetLang = forceLang || studentLang;
    const rawText = text?.trim() || "Hello, welcome to class.";

    // If currently playing, clicking again stops playback
    if (isPlayingAudio) {
      stopAudio();
      return;
    }

    // 1. Prepare phonetic text (translates Ol Chiki Santali script into Hindi/Devanagari phonetics)
    const { speechText, speechLang } = prepareTtsText(rawText, targetLang);

    setIsPlayingAudio(true);

    // 2. Unlock AudioContext on direct user gesture
    if (typeof window !== "undefined") {
      try {
        const win = window as WindowWithAudio;
        const AudioCtx = win.AudioContext || win.webkitAudioContext;
        if (AudioCtx) {
          const ctx = win._audioCtx || new AudioCtx();
          win._audioCtx = ctx;
          if (ctx.state === "suspended") {
            ctx.resume();
          }
        }
      } catch {}
    }

    // Helper: Browser native SpeechSynthesis (instant, zero network latency, preserves gesture)
    const trySpeechSynthesis = (): boolean => {
      try {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;

        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.lang = speechLang;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;

        // Try to match available voices on device
        const voices = window.speechSynthesis.getVoices();
        const prefix = speechLang.split("-")[0].toLowerCase();
        const voiceMatch = voices.find((v) => {
          const l = (v.lang || "").toLowerCase().replace("_", "-");
          return l.startsWith(prefix);
        }) || voices.find((v) => (v.lang || "").toLowerCase().includes("in")) || voices[0];

        if (voiceMatch) {
          utterance.voice = voiceMatch;
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

        // Android WebView keep-alive: periodically call resume
        resumeTimer = setInterval(() => {
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
              finalize();
            } else {
              window.speechSynthesis.resume();
            }
          }
        }, 200);

        // Watchdog: max 8 seconds safety timeout so button never gets stuck
        safetyTimer = setTimeout(() => {
          finalize();
        }, 8000);

        window.speechSynthesis.speak(utterance);
        console.log(`SpeechSynthesis started: "${speechText.slice(0, 30)}..." in ${speechLang}`);
        return true;
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
        return false;
      }
    };

    // 3. Trigger SpeechSynthesis immediately on user click
    const spokeNatively = trySpeechSynthesis();
    if (spokeNatively) {
      return;
    }

    // 4. Fallback: Neural TTS from edge backend if SpeechSynthesis not available
    try {
      const serverUrl = getEdgeServerUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

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

    // 5. Ultimate fallback: reset state gracefully without tone beep
    setIsPlayingAudio(false);
  }, [studentLang, isPlayingAudio, stopAudio]);

  useEffect(() => {
    const s = localStorage.getItem("user_name");
    const l = localStorage.getItem("user_lang") || "hi";
    const ln = localStorage.getItem("user_lang_name") || "Hindi";
    const g = localStorage.getItem("user_grade");
    if (s) setStudentName(s);
    if (l) setStudentLang(l);
    if (ln) setStudentLangName(ln);
    if (g) setGrade(Number(g));

    const initialGreetings: Record<string, string> = {
      hi: "नमस्ते बच्चों, आज हम गणित में नई चीज़ें सीखेंगे।",
      en: "Hello children, today we will learn new things in mathematics.",
      bn: "নমস্কার বাচ্চারা, আজ আমরা গণিতে নতুন कुछ শিখব।",
      mr: "नमस्कार मुलांनो, आज आपण गणितात नवीन गोष्टी शिकणार आहोत.",
      ta: "வணக்கம் குழந்தைகளே, இன்று நாம் கணிதத்தில் புதிய விஷயங்களைக் கற்றுக்கொள்வோம்.",
      te: "నమస్కారం పిల్లలు, ఈరోజు మనం గణితంలో కొత్త విషయాలు నేర్చుకుందాం.",
      sat: "ᱡᱚᱦᱟᱨ ᱜᱤᱫᱽᱨᱟᱹ, ᱛᱮᱦᱮᱧ ᱟᱵᱚ ᱮᱞᱠᱷᱟ ᱨᱮ ᱱᱟᱶᱟ ᱡᱤᱱᱤᱥ ᱵᱚᱱ ᱪᱮᱫᱚᱜᱼᱟ᱾",
    };
    if (l && initialGreetings[l]) {
      setTranslatedSpeech(initialGreetings[l]);
    }

    let pollInterval: NodeJS.Timeout | null = null;
    
    async function init() {
      if (joinedSessionRef.current) return;
      try {
        await detectActiveEdgeServer();
        const savedCode = localStorage.getItem("user_class_code");
        const savedSessionId = localStorage.getItem("user_joined_session_id");
        let targetSessionId = "";

        if (savedSessionId) {
          targetSessionId = savedSessionId;
        } else if (savedCode) {
          try {
            const sess = await getSessionByCode(savedCode);
            if (sess && sess.id) targetSessionId = sess.id;
          } catch (e) {
            console.warn("Class code lookup failed:", e);
          }
        }

        if (!targetSessionId) {
          const res = await fetchActiveSessions();
          const activeList = res?.sessions || [];
          if (activeList.length > 0) {
            targetSessionId = activeList[0].id;
          }
        }

        if (targetSessionId) {
          await joinSession(targetSessionId, {
            student_id: participantId,
            student_name: s || "Aarav",
            preferred_language: l || "hi",
          });
          setJoinedSession({ session_id: targetSessionId });

          fetchPublishedActivities(targetSessionId).then((res) => {
            if (res && res.activities && res.activities.length > 0) {
              setActivities(res.activities as StudentActivity[]);
            }
          });

          connectWebSocket(targetSessionId, (msg) => {
            if (msg.type === "SPEECH_TRANSLATED") {
              const origText = (msg.original_text as string) || "";
              const srcLang = (msg.source_lang as string) || "en";
              setTeacherSpeech(origText);
              setTeacherLang(srcLang);

              const trans = (msg.translations as Record<string, string>) || {};
              const curLang = studentLangRef.current || l || "hi";
              const myTrans = trans[curLang] || trans["hi"] || trans["en"] || origText;
              setTranslatedSpeech(myTrans);
              setTtfa((msg.ttfa_seconds as number) || 0.45);
              playSyntheticAudio(myTrans, curLang);
            } else if (msg.type === "SPEAKING_PERMISSION" || msg.type === "SPEAKING_PERMISSION_CHANGED") {
              if (msg.participant_id === participantId) {
                setCanSpeak(Boolean(msg.can_speak ?? msg.allowed));
                if (msg.can_speak || msg.allowed) {
                  setRaisedHand(false);
                }
              }
            } else if (msg.type === "ACTIVITY_APPROVED" || msg.type === "ACTIVITY_PUBLISHED_TO_CLASS") {
              const act = msg.activity as StudentActivity;
              if (act) {
                setActivities((prev) => [act, ...prev.filter((a) => a.activity_id !== act.activity_id)]);
              }
            }
          });
          if (pollInterval) clearInterval(pollInterval);
        } else {
          setJoinedSession({ session_id: "LOCAL-DEMO-01" });
        }
      } catch (err) {
        console.error("Auto-connect failed:", err);
        setJoinedSession({ session_id: "LOCAL-DEMO-01" });
      }
    }
    
    init();
    pollInterval = setInterval(() => {
      init();
    }, 3000);
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [participantId, playSyntheticAudio]);

  const handleToggleRaiseHand = async () => {
    if (!joinedSession) return;

    if (canSpeak) {
      if (isRecordingStudent) {
        setIsRecordingStudent(false);
        setStudentMicStatus("Transcribing question with Whisper AI...");
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
          setStudentMicStatus("Microphone error");
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
    fetch(
      `${getEdgeServerUrl()}/api/sessions/${joinedSession.session_id}/raise-hand?participant_id=${participantId}&student_name=${encodeURIComponent(
        studentName
      )}&raised=${nextState}`,
      { method: "POST" }
    );
  };

  const tabs = [
    { id: "LISTEN" as const, label: t("tabListen"), icon: <Volume2 className="w-4 h-4" /> },
    { id: "QUIZ" as const, label: t("tabQuiz"), icon: <HelpCircle className="w-4 h-4" /> },
    { id: "WORKSHEET" as const, label: t("tabWorksheet"), icon: <BookOpen className="w-4 h-4" /> },
    { id: "FLASHCARDS" as const, label: t("tabCards"), icon: <Award className="w-4 h-4" /> },
    { id: "GAMES" as const, label: "FLN Games 🎮", icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen vs-bg flex flex-col">

      {/* App Bar */}
      <header className="vs-surface border-0 border-b border-[var(--border)] px-5 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="p-2 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[var(--brand)] text-[#0c1a2e] font-black text-base flex items-center justify-center shadow-sm">
              {studentName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)] leading-none">वाणीSetu</p>
              <div className="flex items-center gap-1.5 mt-0.5 relative">
                <span className="text-[10px] text-[var(--text-muted)]">{studentName} · {t("class")} {grade}</span>
                <span className="text-[10px] text-[var(--text-muted)]">·</span>
                <button
                  onClick={() => setShowLangPicker((prev) => !prev)}
                  className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-deep)] bg-[var(--brand-tint)] px-1.5 py-0.5 rounded hover:bg-[var(--brand-tint2)] transition"
                  title="Your chosen language for translations and replay"
                >
                  <Globe className="w-2.5 h-2.5" />
                  {studentLangName}
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>

                {showLangPicker && (
                  <div className="absolute top-6 left-0 z-50 vs-surface border border-[var(--border)] rounded-2xl shadow-xl p-2 w-48 space-y-1">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-2 py-1">
                      Your Language
                    </p>
                    {SUPPORTED_LANGUAGES.map((sl) => (
                      <button
                        key={sl.code}
                        onClick={() => handleSelectStudentLang(sl.code, sl.name)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                          studentLang === sl.code
                            ? "bg-[var(--brand-tint)] text-[var(--brand-deep)] font-bold"
                            : "text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                        }`}
                      >
                        <span>{sl.nativeName}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{sl.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPlayingAudio && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--red-tint)] text-[var(--red)] text-xs font-bold animate-pulse">
              <Volume2 className="w-3.5 h-3.5" /> {t("playing")}
            </div>
          )}
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${joinedSession ? "bg-[var(--green-tint)] border-[var(--green-tint)] text-[var(--green)]" : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)]"}`}>
            {joinedSession ? t("inClass") : t("connecting")}
          </div>
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-5 flex flex-col gap-4">

        {/* Tab Bar */}
        <div className="vs-surface rounded-2xl p-1.5 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition relative ${
                activeTab === tab.id
                  ? "bg-[var(--brand)] text-[#0c1a2e] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {tab.icon} {tab.label}
              {tab.id === "QUIZ" && activities.filter((a) => a.activity_type === "QUIZ" || Boolean(a.content?.questions && a.content.questions.length > 0)).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--red)] text-white text-[9px] font-black flex items-center justify-center">
                  {activities.filter((a) => a.activity_type === "QUIZ" || Boolean(a.content?.questions && a.content.questions.length > 0)).length}
                </span>
              )}
              {tab.id === "WORKSHEET" && activities.filter((a) => a.activity_type === "WORKSHEET" || Boolean((a.content as Record<string, unknown>)?.tasks)).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--brand)] text-[#0c1a2e] text-[9px] font-black flex items-center justify-center">
                  {activities.filter((a) => a.activity_type === "WORKSHEET" || Boolean((a.content as Record<string, unknown>)?.tasks)).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* LISTEN */}
        {activeTab === "LISTEN" && (
          <div className="space-y-4">
            <div className="vs-surface rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[var(--brand)]" />
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("teacherIsSaying")}</h2>
                </div>
                {ttfa && (
                  <span className="text-[10px] text-[var(--green)] font-bold bg-[var(--green-tint)] px-2 py-0.5 rounded-full">
                    {ttfa}s
                  </span>
                )}
              </div>
              <div className="p-5 sm:p-6 space-y-3">
                {/* Teacher's Original Speech (English default) */}
                <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-[var(--brand)]" />
                      Teacher ({teacherLang === "en" ? "English" : teacherLang.toUpperCase()})
                    </span>
                  </div>
                  <p className="text-lg font-bold text-[var(--text-primary)] leading-relaxed">
                    &ldquo;{teacherSpeech}&rdquo;
                  </p>
                </div>

                {/* Translation in Student's Chosen Language */}
                <div className="p-4 rounded-xl bg-[var(--brand-tint)] border border-[var(--brand-tint2)]">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[var(--brand-deep)] mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      In your language ({studentLangName})
                    </span>
                    {isPlayingAudio && <MicWaveform isSpeaking={true} />}
                  </div>
                  <p className="text-lg font-bold text-[var(--text-primary)] leading-relaxed">
                    &ldquo;{translatedSpeech}&rdquo;
                  </p>
                </div>

                {/* Replay in Student's Language */}
                <button
                  type="button"
                  onClick={() => playSyntheticAudio(translatedSpeech, studentLang)}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                    isPlayingAudio
                      ? "bg-[var(--red-tint)] border-2 border-[var(--red)] text-[var(--red)] animate-pulse shadow-sm"
                      : "vs-btn-brand shadow-sm"
                  }`}
                >
                  {isPlayingAudio ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      <span>{t("playingAudioState")} (Tap to Stop)</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>{`${t("replayInMyLang")} (${studentLangName})`}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Raise Hand */}
            <div className="vs-surface rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t("wantToSpeak")}</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{t("raiseHandSub")}</p>
                </div>
                {raisedHand && !canSpeak && (
                  <span className="text-xs font-bold text-[var(--amber)] bg-[var(--amber-tint)] px-3 py-1.5 rounded-full animate-pulse">
                    {t("waitingState")}
                  </span>
                )}
              </div>
              <button
                onClick={handleToggleRaiseHand}
                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition ${
                  isRecordingStudent
                    ? "bg-[var(--red)] text-white animate-pulse shadow-lg ring-4 ring-red-400/30"
                    : canSpeak
                    ? "bg-[var(--green)] text-white shadow-md animate-bounce"
                    : raisedHand
                    ? "bg-[var(--amber-tint)] text-[var(--amber)] border border-[var(--amber)]"
                    : "bg-[var(--brand-tint)] text-[var(--brand-deep)] border border-[var(--brand-tint2)] hover:bg-[var(--brand-tint2)]"
                }`}
              >
                {isRecordingStudent ? <MicOff className="w-5 h-5" /> : canSpeak ? <Mic className="w-5 h-5" /> : <Hand className="w-5 h-5" />}
                {isRecordingStudent
                  ? "Recording question... Tap to send"
                  : canSpeak
                  ? "Approved! Tap mic to speak"
                  : raisedHand
                  ? t("handRaisedWaitingBtn")
                  : t("raiseMyHandBtn")}
              </button>
              {studentMicStatus && (
                <div className={`mt-2.5 text-xs px-3 py-2 rounded-xl flex items-center gap-2 font-medium ${
                  isRecordingStudent
                    ? "bg-[var(--red-tint)] text-[var(--red)] animate-pulse"
                    : "bg-[var(--green-tint)] text-[var(--green)]"
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {studentMicStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUIZ */}
        {activeTab === "QUIZ" && (
          <div className="space-y-4">
            {(() => {
              const quizList = activities.filter((a) => a.activity_type === "QUIZ" || Boolean(a.content?.questions && a.content.questions.length > 0));
              if (quizList.length === 0) {
                return (
                  <div className="vs-surface rounded-2xl p-10 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] flex items-center justify-center mx-auto">
                      <HelpCircle className="w-7 h-7 text-[var(--brand)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-secondary)]">{t("noQuizYet")}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{t("noQuizYetSub")}</p>
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
                };

                return (
                  <div key={act.activity_id || idx} className="vs-surface rounded-2xl overflow-hidden shadow-sm border border-[var(--border)]">
                    <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between bg-[var(--brand-tint)]">
                      <h2 className="text-sm font-bold text-[var(--brand-deep)]">{act.title}</h2>
                      <span className="text-[10px] font-bold text-[var(--brand-deep)] bg-[var(--surface)] px-2.5 py-1 rounded-full border border-[var(--brand-tint2)]">{act.domain || "Quiz"}</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {questions.map((q) => (
                        <div key={q.id} className="space-y-3 p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{q.question}</p>
                          {q.visual === "COUNTING_APPLES" && (
                            <div className="flex items-center justify-center gap-3 text-3xl py-2 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                              🍎 🍎 🍎
                            </div>
                          )}
                          {q.options && (
                            <div className="grid grid-cols-2 gap-2">
                              {q.options.map((opt) => (
                                <button
                                  key={opt}
                                  disabled={isSubmitted}
                                  onClick={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                  className={`p-3 rounded-xl font-bold text-xs text-center transition border-2 ${
                                    selectedAnswers[q.id] === opt
                                      ? "border-[var(--brand)] bg-[var(--brand)] text-[#0c1a2e] shadow-sm"
                                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--brand)]"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {isSubmitted ? (
                        <div className="p-4 rounded-xl bg-[var(--green-tint)] border border-[var(--green-tint)] text-center space-y-1 animate-fadeIn">
                          <Award className="w-8 h-8 text-[var(--green)] mx-auto" />
                          <p className="text-base font-black text-[var(--green)]">{t("wellDoneTitle")}</p>
                          <p className="text-xs text-[var(--green)] font-semibold">
                            Score: {scoreVal}% ({t("wellDoneSub")})
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={handleScoreThisQuiz}
                          disabled={questions.some((q) => !selectedAnswers[q.id])}
                          className="w-full py-3.5 rounded-xl bg-[var(--green)] hover:opacity-90 disabled:opacity-50 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
                        >
                          {t("submitAnswers")} <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* WORKSHEET */}
        {activeTab === "WORKSHEET" && (
          <div className="space-y-4">
            {(() => {
              const worksheetList = activities.filter((a) => a.activity_type === "WORKSHEET" || Boolean((a.content as Record<string, unknown>)?.tasks));
              if (worksheetList.length === 0) {
                return (
                  <div className="vs-surface rounded-2xl p-10 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] flex items-center justify-center mx-auto">
                      <BookOpen className="w-7 h-7 text-[var(--brand)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-secondary)]">No Worksheet Available</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Worksheets assigned by your teacher will appear here.</p>
                    </div>
                  </div>
                );
              }
              return worksheetList.map((act, idx) => {
                const tasks = (((act.content as Record<string, unknown>)?.tasks as unknown[]) || []) as Array<{ task: string; answer?: string }>;
                const isSubmitted = submittedScores[act.activity_id] !== undefined;

                const handleSubmitWorksheet = () => {
                  setSubmittedScores((prev) => ({ ...prev, [act.activity_id]: 100 }));
                };

                return (
                  <div key={act.activity_id || idx} className="vs-surface rounded-2xl overflow-hidden shadow-sm border border-[var(--border)] space-y-4">
                    <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between bg-[var(--brand-tint)]">
                      <h2 className="text-sm font-bold text-[var(--brand-deep)]">{act.title}</h2>
                      <span className="text-[10px] font-bold text-[var(--brand-deep)] bg-[var(--surface)] px-2.5 py-1 rounded-full border border-[var(--brand-tint2)]">Worksheet</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {tasks.map((tItem, tIdx) => (
                        <div key={tIdx} className="space-y-2 p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)]">
                          <p className="text-xs font-bold text-[var(--text-primary)]">
                            <span className="text-[var(--brand-deep)] font-extrabold mr-1.5">{tIdx + 1}.</span>
                            {tItem.task}
                          </p>
                          <textarea
                            disabled={isSubmitted}
                            value={worksheetAnswers[act.activity_id]?.[tIdx] || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWorksheetAnswers((prev) => ({
                                ...prev,
                                [act.activity_id]: {
                                  ...(prev[act.activity_id] || {}),
                                  [tIdx]: val,
                                },
                              }));
                            }}
                            placeholder="Type your answer here..."
                            rows={2}
                            className="vs-input w-full px-3 py-2 rounded-xl text-xs font-medium resize-none disabled:opacity-60"
                          />
                        </div>
                      ))}

                      {isSubmitted ? (
                        <div className="p-4 rounded-xl bg-[var(--green-tint)] border border-[var(--green-tint)] text-center space-y-1 animate-fadeIn">
                          <Award className="w-8 h-8 text-[var(--green)] mx-auto" />
                          <p className="text-base font-black text-[var(--green)]">Worksheet Submitted! ⭐</p>
                          <p className="text-xs text-[var(--green)] font-semibold">Your responses have been recorded by the teacher.</p>
                        </div>
                      ) : (
                        <button
                          onClick={handleSubmitWorksheet}
                          className="w-full py-3.5 rounded-xl bg-[var(--green)] hover:opacity-90 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
                        >
                          Submit Worksheet <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* FLASHCARDS */}
        {activeTab === "FLASHCARDS" && (
          <div className="space-y-4">
            {(() => {
              const serverCards = activities.filter((a) => a.activity_type === "FLASHCARD" || Boolean((a.content as Record<string, unknown>)?.cards));
              if (serverCards.length > 0) {
                return serverCards.map((act, idx) => {
                  const cards = (((act.content as Record<string, unknown>)?.cards as unknown[]) || []) as Array<{ word: string; meaning?: string; phonics?: string; visual?: string; color?: string }>;
                  return (
                    <div key={act.activity_id || idx} className="space-y-3">
                      <h2 className="text-sm font-bold text-[var(--text-primary)]">{act.title}</h2>
                      <div className="grid grid-cols-2 gap-3">
                        {cards.map((c, cIdx) => (
                          <div key={cIdx} className="vs-surface rounded-2xl overflow-hidden shadow-sm border border-[var(--border)]">
                            <div className="flex items-center justify-center text-5xl py-6" style={{ backgroundColor: c.color ? `color-mix(in srgb, ${c.color} 25%, transparent)` : "var(--brand-tint)" }}>
                              {c.visual || "📚"}
                            </div>
                            <div className="p-4 space-y-1">
                              <p className="text-lg font-black text-[var(--text-primary)]">{c.word}</p>
                              {c.phonics && <p className="text-xs font-bold text-[var(--brand-deep)] uppercase tracking-wider">{c.phonics}</p>}
                              {c.meaning && <p className="text-[11px] text-[var(--text-secondary)]">{c.meaning}</p>}
                              <button
                                type="button"
                                onClick={() => playSyntheticAudio(c.word, studentLang)}
                                className="mt-2 w-full py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--text-secondary)] hover:text-[var(--brand-deep)] font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                              >
                                <Volume2 className="w-3.5 h-3.5" /> {t("pronounce")}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              }

              // Fallback to static flashcards
              return (
                <div className="grid grid-cols-2 gap-3">
                  {(FLASHCARDS_DATA[studentLang] || FLASHCARDS_DATA["hi"]).map((card, i) => (
                    <div key={i} className="vs-surface rounded-2xl overflow-hidden shadow-sm">
                      <div className="flex items-center justify-center text-5xl py-7" style={{ backgroundColor: `color-mix(in srgb, ${card.tint} 60%, transparent)` }}>
                        {card.visual}
                      </div>
                      <div className="p-4 space-y-1">
                        <p className="text-xl font-black text-[var(--text-primary)]">{card.word}</p>
                        <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{card.eng}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{card.desc}</p>
                        <button
                          type="button"
                          onClick={() => playSyntheticAudio(card.word, studentLang)}
                          className="mt-2 w-full py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--text-secondary)] hover:text-[var(--brand-deep)] font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> {t("pronounce")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* FLN GAMES */}
        {activeTab === "GAMES" && (
          <div className="space-y-4">
            <div className="vs-surface rounded-2xl p-5 border border-[var(--brand-tint2)] bg-[var(--brand-tint)] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[var(--brand-deep)]" />
                  <h3 className="text-sm font-bold text-[var(--brand-deep)]">
                    {studentLang === "sat" ? "ᱱᱤᱯᱩᱱ ᱵᱷᱟᱨᱚᱛ ᱜᱤᱫᱽᱨᱟᱹ ᱪᱮᱫᱚᱜ ᱴᱷᱟᱶ" : studentLang === "hi" ? "निपुण भारत बाल-शिक्षा केंद्र" : "NIPUN FLN Learning Hub"}
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Interactive audio games for Class {grade} · Language: <span className="font-bold">{studentLangName}</span>
                </p>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--brand-tint2)] text-xs font-black text-[var(--brand-deep)]">
                ⭐ {gameScore} Stars
              </div>
            </div>

            {/* Game Card */}
            <div className="vs-surface rounded-2xl p-6 text-center space-y-5">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">
                <span>Game {activeGameIndex + 1} of 3</span>
                <span>Classroom Activity</span>
              </div>

              {activeGameIndex === 0 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-black text-[var(--text-primary)]">
                    {studentLang === "sat" ? "ᱮᱞᱠᱷᱟ: ᱛᱤᱱᱟᱹᱜ ᱥᱮᱣ ᱢᱮᱱᱟᱜᱼᱟ? (Count Apples)" : "गिनती: कितने सेब हैं? (Count Apples)"}
                  </h4>
                  <div className="flex items-center justify-center gap-4 text-5xl py-6 bg-[var(--surface-2)] rounded-2xl border border-[var(--border)]">
                    🍎 🍎 🍎 🍎
                  </div>
                  <button
                    onClick={() => playSyntheticAudio(studentLang === "sat" ? "ᱯᱩᱱᱭᱟᱹ ᱥᱮᱣ" : "चार सेब हैं", studentLang)}
                    className="mx-auto px-4 py-2 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-deep)] font-bold text-xs flex items-center gap-2 hover:bg-[var(--brand-tint2)] transition"
                  >
                    <Volume2 className="w-4 h-4" /> {studentLang === "sat" ? "ᱥᱟᱰᱮ ᱟᱸᱡᱚᱢ (Listen)" : "आवाज़ सुनें (Listen)"}
                  </button>
                  <div className="grid grid-cols-4 gap-3 pt-2">
                    {[2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          if (num === 4) {
                            setGameScore((s) => s + 10);
                            playSyntheticAudio(studentLang === "sat" ? "ᱥᱟᱹᱨᱤ ᱜᱮ! ᱯᱩᱱᱭᱟᱹ" : "सही जवाब! चार", studentLang);
                          } else {
                            playSyntheticAudio(studentLang === "sat" ? "ᱟᱨᱦᱚᱸ ᱪᱮᱥᱴᱟᱭ platform" : "फिर से कोशिश करें", studentLang);
                          }
                        }}
                        className="py-4 rounded-2xl bg-[var(--surface-2)] border-2 border-[var(--border)] hover:border-[var(--brand)] text-2xl font-black text-[var(--text-primary)] transition active:scale-95"
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeGameIndex === 1 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-black text-[var(--text-primary)]">
                    {studentLang === "sat" ? "ᱚᱞ ᱪᱤᱠᱤ: 'ᱚ' ᱪᱤᱠᱤ ᱪᱤᱱᱦᱟᱹᱣ (Match Letter)" : "अक्षर ज्ञान: 'अ' अक्षर पहचानें"}
                  </h4>
                  <div className="text-6xl py-6 bg-[var(--violet-tint)] text-[var(--violet)] rounded-2xl font-black border border-[var(--violet-tint)]">
                    {studentLang === "sat" ? "ᱚ" : "अ"}
                  </div>
                  <button
                    onClick={() => playSyntheticAudio(studentLang === "sat" ? "ᱚ ᱪᱤᱠᱤ" : "अक्षर अ", studentLang)}
                    className="mx-auto px-4 py-2 rounded-xl bg-[var(--violet-tint)] text-[var(--violet)] font-bold text-xs flex items-center gap-2 hover:opacity-80 transition"
                  >
                    <Volume2 className="w-4 h-4" /> Listen Sound
                  </button>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {(studentLang === "sat" ? ["ᱚ", "ᱛ", "ᱜ"] : ["अ", "क", "म"]).map((char) => (
                      <button
                        key={char}
                        onClick={() => {
                          if (char === (studentLang === "sat" ? "ᱚ" : "अ")) {
                            setGameScore((s) => s + 10);
                            playSyntheticAudio(studentLang === "sat" ? "ᱟᱹᱰᱤ ᱵᱮᱥ!" : "बहुत बढ़िया!", studentLang);
                          }
                        }}
                        className="py-4 rounded-2xl bg-[var(--surface-2)] border-2 border-[var(--border)] hover:border-[var(--brand)] text-3xl font-black text-[var(--text-primary)] transition active:scale-95"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeGameIndex === 2 && (
                <div className="space-y-4">
                  <h4 className="text-lg font-black text-[var(--text-primary)]">
                    {studentLang === "sat" ? "ᱡᱤᱣᱤᱭᱟᱹᱞᱤ: ᱱᱩᱭ ᱫᱚ ᱚᱠᱚᱭ? (Animal Sound)" : "पशु ज्ञान: यह कौन सा जानवर है?"}
                  </h4>
                  <div className="text-6xl py-6 bg-[var(--green-tint)] rounded-2xl border border-[var(--green-tint)]">
                    🐘
                  </div>
                  <button
                    onClick={() => playSyntheticAudio(studentLang === "sat" ? "ᱦᱟᱹᱛᱤ" : "हाथी", studentLang)}
                    className="mx-auto px-4 py-2 rounded-xl bg-[var(--green-tint)] text-[var(--green)] font-bold text-xs flex items-center gap-2 hover:opacity-80 transition"
                  >
                    <Volume2 className="w-4 h-4" /> {studentLang === "sat" ? "ᱦᱟᱹᱛᱤ (Hati)" : "हाथी (Elephant)"}
                  </button>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {(studentLang === "sat"
                      ? [{ name: "ᱦᱟᱹᱛᱤ (Elephant)", correct: true }, { name: "ᱥᱤᱢ (Rooster)", correct: false }]
                      : [{ name: "हाथी (Elephant)", correct: true }, { name: "शेर (Lion)", correct: false }]
                    ).map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (opt.correct) {
                            setGameScore((s) => s + 10);
                            playSyntheticAudio(studentLang === "sat" ? "ᱥᱟᱹᱨᱤ ᱜᱮ! ᱦᱟᱹᱛᱤ" : "सही उत्तर! हाथी", studentLang);
                          }
                        }}
                        className="py-3.5 rounded-xl bg-[var(--surface-2)] border-2 border-[var(--border)] hover:border-[var(--brand)] text-sm font-bold text-[var(--text-primary)] transition active:scale-95"
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t border-[var(--border-sub)]">
                <button
                  onClick={() => setActiveGameIndex((i) => Math.max(0, i - 1))}
                  disabled={activeGameIndex === 0}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] font-bold text-xs disabled:opacity-40"
                >
                  ← Previous Game
                </button>
                <button
                  onClick={() => setActiveGameIndex((i) => (i + 1) % 3)}
                  className="px-4 py-2 rounded-xl vs-btn-brand text-xs"
                >
                  Next Game →
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="vs-surface border-0 border-t border-[var(--border)] py-3 text-center text-[11px] text-[var(--text-muted)] font-medium">
        {t("footerStudent")} {grade}
      </footer>
    </div>
  );
}
