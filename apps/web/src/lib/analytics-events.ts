import { trackEvent } from './analytics';
import type { Locale } from '@/i18n/config';

// Masterplan §9 — strongly-typed onboarding-funnel event taxonomy.
//
// The discriminated union below is the single source of truth for event
// names + payload shapes. A typo in a stage name or a missing field will
// fail `tsc` at the call site rather than slipping into production with
// silent console.debug output.
//
// Wire-up status (2026-04-15):
//   ✅ language_selected  — LocalePicker.tsx
//   ✅ checklist_item_completed, checklist_dismissed — OnboardingChecklist.tsx
//   ✅ tutorial_* — TutorialOverlay.tsx (pre-existing, names aligned)
//   ⏳ landing_viewed, signup_started, signup_submitted, email_verified,
//      pwa_installed, wizard_started, wizard_completed, first_invoice_sent,
//      first_booking_received — pending host pages (tracked in masterplan
//      Tasks 1–6 and invoice/booking surfaces).

export type OnboardingStage = 'landing' | 'signup' | 'wizard' | 'profile';
export type ChecklistItemName = 'first_service' | 'first_client' | 'paynow_preview';
export type BookingSource = 'public_link' | 'manual';

export type OnboardingEvent =
  | { name: 'onboarding_landing_viewed'; locale: Locale; utm_source?: string }
  | { name: 'onboarding_language_selected'; locale: Locale; stage: OnboardingStage }
  | { name: 'onboarding_signup_started'; locale: Locale }
  | { name: 'onboarding_signup_submitted'; locale: Locale }
  | { name: 'onboarding_email_verified'; delay_seconds: number }
  | { name: 'onboarding_pwa_installed' }
  | { name: 'onboarding_wizard_started'; locale: Locale }
  | { name: 'onboarding_wizard_completed'; locale: Locale; duration_seconds: number }
  | { name: 'onboarding_checklist_item_completed'; item: ChecklistItemName }
  | { name: 'onboarding_checklist_dismissed'; items_completed: number }
  | { name: 'onboarding_first_invoice_sent'; amount_cents: number; currency: 'SGD' }
  | { name: 'onboarding_first_booking_received'; source: BookingSource };

export function trackOnboardingEvent(event: OnboardingEvent): void {
  const { name, ...properties } = event;
  trackEvent(name, properties);
}
