import {
  Sparkles,
  Briefcase,
  Users,
  FileText,
  UserCircle,
  Copy,
  ExternalLink,
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
    | 'addServiceBtn'
    | 'serviceDetails'
    | 'addClient'
    | 'addClientBtn'
    | 'clientDetails'
    | 'collectPayment'
    | 'invoiceDetails'
    | 'profile'
    | 'editProfile'
    | 'copyLink'
    | 'viewServicePage'
    | 'ready';
  icon: LucideIcon;
  /** CSS selector for the element to highlight. `null` = centered card. */
  targetSelector: string | null;
  /** Pathname the target lives on, used to decide if we need a route hop. */
  route?: string;
  /** Where to send the user when the target is not in the current DOM. */
  ctaRoute?: string;
  /** Label key under `tutorial.*` for the center-card CTA button. */
  ctaLabelKey?: 'goToDashboard' | 'goToProfile' | 'goToServices' | 'goToClients' | 'goToAddClient' | 'goToInvoice';
  /** Where the popup card should appear. Default `'auto'`. */
  popupPosition?: 'auto' | 'bottom-right';
  /** If set, tapping the target navigates here instead of just advancing. */
  navigateOnTap?: string;
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
    id: 'addServiceBtn',
    translationKey: 'addServiceBtn',
    icon: Briefcase,
    targetSelector: '[data-tutorial-target="add-service-btn"]',
    route: '/dashboard/services',
    ctaRoute: '/dashboard/services',
    ctaLabelKey: 'goToServices',
  },
  {
    id: 'serviceDetails',
    translationKey: 'serviceDetails',
    icon: Briefcase,
    targetSelector: '[data-tutorial-target="service-form"]',
    route: '/dashboard/services',
    ctaRoute: '/dashboard/services',
    ctaLabelKey: 'goToServices',
    popupPosition: 'bottom-right',
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
    id: 'addClientBtn',
    translationKey: 'addClientBtn',
    icon: Users,
    targetSelector: '[data-tutorial-target="add-client-btn"]',
    route: '/dashboard/clients',
    ctaRoute: '/dashboard/clients',
    ctaLabelKey: 'goToClients',
  },
  {
    id: 'clientDetails',
    translationKey: 'clientDetails',
    icon: Users,
    targetSelector: '[data-tutorial-target="client-form"]',
    route: '/dashboard/clients/add',
    ctaRoute: '/dashboard/clients/add',
    ctaLabelKey: 'goToAddClient',
    popupPosition: 'bottom-right',
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
    id: 'invoiceDetails',
    translationKey: 'invoiceDetails',
    icon: FileText,
    targetSelector: '[data-tutorial-target="invoice-form"]',
    route: '/dashboard/invoices/new',
    ctaRoute: '/dashboard/invoices/new',
    ctaLabelKey: 'goToInvoice',
    popupPosition: 'bottom-right',
  },
  {
    id: 'profile',
    translationKey: 'profile',
    icon: UserCircle,
    targetSelector: '[data-tutorial-target="profile-link"]',
    route: '/dashboard',
    ctaRoute: '/dashboard',
    ctaLabelKey: 'goToDashboard',
    /** When the user taps the avatar, navigate to profile and advance. */
    navigateOnTap: '/dashboard/profile',
  },
  {
    id: 'editProfile',
    translationKey: 'editProfile',
    icon: UserCircle,
    targetSelector: '[data-tutorial-target="edit-profile-btn"]',
    route: '/dashboard/profile',
    ctaRoute: '/dashboard/profile',
    ctaLabelKey: 'goToProfile',
  },
  {
    id: 'copyLink',
    translationKey: 'copyLink',
    icon: Copy,
    targetSelector: '[data-tutorial-target="copy-profile-link"]',
    route: '/dashboard/profile',
    ctaRoute: '/dashboard/profile',
    ctaLabelKey: 'goToProfile',
  },
  {
    id: 'viewServicePage',
    translationKey: 'viewServicePage',
    icon: ExternalLink,
    targetSelector: '[data-tutorial-target="view-service-page"]',
    route: '/dashboard/profile',
    ctaRoute: '/dashboard/profile',
    ctaLabelKey: 'goToProfile',
  },
  { id: 'ready', translationKey: 'ready', icon: Sparkles, targetSelector: null },
];

export const TUTORIAL_TOTAL_STEPS = TUTORIAL_STEPS.length;
