// POST /api/pipeline/approve — Approve a job from pipeline review.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ jobId: string }>>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { jobId } = await request.json() as { jobId: string };

    // Update job status to approved
    await supabase
      .from("jobs")
      .update({ pipeline_status: "approved" })
      .eq("id", jobId)
      .eq("user_id", user.id);

    // Create an application record
    const { data: matsData } = await supabase
      .from("generated_materials")
      .select("id, lenses_used")
      .eq("job_id", jobId)
      .single();

    await supabase.from("applications").insert({
      user_id: user.id,
      job_id: jobId,
      materials_id: matsData?.id ?? null,
      status: "applied",
      date_applied: new Date().toISOString().split("T")[0],
      lenses_used: matsData?.lenses_used ?? [],
    });

    return NextResponse.json({ success: true, data: { jobId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
