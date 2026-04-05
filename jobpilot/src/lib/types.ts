// ============================================================
// src/lib/types.ts
// Central type definitions for JobPilot — URL-first workflow.
// ============================================================

// --- Status types ---

export type ApplicationStatus =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "ghosted";

export type JobSource =
  | "linkedin"
  | "indeed"
  | "unjobs"
  | "company_site"
  | "other";

// --- Profile types ---

export interface LanguageEntry {
  language: string;
  level: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  period: string;
  exchange?: string;
  gpa?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
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
  personal_info: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- Role lens types ---

export interface RoleLens {
  id: string;
  profile_id: string;
  stint_name: string;
  period: string;
  organization: string;
  lens_id: string;
  title: string;
  tags: string[];
  summary: string | null;
  bullets: string[];
  sort_order: number;
  created_at: string;
}

export interface SelectedLens {
  stint_name: string;
  lens_id: string;
  title: string;
  relevance: string; // brief explanation of why this lens was selected
}

// --- Job types ---

export interface ScrapedJob {
  title: string;
  company: string;
  location: string | null;
  description: string;
  requirements: string[];
  keywords: string[];
  salary: string | null;
  deadline: string | null;
  job_type: string;
  level: string | null;
}

export interface Job {
  id: string;
  user_id: string;
  url: string;
  title: string;
  company: string;
  location: string | null;
  level: string | null;
  job_type: string;
  description: string | null;
  requirements: string[];
  keywords: string[];
  salary: string | null;
  deadline: string | null;
  source: JobSource;
  raw_text: string | null;
  created_at: string;
}

// --- Generated materials types ---

export interface CVContent {
  name: string;
  contact: {
    email?: string;
    phone?: string;
    linkedin?: string;
    location?: string;
  };
  summary: string;
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
  lenses_used: SelectedLens[];
}

export interface CoverLetterContent {
  subject: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  angle: string;
}

export interface GeneratedMaterials {
  id: string;
  job_id: string;
  user_id: string;
  cv_content: CVContent | null;
  cover_letter_content: CoverLetterContent | null;
  lenses_used: string[];
  file_prefix: string | null;
  created_at: string;
  updated_at: string;
}

// --- Application types ---

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  materials_id: string | null;
  status: ApplicationStatus;
  date_applied: string;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  job?: Job;
  materials?: GeneratedMaterials;
}

// --- API response wrapper ---

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
