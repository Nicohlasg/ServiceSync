/**
 * tRPC Client Configuration
 * 
 * Used by the web app to communicate with the API
 */

import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query';
import { type AppRouter } from './routers/_app';

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();
