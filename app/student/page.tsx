"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchActiveSessions, joinSession, connectWebSocket, transcribeAudio, broadcastSpeech, getEdgeCandidates } from "@/lib/api-client";
import { AudioRecorder } from "@/lib/audio-recorder";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import { Volume2, Hand, HelpCircle, BookOpen, ArrowLeft, CheckCircle2, Mic, MicOff, Award, Globe, ChevronDown } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@/lib/nipun-data";

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
      correct_answer: string;
    }>;
  };
}

const FLASHCARDS_DATA: Record<string, Array<{ word: string; eng: string; desc: string; visual: string; tint: string }>> = {
  hi: [
    { word: "सूरज", eng: "Sun", desc: "आसमान का चमकता तारा", visual: "☀️", tint: "var(--amber-tint)" },
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
  const [activeTab, setActiveTab] = useState<"LISTEN" | "QUIZ" | "FLASHCARDS">("LISTEN");

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
  useEffect(() => {
    studentLangRef.current = studentLang;
  }, [studentLang]);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [ttfa, setTtfa] = useState<number | null>(null);
  const [raisedHand, setRaisedHand] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [isRecordingStudent, setIsRecordingStudent] = useState(false);
  const [studentMicStatus, setStudentMicStatus] = useState<string | null>(null);
  const [recorder] = useState(() => (typeof window !== "undefined" ? new AudioRecorder() : null));
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);

  const handleSelectStudentLang = (code: string, name: string) => {
    setStudentLang(code);
    setStudentLangName(name);
    setShowLangPicker(false);
    try {
      localStorage.setItem("user_lang", code);
      localStorage.setItem("user_lang_name", name);
    } catch {}

    const initialGreetings: Record<string, string> = {
      hi: "नमस्ते बच्चों, आज हम गणित में नई चीज़ें सीखेंगे।",
      en: "Hello children, today we will learn new things in mathematics.",
      bn: "নমস্কার বাচ্চারা, আজ আমরা গণিতে নতুন কিছু শিখব।",
      mr: "नमस्कार मुलांनो, আজ आपण गणितात नवीन गोष्टी शिकणार आहोत.",
      ta: "வணக்கம் குழந்தைகளே, இன்று நாம் கணிதத்தில் புதிய விஷயங்களைக் கற்றுக்கொள்வோம்.",
      te: "నమస్కారం పిల్లలు, ఈరోజు మనం గణితంలో కొత్త విషయాలు నేర్చుకుందాం.",
    };
    if (initialGreetings[code]) {
      setTranslatedSpeech(initialGreetings[code]);
    }
  };

  const playSyntheticAudio = useCallback(async (text: string, forceLang?: string) => {
    if (!text || !text.trim()) return;
    const targetLang = forceLang || studentLang;

    setIsPlayingAudio(true);

    // 1. Immediately unlock audio context on direct user gesture for mobile WebView
    if (typeof window !== "undefined") {
      try {
        const win = window as WindowWithAudio;
        const AudioCtx = win.AudioContext || win.webkitAudioContext;
        if (AudioCtx) {
          const ctx = win._audioCtx || new AudioCtx();
          win._audioCtx = ctx;
          if (ctx.state === "suspended") ctx.resume();
        }
      } catch {}
    }

    const fallbackToSpeechSynthesis = () => {
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.resume();

          const utterance = new SpeechSynthesisUtterance(text);
          const langMap: Record<string, string> = {
            hi: "hi-IN",
            bn: "bn-IN",
            mr: "mr-IN",
            ta: "ta-IN",
            te: "te-IN",
            en: "en-IN",
          };
          utterance.lang = langMap[targetLang] || "hi-IN";
          utterance.rate = 0.9;
          utterance.pitch = 1.0;

          // Select matching voice only if language actually matches; never force English voices[0] on Indic scripts!
          const voices = window.speechSynthesis.getVoices();
          const langPrefix = targetLang.toLowerCase().slice(0, 2);
          const match = voices.find((v) => {
            const vl = (v.lang || "").toLowerCase().replace("_", "-");
            return vl.startsWith(langPrefix);
          });
          if (match) {
            utterance.voice = match;
          }

          // Retain utterance on window to prevent Android WebView garbage collection silence bug
          const win = window as WindowWithAudio;
          win._activeUtterance = utterance;

          let ended = false;
          const finalize = () => {
            if (!ended) {
              ended = true;
              win._activeUtterance = null;
              setIsPlayingAudio(false);
            }
          };

          utterance.onend = finalize;
          utterance.onerror = finalize;

          // Android WebView pause workaround: periodically call resume
          const resumeTimer = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
              clearInterval(resumeTimer);
              finalize();
            } else {
              window.speechSynthesis.resume();
            }
          }, 250);

          setTimeout(() => {
            clearInterval(resumeTimer);
            finalize();
          }, 8000);

          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
      }
      setIsPlayingAudio(false);
    };

    // 2. Try neural TTS from candidate hosts (Android emulator 10.0.2.2, adb reverse localhost:8000, LAN IP)
    const candidates = getEdgeCandidates();
    let played = false;

    for (const host of candidates) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);

        const res = await fetch(
          `${host}/api/tts/speak?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(targetLang)}`,
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
              fallbackToSpeechSynthesis();
            };

            await audio.play();
            played = true;
            break;
          }
        }
      } catch {
        // Try next candidate host
      }
    }

    if (!played) {
      fallbackToSpeechSynthesis();
    }
  }, [studentLang]);

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
      bn: "নমস্কার বাচ্চারা, আজ আমরা গণিতে নতুন কিছু শিখব।",
      mr: "नमस्कार मुलांनो, आज आपण गणितात नवीन गोष्टी शिकणार आहोत.",
      ta: "வணக்கம் குழந்தைகளே, இன்று நாம் கணிதத்தில் புதிய விஷயங்களைக் கற்றுக்கொள்வோம்.",
      te: "నమస్కారం పిల్లలు, ఈరోజు మనం గణితంలో కొత్త విషయాలు నేర్చుకుందాం.",
    };
    if (l && initialGreetings[l]) {
      setTranslatedSpeech(initialGreetings[l]);
    }

    async function init() {
      try {
        const res = await fetchActiveSessions();
        if (res?.sessions && res.sessions.length > 0) {
          const session = res.sessions[0];
          await joinSession(session.id, {
            student_id: participantId,
            student_name: s || "Aarav",
            preferred_language: l || "hi",
          });
          setJoinedSession({ session_id: session.id });

          connectWebSocket(session.id, (msg) => {
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
            } else if (msg.type === "SPEAKING_PERMISSION") {
              if (msg.participant_id === participantId) {
                setCanSpeak(Boolean(msg.allowed));
                if (msg.allowed) {
                  setRaisedHand(false);
                }
              }
            } else if (msg.type === "ACTIVITY_APPROVED") {
              const act = msg.activity as StudentActivity;
              setActivities((prev) => [act, ...prev]);
            }
          });
        }
      } catch (err) {
        console.error("Auto-connect failed:", err);
      }
    }
    init();
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
      `http://localhost:8000/api/sessions/${joinedSession.session_id}/raise-hand?participant_id=${participantId}&student_name=${encodeURIComponent(
        studentName
      )}&raised=${nextState}`,
      { method: "POST" }
    );
  };

  const tabs = [
    { id: "LISTEN" as const, label: t("tabListen"), icon: <Volume2 className="w-4 h-4" /> },
    { id: "QUIZ" as const, label: t("tabQuiz"), icon: <HelpCircle className="w-4 h-4" /> },
    { id: "FLASHCARDS" as const, label: t("tabCards"), icon: <BookOpen className="w-4 h-4" /> },
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
              {tab.id === "QUIZ" && activities.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--red)] text-white text-[9px] font-black flex items-center justify-center">
                  {activities.length}
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
                  </div>
                  <p className="text-lg font-bold text-[var(--text-primary)] leading-relaxed">
                    &ldquo;{translatedSpeech}&rdquo;
                  </p>
                </div>

                {/* Replay in Student's Language */}
                <button
                  onClick={() => playSyntheticAudio(translatedSpeech, studentLang)}
                  disabled={isPlayingAudio}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
                    isPlayingAudio
                      ? "bg-[var(--red-tint)] border-2 border-[var(--red)] text-[var(--red)] animate-pulse"
                      : "vs-btn-brand"
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  {isPlayingAudio ? t("playingAudioState") : `${t("replayInMyLang")} (${studentLangName})`}
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
            {activities.length === 0 ? (
              <div className="vs-surface rounded-2xl p-10 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] flex items-center justify-center mx-auto">
                  <HelpCircle className="w-7 h-7 text-[var(--brand)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-secondary)]">{t("noQuizYet")}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t("noQuizYetSub")}</p>
                </div>
              </div>
            ) : (
              activities.map((act, idx) => (
                <div key={idx} className="vs-surface rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between bg-[var(--brand-tint)]">
                    <h2 className="text-sm font-bold text-[var(--brand-deep)]">{act.title}</h2>
                    <span className="text-[10px] font-bold text-[var(--brand-deep)] bg-[var(--surface)] px-2.5 py-1 rounded-full border border-[var(--brand-tint2)]">{act.domain}</span>
                  </div>
                  <div className="p-4 space-y-4">
                    {act.content?.questions?.map((q) => (
                      <div key={q.id} className="space-y-3">
                        <p className="text-base font-bold text-[var(--text-primary)]">{q.question}</p>
                        {q.visual === "COUNTING_APPLES" && (
                          <div className="flex items-center justify-center gap-3 text-4xl py-3 bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                            🍎 🍎 🍎
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2.5">
                          {q.options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                              className={`p-4 rounded-xl font-bold text-sm text-center transition border-2 ${
                                selectedAnswers[q.id] === opt
                                  ? "border-[var(--brand)] bg-[var(--brand)] text-[#0c1a2e] shadow-sm"
                                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--brand)]"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {quizScore ? (
                      <div className="p-5 rounded-xl bg-[var(--green-tint)] border border-[var(--green-tint)] text-center space-y-2">
                        <Award className="w-10 h-10 text-[var(--green)] mx-auto" />
                        <p className="text-base font-black text-[var(--green)]">{t("wellDoneTitle")}</p>
                        <p className="text-xs text-[var(--green)] font-semibold">{t("wellDoneSub")}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setQuizScore(100)}
                        className="w-full py-3.5 rounded-xl bg-[var(--green)] hover:opacity-90 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2"
                      >
                        {t("submitAnswers")} <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* FLASHCARDS */}
        {activeTab === "FLASHCARDS" && (
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
                    onClick={() => playSyntheticAudio(card.word, studentLang)}
                    disabled={isPlayingAudio}
                    className="mt-2 w-full py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] text-[var(--text-secondary)] hover:text-[var(--brand-deep)] font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> {t("pronounce")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="vs-surface border-0 border-t border-[var(--border)] py-3 text-center text-[11px] text-[var(--text-muted)] font-medium">
        {t("footerStudent")} {grade}
      </footer>
    </div>
  );
}
