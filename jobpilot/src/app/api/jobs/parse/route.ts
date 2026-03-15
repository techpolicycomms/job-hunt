// ============================================================
// src/app/api/jobs/parse/route.ts
// POST /api/jobs/parse — Parse a job URL or raw text with AI.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseJobDescription } from "@/lib/ai";
import { scrapePage, isLightpandaAvailable } from "@/lib/browser";
import type { ApiResponse, Job } from "@/lib/types";

/**
 * POST /api/jobs/parse
 * Body: { url?: string, rawText?: string }
 *
 * TS concept: `NextRequest` and `NextResponse` are typed wrappers
 * around the web standard Request/Response API.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Job>>> {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json() as { url?: string; rawText?: string };
    const { url, rawText } = body;

    if (!url && !rawText) {
      return NextResponse.json(
        { success: false, error: "Either url or rawText is required" },
        { status: 400 }
      );
    }

    // Get the job text — either from the provided rawText or by scraping the URL
    let jobText = rawText ?? "";
    if (url && !rawText) {
      const lightpandaAvailable = await isLightpandaAvailable();
      if (lightpandaAvailable) {
        jobText = await scrapePage(url);
      } else {
        // If Lightpanda isn't running, ask AI to describe what it knows about this URL
        jobText = `Job posting at URL: ${url}`;
      }
    }

    // Parse with AI
    const parsed = await parseJobDescription(jobText);

    // Save to database
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        url: url ?? null,
        title: parsed.title ?? "Unknown Title",
        company: parsed.company,
        location: parsed.location,
        level: parsed.level,
        job_type: parsed.job_type ?? "Full-time",
        description: parsed.description,
        requirements: parsed.requirements ?? [],
        responsibilities: parsed.responsibilities ?? [],
        qualifications: parsed.qualifications ?? [],
        salary: parsed.salary,
        deadline: parsed.deadline,
        raw_text: jobText.slice(0, 10000),
        source: url ? "manual" : "manual",
        pipeline_status: "discovered",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: job as Job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
