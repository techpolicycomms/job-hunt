// ============================================================
// src/lib/supabase/client.ts
// Supabase client for use in CLIENT COMPONENTS (browser-side).
//
// TS concept: This file uses `createBrowserClient` which is
// typed to return `SupabaseClient<Database>` — but since we
// don't have a generated Database type, we use the default.
// ============================================================

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for browser (client component) use.
 *
 * IMPORTANT: Only uses the ANON key — this key is safe to expose
 * to the browser because Row Level Security (RLS) enforces access control.
 *
 * Usage in client components:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('jobs').select('*')
 */
export function createClient() {
  // TS concept: `!` non-null assertion — we know these env vars exist.
  // If they don't, the error will happen at runtime, not compile time.
  // Better practice: validate env vars at startup (see the server client).
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
