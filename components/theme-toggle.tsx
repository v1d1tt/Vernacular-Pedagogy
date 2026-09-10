"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={`p-2 rounded-xl transition-all ${
        theme === "dark"
          ? "bg-[var(--surface-2)] text-[var(--brand)] hover:bg-[var(--brand-tint)]"
          : "bg-[var(--surface-2)] text-[var(--brand-deep)] hover:bg-[var(--brand-tint)]"
      } ${className}`}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
