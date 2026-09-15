"use client";

import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface LottieAnimationProps {
  /** Path to the .lottie or .json file, relative to /public — e.g. "/animations/education.lottie" */
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible label for screen readers */
  label?: string;
}

/**
 * Thin "use client" wrapper around DotLottieReact.
 * Safe to import from any Server or Client Component.
 */
export function LottieAnimation({
  src,
  loop = true,
  autoplay = true,
  className,
  style,
  label,
}: LottieAnimationProps) {
  return (
    <div
      role="img"
      aria-label={label ?? "animation"}
      className={className}
      style={style}
    >
      <DotLottieReact src={src} loop={loop} autoplay={autoplay} />
    </div>
  );
}
