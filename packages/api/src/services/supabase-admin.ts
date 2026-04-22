/**
 * Centralized Supabase Admin Client — ServiceSync
 *
 * Single source of truth for the service-role Supabase client.
 * All server-side services that need elevated access (storage uploads,
 * cross-user reads, etc.) import from here instead of creating their own.
 *
 * CRIT-04: Eliminates duplicated service-role client creation across 7 files.
 * Validates env vars once at startup instead of crashing with `!` assertions.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Lazy singleton — created on first access, validated once
// ---------------------------------------------------------------------------

let _adminClient: SupabaseClient | null = null;

/**
 * Returns the service-role Supabase client for server-side operations
 * that require elevated access (storage, cross-user queries, etc.).
 *
 * Throws a clear error if env vars are missing instead of silently crashing.
 */
export function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase-admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'These are required for server-side operations.'
    );
  }

  _adminClient = createClient(url, key);
  return _adminClient;
}
