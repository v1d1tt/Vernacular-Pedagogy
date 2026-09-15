"use client";

import React, { useState, useEffect } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface MascotProps {
  src: string;
  width?: number | string;
  height?: number | string;
  className?: string;
}

export function Mascot({ src, width = 300, height = 300, className = "" }: MascotProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`flex items-center justify-center ${className}`} style={{ width, height }} />;
  }

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
      <DotLottieReact
        src={src}
        loop
        autoplay
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}


