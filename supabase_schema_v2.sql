-- ============================================================
-- HireBlind Pro — DEFINITIVE FIX SQL
-- Run this ENTIRE script in Supabase SQL Editor
-- Fixes: internal server error during screening + admin users count
-- ============================================================

-- ─── FIX 1: RESUMES TABLE ────────────────────────────────────────────────────
-- Add all missing columns (safe to run even if they exist)

ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS identity_revealed       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS identity_revealed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_revealed_by    UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS manually_adjusted       BOOLEAN DEFAULT FALSE;

-- Fix file_type CHECK to allow doc and txt
ALTER TABLE public.resumes
  DROP CONSTRAINT IF EXISTS resumes_file_type_check;

ALTER TABLE public.resumes
  ADD CONSTRAINT resumes_file_type_check
  CHECK (file_type IN ('pdf', 'docx', 'doc', 'txt'));

-- Ensure resumes has DELETE policy (needed for cleanup)
DROP POLICY IF EXISTS "resumes_delete_authenticated" ON public.resumes;
CREATE POLICY "resumes_delete_authenticated"
  ON public.resumes FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── FIX 2: USERS TABLE ROLE CHECK ──────────────────────────────────────────
-- Remove 'student' from allowed roles (prevents future bad inserts)

UPDATE public.users SET role = 'recruiter' WHERE role = 'student';
UPDATE public.users SET role = 'recruiter' WHERE role = 'company';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'recruiter'));

-- ─── FIX 3: ADMIN CAN READ ALL USERS (no recursion) ─────────────────────────
-- The old policy "Admins can read all users" caused infinite recursion.
-- Solution: SECURITY DEFINER function reads role WITHOUT going through RLS.

DROP FUNCTION IF EXISTS public.get_my_role();
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Drop all old conflicting policies
DROP POLICY IF EXISTS "Users can read own profile"   ON public.users;
DROP POLICY IF EXISTS "Admins can read all users"    ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow insert on register"     ON public.users;
DROP POLICY IF EXISTS "users_select_own"             ON public.users;
DROP POLICY IF EXISTS "users_insert_own"             ON public.users;
DROP POLICY IF EXISTS "users_update_own"             ON public.users;

-- Re-create clean policies using SECURITY DEFINER function (no recursion)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read"
  ON public.users FOR SELECT
  USING (
    auth.uid() = id                      -- own row always visible
    OR public.get_my_role() = 'admin'    -- admin can see ALL users
  );

CREATE POLICY "users_insert"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ─── FIX 4: SESSIONS TABLE ──────────────────────────────────────────────────
-- Remove recursive policies, allow all authenticated users

DROP POLICY IF EXISTS "Authenticated users read sessions"   ON public.sessions;
DROP POLICY IF EXISTS "Admins create sessions"              ON public.sessions;
DROP POLICY IF EXISTS "Admins update sessions"              ON public.sessions;
DROP POLICY IF EXISTS "Authenticated users create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Authenticated users update sessions" ON public.sessions;
DROP POLICY IF EXISTS "sessions_select_authenticated"       ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_authenticated"       ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_authenticated"       ON public.sessions;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select"
  ON public.sessions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "sessions_insert"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "sessions_update"
  ON public.sessions FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── FIX 5: PII AUDIT LOG ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated read pii_audit_log"  ON public.pii_audit_log;
DROP POLICY IF EXISTS "Authenticated insert pii_audit_log" ON public.pii_audit_log;
DROP POLICY IF EXISTS "pii_audit_log_select"              ON public.pii_audit_log;
DROP POLICY IF EXISTS "pii_audit_log_insert"              ON public.pii_audit_log;

ALTER TABLE public.pii_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pii_audit_log_select"
  ON public.pii_audit_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "pii_audit_log_insert"
  ON public.pii_audit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ─── FIX 6: OVERRIDE LOG ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated read override_log"  ON public.override_log;
DROP POLICY IF EXISTS "Authenticated insert override_log" ON public.override_log;
DROP POLICY IF EXISTS "override_log_select"              ON public.override_log;
DROP POLICY IF EXISTS "override_log_insert"              ON public.override_log;

ALTER TABLE public.override_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "override_log_select"
  ON public.override_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "override_log_insert"
  ON public.override_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ─── FIX 7: IDENTITY REVEAL LOG (create if missing) ─────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.identity_reveal_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id        TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  session_id       UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  revealed_by      UUID REFERENCES public.users(id),
  revealed_at      TIMESTAMPTZ DEFAULT NOW(),
  already_revealed BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.identity_reveal_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reveal_log_select" ON public.identity_reveal_log;
DROP POLICY IF EXISTS "reveal_log_insert" ON public.identity_reveal_log;

CREATE POLICY "reveal_log_select"
  ON public.identity_reveal_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reveal_log_insert"
  ON public.identity_reveal_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ─── FIX 8: INTERVIEW SLOTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated read interview_slots"   ON public.interview_slots;
DROP POLICY IF EXISTS "Authenticated insert interview_slots" ON public.interview_slots;
DROP POLICY IF EXISTS "Authenticated update interview_slots" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_select"               ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_insert"               ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_update"               ON public.interview_slots;

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interview_slots_select"
  ON public.interview_slots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "interview_slots_insert"
  ON public.interview_slots FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "interview_slots_update"
  ON public.interview_slots FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ─── VERIFY ──────────────────────────────────────────────────────────────────
SELECT
  'users'               AS tbl, COUNT(*) AS rows FROM public.users
UNION ALL
SELECT 'sessions',      COUNT(*) FROM public.sessions
UNION ALL
SELECT 'resumes',       COUNT(*) FROM public.resumes
UNION ALL
SELECT 'pii_audit_log', COUNT(*) FROM public.pii_audit_log;
