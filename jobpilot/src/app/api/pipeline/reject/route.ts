// POST /api/pipeline/reject — Skip/archive a job from pipeline review.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ jobId: string }>>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { jobId } = await request.json() as { jobId: string };

    await supabase
      .from("jobs")
      .update({ pipeline_status: "rejected" })
      .eq("id", jobId)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, data: { jobId } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
