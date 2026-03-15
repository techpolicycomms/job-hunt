// POST /api/generate/cv — Generate tailored CV for a job.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTailoredCV } from "@/lib/ai";
import type { ApiResponse, GeneratedMaterials, Job, RoleLens, Profile } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<GeneratedMaterials>>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { jobId } = await request.json() as { jobId: string };

    // Load all needed data
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

    const selectedLenses = job.selected_lenses ?? [];

    // Generate CV
    const cvContent = await generateTailoredCV(job, selectedLenses, lenses, profile);

    // Upsert materials
    const { data: materials, error } = await supabase
      .from("generated_materials")
      .upsert(
        {
          job_id: job.id,
          user_id: user.id,
          cv_content: cvContent,
          lenses_used: selectedLenses.map((s) => s.lens_id),
        },
        { onConflict: "job_id" }
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase
      .from("jobs")
      .update({ pipeline_status: "materials_generated" })
      .eq("id", jobId);

    return NextResponse.json({ success: true, data: materials as GeneratedMaterials });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
