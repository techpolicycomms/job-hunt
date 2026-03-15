// ============================================================
// src/lib/job-search/linkedin.ts
// Job scraper for LinkedIn job search.
// ============================================================

import { scrapeJobListings, isLightpandaAvailable } from "@/lib/browser";
import type { RawJobListing } from "@/lib/types";

/**
 * Searches LinkedIn for jobs matching the given keywords and location.
 *
 * LinkedIn search URL format:
 * https://www.linkedin.com/jobs/search/?keywords=...&location=...
 *
 * @param keywords - Search terms (e.g. ["programme manager", "AI"])
 * @param locations - Target locations (e.g. ["Geneva", "Remote"])
 * @returns Array of raw job listings
 */
export async function searchLinkedIn(
  keywords: string[],
  locations: string[]
): Promise<RawJobListing[]> {
  // Check if Lightpanda is available before trying to scrape
  const available = await isLightpandaAvailable();
  if (!available) {
    console.log("[linkedin] Lightpanda not available, skipping");
    return [];
  }

  const results: RawJobListing[] = [];

  // Search each location separately to get targeted results
  for (const location of locations.slice(0, 3)) {
    try {
      const searchUrl = buildLinkedInUrl(keywords, location);

      // CSS selectors for LinkedIn's job card structure
      // NOTE: LinkedIn frequently changes their HTML — update selectors if scraping breaks
      const jobs = await scrapeJobListings(searchUrl, {
        container: ".jobs-search__results-list li, .job-card-container",
        title: ".job-card-list__title, .base-search-card__title",
        company: ".job-card-container__company-name, .base-search-card__subtitle",
        location: ".job-card-container__metadata-item, .job-search-card__location",
        link: "a.job-card-list__title, a.base-card__full-link",
      });

      // Convert scraped cards to our RawJobListing type
      const listings: RawJobListing[] = jobs
        .filter((job) => job.title && job.url) // Only keep valid listings
        .map((job) => ({
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location || location,
          source: "linkedin" as const, // `as const` makes this a literal type "linkedin"
          snippet: job.snippet,
          discovered_at: new Date().toISOString(),
        }));

      results.push(...listings); // Spread operator adds all elements to results array
    } catch (error) {
      console.error(
        `[linkedin] Error searching for "${location}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Deduplicate by URL before returning
  return deduplicateByUrl(results);
}

/**
 * Builds a LinkedIn jobs search URL from keywords and location.
 *
 * @param keywords - Search terms
 * @param location - Target location
 * @returns Full LinkedIn search URL
 */
function buildLinkedInUrl(keywords: string[], location: string): string {
  // URLSearchParams handles URL encoding (spaces → %20, etc.)
  const params = new URLSearchParams({
    keywords: keywords.join(" "),
    location: location,
    f_TPR: "r86400", // Posted in last 24 hours
    f_JT: "F",       // Full-time jobs
  });

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

/**
 * Removes duplicate job listings that share the same URL.
 *
 * TS concept: Generic function — `<T extends { url: string }>` means
 * "T can be any type that has at least a `url: string` field".
 * This makes the function reusable for any object with a URL.
 */
function deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
