"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LANGUAGES } from "@/lib/nipun-data";
import { fetchActiveSessions } from "@/lib/api-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import { Check, User, GraduationCap, Globe, ArrowRight, Mic, Volume2, Hand, Sparkles, Wifi } from "lucide-react";

export default function VaaniSetuOnboarding() {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher">("student");
  const [name, setName] = useState("");
  const [selectedLang, setSelectedLang] = useState<string>("hi");
  const [grade, setGrade] = useState(2);

  const handleRoleChange = (role: "student" | "teacher") => {
    setSelectedRole(role);
    if (role === "teacher") {
      setSelectedLang("en");
    } else {
      setSelectedLang("hi");
    }
  };

  useEffect(() => {
    fetchActiveSessions().catch(() => {});
  }, []);

  const handleStart = () => {
    if (!name.trim()) return;
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];
    localStorage.setItem("user_role", selectedRole);
    localStorage.setItem("user_name", name);
    localStorage.setItem("user_lang", selectedLang);
    localStorage.setItem("user_lang_name", langObj.name);
    localStorage.setItem("user_grade", String(grade));
    router.push(selectedRole === "teacher" ? "/teacher" : "/student");
  };

  const teacherSteps = [
    { icon: <Mic className="w-4 h-4" />, label: t("stepTeacher1Title"), sub: t("stepTeacher1Sub"), c: "bg-[var(--brand-tint)] text-[var(--brand-deep)]" },
    { icon: <Globe className="w-4 h-4" />, label: t("stepTeacher2Title"), sub: t("stepTeacher2Sub"), c: "bg-[var(--green-tint)] text-[var(--green)]" },
    { icon: <Sparkles className="w-4 h-4" />, label: t("stepTeacher3Title"), sub: t("stepTeacher3Sub"), c: "bg-[var(--amber-tint)] text-[var(--amber)]" },
  ];
  const studentSteps = [
    { icon: <Volume2 className="w-4 h-4" />, label: t("stepStudent1Title"), sub: t("stepStudent1Sub"), c: "bg-[var(--brand-tint)] text-[var(--brand-deep)]" },
    { icon: <Hand className="w-4 h-4" />, label: t("stepStudent2Title"), sub: t("stepStudent2Sub"), c: "bg-[var(--red-tint)] text-[var(--red)]" },
    { icon: <Sparkles className="w-4 h-4" />, label: t("stepStudent3Title"), sub: t("stepStudent3Sub"), c: "bg-[var(--amber-tint)] text-[var(--amber)]" },
  ];
  const steps = selectedRole === "teacher" ? teacherSteps : studentSteps;

  return (
    <div className="min-h-screen vs-bg flex flex-col">
      {/* Nav */}
      <nav className="px-5 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[#0c1a2e] text-sm font-black bg-[var(--brand)]">
            व
          </div>
          <span className="font-bold vs-text text-lg tracking-tight">वाणीSetu</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold vs-tint px-3 py-1.5 rounded-full border vs-tint-border">
            <Wifi className="w-3 h-3" /> {t("offlineReady")}
          </div>
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">

          {/* Left — Hero + Steps */}
          <div className="flex flex-col gap-4">
            {/* Hero */}
            <div className="rounded-3xl p-7 bg-[var(--brand-tint)] border border-[var(--brand-tint2)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] mb-3">
                {t("heroBadge")}
              </p>
              <h1 className="text-3xl font-extrabold leading-tight mb-2 tracking-tight text-[var(--text-primary)]">
                {t("heroTitle1")}<br />{t("heroTitle2")}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs">
                {t("heroSubtitle")}
              </p>
            </div>

            {/* Role toggle */}
            <div className="vs-surface rounded-2xl p-1.5 flex gap-1">
              {(["student", "teacher"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    selectedRole === r
                      ? "bg-[var(--brand)] text-[#0c1a2e] shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {r === "student" ? <GraduationCap className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  {r === "student" ? t("roleStudent") : t("roleTeacher")}
                </button>
              ))}
            </div>

            {/* Steps */}
            <div className="vs-surface rounded-2xl overflow-hidden flex-1">
              <div className="px-5 py-3 border-b border-[var(--border-sub)] vs-surface2">
                <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  {selectedRole === "teacher" ? t("yourWorkflow") : t("howClassWorks")}
                </p>
              </div>
              <div className="px-4 py-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 relative">
                    {i < steps.length - 1 && (
                      <div className="absolute left-[18px] top-[44px] w-px h-5 bg-[var(--border)]" />
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${step.c}`}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{step.label}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{step.sub}</p>
                    </div>
                    <span className="text-xs font-bold text-[var(--text-muted)]">0{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="vs-surface rounded-3xl p-6 sm:p-7 flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
                {t("setupProfileTitle")}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t("setupProfileSub")}</p>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest block">
                {selectedRole === "teacher" ? t("teacherNameLabel") : t("studentNameLabel")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder={selectedRole === "teacher" ? t("teacherNamePlaceholder") : t("studentNamePlaceholder")}
                className="vs-input w-full px-4 py-3.5 rounded-xl text-sm font-medium"
              />
            </div>

            {/* Language */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[var(--brand)]" />
                {selectedRole === "teacher" ? t("teachingInLabel") : t("iUnderstandLabel")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SUPPORTED_LANGUAGES.map((langItem) => {
                  const sel = selectedLang === langItem.code;
                  return (
                    <button
                      key={langItem.code}
                      onClick={() => setSelectedLang(langItem.code)}
                      className={`p-3 rounded-xl border text-left transition ${
                        sel
                          ? "border-[var(--brand)] bg-[var(--brand-tint)] ring-2 ring-[var(--brand-tint2)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]"
                      }`}
                    >
                      <div className={`text-sm font-bold ${sel ? "text-[var(--brand-deep)]" : "text-[var(--text-primary)]"}`}>
                        {langItem.nativeName}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{langItem.name}</div>
                      {sel && <Check className="w-3 h-3 text-[var(--brand-deep)] mt-1.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grade */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest block">
                {t("class")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={`py-3 rounded-xl border font-bold text-sm transition ${
                      grade === g
                        ? "border-[var(--brand)] bg-[var(--brand)] text-[#0c1a2e] shadow-sm"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--brand)]"
                    }`}
                  >
                    {t("class")} {g}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={!name.trim()}
              className="vs-btn-brand mt-auto w-full py-4 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {selectedRole === "teacher" ? t("openTeacherConsole") : t("joinClass")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-[11px] text-[var(--text-muted)] font-medium">
        {t("footerText")}
      </footer>
    </div>
  );
}
