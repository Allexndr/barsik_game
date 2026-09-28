/**
 * Centralized Supabase client environment config.
 *
 * Values are preferred from environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * with graceful fallback constants for local/offline testing.
 */

export const SUPABASE_URL: string =
  import.meta.env.VITE_SUPABASE_URL || 'https://vsuqaatpzyatzhmmdmug.supabase.co';

export const SUPABASE_ANON_KEY: string =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzdXFhYXRwenlhdHpobW1kbXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwODYwNDUsImV4cCI6MjA5OTY2MjA0NX0.fA7_lyCIPUppg_DmgMuwKHaFR93jMLXD7T7tEfWsceo';

export function getSupabaseHeaders(): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}
