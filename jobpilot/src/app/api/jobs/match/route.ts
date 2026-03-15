// POST /api/jobs/match — Compute match score for a job.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { matchJobToProfile } from "@/lib/matching";
import type { ApiResponse, Job, RoleLens, Profile, MatchResult } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<MatchResult>>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { jobId } = await request.json() as { jobId: string };

    // Load job, profile, and lenses
    const [jobRes, profileRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", jobId).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]);

    if (!jobRes.data || !profileRes.data) {
      return NextResponse.json({ success: false, error: "Job or profile not found" }, { status: 404 });
    }

    const job = jobRes.data as Job;
    const profile = profileRes.data as Profile;

    const { data: lensesData } = await supabase
      .from("role_lenses")
      .select("*")
      .eq("profile_id", profile.id);
    const lenses = (lensesData ?? []) as RoleLens[];

    // Build job text
    const jobText = [job.title, job.description, ...job.requirements, ...job.responsibilities]
      .filter(Boolean)
      .join(" ");

    const matchResult = matchJobToProfile(job.id, jobText, lenses, profile);

    // Update job with match results
    await supabase.from("jobs").update({
      match_score: matchResult.match_score,
      match_details: matchResult.match_details,
      selected_lenses: matchResult.selected_lenses,
      recommendation: matchResult.recommendation,
      eligibility_checks: matchResult.eligibility_checks,
      pipeline_status: "matched",
    }).eq("id", jobId);

    return NextResponse.json({ success: true, data: matchResult });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
