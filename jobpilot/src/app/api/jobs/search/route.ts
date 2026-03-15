// POST /api/jobs/search — Trigger job search on demand.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAllPlatforms } from "@/lib/job-search";
import type { ApiResponse, RawJobListing, PlatformSettings } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<RawJobListing[]>>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { keywords, locations, platforms } = await request.json() as {
      keywords: string[];
      locations: string[];
      platforms?: PlatformSettings;
    };

    const defaultPlatforms: PlatformSettings = {
      linkedin: true, google_careers: true, indeed: true, unjobs: true, web: true,
    };

    const results = await searchAllPlatforms(keywords, locations, platforms ?? defaultPlatforms);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
