"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSession, broadcastSpeech, generateAiContent, approveAiContent, connectWebSocket, transcribeAudio, getEdgeServerUrl } from "@/lib/api-client";
import { AudioRecorder } from "@/lib/audio-recorder";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import { Mic, MicOff, Hand, Check, X, Sparkles, ArrowLeft, Send, Radio, ChevronRight, Users, Loader2 } from "lucide-react";
import { MicWaveform } from "@/components/mic-waveform";

export interface SessionInfo {
  session_id: string;
  teacher_name: string;
  course_name: string;
  grade: number;
  teaching_language: string;
  mode: string;
  join_code?: string;
}
export interface SpeechTranscript {
  speaker_name: string;
  speaker_role: string;
  original_text: string;
  ttfa_seconds: number;
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
  const { t } = useLanguage();
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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [recorder] = useState(() => (typeof window !== "undefined" ? new AudioRecorder() : null));
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("user_name");
    const l = localStorage.getItem("user_lang");
    const g = localStorage.getItem("user_grade");
    if (s) setTeacherName(s);
    if (l) setTeachingLang(l);
    if (g) setGrade(Number(g));
  }, []);

  const handleStartSession = async () => {
    const sd = await createSession({
      teacher_id: "T-" + Math.floor(Math.random() * 1000),
      teacher_name: teacherName,
      course_name: courseName,
      grade,
      teaching_language: teachingLang,
    });
    setActiveSession(sd);
    const ws = connectWebSocket(sd.session_id, (msg) => {
      if (msg.type === "RAISE_HAND_UPDATED") {
        const item = msg as unknown as RaiseHandItem;
        setRaiseHandQueue((prev) => (prev.find((p) => p.participant_id === item.participant_id) ? prev : [...prev, item]));
      } else if (msg.type === "SPEECH_TRANSLATED") {
        setTranscripts((prev) => [msg as unknown as SpeechTranscript, ...prev]);
      }
    });
    wsRef.current = ws;
  };

  const handleBroadcastSpeech = async (textToSend?: string) => {
    const text = textToSend || speechText;
    if (!text.trim() || !activeSession) return;

    // Check voice command shortcuts
    const lower = text.toLowerCase();
    if (lower.includes("generate quiz") || lower.includes("क्विज़ बनाओ") || lower.includes("क्विज़")) {
      handleTriggerAiContent("QUIZ");
    } else if (lower.includes("flashcards") || lower.includes("फ्लैशकार्ड")) {
      handleTriggerAiContent("FLASHCARD");
    } else if (lower.includes("worksheet") || lower.includes("वर्कशीट")) {
      handleTriggerAiContent("WORKSHEET");
    }

    const res = await broadcastSpeech({
      session_id: activeSession.session_id,
      speaker_name: teacherName,
      speaker_role: "TEACHER",
      original_text: text,
      source_lang: teachingLang,
    });
    setTranscripts((prev) => [res as unknown as SpeechTranscript, ...prev]);
    setSpeechText("");
  };

  const handleToggleRecord = async () => {
    if (!activeSession || !recorder) return;
    if (isRecording) {
      setIsRecording(false);
      setIsTranscribing(true);
      setMicStatus("Transcribing with Whisper AI...");
      try {
        const b64Pcm = await recorder.stop();
        if (b64Pcm) {
          const result = await transcribeAudio(b64Pcm, teachingLang);
          if (result && result.text) {
            setSpeechText(result.text);
            setMicStatus(`Transcribed: "${result.text}"`);
            await handleBroadcastSpeech(result.text);
          } else {
            setMicStatus("No clear speech detected");
          }
        }
      } catch (err) {
        console.error("Mic recording error:", err);
        setMicStatus("Microphone error");
      } finally {
        setIsTranscribing(false);
        setTimeout(() => setMicStatus(null), 3000);
      }
    } else {
      try {
        await recorder.start();
        setIsRecording(true);
        setMicStatus("Listening... (Tap mic to stop & translate)");
      } catch (err) {
        console.error("Mic start error:", err);
        setMicStatus("Could not access microphone");
      }
    }
  };

  const handleApproveSpeaking = async (participantId: string, allow: boolean) => {
    setRaiseHandQueue((prev) => prev.filter((p) => p.participant_id !== participantId));
    fetch(
      `${getEdgeServerUrl()}/api/sessions/${activeSession?.session_id}/approve-speaking?participant_id=${participantId}&allow=${allow}`,
      { method: "POST" }
    );
  };

  const handleTriggerAiContent = async (type: "QUIZ" | "FLASHCARD" | "WORKSHEET") => {
    if (!activeSession) return;
    setIsGenerating(true);
    const langFallback: Record<string, string> = {
      hi: `${courseName} - पाठ एवं अभ्यास`,
      sat: `${courseName} - ᱥᱟᱛᱟᱢ ᱟᱨ ᱯᱟᱴ`,
      en: `${courseName} Lesson & Practice`,
    };
    const summary = transcripts.map((t) => t.original_text).join(". ") || langFallback[teachingLang] || `${courseName} Lesson`;
    const res = await generateAiContent({
      session_id: activeSession.session_id,
      transcript_summary: summary,
      grade,
      activity_type: type,
      language: teachingLang,
    });
    setPendingActivities((prev) => [res as ActivityItem, ...prev]);
    setIsGenerating(false);
  };

  const handleApproveActivity = async (activityId: string, approve: boolean) => {
    await approveAiContent(activityId, approve ? "APPROVED" : "REJECTED");
    const act = pendingActivities.find((a) => a.activity_id === activityId);
    setPendingActivities((prev) => prev.filter((a) => a.activity_id !== activityId));
    if (approve && act) setPublishedActivities((prev) => [act, ...prev]);
  };

  const modeStyles: Record<string, string> = {
    LECTURE: "bg-[var(--brand)] text-[#0c1a2e]",
    Q_AND_A: "bg-[var(--violet-tint)] text-[var(--violet)]",
    DISCUSSION: "bg-[var(--green-tint)] text-[var(--green)]",
  };

  const modeLabels: Record<string, string> = {
    LECTURE: t("modeLecture"),
    Q_AND_A: t("modeQA"),
    DISCUSSION: t("modeDiscussion"),
  };

  const quickSamples = [
    t("quickSample1"),
    t("quickSample2"),
    t("quickSample3"),
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
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0c1a2e] text-sm font-black bg-[var(--brand)]">व</div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)] leading-none">वाणीSetu</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{teacherName} · {t("class")} {grade} · {teachingLang.toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode */}
          <div className="hidden sm:flex items-center bg-[var(--surface-2)] rounded-xl p-1 gap-1">
            {(["LECTURE", "Q_AND_A", "DISCUSSION"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${mode === m ? modeStyles[m] : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>

          {activeSession ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--green-tint)] text-[var(--green)] text-xs font-bold border border-[var(--green-tint)]">
                <Radio className="w-3.5 h-3.5 animate-pulse" /> {t("live")}
              </div>
              {activeSession.join_code && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--brand)] text-[#0c1a2e] text-xs font-black tracking-widest shadow-sm">
                  <span>🔑 CODE:</span>
                  <span className="font-mono text-sm uppercase">{activeSession.join_code}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="vs-input px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] cursor-pointer"
              >
                <option value="Mathematics">📐 Mathematics (गणित / ᱮᱞᱠᱷᱟ)</option>
                <option value="Literacy & Language">📚 Literacy & Language (साक्षरता / ᱚᱞ)</option>
                <option value="EVS & Science">🌿 EVS & Science (पर्यावरण / ᱯᱚᱨᱤᱵᱮᱥ)</option>
                <option value="General Knowledge">💡 General Knowledge (सामान्य ज्ञान)</option>
              </select>
              <button onClick={handleStartSession} className="vs-btn-brand px-4 py-2 rounded-xl text-xs">
                {t("startClassBtn")}
              </button>
            </div>
          )}
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: Broadcast + Feed */}
        <div className="lg:col-span-8 space-y-4 flex flex-col">

          {/* Broadcast */}
          <div className="vs-surface rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center gap-2">
              <Mic className="w-4 h-4 text-[var(--brand)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("broadcastToClass")}</h2>
              {isRecording && <MicWaveform isSpeaking={true} className="ml-auto" />}
              {activeSession && (
                <div className="ml-auto flex items-center gap-2">
                  {activeSession.join_code && (
                    <span className="text-xs text-[var(--brand-deep)] font-black bg-[var(--brand-tint)] px-2.5 py-0.5 rounded-full border border-[var(--brand-tint2)]">
                      🔑 Code: {activeSession.join_code}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--surface-2)] px-2 py-0.5 rounded-full">
                    ID: {activeSession.session_id}
                  </span>
                </div>
              )}
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handleToggleRecord}
                  disabled={!activeSession || isTranscribing}
                  title={isRecording ? "Stop & Transcribe" : "Record Voice with Whisper AI"}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                    isRecording
                      ? "bg-[var(--red)] text-white animate-pulse shadow-lg ring-4 ring-red-400/30"
                      : isTranscribing
                      ? "bg-[var(--amber-tint)] text-[var(--amber)]"
                      : "bg-[var(--brand-tint)] text-[var(--brand-deep)] hover:bg-[var(--brand-tint2)]"
                  }`}
                >
                  {isTranscribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={speechText}
                  onChange={(e) => setSpeechText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBroadcastSpeech()}
                  placeholder={isRecording ? "Recording voice... Click mic to finish" : isTranscribing ? "Transcribing speech..." : t("broadcastPlaceholder")}
                  disabled={!activeSession || isRecording || isTranscribing}
                  className="vs-input flex-1 px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
                />
                <button
                  onClick={() => handleBroadcastSpeech()}
                  disabled={!activeSession || !speechText.trim()}
                  className="vs-btn-brand w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              {micStatus && (
                <div className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium ${
                  isRecording
                    ? "bg-[var(--red-tint)] text-[var(--red)] animate-pulse"
                    : isTranscribing
                    ? "bg-[var(--amber-tint)] text-[var(--amber)]"
                    : "bg-[var(--green-tint)] text-[var(--green)]"
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {micStatus}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <span className="text-[11px] text-[var(--text-muted)] self-center font-medium">{t("quickLabel")}</span>
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
            </div>
          </div>

          {/* Feed */}
          <div className="flex-1 vs-surface rounded-2xl flex flex-col overflow-hidden min-h-[320px]">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t("liveTranslationFeed")}</h3>
              <span className="text-[10px] text-[var(--green)] font-bold bg-[var(--green-tint)] px-2.5 py-1 rounded-full">
                {transcripts.length} {t("broadcastsCount")}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-10 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--brand-tint)] flex items-center justify-center">
                    <Mic className="w-7 h-7 text-[var(--brand)]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-secondary)]">{t("noBroadcastsYet")}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{t("noBroadcastsSub")}</p>
                  </div>
                </div>
              ) : (
                transcripts.map((tItem, idx) => (
                  <div key={idx} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-[var(--border-sub)] bg-[var(--surface)]">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[var(--brand)] text-[#0c1a2e] text-[10px] font-black flex items-center justify-center">
                          {tItem.speaker_name.charAt(0)}
                        </div>
                        <span className="text-xs font-bold text-[var(--text-primary)]">{tItem.speaker_name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full font-medium">{tItem.speaker_role}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{tItem.ttfa_seconds}s</span>
                    </div>
                    <div className="px-4 py-3 space-y-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">&ldquo;{tItem.original_text}&rdquo;</p>
                      {Object.keys(tItem.translations || {}).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                          {Object.entries(tItem.translations || {}).map(([trLang, text]) => (
                            <div key={trLang} className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px]">
                              <span className="font-bold text-[var(--brand-deep)] uppercase text-[10px]">{trLang} </span>
                              <span className="text-[var(--text-secondary)]">{text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Raise Hand + AI */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">

          {/* Raise Hand */}
          <div className="vs-surface rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-[var(--red)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{t("raiseHandTitle")}</h3>
              </div>
              {raiseHandQueue.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[var(--red)] text-white text-[10px] font-black flex items-center justify-center">
                  {raiseHandQueue.length}
                </span>
              )}
            </div>
            <div className="p-4">
              {raiseHandQueue.length === 0 ? (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--surface-2)] flex items-center justify-center">
                    <Users className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{t("noStudentsWaiting")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {raiseHandQueue.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[var(--red-tint)] border border-[var(--red-tint)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--red)] text-white text-xs font-black flex items-center justify-center">
                          {item.student_name.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-[var(--text-primary)]">{item.student_name}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApproveSpeaking(item.participant_id, true)}
                          className="w-8 h-8 rounded-xl bg-[var(--green)] text-white flex items-center justify-center transition hover:opacity-80"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleApproveSpeaking(item.participant_id, false)}
                          className="w-8 h-8 rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] flex items-center justify-center transition hover:opacity-80"
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

          {/* AI Content */}
          <div className="flex-1 vs-surface rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-[var(--border-sub)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--amber)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t("generateActivityTitle")}</h3>
            </div>
            <div className="p-4 space-y-4 flex-1 flex flex-col">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { type: "QUIZ" as const, label: t("btnQuiz"), style: "bg-[var(--brand-tint)] text-[var(--brand-deep)] border-[var(--brand-tint2)] hover:opacity-80" },
                  { type: "FLASHCARD" as const, label: t("btnCards"), style: "bg-[var(--violet-tint)] text-[var(--violet)] border-[var(--violet-tint)] hover:opacity-80" },
                  { type: "WORKSHEET" as const, label: t("btnSheet"), style: "bg-[var(--amber-tint)] text-[var(--amber)] border-[var(--amber-tint)] hover:opacity-80" },
                ]).map(({ type, label, style }) => (
                  <button
                    key={type}
                    onClick={() => handleTriggerAiContent(type)}
                    disabled={!activeSession || isGenerating}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition disabled:opacity-40 ${style}`}
                  >
                    {isGenerating ? "…" : `+ ${label}`}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {pendingActivities.length > 0 && (
                  <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    {t("needsReview")} ({pendingActivities.length})
                  </p>
                )}
                {pendingActivities.map((act) => {
                  const content = (act.content || {}) as Record<string, unknown>;
                  const questions = (content.questions || []) as Array<{ id: string; question: string; options?: string[]; correct?: string }>;
                  const cards = (content.cards || []) as Array<{ word: string; phonics?: string; meaning?: string; visual?: string }>;
                  const tasks = (content.tasks || []) as Array<{ task: string; answer?: string }>;

                  return (
                    <div key={act.activity_id} className="rounded-xl border border-[var(--brand-tint2)] bg-[var(--brand-tint)] p-3.5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[var(--brand-deep)] uppercase tracking-wider bg-[var(--brand-tint2)] px-2 py-0.5 rounded-full">
                          {act.activity_type}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-medium">
                          {t("needsReview")}
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-extrabold text-[var(--text-primary)] leading-snug">{act.title}</p>
                      </div>

                      {/* Detailed Questions / Content Preview */}
                      <div className="space-y-2 pt-1 border-t border-[var(--brand-tint2)]">
                        <p className="text-[10px] font-bold text-[var(--brand-deep)] uppercase tracking-wider">
                          📋 {t("previewQuestions")}
                        </p>

                        {/* Quiz Questions */}
                        {questions.length > 0 && (
                          <div className="space-y-2">
                            {questions.map((q, qIdx) => (
                              <div key={q.id || qIdx} className="p-2.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs space-y-1.5 shadow-2xs">
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
                              <div key={cIdx} className="p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs flex items-center gap-2">
                                <span className="text-base">{c.visual || "📚"}</span>
                                <div className="overflow-hidden">
                                  <p className="font-bold text-[var(--text-primary)] truncate">{c.word}</p>
                                  {c.meaning && <p className="text-[10px] text-[var(--text-muted)] truncate">{c.meaning}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Worksheet tasks */}
                        {tasks.length > 0 && (
                          <div className="space-y-1.5">
                            {tasks.map((tItem, tIdx) => (
                              <div key={tIdx} className="p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] text-xs">
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
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleApproveActivity(act.activity_id, true)}
                          className="vs-btn-brand flex-1 py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 shadow-md"
                        >
                          {t("approveAndSend")} <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleApproveActivity(act.activity_id, false)}
                          className="px-3.5 py-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)] font-bold text-xs transition hover:opacity-80"
                        >
                          {t("discard")}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {publishedActivities.length > 0 && (
                  <>
                    <p className="text-[11px] font-bold text-[var(--green)] uppercase tracking-widest pt-2">
                      {t("sentToClass")} ({publishedActivities.length})
                    </p>
                    {publishedActivities.map((pa) => {
                      const pContent = (pa.content || {}) as Record<string, unknown>;
                      const pQuestions = (pContent.questions || []) as Array<{ id: string; question: string; options?: string[]; correct?: string }>;
                      return (
                        <div key={pa.activity_id} className="p-3.5 rounded-xl bg-[var(--green-tint)] border border-[var(--green-tint)] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--green)]">{pa.title}</span>
                            <span className="text-[10px] font-black text-[var(--green)] bg-[var(--surface)] px-2 py-0.5 rounded-full">LIVE</span>
                          </div>
                          {pQuestions.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-[var(--green-tint)]/40">
                              {pQuestions.map((q, qIdx) => (
                                <p key={qIdx} className="text-[11px] font-medium text-[var(--text-primary)]">
                                  <span className="font-bold text-[var(--green)] mr-1">Q{qIdx + 1}:</span> {q.question}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {pendingActivities.length === 0 && publishedActivities.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-8 text-center">
                    <div>
                      <Sparkles className="w-8 h-8 text-[var(--amber)] mx-auto mb-2 opacity-40" />
                      <p className="text-xs text-[var(--text-muted)]">{t("generateHint")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
