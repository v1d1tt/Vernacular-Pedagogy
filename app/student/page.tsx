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
import { AudioRecorder } from "@/lib/audio-recorder";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import {
  Volume2,
  Hand,
  HelpCircle,
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  Mic,
  MicOff,
  Award,
  Globe,
  Square,
  Sparkles,
  Key,
  X,
  Loader2,
} from "lucide-react";
import { MicWaveform } from "@/components/mic-waveform";
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
  const { t } = useLanguage();
  const [studentName, setStudentName] = useState("Aarav");
  const [studentLang, setStudentLang] = useState("hi");
  const [studentLangName, setStudentLangName] = useState("Hindi");
  const [grade, setGrade] = useState(2);
  const [participantId] = useState("P-" + Math.floor(Math.random() * 1000));
  const [serverParticipantId, setServerParticipantId] = useState<string | null>(null);
  const [joinedSession, setJoinedSession] = useState<{ session_id: string } | null>(null);
  const [activeClassCode, setActiveClassCode] = useState<string>("");
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
  const [activeTab, setActiveTab] = useState<"LISTEN" | "QUIZ" | "WORKSHEET" | "FLASHCARDS" | "GAMES">("LISTEN");
  const [gameScore, setGameScore] = useState<number>(0);
  const [activeGameIndex, setActiveGameIndex] = useState<number>(0);

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
  const [isDirectQuestionMic, setIsDirectQuestionMic] = useState(false);
  const [, setDirectQuestionText] = useState("");
  const [isTranscribingQuestion, setIsTranscribingQuestion] = useState(false);

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
      } catch {}
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

    // 1. Prepare phonetic text (translates Ol Chiki Santali script into Hindi/Devanagari phonetics)
    const { speechText, speechLang } = prepareTtsText(rawText, targetLang);

    setIsPlayingAudio(true);

    // 2. Browser native SpeechSynthesis (robust voice matching and keep-alive)
    const trySpeechSynthesis = async (): Promise<boolean> => {
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

        // Await voices load
        const voices = await getVoicesAsync();
        const prefix = speechLang.split("-")[0].toLowerCase();

        const exactMatch = voices.find(
          (v) => (v.lang || "").toLowerCase().replace("_", "-") === speechLang.toLowerCase()
        );
        const prefixMatch = voices.find(
          (v) => (v.lang || "").toLowerCase().replace("_", "-").startsWith(prefix)
        );
        const indianVoice = voices.find((v) => (v.lang || "").toLowerCase().includes("in"));
        const chosenVoice = exactMatch || prefixMatch || indianVoice || voices[0];

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
      } catch {}
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
        } catch {}
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
            const myTrans = trans[curLang] || trans["hi"] || trans["en"] || origText;
            setTranslatedSpeech(myTrans);
            setTtfa((msg.ttfa_seconds as number) || 0.45);
            playSyntheticAudio(myTrans, curLang);
          } else if (msg.type === "SPEAKING_PERMISSION" || msg.type === "SPEAKING_PERMISSION_CHANGED") {
            // Server echoes the participant_id WE joined with (uuid), not the local P-xxx.
            if (msg.participant_id === myServerPid) {
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
            }
          } catch (e) {
            console.warn("Class code lookup failed:", e);
            setConnectError("Class code not found on the server. Check the teacher's CODE and retry.");
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
            }
          } catch (e) {
            console.warn("fetchActiveSessions failed:", e);
          }
        }

        if (targetSessionId) {
          // Re-join every time so the server knows this device + language.
          // IMPORTANT: persist the server's participant_id (uuid) — raise-hand
          // and permission events key off it, not the local P-xxx.
          const joinRes = await joinSession(targetSessionId, {
            student_id: participantId,
            student_name: studentName,
            preferred_language: studentLang,
          });
          const srvPid: string = joinRes.participant_id;
          setServerParticipantId(srvPid);
          try {
            localStorage.setItem("user_server_participant_id", srvPid);
          } catch {}
          setJoinedSession({ session_id: targetSessionId });
          localStorage.setItem("user_joined_session_id", targetSessionId);

          try {
            const res = await fetchPublishedActivities(targetSessionId);
            if (res && res.activities && res.activities.length > 0) {
              setActivities(res.activities as StudentActivity[]);
            }
          } catch (e) {
            console.warn("fetchPublishedActivities failed:", e);
          }

          attachSessionWebSocket(targetSessionId, srvPid);
          // Fallback: if we had a stale pid stored, still accept events for it
          if (savedPid && savedPid !== srvPid) {
            console.log("Rotated participant id", savedPid, "->", srvPid);
          }
        } else {
          setJoinedSession(null);
          if (!savedCode.trim()) {
            setConnectError("No live class found on the server. Enter the teacher's class CODE above.");
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
      try { wsRef.current?.close(); } catch {}
    };
  }, [connectToSession]);

  const handleJoinNewCode = async () => {
    if (!newCodeInput.trim()) return;
    setCodeError("");
    const code = newCodeInput.trim().toUpperCase();
    try {
      await runServerDetect();
      const sess = await getSessionByCode(code);
      if (sess && sess.id) {
        localStorage.setItem("user_class_code", code);
        localStorage.setItem("user_joined_session_id", sess.id);
        setActiveClassCode(code);
        setShowCodeModal(false);
        setNewCodeInput("");
        await connectToSession(code);
      }
    } catch {
      setCodeError(t("sessionNotFoundError") || "Invalid class code or class is not active. Check server connection too.");
    }
  };

  // Student Direct Mic Question
  const handleToggleDirectMic = async () => {
    if (!joinedSession || !recorder || String(joinedSession.session_id).startsWith("LOCAL-")) {
      setStudentMicStatus("Not connected to a live class — fix server connection first.");
      setTimeout(() => setStudentMicStatus(null), 3000);
      return;
    }
    if (isDirectQuestionMic) {
      setIsDirectQuestionMic(false);
      setIsTranscribingQuestion(true);
      try {
        const b64Pcm = await recorder.stop();
        if (b64Pcm) {
          const res = await transcribeAudio(b64Pcm, studentLang);
          const questionText = res?.text || "Ma'am, please explain again.";
          setDirectQuestionText(questionText);
          await broadcastSpeech({
            session_id: joinedSession.session_id,
            speaker_name: studentName,
            speaker_role: "STUDENT",
            original_text: questionText,
            source_lang: studentLang,
          });
          setStudentMicStatus(`Question sent: "${questionText}"`);
        }
      } catch (err) {
        console.error("Direct mic error:", err);
      } finally {
        setIsTranscribingQuestion(false);
        setTimeout(() => setStudentMicStatus(null), 4000);
      }
    } else {
      try {
        await recorder.start();
        setIsDirectQuestionMic(true);
        setStudentMicStatus("Listening... Speak your question, then tap stop");
      } catch (err) {
        console.error("Mic access error:", err);
        setStudentMicStatus("Could not access microphone");
      }
    }
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
      await connectToSession().catch(() => {});
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
        recognition.lang = studentLang === "hi" ? "hi-IN" : studentLang === "en" ? "en-IN" : "hi-IN";
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
      } catch {}
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

  const tabs = [
    { id: "LISTEN" as const, label: t("tabListen") || "Listen", icon: <Volume2 className="w-4 h-4" /> },
    { id: "QUIZ" as const, label: t("tabQuiz") || "Quiz", icon: <HelpCircle className="w-4 h-4" /> },
    { id: "WORKSHEET" as const, label: t("tabWorksheet") || "Worksheet", icon: <BookOpen className="w-4 h-4" /> },
    { id: "FLASHCARDS" as const, label: t("tabCards") || "Cards", icon: <Award className="w-4 h-4" /> },
    { id: "GAMES" as const, label: "Games 🎮", icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen vs-bg flex flex-col">
      {/* ── App Bar ────────────────────────────────────────────────── */}
      <header className="vs-surface border-0 border-b border-[var(--border)] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            title="Back to Home"
            className="p-2 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[var(--brand)] text-[#0c1a2e] font-black text-base flex items-center justify-center shadow-xs">
              {studentName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-extrabold text-[var(--text-primary)] leading-none">{studentName}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-medium">
                Class {grade} · <span className="text-[var(--brand-deep)] font-bold">{studentLangName}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Class Code Chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] shadow-2xs">
            <span className="text-[10px] text-[var(--text-muted)]">CLASS:</span>
            <span className="font-mono font-black text-[var(--brand-deep)] uppercase tracking-wider">
              {activeClassCode || "None"}
            </span>
            <button
              onClick={() => setShowCodeModal(true)}
              className="text-[10px] font-bold text-[var(--brand-deep)] underline ml-1 hover:opacity-80"
            >
              Change
            </button>
          </div>

          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </header>

      {/* ── Navigation Tabs ────────────────────────────────────────── */}
      <nav className="vs-surface border-0 border-b border-[var(--border)] px-3 py-2 flex items-center justify-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 whitespace-nowrap ${
              activeTab === tab.id
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
        {/* Connection status — never silently fall back */}
        <div
          className={`rounded-2xl px-4 py-3 border text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
            serverOnline
              ? "bg-[var(--green-tint)] border-[var(--green-tint)] text-[var(--green)]"
              : serverOnline === false
              ? "bg-[var(--red-tint)] border-[var(--red-tint)] text-[var(--red)]"
              : "bg-[var(--amber-tint)] border-[var(--amber-tint)] text-[var(--amber)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${serverOnline ? "bg-[var(--green)]" : serverOnline === false ? "bg-[var(--red)]" : "bg-[var(--amber)] animate-pulse"}`} />
            <span className="font-bold">
              {serverDetecting
                ? "Searching for teacher's edge server…"
                : serverOnline
                ? `Connected · ${serverUrl}${joinedSession ? (wsConnected ? " · Live updates ON" : " · Reconnecting live updates…") : " · No class joined yet"}`
                : `OFFLINE — no quiz/voice will arrive until connected · ${serverUrl || "no server"}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setServerInput(serverUrl || "http://192.168.1.191:8000");
                setShowServerModal(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] font-bold"
            >
              Set server
            </button>
            <button
              onClick={() => connectToSession()}
              disabled={serverDetecting}
              className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] font-bold disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        </div>
        {(serverError || connectError) && (
          <p className="text-[11px] text-[var(--red)] font-medium px-1">{serverError || connectError}</p>
        )}
        {/* LISTEN TAB */}
        {activeTab === "LISTEN" && (
          <div className="space-y-4">
            {/* Teacher's Broadcasted Speech Card */}
            <div className="vs-surface rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-sub)]">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-bold">
                  <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
                  <span>Teacher Broadcast</span>
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
                  {isPlayingAudio && <MicWaveform isSpeaking={true} />}
                </div>
                <p className="text-xl font-extrabold text-[var(--text-primary)] leading-relaxed">
                  &ldquo;{translatedSpeech}&rdquo;
                </p>
              </div>

              {/* Replay in Student's Language Button */}
              <button
                type="button"
                onClick={() => playSyntheticAudio(translatedSpeech, studentLang)}
                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                  isPlayingAudio
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

            {/* Speaking Options Card (Raise Hand + Direct Voice Question) */}
            <div className="vs-surface rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {t("wantToSpeak") || "Ask or Speak to Teacher"}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Speak using your microphone or raise your hand
                  </p>
                </div>
                {raisedHand && !canSpeak && (
                  <span className="text-xs font-bold text-[var(--amber)] bg-[var(--amber-tint)] px-3 py-1 rounded-full animate-pulse">
                    {t("waitingState") || "Waiting for Teacher…"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Raise Hand Button */}
                <button
                  onClick={handleToggleRaiseHand}
                  className={`py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 ${
                    isRecordingStudent
                      ? "bg-[var(--red)] text-white animate-pulse shadow-md"
                      : canSpeak
                      ? "bg-[var(--green)] text-white shadow-md animate-bounce"
                      : raisedHand
                      ? "bg-[var(--amber-tint)] text-[var(--amber)] border border-[var(--amber)]"
                      : "bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--brand)]"
                  }`}
                >
                  <Hand className="w-4 h-4" />
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

                {/* Direct Mic Question Button */}
                <button
                  onClick={handleToggleDirectMic}
                  disabled={isTranscribingQuestion}
                  className={`py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 ${
                    isDirectQuestionMic
                      ? "bg-[var(--red)] text-white animate-pulse shadow-md ring-4 ring-red-400/20"
                      : "vs-btn-brand shadow-xs"
                  }`}
                >
                  {isTranscribingQuestion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isDirectQuestionMic ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                  <span>
                    {isTranscribingQuestion
                      ? "Transcribing with Whisper…"
                      : isDirectQuestionMic
                      ? "Recording… Tap to Send"
                      : t("studentSpeakOption") || "Ask with Mic 🎙️"}
                  </span>
                </button>
              </div>

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
            {(() => {
              const quizList = activities.filter(
                (a) => a.activity_type === "QUIZ" || Boolean(a.content?.questions && a.content.questions.length > 0)
              );
              if (quizList.length === 0) {
                return (
                  <div className="vs-surface rounded-2xl p-10 text-center space-y-4 border border-[var(--border)]">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] flex items-center justify-center mx-auto">
                      <HelpCircle className="w-7 h-7 text-[var(--brand)]" />
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
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                                    isListening
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
                                    onClick={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                                    className={`p-3 rounded-xl font-bold text-xs text-left transition border-2 ${
                                      selectedAnswers[q.id] === opt
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
            {(() => {
              const worksheetList = activities.filter(
                (a) => a.activity_type === "WORKSHEET" || Boolean((a.content as Record<string, unknown>)?.tasks)
              );
              if (worksheetList.length === 0) {
                return (
                  <div className="vs-surface rounded-2xl p-10 text-center space-y-4 border border-[var(--border)]">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] flex items-center justify-center mx-auto">
                      <BookOpen className="w-7 h-7 text-[var(--brand)]" />
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
                        onClick={() => setSubmittedScores((prev) => ({ ...prev, [act.activity_id]: 100 }))}
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
                                <span>Listen</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVoicePractice(c.word)}
                                className="flex-1 py-2 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-deep)] border border-[var(--brand-tint2)] font-bold text-[11px] flex items-center justify-center gap-1 transition"
                              >
                                <Mic className="w-3 h-3" />
                                <span>Practice</span>
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
                          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{card.eng}</p>
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
                          <span>Pronounce</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVoicePractice(card.word)}
                          className="flex-1 py-2 rounded-xl bg-[var(--brand-tint)] text-[var(--brand-deep)] border border-[var(--brand-tint2)] font-bold text-xs flex items-center justify-center gap-1 transition"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>Practice</span>
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

        {/* FLN GAMES */}
        {activeTab === "GAMES" && (
          <div className="space-y-4">
            <div className="vs-surface rounded-2xl p-5 border border-[var(--brand-tint2)] bg-[var(--brand-tint)]/40 flex items-center justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[var(--brand-deep)]" />
                  <h3 className="text-sm font-extrabold text-[var(--brand-deep)]">NIPUN FLN Audio Games</h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Interactive audio games for Class {grade} · Language: <span className="font-bold">{studentLangName}</span>
                </p>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--brand-tint2)] text-xs font-black text-[var(--brand-deep)] shadow-2xs">
                ⭐ {gameScore} Stars
              </div>
            </div>

            <div className="vs-surface rounded-2xl p-6 text-center space-y-5 border border-[var(--border)] shadow-xs">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">
                <span>Game {activeGameIndex + 1} of 3</span>
                <span>NIPUN Foundational</span>
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
                    <Volume2 className="w-4 h-4" /> Listen Audio
                  </button>
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    {["2", "3", "4", "5"].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          if (num === "4") {
                            setGameScore((s) => s + 10);
                            playSyntheticAudio(studentLang === "sat" ? "ᱥᱟᱹᱨᱤ ᱜᱮ! ᱯᱩᱱᱭᱟᱹ" : "सही जवाब! चार", studentLang);
                          }
                        }}
                        className="py-4 rounded-xl bg-[var(--surface-2)] border-2 border-[var(--border)] hover:border-[var(--brand)] text-xl font-bold text-[var(--text-primary)] transition active:scale-95"
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
                    {studentLang === "sat" ? "ᱟᱠᱷᱚᱨ: 'ᱚ' ᱪᱤᱦᱱᱟᱹᱣ ᱢᱮ" : "वर्णमाला: अक्षर 'अ' पहचानें"}
                  </h4>
                  <div className="text-6xl py-6 bg-[var(--violet-tint)] text-[var(--violet)] rounded-2xl font-black border border-[var(--violet-tint)]">
                    {studentLang === "sat" ? "ᱚ" : "अ"}
                  </div>
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

            <input
              type="text"
              value={newCodeInput}
              onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. MATH42"
              maxLength={8}
              className="vs-input w-full px-4 py-3 rounded-xl font-mono text-center text-lg font-bold tracking-widest uppercase"
            />

            {codeError && <p className="text-xs font-bold text-[var(--red)] text-center">{codeError}</p>}

            <button
              onClick={handleJoinNewCode}
              disabled={!newCodeInput.trim()}
              className="w-full vs-btn-brand py-3 rounded-xl text-sm font-extrabold shadow-sm disabled:opacity-50"
            >
              Join Classroom
            </button>
          </div>
        </div>
      )}

      {/* ── Edge Server Setting Modal ──────────────────────────────── */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="vs-surface w-full max-w-md rounded-3xl p-6 border border-[var(--border)] shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-[var(--text-primary)]">Teacher&apos;s server URL</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Ask the teacher for the server address shown on their screen (same Wi-Fi required) and enter it here,
              e.g. <span className="font-mono">http://192.168.1.5:8000</span>. Then enter the class CODE.
            </p>
            <input
              type="text"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="http://192.168.1.5:8000"
              className="vs-input w-full px-4 py-3 rounded-xl font-mono text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowServerModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text-secondary)]"
              >
                Cancel
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
                Save & Connect
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
