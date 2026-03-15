// ============================================================
// src/lib/types.ts
// Central type definitions for the entire JobPilot application.
//
// TS CONCEPTS DEMONSTRATED HERE:
// - interface vs type
// - union types
// - generic types
// - optional properties (?)
// - readonly
// - utility types (Partial, Pick, Omit)
// ============================================================

// ============================================================
// UNION TYPES
// A union type means "this value can be one of these exact strings".
// TypeScript will give you an error if you use any other string.
// ============================================================

/**
 * The pipeline status tracks where a job is in the automated workflow.
 * Using a union type means you can't accidentally write 'Discovered' or 'MATCHED'.
 */
export type PipelineStatus =
  | "discovered"
  | "matched"
  | "materials_generated"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "applied"
  | "archived";

/**
 * Application status tracks a job through the hiring process after applying.
 */
export type ApplicationStatus =
  | "applied"
  | "screening"
  | "interview_scheduled"
  | "interview_done"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "ghosted";

/**
 * Which platform was this job discovered on?
 */
export type JobSource =
  | "linkedin"
  | "google_careers"
  | "indeed"
  | "unjobs"
  | "web"
  | "manual";

// ============================================================
// INTERFACES
// Interfaces describe the shape of objects.
// Use `interface` when defining object types that might be
// extended or implemented by classes.
// Use `type` when you need unions, intersections, or mapped types.
// ============================================================

/**
 * A language proficiency entry in the user's profile.
 */
export interface LanguageEntry {
  language: string;
  level: string; // e.g. "Native", "B2", "Conversational"
}

/**
 * An education entry in the user's profile.
 */
export interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
  // `?` makes the field optional — it can be undefined
  exchange?: string;
  gpa?: string;
}

/**
 * Full user profile — mirrors the `profiles` database table.
 */
export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;      // `string | null` means the DB value can be NULL
  phone: string | null;
  address: string | null;
  linkedin: string | null;
  nationality: string | null;
  work_permit: string | null;
  languages: LanguageEntry[];
  years_experience: number;
  education: EducationEntry[];
  certifications: string[];
  publications: string[];
  achievements: string[];
  // Record<string, unknown>: an object with string keys and any values
  personal_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * A single "lens" — one way of framing a career stint.
 * Each stint has 3-5 lenses, and we pick the best one per job.
 */
export interface RoleLens {
  id: string;
  profile_id: string;
  stint_name: string;   // e.g. "ITU 2021-Present"
  period: string;        // e.g. "2021-Present"
  organization: string;  // e.g. "ITU"
  lens_id: string;       // e.g. "itu21_innovation"
  title: string;         // e.g. "Innovation and Partnership Lead"
  tags: string[];        // Keywords for matching: ["AI", "innovation", ...]
  summary: string | null;
  bullets: string[];     // CV bullet points
  sort_order: number;
  created_at: string;
}

/**
 * Detailed match scoring for a single lens.
 */
export interface LensMatchScore {
  lens_id: string;
  title: string;
  tags: string[];
  // Which tags from this lens were found in the job description
  matched_tags: string[];
  // 0-100 percentage
  score: number;
}

/**
 * Match results broken down by stint.
 * Record<string, LensMatchScore[]> maps stint_name → array of lens scores
 */
export interface MatchDetails {
  // Per-stint breakdown: { "ITU 2021-Present": [{ lens_id, score, ... }, ...] }
  stints: Record<string, LensMatchScore[]>;
  // Overall weighted score
  overall_score: number;
  // Total tags in job description
  total_job_keywords: number;
  // Total tags matched across all selected lenses
  total_matched_keywords: number;
  computed_at: string;
}

/**
 * Records which lens was chosen for each stint when generating materials.
 */
export interface SelectedLens {
  stint_name: string;
  lens_id: string;
  title: string;
  score: number;
}

/**
 * Results of automated eligibility pre-screening.
 */
export interface EligibilityChecks {
  education_match: boolean;
  experience_match: boolean;
  language_match: boolean;
  location_match: boolean;
  work_permit_ok: boolean;
  // Any check that failed, with a reason
  flags: Array<{ check: string; issue: string }>;
}

/**
 * A job listing discovered from any platform.
 * Mirrors the `jobs` database table.
 */
export interface Job {
  id: string;
  user_id: string;
  url: string | null;
  title: string;
  company: string | null;
  location: string | null;
  level: string | null;
  job_type: string;
  description: string | null;
  requirements: string[];
  responsibilities: string[];
  qualifications: string[];
  salary: string | null;
  deadline: string | null;
  source: JobSource | null;
  raw_text: string | null;
  match_score: number;
  match_details: MatchDetails | null;
  selected_lenses: SelectedLens[] | null;
  recommendation: string | null;
  eligibility_checks: EligibilityChecks | null;
  pipeline_status: PipelineStatus;
  is_bookmarked: boolean;
  discovered_at: string;
  created_at: string;
}

/**
 * AI-generated CV and cover letter for a specific job application.
 * Mirrors the `generated_materials` database table.
 */
export interface GeneratedMaterials {
  id: string;
  job_id: string;
  user_id: string;
  // CV structured as sections: { header, summary, experience, education, ... }
  cv_content: CVContent | null;
  // Cover letter as paragraphs with metadata
  cover_letter_content: CoverLetterContent | null;
  // Pre-filled answers for common application form fields
  form_fill_data: Record<string, string> | null;
  lenses_used: string[];
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Structure of the AI-generated CV.
 */
export interface CVContent {
  name: string;
  contact: {
    email?: string;
    phone?: string;
    linkedin?: string;
    location?: string;
  };
  // One-paragraph professional summary tailored to the job
  summary: string;
  // Experience section: one entry per role lens
  experience: Array<{
    title: string;
    organization: string;
    period: string;
    bullets: string[];
  }>;
  education: EducationEntry[];
  skills: string[];
  certifications: string[];
  publications: string[];
  // Which lens was used for each stint
  lenses_used: SelectedLens[];
}

/**
 * Structure of the AI-generated cover letter.
 */
export interface CoverLetterContent {
  subject: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  // The main "angle" or theme of this cover letter
  angle: string;
}

/**
 * A submitted job application tracked through the hiring funnel.
 * Mirrors the `applications` database table.
 */
export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  materials_id: string | null;
  status: ApplicationStatus;
  date_applied: string;
  deadline: string | null;
  lenses_used: string[];
  cover_letter_angle: string | null;
  next_action: string | null;
  next_action_date: string | null;
  follow_up_count: number;
  last_follow_up: string | null;
  interview_stage: string | null;
  interview_date: string | null;
  interview_notes: string | null;
  outcome: string | null;
  rejection_reason: string | null;
  lessons_learned: string | null;
  created_at: string;
  updated_at: string;
  // Joined relation — sometimes included, sometimes not
  // The `?` makes it optional so queries without JOIN still type-check
  job?: Job;
  materials?: GeneratedMaterials;
}

/**
 * Which platforms are enabled for job searching.
 */
export interface PlatformSettings {
  linkedin: boolean;
  google_careers: boolean;
  indeed: boolean;
  unjobs: boolean;
  web: boolean;
}

/**
 * User's search and pipeline configuration.
 * Mirrors the `search_preferences` database table.
 */
export interface SearchPreferences {
  id: string;
  user_id: string;
  keywords: string[];
  locations: string[];
  job_types: string[];
  min_match_score: number;
  max_daily_jobs: number;
  excluded_companies: string[];
  excluded_keywords: string[];
  platforms: PlatformSettings;
  is_active: boolean;
  last_search_at: string | null;
  created_at: string;
}

/**
 * A record of one daily pipeline execution.
 * Mirrors the `pipeline_runs` database table.
 */
export interface PipelineRun {
  id: string;
  user_id: string;
  run_date: string;
  jobs_discovered: number;
  jobs_matched: number;
  jobs_above_threshold: number;
  materials_generated: number;
  jobs_queued_for_review: number;
  errors: Array<{ step: string; message: string; timestamp: string }>;
  duration_ms: number | null;
  created_at: string;
}

// ============================================================
// GENERIC TYPES
// TS concept: Generics let you write reusable code that works
// with many types. T is a placeholder for "whatever type you use".
// ============================================================

/**
 * Standard API response wrapper.
 *
 * Usage examples:
 *   ApiResponse<Job>           — success contains a single Job
 *   ApiResponse<Job[]>         — success contains an array of Jobs
 *   ApiResponse<{ count: number }> — success contains a count object
 *
 * TS concept: The `<T>` is a "type parameter" — like a variable for types.
 * When you write `ApiResponse<Job>`, TypeScript replaces T with Job everywhere.
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * A raw job listing from a scraper before AI parsing.
 */
export interface RawJobListing {
  url: string;
  title: string;
  company: string;
  location: string;
  source: JobSource;
  // The raw text or HTML we scraped
  snippet: string;
  // When it was scraped (ISO timestamp)
  discovered_at: string;
}

/**
 * Result from the matching engine for a single job.
 */
export interface MatchResult {
  job_id: string;
  match_score: number;
  match_details: MatchDetails;
  selected_lenses: SelectedLens[];
  recommendation: string;
  eligibility_checks: EligibilityChecks;
}

// ============================================================
// UTILITY TYPE EXAMPLES
// TS provides built-in "utility types" to transform existing types.
// ============================================================

/**
 * For creating a new job (no id/timestamps yet).
 * `Omit<T, K>` creates a new type with certain keys removed.
 */
export type NewJob = Omit<Job, "id" | "created_at" | "discovered_at">;

/**
 * For updating a job (all fields optional).
 * `Partial<T>` makes every field optional.
 */
export type JobUpdate = Partial<Job>;

/**
 * Just the fields needed for the pipeline review card.
 * `Pick<T, K>` creates a type with only the specified keys.
 */
export type JobSummary = Pick<
  Job,
  "id" | "title" | "company" | "location" | "match_score" | "pipeline_status" | "source" | "discovered_at"
>;
