-- ============================================================
-- JobPilot — Simplified schema for URL-first workflow.
-- Run in your Supabase SQL Editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  name              text NOT NULL,
  email             text,
  phone             text,
  address           text,
  linkedin          text,
  nationality       text,
  work_permit       text,
  languages         jsonb DEFAULT '[]'::jsonb,
  years_experience  int DEFAULT 0,
  education         jsonb DEFAULT '[]'::jsonb,
  certifications    text[] DEFAULT '{}'::text[],
  publications      text[] DEFAULT '{}'::text[],
  achievements      text[] DEFAULT '{}'::text[],
  personal_info     jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: role_lenses
-- ============================================================
CREATE TABLE role_lenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stint_name   text NOT NULL,
  period       text NOT NULL,
  organization text NOT NULL,
  lens_id      text NOT NULL,
  title        text NOT NULL,
  tags         text[] DEFAULT '{}'::text[],
  summary      text,
  bullets      text[] DEFAULT '{}'::text[],
  sort_order   int DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(profile_id, lens_id)
);

-- ============================================================
-- TABLE: jobs
-- Simplified: just stores scraped job data from a URL.
-- ============================================================
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) NOT NULL,
  url          text NOT NULL,
  title        text NOT NULL,
  company      text NOT NULL,
  location     text,
  level        text,
  job_type     text DEFAULT 'Full-time',
  description  text,
  requirements text[] DEFAULT '{}'::text[],
  keywords     text[] DEFAULT '{}'::text[],
  salary       text,
  deadline     text,
  source       text DEFAULT 'other',
  raw_text     text,
  created_at   timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: generated_materials
-- Stores AI-generated CV and cover letter per job.
-- ============================================================
CREATE TABLE generated_materials (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id               uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  user_id              uuid REFERENCES auth.users(id) NOT NULL,
  cv_content           jsonb,
  cover_letter_content jsonb,
  lenses_used          text[],
  -- Naming prefix e.g. "Jha_Rahul_Google_ProgrammeManager_20260404"
  file_prefix          text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ============================================================
-- TABLE: applications
-- Tracks submitted applications through hiring funnel.
-- ============================================================
CREATE TABLE applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) NOT NULL,
  job_id            uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  materials_id      uuid REFERENCES generated_materials(id),
  status            text DEFAULT 'applied' CHECK (
    status IN ('applied', 'screening', 'interview', 'offer', 'rejected', 'withdrawn', 'ghosted')
  ),
  date_applied      date DEFAULT CURRENT_DATE,
  notes             text,
  next_action       text,
  next_action_date  date,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_lenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own lenses"
  ON role_lenses FOR ALL
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own jobs"
  ON jobs FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own materials"
  ON generated_materials FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own applications"
  ON applications FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_jobs_user ON jobs(user_id, created_at DESC);
CREATE INDEX idx_applications_user_status ON applications(user_id, status);
CREATE INDEX idx_lenses_profile ON role_lenses(profile_id, stint_name);

-- ============================================================
-- AUTO-UPDATE updated_at
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
