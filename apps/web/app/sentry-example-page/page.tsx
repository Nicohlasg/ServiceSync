"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold mb-6">Sentry Verification Page</h1>
        <p className="text-slate-400 mb-8">
          Click the button below to trigger a test error and verify your Sentry integration.
        </p>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              console.log("Triggering Sentry test error...");
              throw new Error("Sentry Test Error: Client-side verification");
            }}
            className="h-12 px-8 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors"
          >
            Trigger Client Error
          </button>

          <button
            onClick={async () => {
              await fetch("/api/sentry-test");
            }}
            className="h-12 px-8 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
          >
            Trigger Server Error (via API)
          </button>

          <button
            onClick={() => {
              console.log("Triggering Sentry test log...");
              // @ts-ignore - logger is available on Sentry in v10
              Sentry.logger.info('User triggered test log', { log_source: 'sentry_test' });
              alert("Log triggered! Check your Sentry Logs page.");
            }}
            className="h-12 px-8 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors"
          >
            Trigger Test Log
          </button>

          <button
            onClick={() => {
              console.log("Triggering Sentry test metric...");
              Sentry.metrics.count('test_metric', 1);
              alert("Metric triggered! Check your Sentry Metrics page.");
            }}
            className="h-12 px-8 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors"
          >
            Trigger Test Metric
          </button>
        </div>
      </div>
    </div>
  );
}
