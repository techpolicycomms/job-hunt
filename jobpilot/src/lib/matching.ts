// ============================================================
// src/lib/matching.ts
// The lens matching engine — the heart of JobPilot.
//
// Given a job description and a list of all role lenses,
// this module:
// 1. Groups lenses by stint
// 2. Scores each lens against the job's keywords
// 3. Picks the best-scoring lens per stint
// 4. Computes an overall match score
// 5. Runs eligibility checks
// ============================================================

import type {
  RoleLens,
  Profile,
  MatchDetails,
  MatchResult,
  SelectedLens,
  LensMatchScore,
  EligibilityChecks,
} from "@/lib/types";

// ============================================================
// CONSTANTS
// ============================================================

/** Jobs below this score are not worth generating materials for */
export const DEFAULT_THRESHOLD = 75;

/**
 * Words to ignore when building keyword sets.
 * These are too common to be meaningful for matching.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "need",
  "that", "this", "these", "those", "it", "its", "we", "you", "they",
  "our", "your", "their", "about", "than", "more", "also", "into",
  "within", "across", "through", "including", "such", "other", "both",
  "each", "all", "any", "some", "most", "very", "well", "new", "strong",
]);

// ============================================================
// UTILITY: TEXT PROCESSING
// ============================================================

/**
 * Converts raw job description text into a Set of meaningful keywords.
 *
 * TS concept: `Set<string>` — a collection of unique strings.
 * Much faster than Array for `.has()` lookups.
 *
 * @param text - Raw job description text
 * @returns Set of lowercase keywords
 */
export function extractKeywords(text: string): Set<string> {
  // Normalize: lowercase, remove punctuation, split on whitespace
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // keep hyphens (e.g. "full-time")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));

  return new Set(words);
}

/**
 * Scores how well a lens's tags match the job keywords.
 *
 * TS concept: The function signature shows both parameter types
 * and the return type explicitly for documentation.
 *
 * @param lens - The role lens to score
 * @param jobKeywords - Set of keywords from the job description
 * @returns A score object with match details
 */
export function scoreLensAgainstJob(
  lens: RoleLens,
  jobKeywords: Set<string>
): LensMatchScore {
  // Find which of this lens's tags appear in the job description
  const matchedTags = lens.tags.filter((tag) => {
    // Normalize the tag the same way we normalized the job text
    const normalizedTag = tag.toLowerCase().trim();
    // Check if the job contains this tag or a word from the tag
    return (
      jobKeywords.has(normalizedTag) ||
      // Multi-word tags: check if all words in the tag appear in the job
      normalizedTag.split(/\s+/).every((word) => jobKeywords.has(word))
    );
  });

  // Score = percentage of this lens's tags that matched
  // Guard against division by zero for lenses with no tags
  const score =
    lens.tags.length > 0
      ? Math.round((matchedTags.length / lens.tags.length) * 100)
      : 0;

  return {
    lens_id: lens.lens_id,
    title: lens.title,
    tags: lens.tags,
    matched_tags: matchedTags,
    score,
  };
}

// ============================================================
// MAIN MATCHING FUNCTIONS
// ============================================================

/**
 * Groups lenses by stint, scores each, and picks the best lens per stint.
 *
 * TS concept: `Record<string, RoleLens[]>` is equivalent to `{ [key: string]: RoleLens[] }`.
 * Both describe an object where keys are strings and values are arrays of RoleLens.
 *
 * @param jobText - The full job description text
 * @param lenses - All lenses from the user's profile
 * @returns The best-matching lens per stint, and full scoring details
 */
export function selectBestLenses(
  jobText: string,
  lenses: RoleLens[]
): { selectedLenses: SelectedLens[]; matchDetails: MatchDetails } {
  // Step 1: Extract keywords from the job description
  const jobKeywords = extractKeywords(jobText);

  // Step 2: Group lenses by stint name
  // `reduce` builds up an accumulator object by iterating over the array
  const byStint = lenses.reduce<Record<string, RoleLens[]>>(
    (accumulator, lens) => {
      // If this stint doesn't exist in the accumulator yet, create an empty array
      if (!accumulator[lens.stint_name]) {
        accumulator[lens.stint_name] = [];
      }
      accumulator[lens.stint_name].push(lens);
      return accumulator;
    },
    {} // Initial value: empty object
  );

  // Step 3: For each stint, score all lenses and pick the highest scorer
  const stintResults: Record<string, LensMatchScore[]> = {};
  const selectedLenses: SelectedLens[] = [];

  // `Object.entries()` gives us [key, value] pairs
  for (const [stintName, stintLenses] of Object.entries(byStint)) {
    // Score every lens in this stint
    const scores = stintLenses.map((lens) =>
      scoreLensAgainstJob(lens, jobKeywords)
    );

    // Sort by score descending to find the winner
    scores.sort((a, b) => b.score - a.score);

    stintResults[stintName] = scores;

    // The first element after sorting is the best lens for this stint
    const bestScore = scores[0];
    if (bestScore) {
      selectedLenses.push({
        stint_name: stintName,
        lens_id: bestScore.lens_id,
        title: bestScore.title,
        score: bestScore.score,
      });
    }
  }

  // Step 4: Compute overall match score
  const overallScore = computeMatchScore(selectedLenses);

  // Count total matched keywords across all selected lenses
  const totalMatched = selectedLenses.reduce((sum, sel) => {
    // Find the full score object for this selection
    const stintScores = stintResults[sel.stint_name] ?? [];
    const scoreObj = stintScores.find((s) => s.lens_id === sel.lens_id);
    return sum + (scoreObj?.matched_tags.length ?? 0);
  }, 0);

  const matchDetails: MatchDetails = {
    stints: stintResults,
    overall_score: overallScore,
    total_job_keywords: jobKeywords.size,
    total_matched_keywords: totalMatched,
    computed_at: new Date().toISOString(),
  };

  return { selectedLenses, matchDetails };
}

/**
 * Computes the overall match score as a weighted average of per-stint lens scores.
 *
 * Each stint contributes equally to the final score (simple average).
 * If no lenses were selected, returns 0.
 *
 * @param selectedLenses - The best lens chosen from each stint
 * @returns 0-100 percentage score
 */
export function computeMatchScore(selectedLenses: SelectedLens[]): number {
  if (selectedLenses.length === 0) return 0;

  const sum = selectedLenses.reduce((total, lens) => total + lens.score, 0);
  return Math.round(sum / selectedLenses.length);
}

/**
 * Runs automated eligibility checks against the job description.
 * These are rough heuristics — not guarantees.
 *
 * @param jobText - The full job description text
 * @param profile - The user's profile
 * @returns Pass/fail results for each eligibility dimension
 */
export function runEligibilityChecks(
  jobText: string,
  profile: Profile
): EligibilityChecks {
  const jobLower = jobText.toLowerCase();

  // TS concept: Destructuring — extract multiple fields from an object at once
  const {
    education,
    years_experience,
    languages,
    address,
    work_permit,
  } = profile;

  // Array to collect any issues found
  const flags: Array<{ check: string; issue: string }> = [];

  // --- Education check ---
  // Does the job mention a PhD/doctorate requirement?
  const requiresPhd =
    jobLower.includes("phd") ||
    jobLower.includes("doctorate") ||
    jobLower.includes("doctoral");
  const hasPhd = education.some(
    (e) =>
      e.degree.toLowerCase().includes("phd") ||
      e.degree.toLowerCase().includes("doctor")
  );
  const education_match = requiresPhd ? hasPhd : true;
  if (!education_match) {
    flags.push({ check: "education", issue: "Job may require PhD" });
  }

  // --- Experience check ---
  // Extract years of experience requirements like "5+ years", "minimum 3 years"
  const expMatch = jobLower.match(/(\d+)\+?\s*years?\s+(?:of\s+)?experience/i);
  const requiredYears = expMatch ? parseInt(expMatch[1], 10) : 0;
  const experience_match =
    requiredYears === 0 || years_experience >= requiredYears;
  if (!experience_match) {
    flags.push({
      check: "experience",
      issue: `Job requires ${requiredYears} years; you have ${years_experience}`,
    });
  }

  // --- Language check ---
  // Check if job mentions a required language the user doesn't have
  const requiresFrench =
    jobLower.includes("french") || jobLower.includes("français");
  const hasFrench = languages.some(
    (l) => l.language.toLowerCase() === "french" && l.level !== "Beginner"
  );
  const language_match = requiresFrench ? hasFrench : true;
  if (!language_match) {
    flags.push({ check: "language", issue: "Job may require French proficiency" });
  }

  // --- Location check ---
  // Is the job in a location the user is targeting?
  const targetLocations = ["geneva", "zurich", "dublin", "remote", "switzerland"];
  const jobLocation = jobLower;
  const location_match = targetLocations.some((loc) =>
    jobLocation.includes(loc)
  );
  if (!location_match) {
    flags.push({ check: "location", issue: "Job location may not match your targets" });
  }

  // --- Work permit check ---
  // Is the user eligible to work in the job's location?
  // Simplified: we assume Swiss Permis B covers Switzerland/EU jobs
  const work_permit_ok =
    !!work_permit &&
    (work_permit.toLowerCase().includes("permis b") ||
      work_permit.toLowerCase().includes("eu") ||
      jobLower.includes("remote"));

  return {
    education_match,
    experience_match,
    language_match,
    location_match,
    work_permit_ok,
    flags,
  };
}

/**
 * Generates a human-readable recommendation string based on the match score
 * and eligibility checks.
 *
 * @param score - The overall match score (0-100)
 * @param checks - Eligibility check results
 * @returns A recommendation string like "Strong match — apply immediately"
 */
export function getRecommendation(
  score: number,
  checks: EligibilityChecks
): string {
  const eligibleCount = [
    checks.education_match,
    checks.experience_match,
    checks.language_match,
    checks.location_match,
  ].filter(Boolean).length; // `.filter(Boolean)` removes false/null/undefined values

  if (score >= 85 && eligibleCount === 4) {
    return "Excellent match — apply immediately";
  } else if (score >= 75 && eligibleCount >= 3) {
    return "Strong match — highly recommended";
  } else if (score >= 60 && eligibleCount >= 3) {
    return "Good match — worth applying";
  } else if (score >= 50) {
    return "Moderate match — apply if time allows";
  } else if (score >= 30) {
    return "Weak match — consider carefully";
  } else {
    return "Poor match — not recommended";
  }
}

/**
 * Full matching pipeline for a single job.
 * Combines all the functions above into one convenient call.
 *
 * @param jobId - The database ID of the job
 * @param jobText - The full job description text
 * @param lenses - All role lenses from the user's profile
 * @param profile - The user's profile
 * @returns Complete MatchResult ready to save to the database
 */
export function matchJobToProfile(
  jobId: string,
  jobText: string,
  lenses: RoleLens[],
  profile: Profile
): MatchResult {
  const { selectedLenses, matchDetails } = selectBestLenses(jobText, lenses);
  const eligibilityChecks = runEligibilityChecks(jobText, profile);
  const recommendation = getRecommendation(
    matchDetails.overall_score,
    eligibilityChecks
  );

  return {
    job_id: jobId,
    match_score: matchDetails.overall_score,
    match_details: matchDetails,
    selected_lenses: selectedLenses,
    recommendation,
    eligibility_checks: eligibilityChecks,
  };
}
