"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import { AudioRecorder } from "@/lib/audio-recorder";
import { TRANSLATIONS } from "@/lib/translations";
import {
  DUMP_PROMPTS,
  DumpRecordings,
  pcmBase64ToWavUrl,
  buildDumpExport,
} from "@/lib/language-dump";
import {
  ArrowLeft,
  Mic,
  Square,
  Play,
  Download,
  Trash2,
  CheckCircle2,
  Circle,
  Globe,
  AlertCircle,
} from "lucide-react";

const META_KEY = "langdump-meta";

const recordingsKey = (code: string) => `langdump-rec-${code.trim().toLowerCase() || "new"}`;

export default function LanguageDumpPage() {
  const router = useRouter();
  const { lang } = useLanguage();

  const tdump = (key: string, fallback: string) => {
    if (lang === "hi") {
      return TRANSLATIONS.hi[key] || fallback;
    }
    return TRANSLATIONS.en[key] || fallback;
  };

  const [langName, setLangName] = useState("");
  const [langCode, setLangCode] = useState("");
  const [contributor, setContributor] = useState("");
  const [recordings, setRecordings] = useState<DumpRecordings>({});
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [playingPrompt, setPlayingPrompt] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Restore meta + recordings
  useEffect(() => {
    try {
      const meta = localStorage.getItem(META_KEY);
      if (meta) {
        const m = JSON.parse(meta) as { name?: string; code?: string; by?: string };
        if (m.name) setLangName(m.name);
        if (m.code) setLangCode(m.code);
        if (m.by) setContributor(m.by);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(recordingsKey(langCode));
      setRecordings(raw ? (JSON.parse(raw) as DumpRecordings) : {});
    } catch {
      setRecordings({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langCode]);

  useEffect(() => {
    try {
      localStorage.setItem(META_KEY, JSON.stringify({ name: langName, code: langCode, by: contributor }));
    } catch {}
  }, [langName, langCode, contributor]);

  useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause();
      } catch {}
    };
  }, []);

  const doneCount = Object.keys(recordings).length;
  const pct = Math.round((doneCount / DUMP_PROMPTS.length) * 100);

  const saveRecordings = (next: DumpRecordings) => {
    setRecordings(next);
    try {
      localStorage.setItem(recordingsKey(langCode), JSON.stringify(next));
      setStorageError(null);
    } catch {
      setStorageError(
        tdump("dumpStorageFull", "Phone storage is full — export your progress below, then clear to continue.")
      );
    }
  };

  const toggleRecord = async (promptId: string) => {
    if (activePrompt === promptId) {
      // stop
      try {
        const rec = recorderRef.current;
        recorderRef.current = null;
        setActivePrompt(null);
        if (!rec) return;
        const b64 = await rec.stop();
        if (b64) {
          saveRecordings({
            ...recordings,
            [promptId]: { audioBase64: b64, recordedAt: new Date().toISOString() },
          });
        }
      } catch {
        setActivePrompt(null);
      }
      return;
    }
    // start (only one at a time)
    try {
      const rec = new AudioRecorder();
      recorderRef.current = rec;
      await rec.start();
      setActivePrompt(promptId);
      setStorageError(null);
    } catch {
      setStorageError(tdump("dumpMicError", "Could not access the microphone. Allow mic access and retry."));
    }
  };

  const playRecording = (promptId: string) => {
    const rec = recordings[promptId];
    if (!rec) return;
    try {
      audioRef.current?.pause();
      const url = pcmBase64ToWavUrl(rec.audioBase64);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingPrompt(promptId);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setPlayingPrompt(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPlayingPrompt(null);
      };
      void audio.play();
    } catch {}
  };

  const exportBundle = () => {
    const bundle = buildDumpExport(langName || "Unnamed", langCode || "new", contributor || "Anonymous", recordings);
    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaaniverse-langdump-${bundle.language.code || "new"}-${doneCount}of${DUMP_PROMPTS.length}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const clearAll = () => {
    if (!confirm(tdump("dumpClearConfirm", "Delete all recordings for this language? Export first!"))) return;
    setRecordings({});
    try {
      localStorage.removeItem(recordingsKey(langCode));
    } catch {}
  };

  const categories = ["Greetings", "Classroom", "Numbers", "Words", "School"] as const;

  const getCategoryTitle = (cat: string) => {
    const keyMap: Record<string, string> = {
      Greetings: "dumpCatGreetings",
      Classroom: "dumpCatClassroom",
      Numbers: "dumpCatNumbers",
      Words: "dumpCatWords",
      School: "dumpCatSchool",
    };
    const key = keyMap[cat];
    return key ? tdump(key, cat) : cat;
  };

  return (
    <div className="min-h-screen vs-bg flex flex-col">
      <nav className="px-5 py-4 flex items-center justify-between max-w-5xl mx-auto w-full sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-extrabold vs-text text-lg tracking-tight flex items-center gap-1.5">
            <Globe className="w-5 h-5 text-[var(--brand)]" />
            {tdump("dumpTitle", "Language Dump")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="vs-surface rounded-3xl p-6 space-y-2 border border-[var(--border)]">
          <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
            {tdump("dumpHeading", "🌍 Add a new language")}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {tdump(
              "dumpSub",
              "Missing your language? Read each prompt aloud and record it. Export the bundle and send it to the developers — that is what a new language implementation is built from (UI text, voice, and translation data)."
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <input
              value={langName}
              onChange={(e) => setLangName(e.target.value)}
              placeholder={tdump("dumpLangName", "Language name (e.g. Ho)")}
              className="vs-input px-3 py-2.5 rounded-xl text-sm font-medium"
            />
            <input
              value={langCode}
              onChange={(e) => setLangCode(e.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5))}
              placeholder={tdump("dumpLangCode", "Code (e.g. hoc)")}
              className="vs-input px-3 py-2.5 rounded-xl text-sm font-medium font-mono"
            />
            <input
              value={contributor}
              onChange={(e) => setContributor(e.target.value)}
              placeholder={tdump("dumpYourName", "Your name")}
              className="vs-input px-3 py-2.5 rounded-xl text-sm font-medium"
            />
          </div>
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)] mb-1">
              <span>
                {doneCount}/{DUMP_PROMPTS.length} {tdump("dumpRecorded", "recorded")}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden">
              <div
                className="h-full bg-[var(--brand)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {storageError && (
            <p className="text-xs font-bold text-[var(--red)] bg-[var(--red-tint)] px-3 py-2 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {storageError}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={exportBundle}
              disabled={doneCount === 0}
              className="flex-1 vs-btn-brand py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {tdump("dumpExport", "Export bundle")} ({doneCount})
            </button>
            <button
              onClick={clearAll}
              disabled={doneCount === 0}
              className="px-4 py-3 rounded-xl bg-[var(--red-tint)] text-[var(--red)] text-sm font-bold disabled:opacity-50"
              title={tdump("dumpClear", "Delete all")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {categories.map((cat) => (
          <div key={cat} className="space-y-2">
            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)] px-1">
              {getCategoryTitle(cat)} · {DUMP_PROMPTS.filter((p) => p.category === cat && recordings[p.id]).length}/
              {DUMP_PROMPTS.filter((p) => p.category === cat).length}
            </h2>
            {DUMP_PROMPTS.filter((p) => p.category === cat).map((p) => {
              const rec = recordings[p.id];
              const isActive = activePrompt === p.id;
              return (
                <div
                  key={p.id}
                  className={`vs-surface rounded-2xl p-4 border flex items-center gap-3 ${
                    rec ? "border-[var(--green-tint)]" : "border-[var(--border)]"
                  } ${isActive ? "ring-2 ring-[var(--red)]" : ""}`}
                >
                  {rec ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--green)] shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
                  )}
                  <p className="flex-1 text-sm font-bold text-[var(--text-primary)] leading-snug">
                    &ldquo;{p.reference}&rdquo;
                  </p>
                  {rec && (
                    <button
                      onClick={() => playRecording(p.id)}
                      className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-primary)] active:scale-95 transition"
                      title="Play recording"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleRecord(p.id)}
                    className={`h-10 px-3.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 active:scale-95 transition shrink-0 ${
                      isActive
                        ? "bg-[var(--red)] text-white animate-pulse"
                        : rec
                        ? "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-secondary)]"
                        : "vs-btn-brand"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        {playingPrompt === p.id ? "…" : tdump("dumpStop", "Stop")}
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        {rec ? tdump("dumpRedo", "Redo") : tdump("dumpRecord", "Record")}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}

        <div className="vs-surface rounded-2xl p-4 border border-[var(--border)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
          <p className="font-bold text-[var(--text-primary)] mb-1">
            {tdump("dumpDevTitle", "For developers — turning a bundle into a language:")}
          </p>
          <p>
            {tdump(
              "dumpDevBody",
              "1) Transcribe recordings into TRANSLATIONS entries (lib/translations.ts). 2) Add a script transliterator if needed (lib/ol-chiki.ts pattern) for TTS. 3) Fine-tune/extend IndicTrans + ASR with the audio pairs. 4) Register the code in APP_LANGUAGES + edge LANGUAGES."
            )}
          </p>
        </div>
      </main>

      <footer className="text-center py-4 text-[11px] text-[var(--text-muted)] font-medium">
        {tdump("footerText", "वाणीSetu · Classes 1–3 · Works without internet")}
      </footer>
    </div>
  );
}

