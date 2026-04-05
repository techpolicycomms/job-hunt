// POST /api/scrape — Scrape a job URL or parse pasted text
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeJobUrl, parseJobText, detectSource } from "@/lib/scraper";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    const body = await request.json();
    const { url, rawText } = body as { url?: string; rawText?: string };

    if (!url && !rawText) {
      return NextResponse.json(
        { success: false, error: "Provide a URL or paste the job description text" },
        { status: 400 }
      );
    }

    let job;
    let text: string;
    let source;

    if (url) {
      // Try scraping the URL
      try {
        const result = await scrapeJobUrl(url);
        job = result.job;
        text = result.rawText;
        source = result.source;
      } catch (scrapeError) {
        // If scraping fails and we have rawText as fallback, use it
        if (rawText) {
          job = await parseJobText(rawText);
          text = rawText;
          source = detectSource(url);
        } else {
          throw scrapeError;
        }
      }
    } else {
      // Direct text parsing
      job = await parseJobText(rawText!);
      text = rawText!;
      source = "other";
    }

    // Save to database
    const { data: savedJob, error: dbError } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        url: url ?? "",
        title: job.title,
        company: job.company,
        location: job.location,
        level: job.level,
        job_type: job.job_type,
        description: job.description,
        requirements: job.requirements,
        keywords: job.keywords,
        salary: job.salary,
        deadline: job.deadline,
        source,
        raw_text: text.slice(0, 50000),
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({ success: true, data: { job: savedJob, parsed: job } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
