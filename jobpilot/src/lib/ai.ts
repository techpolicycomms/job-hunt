// ============================================================
// src/lib/ai.ts
// AI helper functions using the Anthropic SDK.
//
// IMPORTANT: This file is SERVER-SIDE ONLY.
// Never import it in client components — it would expose your API key.
// All functions here are called from API routes (/api/...).
//
// TS concept: Server-only modules can use Node.js APIs and secrets.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import type {
  Job,
  RoleLens,
  Profile,
  CVContent,
  CoverLetterContent,
  MatchResult,
  RawJobListing,
} from "@/lib/types";

// ============================================================
// CLIENT INITIALIZATION
// ============================================================

/**
 * Create the Anthropic client once and reuse it.
 *
 * TS concept: `let` vs `const`:
 * - `let` can be reassigned
 * - `const` cannot be reassigned (but the object's contents can change)
 * We use `let` here because we initialize lazily.
 *
 * The `| null` union type means it starts as null and later becomes Anthropic.
 */
let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  // Lazy initialization: only create the client when first needed
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// The model to use for all AI calls
const MODEL = "claude-sonnet-4-20250514";

// ============================================================
// JOB DESCRIPTION PARSING
// ============================================================

/**
 * Uses Claude to parse a raw job description into structured data.
 *
 * TS concept: `Promise<Partial<Job>>` — resolves to a Job with some fields missing.
 * `Partial<T>` makes all fields of T optional (good for partial updates).
 *
 * @param rawText - The scraped job description text
 * @returns Parsed job fields as structured data
 */
export async function parseJobDescription(
  rawText: string
): Promise<Partial<Job>> {
  const client = getClient();

  // TS concept: Template literals can span multiple lines using backticks.
  const prompt = `Parse this job description and extract structured information.
Return ONLY valid JSON with these exact fields (use null for missing data):

{
  "title": "string",
  "company": "string or null",
  "location": "string or null",
  "level": "string or null (e.g. Senior, Mid, Junior)",
  "job_type": "string (Full-time/Part-time/Contract/Freelance)",
  "description": "string (2-3 sentence summary)",
  "requirements": ["array", "of", "requirement", "strings"],
  "responsibilities": ["array", "of", "responsibility", "strings"],
  "qualifications": ["array", "of", "qualification", "strings"],
  "salary": "string or null",
  "deadline": "string or null"
}

Job description to parse:
${rawText.slice(0, 8000)}`; // Limit to 8000 chars to avoid token limits

  // TS concept: `await` pauses this async function until the API responds.
  // The response type is inferred from the SDK's TypeScript definitions.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  // Extract the text content from the response
  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from AI");
  }

  // Parse the JSON response
  // TS concept: `JSON.parse()` returns `any` — we cast it to Partial<Job>
  try {
    const parsed = JSON.parse(content.text) as Partial<Job>;
    return parsed;
  } catch {
    console.error("[ai] Failed to parse job description JSON:", content.text);
    // Return minimal parsed data on failure
    return {
      description: rawText.slice(0, 1000),
      requirements: [],
      responsibilities: [],
      qualifications: [],
    };
  }
}

// ============================================================
// CV GENERATION
// ============================================================

/**
 * Generates a tailored CV for a specific job using the selected lenses.
 *
 * The CV is customized by:
 * 1. Using the best-matching lens for each career stint
 * 2. Highlighting skills that match the job requirements
 * 3. Writing a custom professional summary
 *
 * @param job - The target job
 * @param selectedLenses - The best lens chosen for each stint
 * @param allLenses - All lenses (to get full bullet points)
 * @param profile - The user's profile
 * @returns Structured CV content ready to render
 */
export async function generateTailoredCV(
  job: Job,
  selectedLenses: Array<{ stint_name: string; lens_id: string }>,
  allLenses: RoleLens[],
  profile: Profile
): Promise<CVContent> {
  const client = getClient();

  // Build the experience section using only the selected lenses
  const experienceForPrompt = selectedLenses.map(({ stint_name: _stintName, lens_id }) => {
    // Find the full lens data from all lenses
    const lens = allLenses.find((l) => l.lens_id === lens_id);
    if (!lens) return null;
    return {
      stint_name: lens.stint_name,
      lens_id: lens.lens_id,
      title: lens.title,
      organization: lens.organization,
      period: lens.period,
      tags: lens.tags,
      bullets: lens.bullets,
      summary: lens.summary,
    };
  }).filter(Boolean); // Remove nulls

  const prompt = `You are a professional CV writer. Create a tailored CV for this job application.

TARGET JOB:
Title: ${job.title}
Company: ${job.company ?? "Unknown"}
Description: ${job.description ?? ""}
Requirements: ${job.requirements.join(", ")}

CANDIDATE PROFILE:
Name: ${profile.name}
Years of experience: ${profile.years_experience}
Languages: ${profile.languages.map((l) => `${l.language} (${l.level})`).join(", ")}

SELECTED EXPERIENCE (use exactly these roles and bullets, don't invent new ones):
${JSON.stringify(experienceForPrompt, null, 2)}

EDUCATION:
${profile.education.map((e) => `${e.degree}, ${e.institution} (${e.period})`).join("\n")}

CERTIFICATIONS:
${profile.certifications.join(", ")}

PUBLICATIONS:
${profile.publications.join("; ")}

Return ONLY valid JSON matching this exact structure:
{
  "name": "string",
  "contact": { "email": "string", "phone": "string", "linkedin": "string", "location": "string" },
  "summary": "3-4 sentence professional summary tailored to this specific job",
  "experience": [
    {
      "title": "string",
      "organization": "string",
      "period": "string",
      "bullets": ["array of bullet points — use the ones provided, optionally reordered/refined"]
    }
  ],
  "education": [{ "degree": "string", "institution": "string", "period": "string" }],
  "skills": ["top 10-15 skills most relevant to this job"],
  "certifications": ["array of certifications"],
  "publications": ["array of publications"],
  "lenses_used": [{ "stint_name": "string", "lens_id": "string", "title": "string", "score": 0 }]
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from AI");
  }

  try {
    // TS concept: `as CVContent` is a type assertion — we tell TypeScript
    // "trust me, this parsed object has the CVContent shape"
    return JSON.parse(content.text) as CVContent;
  } catch {
    throw new Error("AI returned invalid JSON for CV generation");
  }
}

// ============================================================
// COVER LETTER GENERATION
// ============================================================

/**
 * Generates a tailored cover letter for a job application.
 *
 * @param job - The target job
 * @param selectedLenses - Which lenses were used
 * @param matchResult - Match score and details
 * @param profile - The user's profile
 * @returns Structured cover letter content
 */
export async function generateCoverLetter(
  job: Job,
  selectedLenses: Array<{ stint_name: string; lens_id: string; title: string }>,
  matchResult: MatchResult,
  profile: Profile
): Promise<CoverLetterContent> {
  const client = getClient();

  // Determine the "angle" — what's the strongest story to tell?
  const primaryLens = selectedLenses[0];
  const angle = primaryLens?.title ?? "Programme Management";

  const prompt = `You are a professional cover letter writer. Write a compelling cover letter.

TARGET JOB:
Title: ${job.title}
Company: ${job.company ?? "the organization"}
Description: ${job.description ?? ""}
Key requirements: ${job.requirements.slice(0, 5).join(", ")}

CANDIDATE:
Name: ${profile.name}
Years of experience: ${profile.years_experience}
Primary angle to highlight: ${angle}
Selected roles: ${selectedLenses.map((l) => l.title).join(", ")}
Match score: ${matchResult.match_score}%

Write a professional, confident cover letter with:
- Opening that hooks attention (reference something specific about the company/role)
- 2-3 body paragraphs highlighting most relevant experience
- Strong closing with clear call to action
- Tone: professional but warm, not robotic

Return ONLY valid JSON:
{
  "subject": "Application for [Job Title] — [Name]",
  "salutation": "Dear Hiring Manager,",
  "paragraphs": ["paragraph 1", "paragraph 2", "paragraph 3", "closing paragraph"],
  "closing": "Sincerely,",
  "angle": "${angle}"
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from AI");
  }

  try {
    return JSON.parse(content.text) as CoverLetterContent;
  } catch {
    throw new Error("AI returned invalid JSON for cover letter generation");
  }
}

// ============================================================
// JOB SEARCH FALLBACK
// ============================================================

/**
 * Falls back to Claude's web_search tool when Lightpanda is unavailable.
 * This searches for jobs using Claude's built-in internet access.
 *
 * TS concept: `Promise<RawJobListing[]>` — resolves to an array of job listings.
 * Arrays are written as `Type[]` or `Array<Type>` (both are equivalent).
 *
 * @param keywords - Search keywords (e.g. ["programme manager", "Geneva"])
 * @param locations - Target locations
 * @returns Array of raw job listings found
 */
export async function searchJobsWithAI(
  keywords: string[],
  locations: string[]
): Promise<RawJobListing[]> {
  const client = getClient();

  const searchQuery = `${keywords.slice(0, 3).join(" ")} jobs ${locations.slice(0, 2).join(" OR ")} 2024 2025`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    tools: [
      {
        name: "web_search",
        description: "Search the web for job listings",
        input_schema: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Search for job listings matching: "${searchQuery}".
Find at least 10 real job postings and return them as a JSON array.
Each job should have: title, company, location, url, snippet (first 200 chars of description), source.`,
      },
    ],
  });

  // Process tool use results
  // TS concept: `.find()` returns `T | undefined` — we handle the undefined case
  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    return [];
  }

  try {
    // Try to extract JSON from the response
    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const listings = JSON.parse(jsonMatch[0]) as RawJobListing[];
    // Add source and timestamp if not present
    return listings.map((listing) => ({
      ...listing,
      source: listing.source ?? "web",
      discovered_at: new Date().toISOString(),
    }));
  } catch {
    console.error("[ai] Failed to parse job search results");
    return [];
  }
}
