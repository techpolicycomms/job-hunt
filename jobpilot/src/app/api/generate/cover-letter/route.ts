// POST /api/generate/cover-letter — Generate tailored cover letter.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCoverLetter } from "@/lib/ai";
import { matchJobToProfile } from "@/lib/matching";
import type { ApiResponse, GeneratedMaterials, Job, RoleLens, Profile } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<GeneratedMaterials>>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { jobId } = await request.json() as { jobId: string };

    const [jobRes, profileRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", jobId).single(),
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    ]);

    if (!jobRes.data || !profileRes.data) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const job = jobRes.data as Job;
    const profile = profileRes.data as Profile;

    const { data: lensesData } = await supabase
      .from("role_lenses")
      .select("*")
      .eq("profile_id", profile.id);
    const lenses = (lensesData ?? []) as RoleLens[];

    const selectedLenses = job.selected_lenses ?? [];
    const jobText = [job.title, job.description, ...job.requirements].filter(Boolean).join(" ");
    const matchResult = matchJobToProfile(job.id, jobText, lenses, profile);

    const clContent = await generateCoverLetter(job, selectedLenses, matchResult, profile);

    // Update existing materials record or create
    const { data: existingMats } = await supabase
      .from("generated_materials")
      .select("id")
      .eq("job_id", jobId)
      .single();

    const { data: materials, error } = existingMats
      ? await supabase
          .from("generated_materials")
          .update({ cover_letter_content: clContent })
          .eq("id", existingMats.id)
          .select()
          .single()
      : await supabase
          .from("generated_materials")
          .insert({
            job_id: job.id,
            user_id: user.id,
            cover_letter_content: clContent,
            lenses_used: selectedLenses.map((s) => s.lens_id),
          })
          .select()
          .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: materials as GeneratedMaterials });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
