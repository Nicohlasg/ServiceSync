"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type BgKey = "slava" | "winston";

const BG_STORAGE_KEY = "ss-bg";
const DEFAULT_BG: BgKey = "slava";

export const BG_META: Record<BgKey, { src: string; label: string; credit: string }> = {
  slava: {
    src: "/backgrounds/bg-slava.jpg",
    label: "City Lights",
    credit: "Slava Auchynnikau",
  },
  winston: {
    src: "/backgrounds/bg-winston.jpg",
    label: "Serene Nature",
    credit: "Winston Tjia",
  },
};

interface BackgroundContextValue {
  bg: BgKey;
  setBg: (bg: BgKey) => void;
}

const BackgroundContext = createContext<BackgroundContextValue>({
  bg: DEFAULT_BG,
  setBg: () => {},
});

export function useBackground() {
  return useContext(BackgroundContext);
}

function applyBackground(key: BgKey) {
  const src = BG_META[key].src;
  // Set directly on <html> so it sits beneath all content with no z-index tricks
  document.documentElement.style.backgroundImage = `url(${src})`;
  document.documentElement.style.backgroundSize = "cover";
  document.documentElement.style.backgroundPosition = "center center";
  document.documentElement.style.backgroundAttachment = "fixed";
  document.documentElement.style.backgroundRepeat = "no-repeat";
}

const NOISE =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const [bg, setBgState] = useState<BgKey>(DEFAULT_BG);

  // Apply initial background and restore from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(BG_STORAGE_KEY) as BgKey | null;
    const initial = (stored === "slava" || stored === "winston") ? stored : DEFAULT_BG;
    setBgState(initial);
    applyBackground(initial);
  }, []);

  const setBg = (newBg: BgKey) => {
    if (newBg === bg) return;
    setBgState(newBg);
    localStorage.setItem(BG_STORAGE_KEY, newBg);
    applyBackground(newBg);
  };

  return (
    <BackgroundContext.Provider value={{ bg, setBg }}>
      {/* Colour-grade overlay — sits above html background, below page content */}
      <div
        aria-hidden="true"
        className="fixed inset-0 glass-bg-overlay pointer-events-none"
        style={{ zIndex: 0 }}
      />
      {/* Film grain */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{ zIndex: 0, backgroundImage: NOISE }}
      />
      {/* Page content — z-index 1 keeps it above the overlay divs */}
      <div className="relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </BackgroundContext.Provider>
  );
}
