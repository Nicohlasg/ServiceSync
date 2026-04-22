/**
 * ServiceSync Analytics & Error Monitoring
 * 
 * Lightweight analytics stubs ready for production integration.
 * Replace these with real services (Vercel Analytics, PostHog, Sentry, etc.)
 * when ready to scale.
 */

// ---------- Analytics (7.7) ----------

export function trackPageView(page: string) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[Analytics] Page view:", page);
  }
  // TODO: Replace with Vercel Analytics, PostHog, or Plausible
  // Example: posthog.capture("$pageview", { $current_url: page });
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[Analytics] Event:", name, properties);
  }
  // TODO: Replace with real analytics
  // Example: posthog.capture(name, properties);
}

// ---------- Error Monitoring (7.8) ----------

export function captureError(error: Error | string, context?: Record<string, unknown>) {
  const errorObj = typeof error === "string" ? new Error(error) : error;

  if (process.env.NODE_ENV === "development") {
    console.error("[ErrorMonitor]", errorObj.message, context);
  }

  // TODO: Replace with Sentry, LogRocket, or Bugsnag
  // Example: Sentry.captureException(errorObj, { extra: context });
}

export function setUser(userId: string | null) {
  if (process.env.NODE_ENV === "development") {
    console.debug("[Analytics] Set user:", userId);
  }
  // TODO: Replace with real user identification
  // Example: posthog.identify(userId);
  // Example: Sentry.setUser(userId ? { id: userId } : null);
}
