/**
 * ServiceSync API Package
 * 
 * tRPC router and types for type-safe API communication
 */

import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';
import { type AppRouter } from './routers/_app';

export { appRouter, type AppRouter } from './routers/_app';
export { createContext, type Context } from './trpc';
export * from './payment';
export { checkHttpRateLimit, assertHttpRateLimit, type RateLimitBucketName } from './rateLimit';

// Re-export tRPC utilities
export { trpc } from './client';

// Inferred router types for client-side usage
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
