/**
 * tRPC HTTP Handler — ServiceSync
 * Mounts the tRPC router at /api/trpc
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: (opts) => createContext(opts),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
          console.error(`[tRPC] Error on ${path ?? '<unknown>'}:`, error);
        }
        : undefined,
  });

export { handler as GET, handler as POST };
