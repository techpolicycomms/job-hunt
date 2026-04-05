// GET /api/applications — List all applications
// POST /api/applications — Create a new application
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("applications")
      .select("*, job:jobs(id, title, company, location, url), materials:generated_materials(id, file_prefix)")
      .eq("user_id", user.id)
      .order("date_applied", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    const { jobId, materialsId, notes } = (await request.json()) as {
      jobId: string;
      materialsId?: string;
      notes?: string;
    };

    if (!jobId) {
      return NextResponse.json({ success: false, error: "jobId required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        job_id: jobId,
        materials_id: materialsId ?? null,
        status: "applied",
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
