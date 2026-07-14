"use client";

import { useEffect } from "react";

interface FullPageLoaderProps {
  onComplete: () => void;
}

export function FullPageLoader({ onComplete }: FullPageLoaderProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <h1 className="text-white/60 text-xl tracking-[0.3em] font-light">
        digital gold
      </h1>
      <div className="mt-6 flex gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-[pulse-dot_1.2s_ease-in-out_infinite]" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-[pulse-dot_1.2s_ease-in-out_0.4s_infinite]" />
        <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-[pulse-dot_1.2s_ease-in-out_0.8s_infinite]" />
      </div>
    </div>
  );
}
