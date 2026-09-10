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
      const saved = localStorage.getItem("vs-app-lang") as LanguageCode | null;
      if (saved && APP_LANGUAGES.some((l) => l.code === saved)) {
        setLangState(saved);
      }
    } catch {
      // localStorage not accessible
    }
  }, []);

  const setLang = useCallback((newLang: LanguageCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem("vs-app-lang", newLang);
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
