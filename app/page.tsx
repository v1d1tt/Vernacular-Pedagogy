"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LANGUAGES } from "@/lib/nipun-data";
import { teacherSignup, teacherLogin, registerStudent } from "@/lib/api-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitch } from "@/components/language-switch";
import { useLanguage } from "@/components/language-provider";
import {
  Check, User, GraduationCap, Globe, ArrowRight,
  Wifi, School, Eye, EyeOff, AlertCircle
} from "lucide-react";
import { LanguageCode } from "@/lib/translations";

type TeacherAuthMode = "login" | "signup";

export default function VaaniSetuOnboarding() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher">("teacher");

  // Existing session check
  const [existingUser, setExistingUser] = useState<{ role: string; name: string; lang: string } | null>(null);

  // Teacher Auth
  const [teacherAuthMode, setTeacherAuthMode] = useState<TeacherAuthMode>("login");

  // Login: name + password
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // Signup: name, subject, grade, school, password, confirm password
  const [signupName, setSignupName] = useState("");
  const [signupSubject, setSignupSubject] = useState("");
  const [signupGrade, setSignupGrade] = useState<number>(2);
  const [signupSchool, setSignupSchool] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [showSignupConfirmPwd, setShowSignupConfirmPwd] = useState(false);

  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Student form
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState<number>(2);
  const [section, setSection] = useState("A");
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("vs-app-lang") as LanguageCode | null;
      if (!saved) setLang("hi");
      const r = localStorage.getItem("user_role");
      const n = localStorage.getItem("user_name");
      const l = localStorage.getItem("user_lang");
      if (r && n) setExistingUser({ role: r, name: n, lang: l || "hi" });
    } catch {}
  }, [setLang]);

  const handleSelectLanguage = (code: string) => setLang(code as LanguageCode);

  const handleContinueLanguage = () => {
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
    localStorage.setItem("user_lang", lang);
    localStorage.setItem("user_lang_name", langObj.name);
    setStep(2);
  };

  const handleSelectRole = (role: "teacher" | "student") => {
    setSelectedRole(role);
    setAuthError("");
    setStep(3);
  };

  // ── Teacher Login ────────────────────────────────────────────────
  const handleTeacherLogin = async () => {
    if (!loginName.trim() || !loginPassword.trim()) return;
    setIsLoading(true);
    setAuthError("");
    try {
      const res = await teacherLogin(loginName.trim(), loginPassword);
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
      localStorage.setItem("user_role", "teacher");
      localStorage.setItem("user_name", res.name);
      localStorage.setItem("user_lang", lang);
      localStorage.setItem("user_lang_name", langObj.name);
      localStorage.setItem("user_grade", String(res.grade || 2));
      localStorage.setItem("user_subject", res.subject || "");
      localStorage.setItem("user_school", res.school_name || "");
      router.push("/teacher");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "ACCOUNT_NOT_FOUND") setAuthError(t("accountNotFoundError"));
      else setAuthError(t("wrongPasswordError"));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Teacher Signup ───────────────────────────────────────────────
  const handleTeacherSignup = async () => {
    if (!signupName.trim() || !signupSubject.trim() || !signupSchool.trim() || !signupPassword.trim()) return;
    if (signupPassword !== signupConfirmPassword) {
      setAuthError(t("passwordMismatchError"));
      return;
    }
    setIsLoading(true);
    setAuthError("");
    try {
      const res = await teacherSignup({
        name: signupName.trim(),
        password: signupPassword,
        subject: signupSubject.trim(),
        grade: signupGrade,
        school_name: signupSchool.trim(),
        preferred_language: lang,
      });
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
      localStorage.setItem("user_role", "teacher");
      localStorage.setItem("user_name", res.name);
      localStorage.setItem("user_lang", lang);
      localStorage.setItem("user_lang_name", langObj.name);
      localStorage.setItem("user_grade", String(signupGrade));
      localStorage.setItem("user_subject", signupSubject.trim());
      localStorage.setItem("user_school", signupSchool.trim());
      router.push("/teacher");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "ACCOUNT_EXISTS") {
        setAuthError(t("accountExistsError"));
        setTeacherAuthMode("login");
        setLoginName(signupName);
      } else if (msg === "SERVER_OFFLINE") {
        setAuthError(t("serverOfflineError"));
      } else {
        setAuthError(t("signupFailedError") || "Signup failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentRegister = async () => {
    if (!studentName.trim() || !schoolName.trim()) return;
    setIsLoading(true);
    try {
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
      await registerStudent({
        name: studentName.trim(),
        grade,
        section: section.trim() || "A",
        school_name: schoolName.trim(),
        preferred_language: lang,
      });
      localStorage.setItem("user_role", "student");
      localStorage.setItem("user_name", studentName.trim());
      localStorage.setItem("user_lang", lang);
      localStorage.setItem("user_lang_name", langObj.name);
      localStorage.setItem("user_grade", String(grade));
      localStorage.setItem("user_section", section.trim() || "A");
      localStorage.setItem("user_school", schoolName.trim());
      router.push("/student");
    } catch {
      router.push("/student");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Guest Login ──────────────────────────────────────────────────
  const handleGuestLogin = () => {
    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
    localStorage.setItem("user_role", "teacher");
    localStorage.setItem("user_name", "Guest Teacher");
    localStorage.setItem("user_lang", lang);
    localStorage.setItem("user_lang_name", langObj.name);
    localStorage.setItem("user_grade", "2");
    localStorage.setItem("user_subject", "General");
    localStorage.setItem("user_school", "Demo School");
    localStorage.setItem("is_guest", "true");
    router.push("/teacher");
  };

  const handleContinueExisting = () => {
    if (!existingUser) return;
    router.push(existingUser.role === "teacher" ? "/teacher" : "/student");
  };

  const primaryLanguages = [
    { code: "hi", name: "Hindi", nativeName: "हिंदी", script: "Devanagari" },
    { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Ol Chiki" },
    { code: "en", name: "English", nativeName: "English", script: "Latin" },
  ];

  const passwordField = (
    id: string,
    value: string,
    onChange: (v: string) => void,
    show: boolean,
    toggleShow: () => void,
    label: string,
    placeholder: string,
    onEnter?: () => void
  ) => (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
          placeholder={placeholder}
          className="vs-input w-full px-4 py-3 rounded-xl text-sm font-medium pr-12"
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen vs-bg flex flex-col justify-between">
      {/* Navigation */}
      <nav className="px-5 py-4 flex items-center justify-between max-w-5xl mx-auto w-full sticky top-0 z-30 bg-[var(--background)]/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-[#0c1a2e] text-base font-black bg-[var(--brand)] shadow-sm">
            व
          </div>
          <span className="font-extrabold vs-text text-lg tracking-tight">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold vs-tint px-3 py-1.5 rounded-full border vs-tint-border">
            <Wifi className="w-3 h-3 text-[var(--green)]" /> {t("offlineReady")}
          </div>
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-2xl space-y-6">

          {/* Returning user banner */}
          {existingUser && step === 1 && (
            <div className="vs-surface p-4 rounded-2xl border border-[var(--brand-tint2)] bg-[var(--brand-tint)] flex items-center justify-between shadow-sm animate-fadeIn">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--brand)] text-[#0c1a2e] font-black text-sm flex items-center justify-center">
                  {existingUser.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-medium">{t("savedProfileFound")}</p>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {existingUser.name} ({existingUser.role.toUpperCase()})
                  </p>
                </div>
              </div>
              <button
                id="btn-continue-existing"
                onClick={handleContinueExisting}
                className="vs-btn-brand px-4 py-2 text-xs font-bold rounded-xl"
              >
                {t("continueBtn")}
              </button>
            </div>
          )}

          {/* Stepper */}
          <div className="vs-surface p-4 rounded-2xl border border-[var(--border)] flex items-center justify-between">
            {[
              { num: 1, label: t("switchLanguage") },
              { num: 2, label: t("chooseRoleTitle") },
              { num: 3, label: selectedRole === "teacher" ? t("teacherAuthTitle") : t("studentRegTitle") },
            ].map((st, i) => (
              <React.Fragment key={st.num}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold transition ${
                    step === st.num ? "bg-[var(--brand)] text-[#0c1a2e] shadow-md"
                    : step > st.num ? "bg-[var(--green-tint)] text-[var(--green)] border border-[var(--green-tint)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                  }`}>
                    {step > st.num ? <Check className="w-4 h-4" /> : st.num}
                  </div>
                  <p className={`hidden sm:block text-xs font-bold ${step === st.num ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                    {st.label}
                  </p>
                </div>
                {i < 2 && <div className="flex-1 h-0.5 mx-2 bg-[var(--border)] rounded-full" />}
              </React.Fragment>
            ))}
          </div>

          {/* ── STEP 1: Language Selection ─────────────────────────────── */}
          {step === 1 && (
            <div className="vs-surface rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl border border-[var(--border)]">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--brand-deep)] uppercase tracking-wider mb-1">
                  <Globe className="w-4 h-4 text-[var(--brand)]" /> Step 1 of 3
                </div>
                <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                  {t("selectLanguageTitle")}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">{t("selectLanguageSub")}</p>
              </div>

              {/* Primary language buttons: Hindi, Santali, English */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {primaryLanguages.map((lItem) => {
                  const isSelected = lang === lItem.code;
                  return (
                    <button
                      key={lItem.code}
                      id={`lang-primary-${lItem.code}`}
                      onClick={() => handleSelectLanguage(lItem.code)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between h-28 ${
                        isSelected
                          ? "border-[var(--brand)] bg-[var(--brand-tint)] shadow-md ring-2 ring-[var(--brand-tint2)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--brand-deep)] uppercase tracking-wider">{lItem.script}</span>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[var(--brand)] text-[#0c1a2e] flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-lg font-black text-[var(--text-primary)] leading-tight">{lItem.nativeName}</p>
                        <p className="text-xs font-bold text-[var(--text-muted)] mt-0.5">{lItem.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Button to choose role */}
              <button
                id="btn-proceed-to-role"
                onClick={handleContinueLanguage}
                className="vs-btn-brand w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                {t("proceedToRole")}
              </button>

              {/* Other regional languages — below primary buttons and proceed button */}
              <div className="space-y-2 pt-4 border-t border-[var(--border)]">
                <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                  Other Languages / अन्य भाषाएं
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SUPPORTED_LANGUAGES.filter((l) => !["hi", "sat", "en"].includes(l.code)).map((langItem) => {
                    const sel = lang === langItem.code;
                    const dis = langItem.disabled;
                    return (
                      <button
                        key={langItem.code}
                        id={`lang-other-${langItem.code}`}
                        disabled={dis}
                        onClick={() => !dis && handleSelectLanguage(langItem.code)}
                        className={`p-2.5 rounded-xl border text-left transition ${
                          dis ? "opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)]"
                          : sel ? "border-[var(--brand)] bg-[var(--brand-tint)] font-bold text-[var(--brand-deep)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)] text-[var(--text-primary)]"
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-between">
                          <span>{langItem.nativeName}</span>
                          {dis && <span className="text-[9px] bg-[var(--surface-3)] text-[var(--text-muted)] px-1 rounded">Soon</span>}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)]">{langItem.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Role Selection ─────────────────────────────────── */}
          {step === 2 && (
            <div className="vs-surface rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl border border-[var(--border)] animate-fadeIn">
              <div className="flex items-center justify-between">
                <button id="btn-back-to-lang" onClick={() => setStep(1)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold transition">
                  {t("backToLanguages")}
                </button>
                <span className="text-xs font-bold text-[var(--brand-deep)] bg-[var(--brand-tint)] px-2.5 py-1 rounded-full">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.nativeName || "हिंदी"}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{t("chooseRoleTitle")}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">{t("chooseRoleSub")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Teacher — no badge label */}
                <button id="btn-role-teacher" onClick={() => handleSelectRole("teacher")}
                  className="p-6 rounded-3xl border-2 border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] transition-all text-left space-y-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--brand-tint)] group-hover:bg-[var(--brand)] text-[var(--brand-deep)] group-hover:text-[#0c1a2e] flex items-center justify-center transition">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-[var(--text-primary)]">{t("roleTeacher")}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{t("teacherRoleDesc")}</p>
                  </div>
                  <div className="text-xs font-bold text-[var(--brand-deep)] flex items-center gap-1 group-hover:translate-x-1 transition">
                    {t("teacherLoginTab")} / {t("teacherSignupTab")} <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>

                {/* Student — no badge label */}
                <button id="btn-role-student" onClick={() => handleSelectRole("student")}
                  className="p-6 rounded-3xl border-2 border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--green)] hover:bg-[var(--green-tint)] transition-all text-left space-y-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--green-tint)] group-hover:bg-[var(--green)] text-[var(--green)] group-hover:text-white flex items-center justify-center transition">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-[var(--text-primary)]">{t("roleStudent")}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{t("studentRoleDesc")}</p>
                  </div>
                  <div className="text-xs font-bold text-[var(--green)] flex items-center gap-1 group-hover:translate-x-1 transition">
                    {t("studentRegTitle")} <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3A: Teacher Auth ──────────────────────────────────── */}
          {step === 3 && selectedRole === "teacher" && (
            <div className="vs-surface rounded-3xl p-6 sm:p-8 space-y-5 shadow-xl border border-[var(--border)] animate-fadeIn">
              <div className="flex items-center justify-between">
                <button id="btn-back-to-role" onClick={() => { setStep(2); setAuthError(""); }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold transition">
                  {t("back")}
                </button>
                <span className="text-xs font-bold text-[var(--text-muted)]">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.nativeName || "हिंदी"}
                </span>
              </div>

              {/* Login / Signup tab toggle */}
              <div className="flex rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-1 gap-1">
                <button id="tab-teacher-login"
                  onClick={() => { setTeacherAuthMode("login"); setAuthError(""); }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition ${
                    teacherAuthMode === "login"
                      ? "bg-[var(--brand)] text-[#0c1a2e] shadow-md"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}>
                  {t("teacherLoginTab")}
                </button>
                <button id="tab-teacher-signup"
                  onClick={() => { setTeacherAuthMode("signup"); setAuthError(""); }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition ${
                    teacherAuthMode === "signup"
                      ? "bg-[var(--brand)] text-[#0c1a2e] shadow-md"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}>
                  {t("teacherSignupTab")}
                </button>
              </div>

              {/* ── LOGIN FORM ── */}
              {teacherAuthMode === "login" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--text-primary)]">{t("teacherLoginTitle")}</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{t("teacherLoginSub")}</p>
                  </div>

                  <div className="space-y-3">
                    {/* Name field */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                        {t("loginNameLabel")}
                      </label>
                      <input
                        id="input-login-name"
                        type="text"
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        placeholder={t("loginNamePlaceholder")}
                        className="vs-input w-full px-4 py-3 rounded-xl text-sm font-medium"
                      />
                    </div>

                    {/* Password field */}
                    {passwordField(
                      "input-login-password",
                      loginPassword, setLoginPassword,
                      showLoginPwd, () => setShowLoginPwd(!showLoginPwd),
                      t("passwordLabel"), t("passwordPlaceholder"),
                      handleTeacherLogin
                    )}
                  </div>

                  {authError && (
                    <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
                    </div>
                  )}

                  <button id="btn-teacher-login" onClick={handleTeacherLogin}
                    disabled={isLoading || !loginName.trim() || !loginPassword.trim()}
                    className="vs-btn-brand w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50">
                    {isLoading ? "..." : t("teacherLoginBtn")}
                  </button>

                  <div className="relative flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-[var(--border)]" />
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>

                  <button id="btn-guest-login-from-login" onClick={handleGuestLogin}
                    className="w-full py-3 rounded-xl text-sm font-bold border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)] hover:bg-[var(--brand-tint)] transition flex items-center justify-center gap-2">
                    <span>👤</span> {t("guestLoginBtn")}
                  </button>
                </div>
              )}

              {/* ── SIGNUP FORM ── */}
              {teacherAuthMode === "signup" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--text-primary)]">{t("teacherSignupTitle")}</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{t("teacherSignupSub")}</p>
                  </div>

                  <div className="space-y-3">
                    {/* Name */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{t("nameLabel")}</label>
                      <input id="input-signup-name" type="text" value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder={t("namePlaceholder")}
                        className="vs-input w-full px-4 py-3 rounded-xl text-sm font-medium" />
                    </div>

                    {/* Subject */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{t("subjectLabel")}</label>
                      <input id="input-signup-subject" type="text" value={signupSubject}
                        onChange={(e) => setSignupSubject(e.target.value)}
                        placeholder={t("subjectPlaceholder")}
                        className="vs-input w-full px-4 py-3 rounded-xl text-sm font-medium" />
                    </div>

                    {/* Grade */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{t("gradeLabel")}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((g) => (
                          <button key={g} id={`btn-signup-grade-${g}`} type="button"
                            onClick={() => setSignupGrade(g)}
                            className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                              signupGrade === g
                                ? "bg-[var(--brand)] text-[#0c1a2e] border-[var(--brand)] shadow-sm"
                                : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--brand)]"
                            }`}>
                            {t("class")} {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* School */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                        <School className="w-3.5 h-3.5 text-[var(--brand)]" /> {t("schoolNameLabel")}
                      </label>
                      <input id="input-signup-school" type="text" value={signupSchool}
                        onChange={(e) => setSignupSchool(e.target.value)}
                        placeholder="e.g. Government Primary School, Ranchi"
                        className="vs-input w-full px-4 py-3 rounded-xl text-sm font-medium" />
                    </div>

                    {/* Password */}
                    {passwordField(
                      "input-signup-password",
                      signupPassword, setSignupPassword,
                      showSignupPwd, () => setShowSignupPwd(!showSignupPwd),
                      t("passwordLabel"), t("passwordPlaceholder")
                    )}

                    {/* Confirm Password */}
                    {passwordField(
                      "input-signup-confirm-password",
                      signupConfirmPassword, setSignupConfirmPassword,
                      showSignupConfirmPwd, () => setShowSignupConfirmPwd(!showSignupConfirmPwd),
                      t("confirmPasswordLabel"), t("confirmPasswordPlaceholder"),
                      handleTeacherSignup
                    )}
                  </div>

                  {authError && (
                    <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
                    </div>
                  )}

                  <button id="btn-signup-complete" onClick={handleTeacherSignup}
                    disabled={isLoading || !signupName.trim() || !signupSubject.trim() || !signupSchool.trim() || !signupPassword.trim() || !signupConfirmPassword.trim()}
                    className="vs-btn-brand w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50">
                    {isLoading ? "..." : t("teacherSignupBtn")}
                  </button>

                  <div className="relative flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-[var(--border)]" />
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>

                  <button id="btn-guest-login-from-signup" onClick={handleGuestLogin}
                    className="w-full py-3 rounded-xl text-sm font-bold border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--brand)] hover:text-[var(--brand-deep)] hover:bg-[var(--brand-tint)] transition flex items-center justify-center gap-2">
                    <span>👤</span> {t("guestLoginBtn")}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3B: Student Registration ──────────────────────────── */}
          {step === 3 && selectedRole === "student" && (
            <div className="vs-surface rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl border border-[var(--border)] animate-fadeIn">
              <div className="flex items-center justify-between">
                <button id="btn-back-to-role-student" onClick={() => setStep(2)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold transition">
                  {t("back")}
                </button>
                <span className="text-xs font-bold text-[var(--green)] bg-[var(--green-tint)] px-2.5 py-1 rounded-full flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5" /> {t("roleStudent")}
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">{t("studentRegTitle")}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">{t("studentRegSub")}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{t("fullNameLabel")}</label>
                  <input id="input-student-name" type="text" value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder={t("studentNamePlaceholder")}
                    className="vs-input w-full px-4 py-3 rounded-xl text-sm font-medium" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{t("class")}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((g) => (
                        <button key={g} id={`btn-student-grade-${g}`} type="button"
                          onClick={() => setGrade(g)}
                          className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                            grade === g
                              ? "bg-[var(--brand)] text-[#0c1a2e] border-[var(--brand)] shadow-sm"
                              : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--brand)]"
                          }`}>
                          {t("class")} {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">{t("sectionLabel")}</label>
                    <input id="input-student-section" type="text" value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. A, B, C"
                      className="vs-input w-full px-4 py-2.5 rounded-xl text-sm font-medium uppercase" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                    <School className="w-3.5 h-3.5 text-[var(--brand)]" /> {t("schoolNameLabel")}
                  </label>
                  <input id="input-student-school" type="text" value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Government Primary School, Ranchi"
                    className="vs-input w-full px-4 py-3 rounded-xl text-sm font-medium" />
                </div>
              </div>

              <button id="btn-student-register" onClick={handleStudentRegister}
                disabled={isLoading || !studentName.trim() || !schoolName.trim()}
                className="vs-btn-brand w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-50">
                {isLoading ? "..." : t("completeStudentSignIn")}
              </button>
            </div>
          )}

        </div>
      </main>

      <footer className="text-center py-4 text-[11px] text-[var(--text-muted)] font-medium">
        {t("footerText")}
      </footer>
    </div>
  );
}
