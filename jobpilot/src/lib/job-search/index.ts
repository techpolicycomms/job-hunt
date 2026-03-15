// ============================================================
// src/lib/job-search/index.ts
// Orchestrator that runs all platform scrapers in parallel
// and returns deduplicated results.
// ============================================================

import { searchLinkedIn } from "./linkedin";
import { searchGoogleCareers } from "./google-careers";
import { searchIndeed } from "./indeed";
import { searchUNJobs } from "./unjobs";
import { searchWeb } from "./web-search";
import type { RawJobListing, PlatformSettings } from "@/lib/types";

/**
 * Runs all enabled platform scrapers in parallel.
 *
 * TS concept: `Promise.allSettled` vs `Promise.all`:
 * - `Promise.all`: if ANY promise rejects, the whole thing fails
 * - `Promise.allSettled`: ALL promises run; you get success/failure for each
 * We use `allSettled` so one broken scraper doesn't kill the whole pipeline.
 *
 * @param keywords - Search terms for all platforms
 * @param locations - Target locations for all platforms
 * @param platforms - Which platforms are enabled
 * @returns Deduplicated array of all discovered jobs
 */
export async function searchAllPlatforms(
  keywords: string[],
  locations: string[],
  platforms: PlatformSettings
): Promise<RawJobListing[]> {
  console.log("[job-search] Starting parallel platform search");
  console.log(`[job-search] Keywords: ${keywords.join(", ")}`);
  console.log(`[job-search] Locations: ${locations.join(", ")}`);

  // Build array of [platformName, Promise] pairs for enabled platforms
  // TS concept: Array of tuples — `[string, Promise<RawJobListing[]>][]`
  // A tuple is a fixed-length array with typed positions
  const searchTasks: Array<[string, Promise<RawJobListing[]>]> = [];

  if (platforms.linkedin) {
    searchTasks.push(["linkedin", searchLinkedIn(keywords, locations)]);
  }
  if (platforms.google_careers) {
    searchTasks.push(["google_careers", searchGoogleCareers(keywords, locations)]);
  }
  if (platforms.indeed) {
    searchTasks.push(["indeed", searchIndeed(keywords, locations)]);
  }
  if (platforms.unjobs) {
    searchTasks.push(["unjobs", searchUNJobs(keywords, locations)]);
  }
  if (platforms.web) {
    searchTasks.push(["web", searchWeb(keywords, locations)]);
  }

  // Run all scrapers simultaneously — much faster than sequential
  // `Promise.allSettled` returns an array of result objects:
  //   { status: "fulfilled", value: T } or { status: "rejected", reason: unknown }
  const results = await Promise.allSettled(
    searchTasks.map(([, promise]) => promise) // Extract just the promises
  );

  // Collect successful results and log failures
  const allListings: RawJobListing[] = [];

  results.forEach((result, index) => {
    const platformName = searchTasks[index][0];

    if (result.status === "fulfilled") {
      console.log(`[job-search] ${platformName}: ${result.value.length} jobs found`);
      allListings.push(...result.value);
    } else {
      console.error(`[job-search] ${platformName} failed:`, result.reason);
    }
  });

  // Deduplicate across all platforms
  const deduplicated = deduplicateListings(allListings);

  console.log(
    `[job-search] Total: ${allListings.length} found, ${deduplicated.length} after dedup`
  );

  return deduplicated;
}

/**
 * Deduplicates job listings using URL and title+company combination.
 *
 * Why check both URL and title+company?
 * - Same job can appear on multiple platforms with different URLs
 * - Title + company is a good proxy for "same job" even without exact URL match
 */
function deduplicateListings(listings: RawJobListing[]): RawJobListing[] {
  const seenUrls = new Set<string>();
  const seenTitleCompany = new Set<string>();

  return listings.filter((listing) => {
    // Skip if we've seen this URL before
    if (listing.url && seenUrls.has(listing.url)) return false;

    // Skip if we've seen this title+company combination before
    const titleCompanyKey = `${listing.title.toLowerCase()}|${listing.company.toLowerCase()}`;
    if (seenTitleCompany.has(titleCompanyKey)) return false;

    // This is a new listing — record it and keep it
    if (listing.url) seenUrls.add(listing.url);
    seenTitleCompany.add(titleCompanyKey);
    return true;
  });
}
