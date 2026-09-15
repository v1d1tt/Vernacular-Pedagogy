"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/components/language-provider";

export interface AvatarGuideProps {
  message?: string | null;
  state?: "idle" | "thinking" | "happy" | "encouraging" | "celebrating" | "hint";
  showHint?: boolean;
  hintText?: string | null;
  className?: string;
}

const avatarMessages: Record<string, Record<string, string>> = {
  idle: {
    en: "Hi, I'm Vani! Ready to learn?",
    hi: "नमस्ते, मैं वानी हूँ! सीखने के लिए तैयार?",
    sat: "ᱡᱚᱦᱟᱨ, ᱤᱧ ᱵᱟᱱᱤ ᱠᱟᱹᱱᱟᱹᱧ! ᱪᱮᱫᱚᱜ ᱞᱟᱹᱜᱤᱫ ᱥᱟᱯᱲᱟᱣ?",
    bn: "হাই, আমি ভানি! শিখতে প্রস্তুত?",
    mr: "नमस्कार, मी वानी! शिकायला तयार?",
    ta: "வணக்கம், நான் வானி! கற்கத் தயாரா?",
    te: "హాయ్, నేను వాణి! నేర్చుకోవడానికి సిద్ధమా?",
  },
  thinking: {
    en: "Hmm, let me think...",
    hi: "हम्म, सोचते हैं...",
    sat: "ᱦᱟᱹᱜ, ᱟᱢᱟᱜ ᱵᱩᱡᱷᱟᱹᱣ...",
    bn: "হুম, চিন্তা করি...",
    mr: "हंम, विचार करतो...",
    ta: "ஹும், நான் சிந்திக்கிறேன்...",
    te: "హమ్, నేను ఆలోచిస్తున్నాను...",
  },
  happy: {
    en: "Great job! 🌟",
    hi: "शाबाश! 🌟",
    sat: "ᱵᱮᱥ! 🌟",
    bn: "সাবাশ! 🌟",
    mr: "शाब्बास! 🌟",
    ta: "அருமை! 🌟",
    te: "చాలా బాగుంది! 🌟",
  },
  encouraging: {
    en: "You can do it! Keep going!",
    hi: "तुम कर सकते हो! जारी रखो!",
    sat: "ᱟᱢ ᱵᱟᱱ ᱢᱟᱜ! ᱟᱹᱰᱤ ᱟᱸᱡᱚᱢ!",
    bn: "তুমি পারবে! চলতে থাকো!",
    mr: "तुम्ही करू शकता! सुरू ठेवा!",
    ta: "நீங்கள் முடியும்! தொடரவும்!",
    te: "మీరు చేయవచ్చు! కొనసాగించండి!",
  },
  celebrating: {
    en: "Amazing! You nailed it! 🎉",
    hi: "कमाल! तुमने कर दिखाया! 🎉",
    sat: "ᱟᱹᱰᱤ! ᱟᱢ ᱵᱟᱱ ᱠᱟᱱᱟᱜ! 🎉",
    bn: "অদ্ভুত! তুমি সফল হলেও! 🎉",
    mr: "अद्भुत! तुम्ही यशस्वी झालात! 🎉",
    ta: "அதிசயம்! நீங்கள் வெற்றி பெற்றீர்கள்! 🎉",
    te: "అద్భుతం! మీరు విజయించారు! 🎉",
  },
  hint: {
    en: "💡 Hint: ",
    hi: "💡 संकेत: ",
    sat: "💡 ᱦᱤᱸᱛ: ",
    bn: "💡 ইঙ্গিত: ",
    mr: "💡 सूचना: ",
    ta: "💡 குறிப்பு: ",
    te: "💡 సూచన: ",
  },
};

// Vani the parrot 🦜 — mascot expression + ring per mood.
const MOOD: Record<
  string,
  { badge: string; ring: string; bg: string; bounce: boolean }
> = {
  idle: { badge: "👋", ring: "var(--brand-tint2)", bg: "var(--brand-tint)", bounce: false },
  thinking: { badge: "💭", ring: "var(--violet-tint)", bg: "var(--violet-tint)", bounce: false },
  happy: { badge: "⭐", ring: "var(--green-tint)", bg: "var(--green-tint)", bounce: true },
  encouraging: { badge: "💪", ring: "var(--brand-tint2)", bg: "var(--brand-tint)", bounce: false },
  celebrating: { badge: "🎉", ring: "var(--amber-tint)", bg: "var(--amber-tint)", bounce: true },
  hint: { badge: "💡", ring: "var(--amber-tint)", bg: "var(--amber-tint)", bounce: false },
};

export function AvatarGuide({
  message,
  state = "idle",
  showHint = false,
  hintText,
  className = "",
}: AvatarGuideProps) {
  const { lang } = useLanguage();
  const [popKey, setPopKey] = useState(0);

  // Re-trigger the pop animation every time the mood changes.
  useEffect(() => {
    setPopKey((k) => k + 1);
  }, [state]);

  const getMessage = () => {
    if (message) return message;
    if (showHint && hintText) {
      const hintPrefix = avatarMessages.hint[lang] || avatarMessages.hint.en;
      return hintPrefix + hintText;
    }
    return avatarMessages[state]?.[lang] || avatarMessages[state]?.en || "";
  };

  const mood = MOOD[state] || MOOD.idle;

  return (
    <div
      className={`vs-surface rounded-2xl p-3.5 flex items-center gap-3.5 animate-vani-fade-in ${className}`}
    >
      {/* Mascot */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div
          key={popKey}
          className={`relative w-[72px] h-[72px] rounded-full flex items-center justify-center text-[44px] leading-none shadow-md animate-vani-float ${
            mood.bounce ? "animate-vani-bounce" : ""
          }`}
          style={{ backgroundColor: mood.bg, border: `3px solid ${mood.ring}` }}
          role="img"
          aria-label="Vani the learning buddy"
        >
          <span className="translate-y-[-2px]">🦜</span>
          <span className="absolute -bottom-1 -right-1 text-xl leading-none drop-shadow">
            {mood.badge}
          </span>
          {state === "celebrating" && (
            <>
              <span className="absolute -top-2 -left-2 text-base animate-vani-bounce">⭐</span>
              <span className="absolute top-0 -right-3 text-base animate-vani-bounce">✨</span>
            </>
          )}
        </div>
        <span className="text-[10px] font-black tracking-widest text-[var(--brand-deep)] uppercase">
          Vani
        </span>
      </div>

      {/* Speech bubble */}
      <div
        className={`relative flex-1 px-4 py-3 rounded-2xl border text-left ${
          showHint
            ? "bg-[var(--amber-tint)] border-[var(--amber-tint)]"
            : "bg-[var(--surface-2)] border-[var(--border)]"
        }`}
      >
        {/* Tail pointing at Vani */}
        <div
          className={`absolute left-[-7px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[7px] border-y-transparent border-r-[7px] ${
            showHint ? "border-r-[var(--amber-tint)]" : "border-r-[var(--surface-2)]"
          }`}
        />
        <p className="text-sm font-bold text-[var(--text-primary)] leading-relaxed">
          {getMessage()}
        </p>
      </div>
    </div>
  );
}

export function useAvatarGuide() {
  const [state, setState] = useState<"idle" | "thinking" | "happy" | "encouraging" | "celebrating" | "hint">("idle");
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const say = (newState: typeof state, msg?: string, hint?: string) => {
    if (timer.current) clearTimeout(timer.current);
    setState(newState);
    setCustomMessage(msg || null);
    setHintText(hint || null);
    if (newState !== "idle" && newState !== "hint") {
      timer.current = setTimeout(() => {
        setState("idle");
        setCustomMessage(null);
      }, 3000);
    }
  };

  return {
    state,
    message: customMessage,
    hintText,
    say,
    thinking: (msg?: string) => say("thinking", msg),
    happy: (msg?: string) => say("happy", msg),
    encourage: (msg?: string) => say("encouraging", msg),
    celebrate: (msg?: string) => say("celebrating", msg),
    hint: (text: string) => say("hint", undefined, text),
  };
}
