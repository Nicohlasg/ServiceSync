import {
  Sparkles,
  Briefcase,
  Users,
  FileText,
  UserCircle,
  Clock,
  type LucideIcon,
} from 'lucide-react';

// Coachmark tour — users learn by tapping real UI, not reading slideshows.
// Each interactive step names a `targetSelector` found via `data-tutorial-target`.
// If the target isn't in the current DOM, the overlay falls back to a centered
// card with a `Go to …` CTA that routes to `ctaRoute`.
//
// Copy lives in `messages/<locale>.json → tutorial.<translationKey>.{title,body}`.

export type TutorialStepConfig = {
  id: string;
  translationKey:
    | 'welcome'
    | 'addService'
    | 'addClient'
    | 'collectPayment'
    | 'profile'
    | 'workingHours'
    | 'ready';
  icon: LucideIcon;
  /** CSS selector for the element to highlight. `null` = centered card. */
  targetSelector: string | null;
  /** Pathname the target lives on, used to decide if we need a route hop. */
  route?: string;
  /** Where to send the user when the target is not in the current DOM. */
  ctaRoute?: string;
  /** Label key under `tutorial.*` for the center-card CTA button. */
  ctaLabelKey?: 'goToDashboard' | 'goToProfile';
};

export const TUTORIAL_STEPS: ReadonlyArray<TutorialStepConfig> = [
  { id: 'welcome', translationKey: 'welcome', icon: Sparkles, targetSelector: null },
  {
    id: 'addService',
    translationKey: 'addService',
    icon: Briefcase,
    targetSelector: '[data-tutorial-target="nav-services"]',
    route: '/dashboard',
    ctaRoute: '/dashboard',
    ctaLabelKey: 'goToDashboard',
  },
  {
    id: 'addClient',
    translationKey: 'addClient',
    icon: Users,
    targetSelector: '[data-tutorial-target="nav-clients"]',
    route: '/dashboard',
    ctaRoute: '/dashboard',
    ctaLabelKey: 'goToDashboard',
  },
  {
    id: 'collectPayment',
    translationKey: 'collectPayment',
    icon: FileText,
    targetSelector: '[data-tutorial-target="collect-payment"]',
    route: '/dashboard',
    ctaRoute: '/dashboard',
    ctaLabelKey: 'goToDashboard',
  },
  {
    id: 'profile',
    translationKey: 'profile',
    icon: UserCircle,
    targetSelector: '[data-tutorial-target="profile-link"]',
    route: '/dashboard',
    ctaRoute: '/dashboard',
    ctaLabelKey: 'goToDashboard',
  },
  {
    id: 'workingHours',
    translationKey: 'workingHours',
    icon: Clock,
    targetSelector: '[data-tutorial-target="working-hours"]',
    route: '/dashboard/profile',
    ctaRoute: '/dashboard/profile',
    ctaLabelKey: 'goToProfile',
  },
  { id: 'ready', translationKey: 'ready', icon: Sparkles, targetSelector: null },
];

export const TUTORIAL_TOTAL_STEPS = TUTORIAL_STEPS.length;
