// ============================================================
// src/lib/scraper.ts
// Scrapes job postings from URLs using fetch + Claude parsing.
// Falls back to raw text input for sites that block scraping.
// SERVER-SIDE ONLY.
// ============================================================

import type { ScrapedJob, JobSource } from "@/lib/types";
import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return anthropicClient;
}

const MODEL = "claude-sonnet-4-20250514";

/**
 * Detect the job source from a URL domain.
 */
export function detectSource(url: string): JobSource {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("linkedin.com")) return "linkedin";
    if (hostname.includes("indeed.com")) return "indeed";
    if (hostname.includes("unjobs.org") || hostname.includes("careers.un.org")) return "unjobs";
    return "company_site";
  } catch {
    return "other";
  }
}

/**
 * Strip HTML tags and extract readable text from HTML content.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch the raw text content from a job URL.
 * Returns null if the site blocks scraping (e.g., LinkedIn).
 */
export async function fetchJobPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const text = stripHtml(html);

    // If we got very little text, the page probably requires JS rendering
    if (text.length < 200) return null;

    return text;
  } catch {
    return null;
  }
}

/**
 * Parse raw text (from scraping or user paste) into structured job data using Claude.
 */
export async function parseJobText(rawText: string): Promise<ScrapedJob> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Parse this job posting and extract structured information.
Return ONLY valid JSON with these exact fields (use null for missing data, empty arrays for missing lists):

{
  "title": "exact job title",
  "company": "company/organization name",
  "location": "location or null",
  "description": "2-4 sentence summary of the role",
  "requirements": ["key requirement 1", "key requirement 2", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "salary": "salary range or null",
  "deadline": "application deadline or null",
  "job_type": "Full-time/Part-time/Contract/Consultancy",
  "level": "Senior/Mid/Junior/Director or null"
}

For the "keywords" field, extract 15-25 important keywords and phrases that an ATS system would scan for. Include:
- Technical skills mentioned
- Soft skills emphasized
- Industry-specific terms
- Tools/platforms named
- Certifications or qualifications mentioned
- Key action verbs used

Job posting text:
${rawText.slice(0, 12000)}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from AI");
  }

  // Extract JSON from response (handles markdown code blocks)
  let jsonText = content.text;
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonText.trim()) as ScrapedJob;
  } catch {
    throw new Error("Failed to parse job description. Please try pasting the job text directly.");
  }
}

/**
 * Full scrape pipeline: fetch URL -> parse with Claude.
 * Returns the scraped job data and raw text.
 */
export async function scrapeJobUrl(
  url: string
): Promise<{ job: ScrapedJob; rawText: string; source: JobSource }> {
  const source = detectSource(url);
  const rawText = await fetchJobPage(url);

  if (!rawText) {
    throw new Error(
      "Could not fetch this job page. The site may require login or block automated access. " +
        "Please copy-paste the job description text instead."
    );
  }

  const job = await parseJobText(rawText);
  return { job, rawText, source };
}
