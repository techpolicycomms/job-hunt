-- ============================================================
-- src/lib/schema.sql
-- Full Supabase database schema for JobPilot.
-- Run this in your Supabase project's SQL Editor.
-- ============================================================

-- Enable the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: profiles
-- Stores user profile data including personal info, education,
-- certifications, and publications.
-- ============================================================
CREATE TABLE profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- References the Supabase built-in auth.users table
  user_id           uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  name              text NOT NULL,
  email             text,
  phone             text,
  address           text,
  linkedin          text,
  nationality       text,
  work_permit       text,
  -- JSONB: binary JSON — faster queries than plain JSON
  -- Stores array of {language, level} objects
  languages         jsonb DEFAULT '[]'::jsonb,
  years_experience  int DEFAULT 0,
  -- Stores array of {degree, institution, year, gpa?} objects
  education         jsonb DEFAULT '[]'::jsonb,
  certifications    text[] DEFAULT '{}'::text[],
  publications      text[] DEFAULT '{}'::text[],
  achievements      text[] DEFAULT '{}'::text[],
  -- Flexible catch-all for any extra personal data
  personal_info     jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: role_lenses
-- Each "lens" is an alternative framing of a career stint.
-- E.g., the same ITU 2021-present job can be framed as
-- "Innovation Lead" or "Sustainability Analyst" depending on context.
-- ============================================================
CREATE TABLE role_lenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  -- Human-readable name of the career period, e.g. "ITU 2021-Present"
  stint_name   text NOT NULL,
  -- Date range string, e.g. "2021-Present"
  period       text NOT NULL,
  -- Employer/organization name
  organization text NOT NULL,
  -- Unique identifier for this lens, e.g. "itu21_innovation"
  lens_id      text NOT NULL,
  -- Job title for this framing
  title        text NOT NULL,
  -- Keywords used for matching against job descriptions
  tags         text[] DEFAULT '{}'::text[],
  -- One-paragraph summary for this lens
  summary      text,
  -- Array of CV bullet points for this lens
  bullets      text[] DEFAULT '{}'::text[],
  -- Controls display order in the UI
  sort_order   int DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  -- Ensure each profile can only have one lens with a given ID
  UNIQUE(profile_id, lens_id)
);

-- ============================================================
-- TABLE: jobs
-- Stores discovered job listings from all platforms.
-- pipeline_status tracks where the job is in the workflow.
-- ============================================================
CREATE TABLE jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) NOT NULL,
  url               text,
  title             text NOT NULL,
  company           text,
  location          text,
  level             text,   -- e.g. "Senior", "Mid", "Junior"
  job_type          text DEFAULT 'Full-time',
  description       text,
  -- Parsed arrays from the job description
  requirements      text[] DEFAULT '{}'::text[],
  responsibilities  text[] DEFAULT '{}'::text[],
  qualifications    text[] DEFAULT '{}'::text[],
  salary            text,
  deadline          text,
  -- Source platform: 'linkedin', 'indeed', 'google_careers', etc.
  source            text,
  -- The raw scraped text before AI parsing
  raw_text          text,
  -- 0-100 percentage match score
  match_score       int DEFAULT 0,
  -- JSON object with per-stint and per-lens scores
  match_details     jsonb,
  -- JSON object recording which lens was chosen per stint
  selected_lenses   jsonb,
  -- Human-readable recommendation string
  recommendation    text,
  -- JSON object with education/experience/language/location checks
  eligibility_checks jsonb,
  -- Tracks the job through the pipeline workflow
  pipeline_status   text DEFAULT 'discovered' CHECK (
    pipeline_status IN (
      'discovered',           -- Just found by scraper
      'matched',              -- Match score computed
      'materials_generated',  -- CV and cover letter created
      'ready_for_review',     -- Queued for human review
      'approved',             -- User approved the application
      'rejected',             -- User rejected the job
      'applied',              -- Application sent
      'archived'              -- Old job, no longer active
    )
  ),
  is_bookmarked     bool DEFAULT false,
  discovered_at     timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: generated_materials
-- Stores AI-generated CV and cover letter for a specific job.
-- ============================================================
CREATE TABLE generated_materials (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id               uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id              uuid REFERENCES auth.users(id) NOT NULL,
  -- Full CV as structured JSON (sections, bullets, etc.)
  cv_content           jsonb,
  -- Cover letter as structured JSON (paragraphs, tone, etc.)
  cover_letter_content jsonb,
  -- Pre-filled answers for application forms
  form_fill_data       jsonb,
  -- Which lens IDs were used to generate this CV
  lenses_used          text[],
  is_approved          bool DEFAULT false,
  approved_at          timestamptz,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: applications
-- Tracks submitted job applications through the interview pipeline.
-- ============================================================
CREATE TABLE applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) NOT NULL,
  job_id            uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  materials_id      uuid REFERENCES generated_materials(id),
  -- Application status through the hiring funnel
  status            text DEFAULT 'applied' CHECK (
    status IN (
      'applied', 'screening', 'interview_scheduled',
      'interview_done', 'offer', 'rejected', 'withdrawn', 'ghosted'
    )
  ),
  date_applied      date DEFAULT CURRENT_DATE,
  deadline          date,
  lenses_used       text[],
  cover_letter_angle text,  -- e.g. "sustainability angle"
  next_action       text,   -- e.g. "Send follow-up email"
  next_action_date  date,
  follow_up_count   int DEFAULT 0,
  last_follow_up    date,
  interview_stage   text,
  interview_date    timestamptz,
  interview_notes   text,
  outcome           text,
  rejection_reason  text,
  lessons_learned   text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: search_preferences
-- Per-user settings for the automated job discovery pipeline.
-- ============================================================
CREATE TABLE search_preferences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  -- Keywords to search for across all platforms
  keywords          text[] DEFAULT '{}'::text[],
  -- Target locations
  locations         text[] DEFAULT '{}'::text[],
  job_types         text[] DEFAULT '{}'::text[],
  -- Only generate materials for jobs above this score (0-100)
  min_match_score   int DEFAULT 75,
  -- Maximum jobs to generate materials for per day
  max_daily_jobs    int DEFAULT 20,
  -- Companies to skip entirely
  excluded_companies text[] DEFAULT '{}'::text[],
  -- Keywords that disqualify a job
  excluded_keywords  text[] DEFAULT '{}'::text[],
  -- Which platforms to search (JSON object with boolean values)
  platforms         jsonb DEFAULT '{"linkedin":true,"google_careers":true,"indeed":true,"unjobs":true,"web":true}'::jsonb,
  -- Toggle to pause/resume the daily cron pipeline
  is_active         bool DEFAULT true,
  last_search_at    timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: pipeline_runs
-- Logs each daily pipeline execution for debugging and analytics.
-- ============================================================
CREATE TABLE pipeline_runs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES auth.users(id) NOT NULL,
  run_date                 date DEFAULT CURRENT_DATE,
  jobs_discovered          int DEFAULT 0,
  jobs_matched             int DEFAULT 0,
  jobs_above_threshold     int DEFAULT 0,
  materials_generated      int DEFAULT 0,
  jobs_queued_for_review   int DEFAULT 0,
  -- Array of error objects {step, message, timestamp}
  errors                   jsonb DEFAULT '[]'::jsonb,
  -- How long the pipeline took in milliseconds
  duration_ms              int,
  created_at               timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Every user can only see and modify their own rows.
-- This is enforced at the database level — even if your app
-- code has a bug, users cannot see each other's data.
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_lenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Profiles: user can only CRUD their own profile
CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (auth.uid() = user_id);

-- Role lenses: user can only access lenses belonging to their profile
CREATE POLICY "Users manage own lenses"
  ON role_lenses FOR ALL
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Jobs: user can only see their own discovered jobs
CREATE POLICY "Users manage own jobs"
  ON jobs FOR ALL
  USING (auth.uid() = user_id);

-- Generated materials: user can only see their own materials
CREATE POLICY "Users manage own materials"
  ON generated_materials FOR ALL
  USING (auth.uid() = user_id);

-- Applications: user can only see their own applications
CREATE POLICY "Users manage own applications"
  ON applications FOR ALL
  USING (auth.uid() = user_id);

-- Search preferences: user can only see their own settings
CREATE POLICY "Users manage own search preferences"
  ON search_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Pipeline runs: user can only see their own run history
CREATE POLICY "Users manage own pipeline runs"
  ON pipeline_runs FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- Speeds up the most common queries in the app.
-- ============================================================

-- Dashboard and pipeline review: get top-scoring unreviewed jobs
CREATE INDEX idx_jobs_user_score
  ON jobs(user_id, match_score DESC);

-- Pipeline review: filter by status
CREATE INDEX idx_jobs_user_status
  ON jobs(user_id, pipeline_status);

-- Tracker: filter applications by status
CREATE INDEX idx_applications_user_status
  ON applications(user_id, status);

-- Profile page: group lenses by stint
CREATE INDEX idx_lenses_profile_stint
  ON role_lenses(profile_id, stint_name);

-- ============================================================
-- AUTO-UPDATE updated_at
-- Trigger function to automatically update the updated_at column.
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON generated_materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
