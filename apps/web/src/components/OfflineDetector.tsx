"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let isActive = true;

    const verifyConnectivity = async () => {
      if (typeof window === "undefined") {
        return;
      }

      if (!navigator.onLine) {
        if (isActive) {
          setIsOffline(true);
        }
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 4000);
        const response = await fetch(`/manifest.json?online-check=${Date.now()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (isActive) {
          setIsOffline(!response.ok);
        }
      } catch {
        if (isActive) {
          setIsOffline(true);
        }
      }
    };

    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      void verifyConnectivity();
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void verifyConnectivity();
      }
    }, 30000);
    void verifyConnectivity();

    return () => {
      isActive = false;
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.clearInterval(intervalId);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[300] bg-amber-600 text-white text-center py-2 px-4 flex items-center justify-center gap-2 animate-in slide-in-from-top duration-200">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="text-sm font-bold">You are offline. Some features may not work.</span>
    </div>
  );
}
