// ============================================================
// src/middleware.ts
// Next.js Edge Middleware — runs on every request before the page renders.
//
// Responsibilities:
// 1. Check if the user is authenticated with Supabase
// 2. Redirect unauthenticated users to /login
// 3. Refresh expired auth tokens automatically
//
// This runs on Vercel's Edge Runtime — it must be fast and
// cannot use Node.js-specific APIs.
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Middleware function called on every matching request.
 *
 * TS concept: `NextRequest` and `NextResponse` are types from Next.js
 * that extend the web standard `Request` and `Response` types.
 *
 * The return type is `Promise<NextResponse>` — middleware always returns
 * a response (either the original request continues, or a redirect).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Create a mutable response that we can attach cookies to
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create a Supabase client that can read/write cookies from the request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read all cookies from the incoming request
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to both the request and the response
          // (needed for token refresh to work correctly)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: `getUser()` refreshes the session token if it's expired.
  // Do NOT use `getSession()` here — it doesn't verify the JWT server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ============================================================
  // ROUTING LOGIC
  // ============================================================

  // Public paths that don't require authentication
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/cron") || // Cron is secured by CRON_SECRET instead
    pathname.startsWith("/_next") ||    // Next.js internal paths
    pathname.startsWith("/favicon") ||
    pathname === "/";                    // Allow root for redirect

  // If user is not logged in and trying to access a protected page → redirect to login
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Pass the original URL so we can redirect back after login
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user IS logged in and tries to visit /login → redirect to dashboard
  if (user && pathname.startsWith("/login")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  // Allow the request to continue with the (possibly cookie-updated) response
  return supabaseResponse;
}

/**
 * Configures which paths this middleware runs on.
 *
 * The `matcher` excludes static files and API routes that don't need auth.
 * Using negative lookahead regex to skip Next.js internals.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
