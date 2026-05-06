/**
 * Root tRPC Application Router — ServiceSync
 */

import { router } from '@/server/trpc';
import { cashRouter } from './cash';
import { bookingRouter } from './booking';
import { scheduleRouter } from './schedule';
import { providerRouter } from './provider';
import { clientsRouter } from './clients';
import { invoicesRouter } from './invoices';
// BETA-ONLY: REMOVE FOR PUBLIC LAUNCH
import { betaRouter } from './beta';
import { reviewsRouter } from './reviews';
import { plansRouter } from './plans';
import { jobsRouter } from './jobs';
import { quotesRouter } from './quotes';
import { expensesRouter } from './expenses';
import { analyticsRouter } from './analytics';
import { inventoryRouter } from './inventory';
import { notificationsRouter } from './notifications';

export const appRouter = router({
  cash: cashRouter,
  booking: bookingRouter,
  schedule: scheduleRouter,
  provider: providerRouter,
  clients: clientsRouter,
  invoices: invoicesRouter,
  reviews: reviewsRouter,
  plans: plansRouter,
  jobs: jobsRouter,
  quotes: quotesRouter,
  expenses: expensesRouter,
  analytics: analyticsRouter,
  inventory: inventoryRouter,
  notifications: notificationsRouter,
  // BETA-ONLY: REMOVE FOR PUBLIC LAUNCH
  beta: betaRouter,
});

export type AppRouter = typeof appRouter;
