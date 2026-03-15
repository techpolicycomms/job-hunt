// ============================================================
// src/lib/pipeline.ts
// The daily automated job discovery and processing pipeline.
//
// Pipeline steps:
// 1. Load user's search preferences and profile
// 2. Discover jobs across all enabled platforms
// 3. Deduplicate against already-known jobs
// 4. Parse each job with AI (extract structured data)
// 5. Match each job against the 17 lenses
// 6. Filter to jobs scoring 75%+
// 7. Generate CV and cover letter for top 20 matches
// 8. Queue them for human review
// 9. Log run statistics to pipeline_runs table
// ============================================================

import { createAdminClient } from "@/lib/supabase/server";
import { searchAllPlatforms } from "@/lib/job-search";
import { parseJobDescription, generateTailoredCV, generateCoverLetter } from "@/lib/ai";
import { matchJobToProfile } from "@/lib/matching";
import type {
  SearchPreferences,
  Profile,
  RoleLens,
  PipelineRun,
  Job,
  MatchResult,
} from "@/lib/types";

// ============================================================
// PIPELINE RESULT TYPE
// TS concept: A type alias for the function's return value.
// This makes the return type easy to understand and reusable.
// ============================================================

export interface PipelineResult {
  success: boolean;
  run: Partial<PipelineRun>;
  error?: string;
}

// ============================================================
// MAIN PIPELINE FUNCTION
// ============================================================

/**
 * Runs the full daily job discovery and processing pipeline for a user.
 *
 * This is called by:
 * - The daily cron job at 8am UTC
 * - The "Run Pipeline Now" button in the UI
 *
 * TS concept: `async function` always returns a `Promise`.
 * The type `Promise<PipelineResult>` makes this explicit.
 *
 * @param userId - The Supabase auth user ID to run the pipeline for
 * @returns Pipeline run statistics
 */
export async function runPipeline(userId: string): Promise<PipelineResult> {
  const startTime = Date.now();

  // Stats to track and log
  let jobsDiscovered = 0;
  let jobsMatched = 0;
  let jobsAboveThreshold = 0;
  let materialsGenerated = 0;
  let jobsQueuedForReview = 0;
  const errors: Array<{ step: string; message: string; timestamp: string }> = [];

  // Admin client bypasses RLS — needed for pipeline operations
  const supabase = createAdminClient();

  try {
    // ============================================================
    // STEP 1: Load user data
    // ============================================================

    console.log(`[pipeline] Starting pipeline for user ${userId}`);

    // Load search preferences
    const { data: prefs, error: prefsError } = await supabase
      .from("search_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (prefsError || !prefs) {
      throw new Error(`Failed to load search preferences: ${prefsError?.message}`);
    }

    const preferences = prefs as SearchPreferences;

    // Check if pipeline is active
    if (!preferences.is_active) {
      return {
        success: true,
        run: {
          jobs_discovered: 0,
          errors: [{ step: "init", message: "Pipeline is paused", timestamp: new Date().toISOString() }],
        },
      };
    }

    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to load profile: ${profileError?.message}`);
    }

    // Load all role lenses
    const { data: lensesData, error: lensesError } = await supabase
      .from("role_lenses")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order");

    if (lensesError) {
      throw new Error(`Failed to load lenses: ${lensesError.message}`);
    }

    const lenses = (lensesData ?? []) as RoleLens[];
    console.log(`[pipeline] Loaded ${lenses.length} lenses`);

    // ============================================================
    // STEP 2: Discover jobs
    // ============================================================

    console.log("[pipeline] Step 2: Discovering jobs...");

    let rawListings = await searchAllPlatforms(
      preferences.keywords,
      preferences.locations,
      preferences.platforms
    );

    jobsDiscovered = rawListings.length;
    console.log(`[pipeline] Discovered ${jobsDiscovered} raw listings`);

    // ============================================================
    // STEP 3: Filter out already-known jobs and excluded companies
    // ============================================================

    // Load URLs of jobs we already have in the database
    const { data: existingJobs } = await supabase
      .from("jobs")
      .select("url, title, company")
      .eq("user_id", userId);

    const knownUrls = new Set(
      (existingJobs ?? []).map((j: { url: string }) => j.url).filter(Boolean)
    );

    const knownTitleCompany = new Set(
      (existingJobs ?? []).map(
        (j: { title: string; company: string }) =>
          `${j.title?.toLowerCase()}|${j.company?.toLowerCase()}`
      )
    );

    // Filter out duplicates and excluded companies
    rawListings = rawListings.filter((listing) => {
      // Skip if URL already known
      if (listing.url && knownUrls.has(listing.url)) return false;

      // Skip if title+company already known
      const key = `${listing.title.toLowerCase()}|${listing.company.toLowerCase()}`;
      if (knownTitleCompany.has(key)) return false;

      // Skip excluded companies (case-insensitive)
      const isExcluded = preferences.excluded_companies.some((excluded) =>
        listing.company.toLowerCase().includes(excluded.toLowerCase())
      );
      if (isExcluded) return false;

      // Skip if contains excluded keywords
      const hasExcludedKeyword = preferences.excluded_keywords.some((kw) =>
        listing.snippet.toLowerCase().includes(kw.toLowerCase()) ||
        listing.title.toLowerCase().includes(kw.toLowerCase())
      );
      if (hasExcludedKeyword) return false;

      return true;
    });

    console.log(`[pipeline] ${rawListings.length} new listings after dedup/filtering`);

    // ============================================================
    // STEP 4: Parse each job with AI and save to database
    // ============================================================

    console.log("[pipeline] Step 4: Parsing jobs with AI...");

    const parsedJobs: Job[] = [];

    for (const listing of rawListings) {
      try {
        // Parse the raw text into structured job data
        const parsed = await parseJobDescription(listing.snippet);

        // Insert into database
        const { data: insertedJob, error: insertError } = await supabase
          .from("jobs")
          .insert({
            user_id: userId,
            url: listing.url,
            title: parsed.title ?? listing.title,
            company: parsed.company ?? listing.company,
            location: parsed.location ?? listing.location,
            source: listing.source,
            raw_text: listing.snippet,
            description: parsed.description,
            requirements: parsed.requirements ?? [],
            responsibilities: parsed.responsibilities ?? [],
            qualifications: parsed.qualifications ?? [],
            salary: parsed.salary,
            deadline: parsed.deadline,
            pipeline_status: "discovered",
            discovered_at: listing.discovered_at,
          })
          .select()
          .single();

        if (!insertError && insertedJob) {
          parsedJobs.push(insertedJob as Job);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ step: "parse", message: errorMessage, timestamp: new Date().toISOString() });
      }
    }

    // ============================================================
    // STEP 5: Match each job against the 17 lenses
    // ============================================================

    console.log(`[pipeline] Step 5: Matching ${parsedJobs.length} jobs...`);

    const matchedJobs: Array<{ job: Job; matchResult: MatchResult }> = [];

    for (const job of parsedJobs) {
      try {
        const jobText = [
          job.title,
          job.description,
          ...job.requirements,
          ...job.responsibilities,
          ...job.qualifications,
        ]
          .filter(Boolean)
          .join(" ");

        const matchResult = matchJobToProfile(job.id, jobText, lenses, profile as Profile);

        // Update job with match results in database
        await supabase
          .from("jobs")
          .update({
            match_score: matchResult.match_score,
            match_details: matchResult.match_details,
            selected_lenses: matchResult.selected_lenses,
            recommendation: matchResult.recommendation,
            eligibility_checks: matchResult.eligibility_checks,
            pipeline_status: "matched",
          })
          .eq("id", job.id);

        matchedJobs.push({ job: { ...job, match_score: matchResult.match_score }, matchResult });
        jobsMatched++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ step: "match", message: errorMessage, timestamp: new Date().toISOString() });
      }
    }

    // ============================================================
    // STEP 6: Filter to jobs above the threshold
    // ============================================================

    const threshold = preferences.min_match_score;
    const aboveThreshold = matchedJobs.filter(
      ({ matchResult }) => matchResult.match_score >= threshold
    );

    // Sort by score descending, take top N
    aboveThreshold.sort((a, b) => b.matchResult.match_score - a.matchResult.match_score);
    const topJobs = aboveThreshold.slice(0, preferences.max_daily_jobs);

    jobsAboveThreshold = aboveThreshold.length;
    console.log(`[pipeline] ${jobsAboveThreshold} jobs above ${threshold}% threshold`);
    console.log(`[pipeline] Generating materials for top ${topJobs.length} jobs`);

    // ============================================================
    // STEP 7: Generate CV and cover letter for top matches
    // ============================================================

    for (const { job, matchResult } of topJobs) {
      try {
        // Generate tailored CV
        const cvContent = await generateTailoredCV(
          job,
          matchResult.selected_lenses,
          lenses,
          profile as Profile
        );

        // Generate tailored cover letter
        const clContent = await generateCoverLetter(
          job,
          matchResult.selected_lenses,
          matchResult,
          profile as Profile
        );

        // Save materials to database
        const { error: matError } = await supabase
          .from("generated_materials")
          .insert({
            job_id: job.id,
            user_id: userId,
            cv_content: cvContent,
            cover_letter_content: clContent,
            lenses_used: matchResult.selected_lenses.map((s) => s.lens_id),
          });

        if (!matError) {
          // Update job status to materials_generated
          await supabase
            .from("jobs")
            .update({ pipeline_status: "materials_generated" })
            .eq("id", job.id);

          materialsGenerated++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ step: "generate", message: errorMessage, timestamp: new Date().toISOString() });
      }
    }

    // ============================================================
    // STEP 8: Queue for review
    // ============================================================

    // Mark all materials_generated jobs as ready_for_review
    const { error: queueError } = await supabase
      .from("jobs")
      .update({ pipeline_status: "ready_for_review" })
      .eq("user_id", userId)
      .eq("pipeline_status", "materials_generated");

    if (!queueError) {
      jobsQueuedForReview = materialsGenerated;
    }

    // Update last_search_at in preferences
    await supabase
      .from("search_preferences")
      .update({ last_search_at: new Date().toISOString() })
      .eq("user_id", userId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[pipeline] Fatal error:", errorMessage);
    errors.push({ step: "fatal", message: errorMessage, timestamp: new Date().toISOString() });
  }

  // ============================================================
  // STEP 9: Log pipeline run statistics
  // ============================================================

  const durationMs = Date.now() - startTime;

  const runData: Partial<PipelineRun> = {
    user_id: userId,
    jobs_discovered: jobsDiscovered,
    jobs_matched: jobsMatched,
    jobs_above_threshold: jobsAboveThreshold,
    materials_generated: materialsGenerated,
    jobs_queued_for_review: jobsQueuedForReview,
    errors,
    duration_ms: durationMs,
  };

  // Save the run log to the database
  try {
    const supabase = createAdminClient();
    await supabase.from("pipeline_runs").insert(runData);
  } catch (logError) {
    console.error("[pipeline] Failed to log run:", logError);
  }

  console.log(`[pipeline] Completed in ${durationMs}ms`);
  console.log(`[pipeline] Stats:`, runData);

  return {
    success: errors.filter((e) => e.step === "fatal").length === 0,
    run: runData,
  };
}
