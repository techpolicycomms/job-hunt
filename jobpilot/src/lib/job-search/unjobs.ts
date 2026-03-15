// ============================================================
// src/lib/job-search/unjobs.ts
// Job scraper for UNjobs.org — UN and international organization jobs.
// Perfect for Rahul's profile targeting Geneva-based UN/IGO roles.
// ============================================================

import { scrapeJobListings, isLightpandaAvailable } from "@/lib/browser";
import type { RawJobListing } from "@/lib/types";

export async function searchUNJobs(
  keywords: string[],
  locations: string[]
): Promise<RawJobListing[]> {
  const available = await isLightpandaAvailable();
  if (!available) {
    console.log("[unjobs] Lightpanda not available, skipping");
    return [];
  }

  const results: RawJobListing[] = [];

  // UNjobs has a search endpoint at unjobs.org/search
  for (const keyword of keywords.slice(0, 5)) {
    try {
      const searchUrl = `https://unjobs.org/search?q=${encodeURIComponent(keyword)}`;

      const jobs = await scrapeJobListings(searchUrl, {
        container: ".job, .job-listing, article.vacancy",
        title: ".job-title, h3, h2",
        company: ".organization, .employer, .agency",
        location: ".location, .duty-station",
        link: "a",
      });

      const listings: RawJobListing[] = jobs
        .filter((job) => job.title && job.url)
        .map((job) => ({
          url: job.url.startsWith("http") ? job.url : `https://unjobs.org${job.url}`,
          title: job.title,
          company: job.company,
          location: job.location,
          source: "unjobs" as const,
          snippet: job.snippet,
          discovered_at: new Date().toISOString(),
        }));

      results.push(...listings);
    } catch (error) {
      console.error(`[unjobs] Error:`, error instanceof Error ? error.message : error);
    }
  }

  // Also search careers.un.org directly
  try {
    const unCareersUrl = `https://careers.un.org/lbw/home.aspx?viewtype=SJ&level=All&family=All&location=All&lang=en-US`;
    const jobs = await scrapeJobListings(unCareersUrl, {
      container: ".job-posting, .vacancy-row, tr.vacanctRow",
      title: ".job-title, td.jobTitle",
      company: "United Nations", // Always UN
      location: ".location, td.location",
      link: "a",
    });

    const listings: RawJobListing[] = jobs
      .filter((j) => j.title && j.url)
      .map((j) => ({
        url: j.url,
        title: j.title,
        company: "United Nations",
        location: j.location,
        source: "unjobs" as const,
        snippet: j.snippet,
        discovered_at: new Date().toISOString(),
      }));

    results.push(...listings);
  } catch {
    // UN careers site might be unavailable — not critical
  }

  return deduplicateByUrl(results);
}

function deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
