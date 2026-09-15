"use client";

import React, { useState } from "react";

/**
 * HotspotModeHelp — collapsible, fully-offline classroom checklist.
 * Shown inside the "Set server" modals so teachers can get two devices
 * talking with no internet and no router.
 */
export function HotspotModeHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 text-left text-xs font-bold text-[var(--brand-deep)] flex items-center justify-between"
      >
        <span>📶 No internet / no router? Use hotspot mode (fully offline)</span>
        <span className="text-[var(--text-muted)]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <ol className="px-4 pb-4 pt-1 space-y-2 text-[11px] text-[var(--text-secondary)] list-decimal list-inside leading-relaxed">
          <li>
            <span className="font-bold text-[var(--text-primary)]">Start the server on the laptop: </span>
            <span className="font-mono">python server/main.py</span> (leave it running).
          </li>
          <li>
            <span className="font-bold text-[var(--text-primary)]">Create a network with no internet needed: </span>
            turn on the hotspot on the teacher&apos;s phone (or laptop) and join the second phone + the laptop to it.
          </li>
          <li>
            <span className="font-bold text-[var(--text-primary)]">Enter the gateway address above: </span>
            Android hotspot → <span className="font-mono">http://192.168.43.1:8000</span>, iPhone/Mac hotspot →{" "}
            <span className="font-mono">http://172.20.10.1:8000</span>, Windows hotspot →{" "}
            <span className="font-mono">http://192.168.137.1:8000</span>. Same URL on{" "}
            <span className="font-bold">both</span> devices.
          </li>
          <li>
            <span className="font-bold text-[var(--text-primary)]">Check both banners turn green </span>
            (“Edge server connected”). If not, confirm all three devices are on the hotspot and retry.
          </li>
          <li>
            Teacher taps <span className="font-bold">Start Class</span>, reads the 6-char CODE aloud; student enters
            it under <span className="font-bold">CLASS → Change</span>. Voice, quizzes and raise-hand then work with
            zero internet.
          </li>
        </ol>
      )}
    </div>
  );
}
