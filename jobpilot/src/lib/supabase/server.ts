// ============================================================
// src/lib/supabase/server.ts
// Supabase client for use in SERVER COMPONENTS and API routes.
//
// This version reads/writes cookies to maintain session state.
// The `cookies()` function is Next.js App Router's way to access
// HTTP cookies on the server.
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for server-side use.
 *
 * TS concept: `async` functions return a `Promise<T>`.
 * `await cookies()` resolves the Promise to get the cookie store.
 *
 * The cookie handlers let Supabase SSR maintain the auth session
 * by reading/writing JWT tokens from HTTP cookies.
 */
export async function createClient() {
  // `await cookies()` — Next.js 15 requires awaiting the cookies() call
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read a specific cookie by name
        getAll() {
          return cookieStore.getAll();
        },
        // Write cookies (used when refreshing tokens)
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail in Server Components (read-only context).
            // The middleware handles session refresh in those cases.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase admin client using the service role key.
 * This BYPASSES Row Level Security — use only in trusted server code.
 *
 * NEVER expose this to the browser or use in client components.
 * The service role key has full access to all data.
 */
export function createAdminClient() {
  // We import createClient from supabase-js directly (not @supabase/ssr)
  // because admin clients don't need cookie management
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Admin clients should not auto-refresh tokens
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
