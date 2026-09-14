"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/components/language-provider";
import { LanguageCode } from "@/lib/translations";
import { Globe, Check, ChevronDown } from "lucide-react";

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, supportedLanguages, currentLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        aria-label={t("switchLanguage", "Change language")}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--brand-tint)] text-[var(--brand-deep)] transition border border-[var(--border)] text-xs font-bold"
      >
        <Globe className="w-4 h-4 text-[var(--brand)]" />
        <span className="font-semibold text-[var(--text-primary)] hidden xs:inline sm:inline">
          {currentLanguage.nativeName}
        </span>
        <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-2xl vs-surface border border-[var(--border)] shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border-sub)]">
            {t("switchLanguage", "Language / भाषा")}
          </div>
          <div className="py-1 max-h-72 overflow-y-auto">
            {supportedLanguages.map((item) => {
              const active = item.code === lang;
              const isDisabled = item.disabled;
              return (
                <button
                  key={item.code}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    setLang(item.code as LanguageCode);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition ${isDisabled
                    ? "opacity-50 cursor-not-allowed bg-transparent"
                    : active
                      ? "bg-[var(--brand-tint)] text-[var(--brand-deep)] font-bold"
                      : "text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                    }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-xs">{item.nativeName}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{item.name}</span>
                  </div>
                  {isDisabled ? (
                    <span className="text-[9px] font-extrabold uppercase tracking-wider bg-[var(--surface-2)] text-[var(--text-muted)] px-1.5 py-0.5 rounded">
                      {item.badge || "Soon"}
                    </span>
                  ) : (
                    active && <Check className="w-3.5 h-3.5 text-[var(--brand)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
