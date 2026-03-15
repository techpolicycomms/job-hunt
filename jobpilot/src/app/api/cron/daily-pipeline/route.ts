// ============================================================
// src/app/api/cron/daily-pipeline/route.ts
// GET /api/cron/daily-pipeline — Daily automated pipeline.
//
// Secured with CRON_SECRET bearer token.
// Called by Vercel Cron at 8am UTC daily.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline";

/**
 * GET /api/cron/daily-pipeline
 *
 * Security: Vercel Cron adds an Authorization header with the CRON_SECRET.
 * We verify this before running anything — without it, anyone could trigger
 * the pipeline by hitting this URL.
 *
 * TS concept: `NextResponse.json<T>()` — generic JSON response
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // ============================================================
  // SECURITY CHECK
  // ============================================================

  // Verify the Authorization header contains our CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedAuth) {
    console.error("[cron] Unauthorized request to daily pipeline");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ============================================================
  // RUN PIPELINE FOR ALL ACTIVE USERS
  // ============================================================

  const supabase = createAdminClient();

  // Find all users with active search preferences
  const { data: activePrefs, error } = await supabase
    .from("search_preferences")
    .select("user_id")
    .eq("is_active", true);

  if (error) {
    console.error("[cron] Failed to load active users:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ userId: string; success: boolean; error?: string }> = [];

  // Run pipeline for each active user sequentially
  // (Parallel would be better for scale, but sequential is safer for API limits)
  for (const { user_id } of activePrefs ?? []) {
    try {
      const result = await runPipeline(user_id);
      results.push({ userId: user_id, success: result.success });
      console.log(`[cron] Pipeline for user ${user_id}: ${result.success ? "success" : "failed"}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ userId: user_id, success: false, error: message });
      console.error(`[cron] Pipeline failed for user ${user_id}:`, message);
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
