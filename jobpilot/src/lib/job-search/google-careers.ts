// ============================================================
// src/lib/job-search/google-careers.ts
// Job scraper for Google Jobs (via Google Careers search).
// ============================================================

import { scrapeJobListings, isLightpandaAvailable } from "@/lib/browser";
import type { RawJobListing } from "@/lib/types";

/**
 * Searches Google for jobs (Google Jobs search results appear at top of SERP).
 *
 * @param keywords - Search terms
 * @param locations - Target locations
 * @returns Array of raw job listings
 */
export async function searchGoogleCareers(
  keywords: string[],
  locations: string[]
): Promise<RawJobListing[]> {
  const available = await isLightpandaAvailable();
  if (!available) {
    console.log("[google-careers] Lightpanda not available, skipping");
    return [];
  }

  const results: RawJobListing[] = [];

  for (const location of locations.slice(0, 3)) {
    try {
      const searchUrl = buildGoogleJobsUrl(keywords, location);

      // Google renders job cards in a specific structure within search results
      const jobs = await scrapeJobListings(searchUrl, {
        container: ".iFjolb, .g, [class*='job']", // Google changes class names often
        title: "h3, .DKV0Md",
        company: ".vNEEBe, .company",
        location: ".Qk80Jf, .location",
        link: "a",
      });

      const listings: RawJobListing[] = jobs
        .filter((job) => job.title && job.url)
        .map((job) => ({
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location || location,
          source: "google_careers" as const,
          snippet: job.snippet,
          discovered_at: new Date().toISOString(),
        }));

      results.push(...listings);
    } catch (error) {
      console.error(`[google-careers] Error:`, error instanceof Error ? error.message : error);
    }
  }

  return deduplicateByUrl(results);
}

function buildGoogleJobsUrl(keywords: string[], location: string): string {
  const query = `${keywords.join(" ")} jobs ${location}`;
  const params = new URLSearchParams({
    q: query,
    ibp: "htl;jobs", // Activates Google's jobs vertical
  });
  return `https://www.google.com/search?${params.toString()}`;
}

function deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
