// PATCH /api/applications/[id] — Update application status/notes
// DELETE /api/applications/[id] — Delete an application
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    const updates = await request.json();
    // Only allow updating specific fields
    const allowed: Record<string, unknown> = {};
    if (updates.status) allowed.status = updates.status;
    if (updates.notes !== undefined) allowed.notes = updates.notes;
    if (updates.next_action !== undefined) allowed.next_action = updates.next_action;
    if (updates.next_action_date !== undefined) allowed.next_action_date = updates.next_action_date;

    const { data, error } = await supabase
      .from("applications")
      .update(allowed)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
