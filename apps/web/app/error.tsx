"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-slate-400 mb-8">An unexpected error occurred. Please try again.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="h-12 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="h-12 px-8 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors flex items-center"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
