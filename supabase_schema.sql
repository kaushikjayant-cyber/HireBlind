-- HireBlind Supabase Schema
-- Run this in Supabase SQL Editor (Database → SQL Editor → New Query)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'recruiter', 'student')) DEFAULT 'recruiter',
  org_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SECURITY FUNCTIONS ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_user_role(requested_role text)
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  RETURN user_role = requested_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_user_role_in(requested_roles text[])
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid() LIMIT 1;
  RETURN user_role = ANY(requested_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow insert on register" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can read all users" ON public.users FOR SELECT USING (
  public.check_user_role('admin')
);

-- ─── SESSIONS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_title TEXT NOT NULL,
  job_description TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')) DEFAULT 'active',
  resume_count INTEGER DEFAULT 0,
  shortlisted_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read sessions" ON public.sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins create sessions" ON public.sessions FOR INSERT WITH CHECK (
  public.check_user_role_in(ARRAY['admin', 'recruiter'])
);
CREATE POLICY "Admins update sessions" ON public.sessions FOR UPDATE USING (
  public.check_user_role_in(ARRAY['admin', 'recruiter'])
);

-- ─── RESUMES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resumes (
  id TEXT PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.users(id),
  original_file_name TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('pdf', 'docx')),
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processing_status TEXT CHECK (processing_status IN ('pending','processing','done','error')) DEFAULT 'pending',
  anonymised_content TEXT,
  score_breakdown JSONB,
  overall_score NUMERIC(5,2) DEFAULT 0,
  rank INTEGER,
  is_shortlisted BOOLEAN DEFAULT FALSE,
  manually_adjusted BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read resumes" ON public.resumes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users insert resumes" ON public.resumes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users update resumes" ON public.resumes FOR UPDATE USING (auth.role() = 'authenticated');

-- ─── PII AUDIT LOG ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pii_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  field_stripped TEXT NOT NULL,
  stripped_at TIMESTAMPTZ DEFAULT NOW(),
  stripped_by TEXT DEFAULT 'system'
);

ALTER TABLE public.pii_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read pii_audit_log" ON public.pii_audit_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert pii_audit_log" ON public.pii_audit_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── OVERRIDE LOG ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.override_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  original_rank INTEGER,
  new_rank INTEGER,
  reason TEXT,
  overridden_by UUID REFERENCES public.users(id),
  overridden_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.override_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read override_log" ON public.override_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert override_log" ON public.override_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── INTERVIEW SLOTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  resume_id TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  candidate_code TEXT,
  scheduled_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ,
  revealed_by UUID REFERENCES public.users(id),
  status TEXT CHECK (status IN ('scheduled', 'revealed', 'cancelled')) DEFAULT 'scheduled'
);

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read interview_slots" ON public.interview_slots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated insert interview_slots" ON public.interview_slots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated update interview_slots" ON public.interview_slots FOR UPDATE USING (auth.role() = 'authenticated');

-- ─── STORAGE BUCKET ─────────────────────────────────────────────────────────
-- Run separately in Supabase Storage section, or via dashboard:
-- Bucket name: resumes
-- Access: private (authenticated only)
