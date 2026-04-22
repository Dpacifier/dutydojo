import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// These are injected by Vite at build time from .env
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const SUPABASE_URL      = ((_env.VITE_SUPABASE_URL      as string) ?? '');
const SUPABASE_ANON_KEY = ((_env.VITE_SUPABASE_ANON_KEY as string) ?? '');

let _client: SupabaseClient | null = null;

/** Returns null when env vars are not configured. */
export function supabase(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,  // We manage sessions in SQLite
        autoRefreshToken: false,
      },
    });
  }
  return _client;
}

/** Inject a stored session so all subsequent calls are authenticated. */
export async function restoreSession(accessToken: string, refreshToken: string): Promise<boolean> {
  const sb = supabase();
  if (!sb || !accessToken) return false;
  const { error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return !error;
}

export function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
