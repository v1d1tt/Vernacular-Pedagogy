"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface MascotProps {
  src: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Mascot({ src, width = 300, height = 300, className }: MascotProps) {
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
      <DotLottieReact
        src={src}
        loop
        autoplay
      />
    </div>
  );
}
