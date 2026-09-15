"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createSession,
  broadcastSpeech,
  generateAiContent,
  approveAiContent,
  approveSpeaking,
  connectWebSocket,
  getEdgeServerUrl,
  detectActiveEdgeServer,
  setEdgeServerUrl,
  fetchTeacherSessions,
  endSession,
  reactivateSession,
  streamAudioChunk,
  updateTeacherMicState,
  fetchRaisedHands,
  SessionData,
  WSHandle,
} from "@/lib/api-client";
import { ContinuousAudioStreamer } from "@/lib/audio-streamer";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { getLocalizedSubjectKey } from "@/lib/nipun-data";
import { useLanguage } from "@/components/language-provider";
import {
  Mic,
  MicOff,
  Check,
  X,
  ArrowLeft,
  Send,
  Radio,
  ChevronRight,
  Users,
  Loader2,
  Copy,
  CheckCheck,
  Power,
  Layers,
  Clock,
  Plus,
  RefreshCw,
  School,
  QrCode,
  Smartphone,
} from "lucide-react";
// QRCode is imported dynamically in generateQRCode to avoid SSR issues
import { MicWaveform } from "@/components/mic-waveform";
import { Mascot } from "@/components/mascot";

export interface SessionInfo {
  session_id: string;
  teacher_name: string;
  course_name: string;
  grade: number;
  teaching_language: string;
  mode: string;
  join_code?: string;
  is_active?: number;
}

export interface SpeechTranscript {
  id?: string;
  speaker_name: string;
  speaker_role: string;
  original_text: string;
  source_lang?: string;
  ttfa_seconds: number;
  timestamp?: number;
  translations?: Record<string, string>;
}

export interface RaiseHandItem {
  participant_id: string;
  student_name: string;
  raised_hand: boolean;
}

export interface ActivityItem {
  activity_id: string;
  activity_type: string;
  title: string;
  domain: string;
  skill: string;
  grade: number;
  content: Record<string, unknown>;
  status: string;
}

export default function TeacherConsole() {
  const router = useRouter();
  const { t, lang: appLang, currentLanguage } = useLanguage();
  const [teacherName, setTeacherName] = useState("Mrs. Anita Sharma");
  const [teachingLang, setTeachingLang] = useState("en");
  const [grade, setGrade] = useState(2);
  const [courseName, setCourseName] = useState("Mathematics");
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [speechText, setSpeechText] = useState("");
  const [transcripts, setTranscripts] = useState<SpeechTranscript[]>([]);
  const [mode, setMode] = useState<"LECTURE" | "Q_AND_A" | "DISCUSSION">("LECTURE");
  const [raiseHandQueue, setRaiseHandQueue] = useState<RaiseHandItem[]>([]);
  const [pendingActivities, setPendingActivities] = useState<ActivityItem[]>([]);
  const [publishedActivities, setPublishedActivities] = useState<ActivityItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showClassroomsModal, setShowClassroomsModal] = useState(false);
  const [teacherClassrooms, setTeacherClassrooms] = useState<SessionData[]>([]);
  const [isLoadingClassrooms, setIsLoadingClassrooms] = useState(false);

  const [isMicLive, setIsMicLive] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const streamerRef = useRef<ContinuousAudioStreamer | null>(null);
  const wsRef = useRef<WSHandle | null>(null);
  const activeSessionRef = useRef<SessionInfo | null>(null);
  const [serverUrl, setServerUrlState] = useState<string>("");
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverDetecting, setServerDetecting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverInput, setServerInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  // Keep teaching language in sync with global language switcher
  useEffect(() => {
    if (appLang && appLang !== teachingLang) {
      setTeachingLang(appLang as string);
      try {
        localStorage.setItem("user_lang", appLang);
        if (currentLanguage) localStorage.setItem("user_lang_name", currentLanguage.name);
      } catch {}
    }
  }, [appLang, currentLanguage, teachingLang]);

  useEffect(() => {
    const onLangEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      if (detail && detail !== teachingLang) {
        setTeachingLang(detail);
      }
    };
    window.addEventListener("vs-lang-change", onLangEvt as EventListener);
    return () => window.removeEventListener("vs-lang-change", onLangEvt as EventListener);
  }, [teachingLang]);

  // Setup WebSocket connection for a given session (auto-reconnecting)
  const initSessionWebSocket = useCallback((sessionId: string) => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setWsConnected(false);
    const handle = connectWebSocket(
      sessionId,
      (msg) => {
        if (msg.type === "RAISE_HAND_UPDATED") {
          const item = msg as unknown as RaiseHandItem;
          if (item.raised_hand === false) {
            setRaiseHandQueue((prev) => prev.filter((p) => p.participant_id !== item.participant_id));
            return;
          }
          setRaiseHandQueue((prev) =>
            prev.find((p) => p.participant_id === item.participant_id) ? prev : [...prev, item]
          );
        } else if (msg.type === "SPEECH_TRANSLATED") {
          const newT = msg as unknown as SpeechTranscript;
          setTranscripts((prev) => {
            const isDup = prev.some(
              (item) =>
                (item.id && newT.id && item.id === newT.id) ||
                (item.original_text === newT.original_text &&
                  Math.abs((item.timestamp || 0) - (newT.timestamp || 0)) < 3)
            );
            if (isDup) return prev;
            return [newT, ...prev];
          });
        } else if (msg.type === "ACTIVITY_PUBLISHED_TO_CLASS") {
          // Activity confirmed
        } else if (msg.type === "SESSION_ENDED") {
          // keep UI but mark offline
        }
      },
      {
        onOpen: () => setWsConnected(true),
        onClose: () => setWsConnected(false),
        shouldStayOpen: () => !!activeSessionRef.current && activeSessionRef.current.session_id === sessionId,
      }
    );
    wsRef.current = handle;
  }, []);

  const runServerDetect = useCallback(
    async (force = false) => {
      setServerDetecting(true);
      setServerError(null);
      try {
        const url = await detectActiveEdgeServer(force ? { force: true } : undefined);
        setServerUrlState(url);
        setServerOnline(true);
        setServerInput(url);
        // Re-attach WS if we have an active session but socket dropped
        const s = activeSessionRef.current;
        if (s?.session_id) initSessionWebSocket(s.session_id);
        return url;
      } catch {
        setServerOnline(false);
        setServerError(
          "Edge server not found on this network. Start the server (python server/main.py) on the teacher laptop/hotspot host, join the same Wi-Fi, then tap Retry — or enter its http://<IP>:8000 manually."
        );
        try {
          setServerUrlState(getEdgeServerUrl());
        } catch {}
        return null;
      } finally {
        setServerDetecting(false);
      }
    },
    [initSessionWebSocket]
  );

  // Initial load: detect edge server, restore profile and any active session
  useEffect(() => {
    const s = localStorage.getItem("user_name");
    const l = localStorage.getItem("user_lang");
    const g = localStorage.getItem("user_grade");
    const subj = localStorage.getItem("user_subject");
    if (s) setTeacherName(s);
    if (l) setTeachingLang(l);
    if (g) setGrade(Number(g));
    if (subj) setCourseName(subj);

    void (async () => {
      const url = await runServerDetect();
      if (!url) return;
      try {
        const savedSession = localStorage.getItem("teacher_active_session");
        if (savedSession) {
          const parsed = JSON.parse(savedSession) as SessionInfo;
          if (parsed && parsed.session_id && !String(parsed.session_id).startsWith("LOCAL-")) {
            setActiveSession(parsed);
            initSessionWebSocket(parsed.session_id);
            void (async () => {
              try {
                const rh = await fetchRaisedHands(parsed.session_id);
                if (rh?.raised_hands && Array.isArray(rh.raised_hands)) {
                  setRaiseHandQueue(
                    rh.raised_hands.map(
                      (item: { id?: string; participant_id?: string; student_name?: string; preferred_language?: string }) => ({
                        participant_id: item.id || item.participant_id || "",
                        student_name: item.student_name || "Student",
                        preferred_language: item.preferred_language || "hi",
                      })
                    )
                  );
                }
              } catch {}
            })();
          } else {
            localStorage.removeItem("teacher_active_session");
          }
        }
      } catch {}
    })();
  }, [initSessionWebSocket, runServerDetect]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, []);

  const handleStartSession = async () => {
    setActionError(null);
    try {
      await runServerDetect();
      const sd = await createSession({
        teacher_id: "T-" + Math.floor(Math.random() * 1000),
        teacher_name: teacherName,
        course_name: courseName,
        grade,
        teaching_language: teachingLang,
      });
      if (!sd || !sd.session_id || String(sd.session_id).startsWith("LOCAL-")) {
        throw new Error("Server returned an offline session. Check edge-server connection.");
      }
      const sessionInfo: SessionInfo = {
        session_id: sd.session_id,
        teacher_name: sd.teacher_name,
        course_name: sd.course_name || courseName,
        grade: sd.grade,
        teaching_language: sd.teaching_language,
        mode: sd.mode || "LECTURE",
        join_code: sd.join_code,
        is_active: 1,
      };
      setActiveSession(sessionInfo);
      setCourseName(sessionInfo.course_name);
      try {
        localStorage.setItem("user_subject", sessionInfo.course_name);
        localStorage.setItem("teacher_active_session", JSON.stringify(sessionInfo));
      } catch {}
      initSessionWebSocket(sessionInfo.session_id);
    } catch (e) {
      console.error("Start session failed:", e);
      setActionError(
        e instanceof Error && e.message === "EDGE_SERVER_NOT_FOUND"
          ? "Cannot reach the edge server. Both devices must be on the same Wi-Fi/hotspot and the server must be running. Set the server URL below and retry."
          : `Could not start class: ${e instanceof Error ? e.message : "unknown error"}`
      );
      await runServerDetect(true).catch(() => {});
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    if (confirm("Are you sure you want to end this live classroom session?")) {
      try {
        await endSession(activeSession.session_id);
      } catch (e) {
        console.warn("End session request failed:", e);
      }
      wsRef.current?.close();
      setWsConnected(false);
      setActiveSession(null);
      localStorage.removeItem("teacher_active_session");
      setTranscripts([]);
      setRaiseHandQueue([]);
      setPendingActivities([]);
      setPublishedActivities([]);
    }
  };

  const handleCopyCode = (codeToCopy?: string) => {
    const code = codeToCopy || activeSession?.join_code;
    if (!code) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2200);
    }
  };

  const generateQRCode = useCallback(async () => {
    if (!activeSession?.join_code || !serverUrl) return;
    // Build join URL pointing at THIS frontend (hotspot IP) + edge server + class code.
    // Student scans with camera app -> opens student page -> auto-fills server URL + code.
    const frontendOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const joinUrl = `${frontendOrigin}/student?server=${encodeURIComponent(serverUrl)}&code=${activeSession.join_code}`;
    try {
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(joinUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#0c1a2e", light: "#ffffff" },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (e) {
      console.error("QR generation failed:", e);
    }
  }, [activeSession?.join_code, serverUrl]);

  // Generate QR when session becomes active
  useEffect(() => {
    if (activeSession?.join_code && serverUrl) {
      generateQRCode();
    } else {
      setQrCodeDataUrl("");
    }
  }, [generateQRCode]);

  const handleOpenClassroomsModal = async () => {
    setShowClassroomsModal(true);
    setIsLoadingClassrooms(true);
    setActionError(null);
    try {
      await runServerDetect();
      const res = await fetchTeacherSessions(teacherName);
      setTeacherClassrooms(res.sessions || []);
    } catch (e) {
      console.error("Fetch classrooms failed:", e);
      setTeacherClassrooms([]);
      setActionError("Could not load classrooms — edge server unreachable.");
    } finally {
      setIsLoadingClassrooms(false);
    }
  };

  const handleSwitchClassroom = async (session: SessionData) => {
    if (session.is_active === 0) {
      try {
        await reactivateSession(session.id);
      } catch {}
    }
    const sessionInfo: SessionInfo = {
      session_id: session.id,
      teacher_name: session.teacher_name,
      course_name: session.course_name,
      grade: session.grade,
      teaching_language: session.teaching_language,
      mode: session.mode || "LECTURE",
      join_code: session.join_code,
      is_active: 1,
    };
    setActiveSession(sessionInfo);
    setCourseName(session.course_name);
    setGrade(session.grade);
    setTeachingLang(session.teaching_language);
    try {
      localStorage.setItem("teacher_active_session", JSON.stringify(sessionInfo));
    } catch {}
    initSessionWebSocket(session.id);
    setShowClassroomsModal(false);
  };

  const handleBroadcastSpeech = async (textToSend?: string) => {
    const text = textToSend || speechText;
    if (!text.trim() || !activeSession) return;
    setActionError(null);

    // Check voice command shortcuts
    const lower = text.toLowerCase();
    if (lower.includes("generate quiz") || lower.includes("क्विज़ बनाओ") || lower.includes("क्विज़")) {
      handleTriggerAiContent("QUIZ");
    } else if (lower.includes("flashcards") || lower.includes("फ्लैशकार्ड")) {
      handleTriggerAiContent("FLASHCARD");
    } else if (lower.includes("worksheet") || lower.includes("वर्कशीट")) {
      handleTriggerAiContent("WORKSHEET");
    } else if (lower.includes("generate game") || lower.includes("game") || lower.includes("खेल")) {
      handleTriggerAiContent("GAME");
    }

    try {
      const res = await broadcastSpeech({
        session_id: activeSession.session_id,
        speaker_name: teacherName,
        speaker_role: "TEACHER",
        original_text: text,
        source_lang: teachingLang,
      });
      const newT = res as unknown as SpeechTranscript;
      setTranscripts((prev) => {
        const isDup = prev.some(
          (item) =>
            (item.id && newT.id && item.id === newT.id) ||
            (item.original_text === newT.original_text &&
              Math.abs((item.timestamp || 0) - (newT.timestamp || 0)) < 3)
        );
        if (isDup) return prev;
        return [newT, ...prev];
      });
      setSpeechText("");
    } catch (e) {
      console.error("Broadcast failed:", e);
      setActionError("Broadcast failed — students did NOT receive this. Check server connection and retry.");
      await runServerDetect().catch(() => {});
    }
  };

  const handleToggleMic = async () => {
    if (!activeSession) return;

    if (isMicLive) {
      // 1. Turn OFF microphone immediately
      setIsMicLive(false);
      setIsFlushing(true);
      setMicStatus(t("finishingTranslation") || "Finishing translation for students...");

      // Update backend teacher mic state immediately
      try {
        await updateTeacherMicState({
          session_id: activeSession.session_id,
          is_live: false,
          speaker_name: teacherName,
        });
      } catch (err) {
        console.warn("Failed to update mic state:", err);
      }

      // 2. Flush remaining audio buffer completely (ensures 100% spoken text is sent & translated)
      if (streamerRef.current) {
        try {
          await streamerRef.current.flushAndStop();
        } catch (err) {
          console.error("Flush audio streamer error:", err);
        }
        streamerRef.current = null;
      }

      setIsFlushing(false);
      setMicStatus(null);
    } else {
      // Turn ON mic continuously
      try {
        setActionError(null);
        setIsMicLive(true);
        setIsFlushing(false);
        setMicStatus(t("micLive") || "● LIVE MIC");

        // Notify backend teacher mic is live
        try {
          await updateTeacherMicState({
            session_id: activeSession.session_id,
            is_live: true,
            speaker_name: teacherName,
          });
        } catch (err) {
          console.warn("Failed to broadcast mic live state:", err);
        }

        const streamer = new ContinuousAudioStreamer();
        streamerRef.current = streamer;

        await streamer.start(async (base64Pcm, seqNum, isFinal) => {
          if (!activeSessionRef.current) return;
          try {
            const res = await streamAudioChunk({
              session_id: activeSessionRef.current.session_id,
              speaker_name: teacherName,
              speaker_role: "TEACHER",
              source_lang: teachingLang,
              audio_base64: base64Pcm,
              seq_num: seqNum,
              is_final: isFinal,
            });
            if (res && res.original_text) {
              setTranscripts((prev) => {
                if (prev.some((item) => item.original_text === res.original_text)) {
                  return prev;
                }
                return [res as unknown as SpeechTranscript, ...prev];
              });
            }
          } catch (err) {
            console.error("Stream audio chunk error:", err);
          }
        });
      } catch (err) {
        console.error("Failed to start mic streamer:", err);
        setIsMicLive(false);
        setIsFlushing(false);
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : "Could not access microphone";
        setMicStatus(`Microphone error: ${detail}`);
      }
    }
  };

  const handleApproveSpeaking = async (participantId: string, allow: boolean) => {
    setRaiseHandQueue((prev) => prev.filter((p) => p.participant_id !== participantId));
    if (!activeSession) return;
    try {
      await approveSpeaking(activeSession.session_id, participantId, allow);
    } catch (e) {
      console.error("Approve-speaking failed:", e);
      setActionError("Could not notify student (server unreachable).");
    }
  };

  // Passes ALL broadcasted transcripts from the entire lesson
  const handleTriggerAiContent = async (type: "QUIZ" | "FLASHCARD" | "WORKSHEET" | "GAME") => {
    if (!activeSession) return;
    setIsGenerating(true);
    setActionError(null);
    const langFallback: Record<string, string> = {
      hi: `${courseName} - प्राथमिक पाठ एवं अभ्यास`,
      sat: `${courseName} - ᱥᱟᱛᱟᱢ ᱟᱨ ᱯᱟᱴ`,
      en: `${courseName} Lesson & Practice`,
    };
    // Include full transcript text from all messages
    const fullSummary = transcripts.map((t) => t.original_text).filter(Boolean).join(". ") || langFallback[teachingLang] || `${courseName} Lesson`;

    try {
      const res = await generateAiContent({
        session_id: activeSession.session_id,
        transcript_summary: fullSummary,
        grade,
        activity_type: type,
        language: teachingLang,
        course_name: activeSession.course_name || courseName,
      });
      setPendingActivities((prev) => [res as ActivityItem, ...prev]);
    } catch (e) {
      console.error("AI generate failed:", e);
      setActionError("AI content failed — server unreachable. Students will NOT receive a quiz.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveActivity = async (activityId: string, approve: boolean) => {
    try {
      await approveAiContent(activityId, approve ? "APPROVED" : "REJECTED");
    } catch (e) {
      console.error("Approve activity failed:", e);
      setActionError("Could not publish quiz to students — server unreachable.");
      return;
    }
    const act = pendingActivities.find((a) => a.activity_id === activityId);
    setPendingActivities((prev) => prev.filter((a) => a.activity_id !== activityId));
    if (approve && act) setPublishedActivities((prev) => [act, ...prev]);
  };

  const modeStyles: Record<string, string> = {
    LECTURE: "bg-[var(--brand)] text-[#0c1a2e] shadow-xs font-bold",
    Q_AND_A: "bg-[var(--violet-tint)] text-[var(--violet)] font-bold",
    DISCUSSION: "bg-[var(--green-tint)] text-[var(--green)] font-bold",
  };

  const quickSamples = [
    t("quickSample1") || "Today we will learn addition in mathematics.",
    t("quickSample2") || "How many apples are there?",
    t("quickSample3") || "What is three plus two?",
  ];

  return (
    <div className="min-h-screen vs-bg flex flex-col">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="vs-surface border-0 border-b border-[var(--border)] px-3 sm:px-6 py-2.5 space-y-2 sticky top-0 z-30 shadow-xs">
        {/* Top Row: Branding on left, Theme & Language & Classrooms on right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              title="Back to Home"
              className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[#0c1a2e] text-xs font-black bg-[var(--brand)] shadow-xs shrink-0">
              व
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-extrabold text-[var(--text-primary)] leading-none">वाणीSetu</p>
              <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-[var(--brand-tint)] text-[var(--brand-deep)]">
                Teacher
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* My Classrooms Button */}
            <button
              onClick={handleOpenClassroomsModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-1)] text-[var(--text-primary)] text-xs font-bold transition shadow-2xs"
              title="View all classrooms created"
            >
              <Layers className="w-3.5 h-3.5 text-[var(--brand-deep)]" />
              <span className="hidden xs:inline text-[11px]">{t("myClassrooms") || "Classrooms"}</span>
            </button>
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </div>

        {/* Second Row: Teacher Info & Subject on left, Start Class / Active Session on right */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--border-sub)]">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] font-bold text-[var(--text-muted)] truncate shrink-0">
              {teacherName} · {t("class")} {grade}
            </span>
            <span className="text-[var(--text-muted)] text-[10px]">·</span>
            {!activeSession ? (
              <select
                value={courseName}
                onChange={(e) => {
                  const val = e.target.value;
                  setCourseName(val);
                  try {
                    localStorage.setItem("user_subject", val);
                  } catch {}
                }}
                className="vs-input px-2 py-1 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] cursor-pointer outline-none max-w-[140px] sm:max-w-[210px] truncate"
              >
                <option value="Mathematics">{t("subjectMath")}</option>
                <option value="Literacy & Language">{t("subjectLiteracy")}</option>
                <option value="EVS & Science">{t("subjectScience")}</option>
                <option value="General Knowledge">{t("subjectGK")}</option>
              </select>
            ) : (
              <span className="font-bold text-xs text-[var(--brand-deep)] truncate">
                {t(getLocalizedSubjectKey(activeSession.course_name || courseName), activeSession.course_name || courseName)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Class Mode Switcher (on md+ screens) */}
            <div className="hidden md:flex items-center bg-[var(--surface-2)] rounded-xl p-0.5 gap-1 border border-[var(--border)]">
              {[
                { code: "LECTURE" as const, label: t("modeLecture") },
                { code: "Q_AND_A" as const, label: t("modeQA") },
                { code: "DISCUSSION" as const, label: t("modeDiscussion") }
              ].map(({ code: m, label }) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition ${
                    mode === m ? modeStyles[m] : "text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeSession ? (
              <div className="flex items-center gap-1.5">
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--green-tint)] text-[var(--green)] text-xs font-bold border border-[var(--green-tint)]">
                  <Radio className="w-3 h-3 animate-pulse" /> {t("live") || "LIVE"}
                </div>

                {activeSession.join_code && (
                  <button
                    onClick={() => handleCopyCode()}
                    title="Click to copy Class Code"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--brand)] text-[#0c1a2e] text-xs font-black tracking-wide shadow-xs hover:brightness-105 active:scale-95 transition"
                  >
                    <span className="text-[10px] font-bold opacity-80">CODE:</span>
                    <span className="font-mono text-xs tracking-wider uppercase">{activeSession.join_code}</span>
                    {codeCopied ? (
                      <CheckCheck className="w-3.5 h-3.5 text-green-900" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 opacity-80" />
                    )}
                  </button>
                )}

                <button
                  onClick={handleEndSession}
                  title="End Classroom Session"
                  className="p-1.5 rounded-lg text-[var(--red)] hover:bg-[var(--red-tint)] border border-transparent hover:border-[var(--red-tint)] transition"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartSession}
                className="vs-btn-brand px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("startClassBtn") || "Start Class"}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Broadcast + Live Feed (8 cols) */}
        <div className="lg:col-span-8 space-y-4 flex flex-col">
          {/* Connection status — always visible so fallback is never silent */}
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
                  ? (t("searchingEdge") || "Searching for edge server on this network…")
                  : serverOnline
                  ? `${t("edgeConnected") || "Connected to edge server"} · ${serverUrl}${activeSession ? (wsConnected ? " · WS live" : " · WS reconnecting…") : ""}`
                  : `${t("edgeOffline") || "OFFLINE — using no fallback."} · ${serverUrl || "no server"}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setServerInput(serverUrl || "http://192.168.1.191:8000");
                  setShowServerModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] font-bold hover:opacity-90"
              >
                {t("setServerBtn") || "Set server"}
              </button>
              <button
                onClick={() => runServerDetect(true)}
                disabled={serverDetecting}
                className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${serverDetecting ? "animate-spin" : ""}`} />
                {t("retryBtn") || "Retry"}
              </button>
            </div>
          </div>
          {serverError && !serverOnline && (
            <p className="text-[11px] text-[var(--red)] font-medium px-1">{serverError}</p>
          )}
          {actionError && (
            <div className="rounded-2xl px-4 py-3 bg-[var(--red-tint)] border border-[var(--red-tint)] text-[var(--red)] text-xs font-bold">
              {actionError}
            </div>
          )}
          {/* Prominent Class Banner when active */}
          {activeSession && (
            <div className="vs-surface rounded-2xl p-4 border border-[var(--brand-tint2)] bg-gradient-to-r from-[var(--surface)] to-[var(--brand-tint)]/20 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-4">
                <div className="shrink-0 bg-white/60 rounded-full shadow-sm p-1">
                  <Mascot src="/animations/owlsanimation.lottie" width={60} height={60} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">
                      {t("classCodeTitle") || "Class Join Code"}
                    </p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--green-tint)] text-[var(--green)] font-black">
                      {t("activeClassBadge") || "Active Class"}
                    </span>
                  </div>
                  <p className="text-2xl font-black font-mono tracking-widest text-[var(--text-primary)]">
                    {activeSession.join_code}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyCode()}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition shadow-2xs"
                >
                  {codeCopied ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-[var(--green)]" />
                      <span className="text-[var(--green)]">{t("codeCopied") || "Copied!"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[var(--brand-deep)]" />
                      <span>{t("copyCode") || "Copy Code"}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => { generateQRCode(); setShowQRModal(true); }}
                  className="px-4 py-2 rounded-xl bg-[var(--violet-tint)] hover:bg-[var(--violet)] hover:text-white text-[var(--violet)] border border-[var(--violet-tint)] text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                  title="Show QR code for students to scan & join"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{t("qrCode") || "QR"}</span>
                </button>
                <button
                  onClick={handleEndSession}
                  className="px-3 py-2 rounded-xl bg-[var(--red-tint)] hover:bg-red-200/50 border border-[var(--red-tint)] text-[var(--red)] text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{t("endClassBtn") || "End Class"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Broadcast Studio - Mic First Design */}
          <div className="vs-surface rounded-2xl overflow-hidden border border-[var(--border)] shadow-xs">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-[var(--brand)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  {t("broadcastToClass") || "Broadcast to Class"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {isMicLive && <MicWaveform isSpeaking={true} className="ml-auto" />}
                {isMicLive && (
                  <span className="text-[10px] font-bold text-[var(--red)] bg-[var(--red-tint)] px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-ping" />
                    {t("micLive") || "● LIVE"}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Main Mic Toggle - Large, Prominent */}
              <button
                onClick={handleToggleMic}
                disabled={!activeSession || isFlushing}
                className={`w-full py-5 sm:py-6 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm transition active:scale-[0.98] shadow-lg ${
                  isMicLive
                    ? "bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-xl ring-4 ring-red-500/20"
                    : isFlushing
                    ? "bg-[var(--amber-tint)] text-[var(--amber)] border-2 border-[var(--amber-tint)]"
                    : "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-deep)] text-[#0c1a2e] hover:from-[var(--brand-deep)] hover:to-[var(--brand)]"
                }`}
              >
                {isFlushing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-base">{t("finishingTranslation") || "Finishing translation..."}</span>
                  </>
                ) : isMicLive ? (
                  <>
                    <Mic className="w-6 h-6" />
                    <span className="text-base">{t("micOn") || "Mic ON — Listening"}</span>
                    <span className="w-2 h-2 rounded-full bg-white/30 animate-ping" />
                  </>
                ) : (
                  <>
                    <MicOff className="w-6 h-6" />
                    <span className="text-base">{t("micOff") || "Tap to Start Live Translation"}</span>
                  </>
                )}
              </button>

              {micStatus && (
                <div
                  className={`text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 font-medium ${
                    isMicLive
                      ? "bg-[var(--red-tint)] text-[var(--red)] animate-pulse font-bold"
                      : isFlushing
                      ? "bg-[var(--amber-tint)] text-[var(--amber)]"
                      : "bg-[var(--green-tint)] text-[var(--green)]"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {micStatus}
                </div>
              )}

              {/* Text Input - Only when mic is OFF */}
              {!isMicLive && !isFlushing && activeSession && (
                <div className="flex gap-2 pt-2 border-t border-[var(--border-sub)]">
                  <input
                    type="text"
                    value={speechText}
                    onChange={(e) => setSpeechText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBroadcastSpeech()}
                    placeholder={t("broadcastPlaceholder") || "Type lesson text to translate & broadcast…"}
                    className="vs-input flex-1 px-4 py-3 rounded-xl text-sm font-medium"
                  />
                  <button
                    onClick={() => handleBroadcastSpeech()}
                    disabled={!speechText.trim()}
                    className="vs-btn-brand w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 disabled:opacity-40"
                    title="Broadcast text"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Quick Samples - Only when mic is OFF */}
              {!isMicLive && !isFlushing && activeSession && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-[var(--text-muted)] font-bold">{t("quickLabel") || "Quick:"}</span>
                  {quickSamples.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleBroadcastSpeech(s)}
                      disabled={!activeSession}
                      className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand-deep)] border border-[var(--border)] text-[var(--text-secondary)] text-[11px] font-medium disabled:opacity-40 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Translation Feed */}
          <div className="flex-1 vs-surface rounded-2xl flex flex-col overflow-hidden min-h-[360px] border border-[var(--border)] shadow-xs">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mascot src="/animations/owl-birdanimation.lottie" width={24} height={24} />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {t("liveTranslationFeed") || "Live Translation Stream"}
                </h3>
              </div>
              <span className="text-[10px] text-[var(--green)] font-bold bg-[var(--green-tint)] px-2.5 py-1 rounded-full border border-[var(--green-tint)]">
                {transcripts.length} {t("broadcastsCount") || "broadcasts"}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-3">
                  <div className="flex justify-center mx-auto mb-2">
                    <Mascot src="/animations/sound-recognization.lottie" width={160} height={160} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-secondary)]">
                      {t("noBroadcastsYet") || "No broadcasts yet"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {t("noBroadcastsSub") || "Start a classroom and type or speak a lesson line above"}
                    </p>
                  </div>
                </div>
              ) : (
                transcripts.map((tItem, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden shadow-2xs"
                  >
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-[var(--border-sub)] bg-[var(--surface)]">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center ${
                            tItem.speaker_role === "TEACHER"
                              ? "bg-[var(--brand)] text-[#0c1a2e]"
                              : "bg-[var(--violet)] text-white"
                          }`}
                        >
                          {tItem.speaker_name.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-[var(--text-primary)]">{tItem.speaker_name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full font-medium">
                          {tItem.speaker_role}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{tItem.ttfa_seconds}s</span>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm font-bold text-[var(--text-primary)] leading-relaxed">
                        &ldquo;{tItem.original_text}&rdquo;
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Student Hands & AI Activities (4 cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          {/* Raised Hands Queue */}
          <div className="vs-surface rounded-2xl overflow-hidden border border-[var(--border)] shadow-xs">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mascot src="/animations/blue-owl-blinking-eyesanimation.lottie" width={24} height={24} />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {t("raiseHandTitle") || "Student Hands"}
                </h3>
              </div>
              {raiseHandQueue.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[var(--red)] text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                  {raiseHandQueue.length}
                </span>
              )}
            </div>
            <div className="p-4">
              {raiseHandQueue.length === 0 ? (
                <div className="flex items-center gap-3 py-2 text-[var(--text-muted)]">
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface-2)] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <p className="text-xs">{t("noStudentsWaiting") || "No students waiting to speak"}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {raiseHandQueue.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--red-tint)] border border-[var(--red-tint)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--red)] text-white text-xs font-black flex items-center justify-center">
                          {item.student_name.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{item.student_name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApproveSpeaking(item.participant_id, true)}
                          title="Allow student to speak"
                          className="w-8 h-8 rounded-xl bg-[var(--green)] text-white flex items-center justify-center transition hover:opacity-90"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleApproveSpeaking(item.participant_id, false)}
                          title="Dismiss"
                          className="w-8 h-8 rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] flex items-center justify-center transition hover:opacity-90"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Activity Generator */}
          <div className="flex-1 vs-surface rounded-2xl overflow-hidden flex flex-col border border-[var(--border)] shadow-xs">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mascot src="/animations/owl-birdanimation.lottie" width={24} height={24} />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {t("generateActivityTitle") || "Lesson AI Content"}
                </h3>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">NIPUN FLN</span>
            </div>

            <div className="p-4 space-y-4 flex-1 flex flex-col">
              <div className="grid grid-cols-4 gap-2">
                {[
                  {
                    type: "QUIZ" as const,
                    label: t("btnQuiz") || "Quiz",
                    style: "bg-[var(--brand-tint)] text-[var(--brand-deep)] border-[var(--brand-tint2)]",
                  },
                  {
                    type: "FLASHCARD" as const,
                    label: t("btnCards") || "Cards",
                    style: "bg-[var(--violet-tint)] text-[var(--violet)] border-[var(--violet-tint)]",
                  },
                  {
                    type: "WORKSHEET" as const,
                    label: t("btnSheet") || "Sheet",
                    style: "bg-[var(--amber-tint)] text-[var(--amber)] border-[var(--amber-tint)]",
                  },
                  {
                    type: "GAME" as const,
                    label: t("gamesTab") || "Games",
                    style: "bg-[var(--green-tint)] text-[var(--green)] border-[var(--green-tint)]",
                  },
                ].map(({ type, label, style }) => (
                  <button
                    key={type}
                    onClick={() => handleTriggerAiContent(type)}
                    disabled={!activeSession || isGenerating}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition disabled:opacity-40 hover:opacity-90 shadow-2xs ${style}`}
                  >
                    {isGenerating ? "…" : `+ ${label}`}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto max-h-[460px]">
                {pendingActivities.length > 0 && (
                  <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {t("needsReview") || "Needs Review"} ({pendingActivities.length})
                  </p>
                )}

                {pendingActivities.map((act) => {
                  const content = (act.content || {}) as Record<string, unknown>;
                  const questions = (content.questions || []) as Array<{
                    id: string;
                    question: string;
                    options?: string[];
                    correct?: string;
                  }>;
                  const cards = (content.cards || []) as Array<{
                    word: string;
                    phonics?: string;
                    meaning?: string;
                    visual?: string;
                  }>;
                  const tasks = (content.tasks || []) as Array<{ task: string; answer?: string }>;
                  const games = (content.games || []) as Array<{
                    id?: string;
                    title: string;
                    instruction?: string;
                    visual?: string;
                    options?: string[];
                    correct?: string;
                  }>;

                  return (
                    <div
                      key={act.activity_id}
                      className="rounded-xl border border-[var(--brand-tint2)] bg-[var(--brand-tint)]/40 p-3.5 space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[var(--brand-deep)] uppercase tracking-wider bg-[var(--brand-tint2)] px-2 py-0.5 rounded-full">
                          {act.activity_type}
                        </span>
                        <span className="text-[10px] text-[var(--amber)] font-bold bg-[var(--amber-tint)] px-2 py-0.5 rounded-full">
                          Pending Approval
                        </span>
                      </div>

                      <p className="text-sm font-extrabold text-[var(--text-primary)] leading-snug">{act.title}</p>

                      {/* Detailed Questions / Content Preview */}
                      <div className="space-y-2 pt-1 border-t border-[var(--brand-tint2)]">
                        <p className="text-[10px] font-bold text-[var(--brand-deep)] uppercase tracking-wider">
                          📋 {t("previewQuestions") || "Preview"}
                        </p>

                        {/* Quiz Questions */}
                        {questions.length > 0 && (
                          <div className="space-y-2">
                            {questions.map((q, qIdx) => (
                              <div
                                key={q.id || qIdx}
                                className="p-2.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs space-y-1.5 shadow-2xs"
                              >
                                <p className="font-bold text-[var(--text-primary)]">
                                  <span className="text-[var(--brand-deep)] font-black mr-1">Q{qIdx + 1}:</span>
                                  {q.question}
                                </p>
                                {q.options && (
                                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {q.options.map((opt, oIdx) => {
                                      const isCorrect = opt === q.correct;
                                      return (
                                        <span
                                          key={oIdx}
                                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                            isCorrect
                                              ? "bg-[var(--green-tint)] text-[var(--green)] border-[var(--green-tint)] font-bold ring-1 ring-[var(--green)]"
                                              : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]"
                                          }`}
                                        >
                                          {opt} {isCorrect && "✓"}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Flashcards */}
                        {cards.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {cards.map((c, cIdx) => (
                              <div
                                key={cIdx}
                                className="p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs flex items-center gap-2"
                              >
                                <span className="text-base">{c.visual || "📚"}</span>
                                <div className="overflow-hidden">
                                  <p className="font-bold text-[var(--text-primary)] truncate">{c.word}</p>
                                  {c.meaning && (
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">{c.meaning}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Worksheet tasks */}
                        {tasks.length > 0 && (
                          <div className="space-y-1.5">
                            {tasks.map((tItem, tIdx) => (
                              <div
                                key={tIdx}
                                className="p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs"
                              >
                                <p className="font-medium text-[var(--text-primary)]">
                                  <span className="font-bold text-[var(--brand-deep)] mr-1">{tIdx + 1}.</span>
                                  {tItem.task}
                                </p>
                                {tItem.answer && (
                                  <p className="text-[10px] text-[var(--green)] font-bold mt-0.5">
                                    Answer: {tItem.answer}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Lesson games */}
                        {games.length > 0 && (
                          <div className="space-y-1.5">
                            {games.map((g, gIdx) => (
                              <div
                                key={g.id || gIdx}
                                className="p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs flex items-center gap-2"
                              >
                                <span className="text-base">{g.visual || "🎮"}</span>
                                <div className="overflow-hidden">
                                  <p className="font-bold text-[var(--text-primary)] truncate">{g.title}</p>
                                  {g.instruction && (
                                    <p className="text-[10px] text-[var(--text-muted)] truncate">{g.instruction}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleApproveActivity(act.activity_id, true)}
                          className="vs-btn-brand flex-1 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 shadow-sm"
                        >
                          <span>{t("approveAndSend") || "Approve & Send"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleApproveActivity(act.activity_id, false)}
                          className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-xs transition hover:opacity-80"
                        >
                          {t("discard") || "Discard"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {publishedActivities.length > 0 && (
                  <>
                    <p className="text-[11px] font-bold text-[var(--green)] uppercase tracking-wider pt-2">
                      {t("sentToClass") || "Sent to Class"} ({publishedActivities.length})
                    </p>
                    {publishedActivities.map((pa) => (
                      <div
                        key={pa.activity_id}
                        className="p-3.5 rounded-xl bg-[var(--green-tint)] border border-[var(--green-tint)] space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[var(--green)]">{pa.title}</span>
                          <span className="text-[10px] font-black text-[var(--green)] bg-[var(--surface)] px-2 py-0.5 rounded-full">
                            LIVE
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {pendingActivities.length === 0 && publishedActivities.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-10 text-center">
                    <div>
                      <div className="flex justify-center mx-auto mb-3">
                        <Mascot src="/animations/owlhianimation.lottie" width={160} height={160} />
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t("generateHint") || "Click '+ Quiz' or '+ Cards' to create activities from your lesson"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── My Classrooms History Modal ────────────────────────────── */}
      {showClassroomsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="vs-surface w-full max-w-2xl rounded-3xl overflow-hidden border border-[var(--border)] shadow-2xl flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-2)]">
              <div className="flex items-center gap-2.5">
                <School className="w-5 h-5 text-[var(--brand-deep)]" />
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    {t("myClassrooms") || "My Classrooms"}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    All classroom sessions created by {teacherName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClassroomsModal(false)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-1)] text-[var(--text-secondary)] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {isLoadingClassrooms ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-deep)]" />
                  <p className="text-xs font-medium">Loading classrooms…</p>
                </div>
              ) : teacherClassrooms.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-muted)] space-y-2">
                  <School className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">No classrooms found</p>
                  <p className="text-xs">Start your first classroom session using the &ldquo;Start Class&rdquo; button.</p>
                </div>
              ) : (
                teacherClassrooms.map((c) => {
                  const isCurrent = activeSession?.session_id === c.id;
                  const dateStr = c.created_at
                    ? new Date(c.created_at * 1000).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-[var(--brand-tint)]/40 border-[var(--brand-tint2)] ring-2 ring-[var(--brand-deep)]/20"
                          : "bg-[var(--surface-1)] border-[var(--border)] hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              c.is_active === 1
                                ? "bg-[var(--green-tint)] text-[var(--green)]"
                                : "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]"
                            }`}
                          >
                            {c.is_active === 1 ? "LIVE" : "ENDED"}
                          </span>
                          <span className="text-sm font-extrabold text-[var(--text-primary)]">{c.course_name}</span>
                          <span className="text-xs text-[var(--text-muted)] font-medium">
                            · {t("class")} {c.grade} ({c.teaching_language.toUpperCase()})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] pt-0.5">
                          {c.join_code && (
                            <span className="font-mono font-bold text-[var(--brand-deep)] bg-[var(--brand-tint)] px-2 py-0.5 rounded border border-[var(--brand-tint2)]">
                              🔑 {c.join_code}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>{c.participant_count ?? 0} students</span>
                          </span>
                          {dateStr && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{dateStr}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {c.join_code && (
                          <button
                            onClick={() => handleCopyCode(c.join_code)}
                            className="p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:bg-[var(--surface-1)] text-[var(--text-secondary)] transition"
                            title="Copy Join Code"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                        {isCurrent ? (
                          <span className="px-3 py-1.5 rounded-xl bg-[var(--green-tint)] text-[var(--green)] text-xs font-bold">
                            Current Class
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSwitchClassroom(c)}
                            className="vs-btn-brand px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-2xs"
                          >
                            <span>{c.is_active === 1 ? "Switch" : "Reopen"}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {teacherClassrooms.length} classroom session(s) recorded
              </span>
              <button
                onClick={() => setShowClassroomsModal(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edge Server Setting Modal ──────────────────────────────── */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="vs-surface w-full max-w-md rounded-3xl p-6 border border-[var(--border)] shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-[var(--text-primary)]">Edge server URL</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Both devices must reach the SAME server. On the teacher laptop run{" "}
              <span className="font-mono">python server/main.py</span>, find its Wi-Fi IP (e.g. 192.168.1.5),
              and enter <span className="font-mono">http://192.168.1.5:8000</span> here on BOTH devices.
              Same Wi-Fi / hotspot required.
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
                    await runServerDetect(true);
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

      {/* ── QR Code Modal (hotspot join) ── */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="vs-surface w-full max-w-sm rounded-3xl p-6 border border-[var(--border)] shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[var(--violet)]" />
                {t("qrCodeTitle") || "Scan to Join Class"}
              </h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              1️⃣ Students join your hotspot/Wi-Fi ➁ Scan with camera app — server URL + class code auto-fill
            </p>
            <div className="p-4 bg-white rounded-2xl border border-[var(--border)] inline-block">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Class QR Code" className="w-64 h-64 mx-auto" />
              ) : (
                <div className="w-64 h-64 mx-auto flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs font-bold">Generating QR…</span>
                </div>
              )}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                <span className="font-mono font-bold text-[var(--text-primary)]">{activeSession?.join_code}</span>
                <span className="px-2 py-0.5 rounded bg-[var(--surface-2)]">{t("classCode") || "Code"}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-[var(--text-muted)]">
                <Smartphone className="w-3.5 h-3.5" />
                <span className="font-mono truncate max-w-[200px]">{serverUrl}</span>
              </div>
            </div>
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full vs-btn-brand py-2.5 rounded-xl text-xs font-extrabold"
            >
              {t("close") || "Close"}
            </button>
          </div>
        </div>
      )}

      <footer className="text-center py-3 text-[11px] text-[var(--text-muted)] font-medium">
        {t("footerText")}
      </footer>
    </div>
  );
}
