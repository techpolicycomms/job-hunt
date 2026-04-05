// POST /api/generate — Generate CV + cover letter for a job
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { selectLenses, generateCV, generateCoverLetter } from "@/lib/ai";
import { generateFilePrefix } from "@/lib/pdf";
import type { ScrapedJob, RoleLens, Profile } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    const { jobId } = (await request.json()) as { jobId: string };
    if (!jobId) {
      return NextResponse.json({ success: false, error: "jobId is required" }, { status: 400 });
    }

    // Load job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();
    if (jobError || !job) {
      return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
    }

    // Load profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (profileError || !profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found. Run /api/seed first." },
        { status: 404 }
      );
    }

    // Load all lenses
    const { data: lenses } = await supabase
      .from("role_lenses")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order");

    if (!lenses || lenses.length === 0) {
      return NextResponse.json(
        { success: false, error: "No role lenses found. Run /api/seed first." },
        { status: 404 }
      );
    }

    // Build the ScrapedJob object for AI functions
    const scrapedJob: ScrapedJob = {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description ?? "",
      requirements: job.requirements ?? [],
      keywords: job.keywords ?? [],
      salary: job.salary,
      deadline: job.deadline,
      job_type: job.job_type ?? "Full-time",
      level: job.level,
    };

    // Step 1: AI selects best lenses
    const selectedLenses = await selectLenses(scrapedJob, lenses as RoleLens[]);

    // Step 2: Generate CV
    const cvContent = await generateCV(
      scrapedJob,
      selectedLenses,
      lenses as RoleLens[],
      profile as unknown as Profile
    );

    // Step 3: Generate Cover Letter
    const coverLetterContent = await generateCoverLetter(
      scrapedJob,
      selectedLenses,
      profile as unknown as Profile
    );

    // Generate file prefix for naming
    const filePrefix = generateFilePrefix(profile.name, job.company, job.title);

    // Save to database
    const { data: materials, error: matError } = await supabase
      .from("generated_materials")
      .insert({
        job_id: jobId,
        user_id: user.id,
        cv_content: cvContent,
        cover_letter_content: coverLetterContent,
        lenses_used: selectedLenses.map((l) => l.lens_id),
        file_prefix: filePrefix,
      })
      .select()
      .single();

    if (matError) throw new Error(matError.message);

    return NextResponse.json({
      success: true,
      data: {
        materials,
        selectedLenses,
        filePrefix,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
