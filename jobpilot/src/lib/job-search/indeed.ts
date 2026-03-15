// ============================================================
// src/lib/job-search/indeed.ts
// Job scraper for Indeed.
// ============================================================

import { scrapeJobListings, isLightpandaAvailable } from "@/lib/browser";
import type { RawJobListing } from "@/lib/types";

export async function searchIndeed(
  keywords: string[],
  locations: string[]
): Promise<RawJobListing[]> {
  const available = await isLightpandaAvailable();
  if (!available) {
    console.log("[indeed] Lightpanda not available, skipping");
    return [];
  }

  const results: RawJobListing[] = [];

  for (const location of locations.slice(0, 3)) {
    try {
      // Indeed uses different subdomains per country:
      // indeed.com (US), ch.indeed.com (Switzerland), ie.indeed.com (Ireland)
      const domain = getIndeedDomain(location);
      const searchUrl = `https://${domain}/jobs?q=${encodeURIComponent(keywords.join(" "))}&l=${encodeURIComponent(location)}&sort=date`;

      const jobs = await scrapeJobListings(searchUrl, {
        container: ".job_seen_beacon, .resultContent, [data-testid='job-card']",
        title: ".jobTitle span, h2.jobTitle",
        company: ".companyName, [data-testid='company-name']",
        location: ".companyLocation, [data-testid='text-location']",
        link: "a.jcs-JobTitle, h2.jobTitle a",
      });

      const listings: RawJobListing[] = jobs
        .filter((job) => job.title && job.url)
        .map((job) => ({
          url: job.url.startsWith("http") ? job.url : `https://${domain}${job.url}`,
          title: job.title,
          company: job.company,
          location: job.location || location,
          source: "indeed" as const,
          snippet: job.snippet,
          discovered_at: new Date().toISOString(),
        }));

      results.push(...listings);
    } catch (error) {
      console.error(`[indeed] Error:`, error instanceof Error ? error.message : error);
    }
  }

  return deduplicateByUrl(results);
}

/** Returns the appropriate Indeed domain for a given location */
function getIndeedDomain(location: string): string {
  const loc = location.toLowerCase();
  if (loc.includes("swiss") || loc.includes("geneva") || loc.includes("zurich")) {
    return "ch.indeed.com";
  }
  if (loc.includes("ireland") || loc.includes("dublin")) {
    return "ie.indeed.com";
  }
  return "www.indeed.com";
}

function deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
