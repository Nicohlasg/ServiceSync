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

export const appRouter = router({
  cash: cashRouter,
  booking: bookingRouter,
  schedule: scheduleRouter,
  provider: providerRouter,
  clients: clientsRouter,
  invoices: invoicesRouter,
});

export type AppRouter = typeof appRouter;
