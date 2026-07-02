-- ============================================================================
-- HireBlind Pro — COMPLETE DATABASE SCHEMA
-- Run this ENTIRE script in your Supabase SQL Editor on a fresh project.
-- It creates all tables, fields (including admin_key), indexes, RLS policies,
-- and security functions required for multi-tenant isolation.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. USERS TABLE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY, -- Maps to auth.users.id
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'recruiter')),
  admin_key   TEXT UNIQUE,     -- Invite key owned by admins
  admin_id    UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin tenant root for recruiters
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically insert users on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  -- Validate and coalesce role (must be 'admin' or 'recruiter')
  assigned_role := COALESCE(new.raw_user_meta_data->>'role', 'recruiter');
  IF assigned_role NOT IN ('admin', 'recruiter') THEN
    assigned_role := 'recruiter';
  END IF;

  INSERT INTO public.users (id, email, role, admin_key, created_at)
  VALUES (
    new.id,
    new.email,
    assigned_role,
    CASE WHEN assigned_role = 'admin' THEN 
      (SELECT substring(upper(md5(random()::text)) from 1 for 8))
    ELSE NULL END,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. SESSIONS (JOB PIPELINES) TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_title         TEXT NOT NULL,
  job_description   TEXT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by        UUID REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id          UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Tenant mapping
  resume_count      INT DEFAULT 0,
  shortlisted_count INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. RESUMES TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.resumes (
  id                    TEXT PRIMARY KEY, -- Custom ID passed from front-end
  session_id            UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  uploaded_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  recruiter_id          UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_id              UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Tenant mapping
  original_file_name    TEXT NOT NULL,
  file_type             TEXT CHECK (file_type IN ('pdf', 'docx', 'doc', 'txt')),
  file_size             INT,
  uploaded_at           TIMESTAMPTZ DEFAULT NOW(),
  processing_status     TEXT DEFAULT 'queued' CHECK (processing_status IN ('queued', 'processing', 'anonymised', 'scored', 'done', 'error')),
  anonymised_content    TEXT,
  overall_score         FLOAT DEFAULT 0.0,
  score_breakdown       JSONB DEFAULT '{}'::jsonb,
  is_shortlisted        BOOLEAN DEFAULT FALSE,
  manually_adjusted     BOOLEAN DEFAULT FALSE,
  identity_revealed     BOOLEAN DEFAULT FALSE,
  identity_revealed_at  TIMESTAMPTZ,
  identity_revealed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- ── 4. PII AUDIT LOG TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pii_audit_log (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  resume_id           TEXT,
  filename            TEXT,
  pii_fields_removed  TEXT[], -- Array of fields removed (e.g. ['name', 'email'])
  stripped_by         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  stripped_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. OVERRIDE LOG TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.override_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  resume_id       TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  original_rank   INT NOT NULL,
  new_rank        INT NOT NULL,
  reason          TEXT NOT NULL,
  overridden_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  overridden_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. IDENTITY REVEAL LOG TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.identity_reveal_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id         TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  session_id        UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  revealed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  revealed_at       TIMESTAMPTZ DEFAULT NOW(),
  already_revealed  BOOLEAN DEFAULT FALSE
);

-- ── 7. INTERVIEW SLOTS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interview_slots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  resume_id       TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  recruiter_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  candidate_email TEXT,
  slot_time       TIMESTAMPTZ NOT NULL,
  status          TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ── SECURITY DEFINER FUNCTIONS (Prevents infinite RLS recursion) ─────────────

DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.get_my_admin_id() CASCADE;
CREATE OR REPLACE FUNCTION public.get_my_admin_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT admin_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;


-- ── ROW LEVEL SECURITY (RLS) POLICIES ───────────────────────────────────────

-- 1. Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;

CREATE POLICY "users_read" ON public.users FOR SELECT USING (
  auth.uid() = id
  OR (
    public.get_my_role() = 'admin'
    AND (id = auth.uid() OR admin_id = auth.uid())
  )
);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 2. Sessions (Pipelines)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete" ON public.sessions;

CREATE POLICY "sessions_select" ON public.sessions FOR SELECT USING (
  (public.get_my_role() = 'recruiter' AND created_by = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);
CREATE POLICY "sessions_insert" ON public.sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "sessions_update" ON public.sessions FOR UPDATE USING (
  (public.get_my_role() = 'recruiter' AND created_by = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);
CREATE POLICY "sessions_delete" ON public.sessions FOR DELETE USING (
  (public.get_my_role() = 'recruiter' AND created_by = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

-- 3. Resumes
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resumes_select" ON public.resumes;
DROP POLICY IF EXISTS "resumes_insert" ON public.resumes;
DROP POLICY IF EXISTS "resumes_update" ON public.resumes;
DROP POLICY IF EXISTS "resumes_delete" ON public.resumes;

CREATE POLICY "resumes_select" ON public.resumes FOR SELECT USING (
  (public.get_my_role() = 'recruiter' AND recruiter_id = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);
CREATE POLICY "resumes_insert" ON public.resumes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "resumes_update" ON public.resumes FOR UPDATE USING (
  (public.get_my_role() = 'recruiter' AND recruiter_id = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);
CREATE POLICY "resumes_delete" ON public.resumes FOR DELETE USING (
  (public.get_my_role() = 'recruiter' AND recruiter_id = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

-- 4. PII Audit Log
ALTER TABLE public.pii_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pii_audit_log_select" ON public.pii_audit_log;
DROP POLICY IF EXISTS "pii_audit_log_insert" ON public.pii_audit_log;

CREATE POLICY "pii_audit_log_select" ON public.pii_audit_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pii_audit_log_insert" ON public.pii_audit_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 5. Override Log
ALTER TABLE public.override_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "override_log_select" ON public.override_log;
DROP POLICY IF EXISTS "override_log_insert" ON public.override_log;

CREATE POLICY "override_log_select" ON public.override_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "override_log_insert" ON public.override_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 6. Identity Reveal Log
ALTER TABLE public.identity_reveal_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reveal_log_select" ON public.identity_reveal_log;
DROP POLICY IF EXISTS "reveal_log_insert" ON public.identity_reveal_log;

CREATE POLICY "reveal_log_select" ON public.identity_reveal_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "reveal_log_insert" ON public.identity_reveal_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 7. Interview Slots
ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interview_slots_select" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_insert" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_update" ON public.interview_slots;

CREATE POLICY "interview_slots_select" ON public.interview_slots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "interview_slots_insert" ON public.interview_slots FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "interview_slots_update" ON public.interview_slots FOR UPDATE USING (auth.role() = 'authenticated');
