/**
 * tRPC Client Setup for Next.js App
 */

import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query';
import { type AppRouter } from '@servicesync/api';

export const api: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

export { type RouterInputs, type RouterOutputs } from '@servicesync/api';
