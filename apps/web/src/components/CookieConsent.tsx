"use client";

import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      // Small delay so it doesn't pop up instantly
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShow(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[250] animate-in slide-in-from-bottom duration-500">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl max-w-lg mx-auto">
        <div className="flex items-start gap-3">
          <div className="bg-amber-500/20 p-2 rounded-xl shrink-0 mt-0.5">
            <Cookie className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm mb-1">Cookie Notice</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              We use essential cookies to keep you logged in and functional cookies to improve your experience. No third-party tracking.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAccept}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
              >
                Accept
              </button>
              <button
                onClick={handleDecline}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-xs px-4 py-2 rounded-lg transition-colors"
              >
                Essential Only
              </button>
            </div>
          </div>
          <button
            onClick={handleDecline}
            className="text-slate-500 hover:text-white transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
