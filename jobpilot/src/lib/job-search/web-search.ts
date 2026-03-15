// ============================================================
// src/lib/job-search/web-search.ts
// General web search for job listings not covered by other scrapers.
// Falls back to AI-powered search when Lightpanda is unavailable.
// ============================================================

import { scrapePage, isLightpandaAvailable } from "@/lib/browser";
import { searchJobsWithAI } from "@/lib/ai";
import type { RawJobListing } from "@/lib/types";

// Specific job boards to search directly
const ADDITIONAL_JOB_BOARDS = [
  { name: "ReliefWeb", url: "https://reliefweb.int/jobs?search={KEYWORDS}" },
  { name: "Devex", url: "https://www.devex.com/jobs/search?keywords={KEYWORDS}" },
  { name: "EPFL Jobs", url: "https://actu.epfl.ch/jobs/?q={KEYWORDS}" },
];

/**
 * Searches general web sources for job listings.
 * Uses Lightpanda if available, falls back to AI web search.
 *
 * @param keywords - Search terms
 * @param locations - Target locations
 * @returns Array of raw job listings
 */
export async function searchWeb(
  keywords: string[],
  locations: string[]
): Promise<RawJobListing[]> {
  const results: RawJobListing[] = [];
  const available = await isLightpandaAvailable();

  if (available) {
    // Scrape specific job boards
    for (const board of ADDITIONAL_JOB_BOARDS) {
      try {
        const url = board.url.replace("{KEYWORDS}", encodeURIComponent(keywords.join(" ")));
        const pageText = await scrapePage(url);

        // Simple text extraction: look for job-like patterns
        const jobListings = extractJobsFromText(pageText, board.name, url);
        results.push(...jobListings);
      } catch (error) {
        console.error(`[web-search] Error scraping ${board.name}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // Always try AI search as an additional source (if not in Lightpanda-only mode)
  try {
    const aiResults = await searchJobsWithAI(keywords, locations);
    results.push(...aiResults);
  } catch (error) {
    console.error("[web-search] AI search failed:", error instanceof Error ? error.message : error);
  }

  return deduplicateByUrl(results);
}

/**
 * Heuristic extraction of job listings from raw page text.
 * Used when we can't use structured CSS selectors.
 *
 * This is a simplified approach — real production would need
 * site-specific parsers.
 *
 * @param text - Raw page text
 * @param source - Where this text came from
 * @param sourceUrl - The URL of the page
 * @returns Best-effort extracted job listings
 */
function extractJobsFromText(
  text: string,
  source: string,
  sourceUrl: string
): RawJobListing[] {
  // Split into lines and look for job-like content
  const lines = text.split("\n").filter((line) => line.trim().length > 20);

  // Very simplified: return first 5 lines as potential job titles
  // In production, this would use NLP or structured parsing
  return lines.slice(0, 5).map((line) => ({
    url: sourceUrl,
    title: line.trim().slice(0, 100),
    company: source,
    location: "See listing",
    source: "web" as const,
    snippet: line.trim().slice(0, 300),
    discovered_at: new Date().toISOString(),
  }));
}

function deduplicateByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
