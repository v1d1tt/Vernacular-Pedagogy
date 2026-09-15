"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Camera, X, Loader2 } from "lucide-react";

interface QrScannerProps {
  onScan: (text: string) => void;
  onClose: () => void;
}

/**
 * Camera QR scanner (teacher's class-join QR).
 * Dynamically imports html5-qrcode so it only loads when opened.
 * Works in browser + Capacitor WebView (CAMERA permission in manifest).
 */
export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const { t } = useLanguage();
  const regionId = useRef(`qr-region-${Math.floor(Math.random() * 1e6)}`);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId.current);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            // Stop immediately so the same code isn't read twice.
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                try {
                  scanner.clear();
                } catch {}
                onScanRef.current(decodedText);
              });
          },
          () => {
            // frame with no QR — ignore silently
          }
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setStarting(false);
          setError(
            e instanceof Error && /permission|denied|NotAllowed/i.test(e.message)
              ? t("qrCameraDenied", "Camera blocked — allow camera access and retry, or type the code manually.")
              : t("qrCameraError", "Could not start the camera. Type the code manually instead.")
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .catch(() => {})
          .finally(() => {
            try {
              s.clear();
            } catch {}
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
          <Camera className="w-4 h-4 text-[var(--brand-deep)]" />
          {t("qrScanTitle", "Scan teacher's QR")}
        </p>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <p className="text-xs font-bold text-[var(--red)] bg-[var(--red-tint)] px-3 py-2 rounded-xl">
          {error}
        </p>
      ) : (
        <>
          <div
            id={regionId.current}
            className="w-full rounded-2xl overflow-hidden border border-[var(--border)] bg-black min-h-[240px]"
          />
          {starting && (
            <p className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("qrStarting", "Starting camera… point at the QR code")}
            </p>
          )}
          {!starting && (
            <p className="text-[11px] text-[var(--text-muted)] text-center">
              {t("qrHint", "Point your camera at the QR shown on the teacher's screen")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Parses a scanned class-join payload.
 * Accepts the full join URL (.../student?server=<edge>&code=<CODE>)
 * or a bare 6-character class code.
 */
export function parseJoinQr(text: string): { code: string; server?: string } | null {
  const clean = (text || "").trim();
  if (!clean) return null;
  try {
    if (/^https?:\/\//i.test(clean)) {
      const url = new URL(clean);
      const code = (url.searchParams.get("code") || "").trim().toUpperCase();
      const server = (url.searchParams.get("server") || "").trim();
      if (code) return { code, server: server || undefined };
      return null;
    }
  } catch {
    // not a URL — fall through to bare-code handling
  }
  const bare = clean.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (bare.length >= 4 && bare.length <= 8) return { code: bare };
  return null;
}
