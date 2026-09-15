"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { LanguageCode, AppLanguage, APP_LANGUAGES, TRANSLATIONS } from "@/lib/translations";

interface LanguageContextValue {
  lang: LanguageCode;
  setLang: (code: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  currentLanguage: AppLanguage;
  supportedLanguages: AppLanguage[];
}

const defaultLanguage = APP_LANGUAGES[0]; // Hindi as default, or English if saved

const LanguageCtx = createContext<LanguageContextValue>({
  lang: "hi",
  setLang: () => {},
  t: (key: string, fallback?: string) => fallback || key,
  currentLanguage: defaultLanguage,
  supportedLanguages: APP_LANGUAGES,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>("hi");

  useEffect(() => {
    try {
      const savedVs = localStorage.getItem("vs-app-lang") as LanguageCode | null;
      const savedUser = localStorage.getItem("user_lang") as LanguageCode | null;
      const saved = savedVs || savedUser;
      if (saved && APP_LANGUAGES.some((l) => l.code === saved)) {
        setLangState(saved);
        // ensure both keys are in sync on load
        try {
          localStorage.setItem("vs-app-lang", saved);
          // keep user_lang in sync only if it was already set (preserve onboarding flow)
          if (savedUser && savedUser !== saved) localStorage.setItem("user_lang", saved);
        } catch {}
      }
    } catch {
      // localStorage not accessible
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "vs-app-lang" || e.key === "user_lang") {
        const val = (e.newValue as LanguageCode | null);
        if (val && APP_LANGUAGES.some((l) => l.code === val)) {
          setLangState(val);
        }
      }
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as LanguageCode | undefined;
      if (detail && APP_LANGUAGES.some((l) => l.code === detail)) {
        setLangState(detail);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("vs-lang-change", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("vs-lang-change", onCustom as EventListener);
    };
  }, []);

  const setLang = useCallback((newLang: LanguageCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem("vs-app-lang", newLang);
      localStorage.setItem("user_lang", newLang);
      const found = APP_LANGUAGES.find((l) => l.code === newLang);
      if (found) localStorage.setItem("user_lang_name", found.name);
      // notify all tabs / components that bypass React context (studentLang local state)
      window.dispatchEvent(new CustomEvent("vs-lang-change", { detail: newLang }));
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const activeDict = TRANSLATIONS[lang];
      if (activeDict && activeDict[key]) {
        return activeDict[key];
      }
      // fallback to Hindi, then English, then fallback param, then key
      if (TRANSLATIONS.hi && TRANSLATIONS.hi[key]) {
        return TRANSLATIONS.hi[key];
      }
      if (TRANSLATIONS.en && TRANSLATIONS.en[key]) {
        return TRANSLATIONS.en[key];
      }
      return fallback !== undefined ? fallback : key;
    },
    [lang]
  );

  const currentLanguage = APP_LANGUAGES.find((l) => l.code === lang) || defaultLanguage;

  return (
    <LanguageCtx.Provider
      value={{
        lang,
        setLang,
        t,
        currentLanguage,
        supportedLanguages: APP_LANGUAGES,
      }}
    >
      {children}
    </LanguageCtx.Provider>
  );
}

export const useLanguage = () => useContext(LanguageCtx);
