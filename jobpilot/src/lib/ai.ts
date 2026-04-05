// ============================================================
// src/lib/ai.ts
// AI functions for lens selection, CV generation, and cover letter generation.
// Uses Anthropic Claude. SERVER-SIDE ONLY.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import type {
  RoleLens,
  Profile,
  CVContent,
  CoverLetterContent,
  SelectedLens,
  ScrapedJob,
} from "@/lib/types";

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const MODEL = "claude-sonnet-4-20250514";

// ============================================================
// AI LENS SELECTION
// ============================================================

/**
 * Uses Claude to select the most relevant lens for each career stint
 * based on the job description. This replaces the old tag-matching algorithm.
 */
export async function selectLenses(
  job: ScrapedJob,
  allLenses: RoleLens[]
): Promise<SelectedLens[]> {
  const client = getClient();

  // Group lenses by stint
  const stints: Record<string, Array<{ lens_id: string; title: string; tags: string[]; summary: string | null }>> = {};
  for (const lens of allLenses) {
    if (!stints[lens.stint_name]) stints[lens.stint_name] = [];
    stints[lens.stint_name].push({
      lens_id: lens.lens_id,
      title: lens.title,
      tags: lens.tags,
      summary: lens.summary,
    });
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are helping select the best framing of a candidate's experience for a job application.

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Requirements: ${job.requirements.join(", ")}
Keywords: ${job.keywords.join(", ")}

The candidate has multiple career stints, each with several alternative "lenses" (framings).
Pick the SINGLE BEST lens for each stint that most closely matches this job.

STINTS AND LENSES:
${JSON.stringify(stints, null, 2)}

Return ONLY valid JSON — an array of objects:
[
  {
    "stint_name": "exact stint name",
    "lens_id": "exact lens_id",
    "title": "exact lens title",
    "relevance": "one sentence explaining why this lens is the best match"
  }
]

Include ALL stints. Pick exactly one lens per stint.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected AI response");

  let jsonText = content.text;
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonText = jsonMatch[1];

  try {
    return JSON.parse(jsonText.trim()) as SelectedLens[];
  } catch {
    throw new Error("AI returned invalid JSON for lens selection");
  }
}

// ============================================================
// ATS-OPTIMIZED CV GENERATION
// ============================================================

export async function generateCV(
  job: ScrapedJob,
  selectedLenses: SelectedLens[],
  allLenses: RoleLens[],
  profile: Profile
): Promise<CVContent> {
  const client = getClient();

  // Build experience data using selected lenses
  const experience = selectedLenses
    .map(({ lens_id }) => {
      const lens = allLenses.find((l) => l.lens_id === lens_id);
      if (!lens) return null;
      return {
        lens_id: lens.lens_id,
        stint_name: lens.stint_name,
        title: lens.title,
        organization: lens.organization,
        period: lens.period,
        tags: lens.tags,
        bullets: lens.bullets,
        summary: lens.summary,
      };
    })
    .filter(Boolean);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are an expert CV writer specializing in ATS (Applicant Tracking System) optimization.

Create a tailored, ATS-friendly CV for this job application.

ATS RULES — CRITICAL:
- Use standard section headers: PROFESSIONAL SUMMARY, EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS, PUBLICATIONS
- NO tables, columns, graphics, or special formatting
- Weave these job keywords naturally into the summary and bullet points: ${job.keywords.join(", ")}
- Front-load each bullet point with a strong action verb
- Include measurable results where possible (numbers, percentages, amounts)
- Keep bullet points concise (1-2 lines each)
- Skills section should list keywords that match the job requirements

TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Requirements: ${job.requirements.join("; ")}
Key ATS Keywords: ${job.keywords.join(", ")}

CANDIDATE:
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
LinkedIn: ${profile.linkedin}
Location: ${profile.address}
Years of experience: ${profile.years_experience}
Languages: ${profile.languages.map((l) => `${l.language} (${l.level})`).join(", ")}

EXPERIENCE (use these roles and bullets — refine wording for ATS but don't fabricate):
${JSON.stringify(experience, null, 2)}

EDUCATION:
${profile.education.map((e) => `${e.degree}, ${e.institution} (${e.period})${e.exchange ? ` — Exchange: ${e.exchange}` : ""}`).join("\n")}

CERTIFICATIONS: ${profile.certifications.join("; ")}
PUBLICATIONS: ${profile.publications.join("; ")}
ACHIEVEMENTS: ${profile.achievements.join("; ")}

Return ONLY valid JSON:
{
  "name": "${profile.name}",
  "contact": { "email": "${profile.email}", "phone": "${profile.phone}", "linkedin": "${profile.linkedin}", "location": "${profile.address}" },
  "summary": "3-4 sentence ATS-optimized professional summary weaving in job keywords",
  "experience": [
    {
      "title": "role title",
      "organization": "org name",
      "period": "date range",
      "bullets": ["ATS-optimized bullet 1", "bullet 2", ...]
    }
  ],
  "education": [{ "degree": "...", "institution": "...", "period": "..." }],
  "skills": ["top 15 skills matching job keywords"],
  "certifications": ["..."],
  "publications": ["..."],
  "lenses_used": ${JSON.stringify(selectedLenses)}
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected AI response");

  let jsonText = content.text;
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonText = jsonMatch[1];

  try {
    return JSON.parse(jsonText.trim()) as CVContent;
  } catch {
    throw new Error("AI returned invalid JSON for CV generation");
  }
}

// ============================================================
// ATS-OPTIMIZED COVER LETTER GENERATION
// ============================================================

export async function generateCoverLetter(
  job: ScrapedJob,
  selectedLenses: SelectedLens[],
  profile: Profile
): Promise<CoverLetterContent> {
  const client = getClient();

  const primaryAngle = selectedLenses[0]?.title ?? "Programme Management";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Write a compelling, ATS-friendly cover letter for this job application.

ATS RULES:
- Include job-relevant keywords naturally: ${job.keywords.slice(0, 15).join(", ")}
- Reference the specific job title and company name
- Keep it to 3-4 paragraphs (not too long)
- Professional but warm tone — not robotic
- Opening should hook attention with something specific about the role/company
- Body paragraphs highlight the most relevant experience
- Strong closing with a clear call to action

JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.description}
Key Requirements: ${job.requirements.slice(0, 5).join("; ")}

CANDIDATE:
Name: ${profile.name}
Years of experience: ${profile.years_experience}
Primary angle: ${primaryAngle}
Key roles: ${selectedLenses.map((l) => l.title).join(", ")}
Location: ${profile.address}

Return ONLY valid JSON:
{
  "subject": "Application for ${job.title} — ${profile.name}",
  "salutation": "Dear Hiring Manager,",
  "paragraphs": ["opening paragraph", "body paragraph 1", "body paragraph 2", "closing paragraph"],
  "closing": "Sincerely,",
  "angle": "${primaryAngle}"
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected AI response");

  let jsonText = content.text;
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonText = jsonMatch[1];

  try {
    return JSON.parse(jsonText.trim()) as CoverLetterContent;
  } catch {
    throw new Error("AI returned invalid JSON for cover letter");
  }
}
