"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaContextType {
  deferredPrompt: BeforeInstallPromptEvent | null;
  install: () => Promise<void>;
  isInstallable: boolean;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setDeferredPrompt(null);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <PwaContext.Provider value={{ deferredPrompt, install, isInstallable: !!deferredPrompt }}>
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (context === undefined) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
}

export function PwaInstallPrompt() {
  const { deferredPrompt, install } = usePwa();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (deferredPrompt) {
      const dismissed = localStorage.getItem("pwa-install-dismissed");
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setShowBanner(true);
      }
    } else {
      setShowBanner(false);
    }
  }, [deferredPrompt]);

  const handleInstall = async () => {
    await install();
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[200] animate-in slide-in-from-bottom duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 shadow-2xl shadow-blue-500/30 border border-blue-400/30 flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl shrink-0">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Install App</p>
          <p className="text-blue-100 text-xs truncate">Get ServiceSync on your home screen</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="bg-white text-blue-600 font-bold text-xs px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors shrink-0"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/60 hover:text-white transition-colors shrink-0 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
