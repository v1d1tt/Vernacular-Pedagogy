"use client";

import React, { useEffect, useRef } from "react";

interface MicWaveformProps {
  isSpeaking: boolean;
  color?: string;
  barCount?: number;
  className?: string;
}

export function MicWaveform({
  isSpeaking,
  color = "var(--brand)",
  barCount = 12,
  className = "",
}: MicWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / (barCount * 1.5);
      const gap = barWidth * 0.5;

      for (let i = 0; i < barCount; i++) {
        let barHeight = height * 0.15;
        if (isSpeaking) {
          const sinVal = Math.sin(phase + i * 0.5);
          const noise = Math.random() * 0.3;
          barHeight = Math.max(height * 0.2, height * (0.3 + 0.5 * Math.abs(sinVal) + noise));
        }

        const x = i * (barWidth + gap) + gap;
        const y = (height - barHeight) / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }

      phase += 0.15;
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isSpeaking, color, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={32}
      className={`inline-block ${className}`}
    />
  );
}
