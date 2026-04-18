-- ================================================================
-- HireBlind Pro — Multi-Tenant Isolation SQL
-- Run ENTIRE script in Supabase SQL Editor (safe to run multiple times)
-- ================================================================

-- ── 1. ADD admin_id COLUMNS ──────────────────────────────────────

-- users: recruiter rows get admin_id = the admin who created them
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- sessions (jobs): track which admin's tenant this belongs to
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- resumes: track recruiter + admin tenant
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS recruiter_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- anonymised_content: required for re-scoring
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS anonymised_content TEXT;

-- pii_audit_log table (create if missing)
CREATE TABLE IF NOT EXISTS public.pii_audit_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  resume_id       TEXT,
  filename        TEXT,
  pii_fields_removed TEXT[],
  stripped_by     UUID REFERENCES public.users(id),
  stripped_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. SECURITY DEFINER HELPERS (no recursion) ───────────────────

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

-- ── 3. USERS TABLE RLS ────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read"   ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;

-- Admin sees their own recruiters + themselves
-- Recruiter sees only themselves
CREATE POLICY "users_read" ON public.users FOR SELECT USING (
  auth.uid() = id
  OR (
    public.get_my_role() = 'admin'
    AND (id = auth.uid() OR admin_id = auth.uid())
  )
);

CREATE POLICY "users_insert" ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update" ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- ── 4. SESSIONS (JOBS) TABLE RLS ─────────────────────────────────

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete" ON public.sessions;

-- Recruiter sees only their sessions
-- Admin sees only sessions from their tenant (admin_id matches)
CREATE POLICY "sessions_select" ON public.sessions FOR SELECT USING (
  (public.get_my_role() = 'recruiter' AND created_by = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

CREATE POLICY "sessions_insert" ON public.sessions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "sessions_update" ON public.sessions FOR UPDATE USING (
  (public.get_my_role() = 'recruiter' AND created_by = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

CREATE POLICY "sessions_delete" ON public.sessions FOR DELETE USING (
  (public.get_my_role() = 'recruiter' AND created_by = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

-- ── 5. RESUMES TABLE RLS ─────────────────────────────────────────

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resumes_select" ON public.resumes;
DROP POLICY IF EXISTS "resumes_insert" ON public.resumes;
DROP POLICY IF EXISTS "resumes_update" ON public.resumes;
DROP POLICY IF EXISTS "resumes_delete" ON public.resumes;
DROP POLICY IF EXISTS "resumes_delete_authenticated" ON public.resumes;

CREATE POLICY "resumes_select" ON public.resumes FOR SELECT USING (
  (public.get_my_role() = 'recruiter' AND recruiter_id = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

CREATE POLICY "resumes_insert" ON public.resumes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "resumes_update" ON public.resumes FOR UPDATE USING (
  (public.get_my_role() = 'recruiter' AND recruiter_id = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

CREATE POLICY "resumes_delete" ON public.resumes FOR DELETE USING (
  (public.get_my_role() = 'recruiter' AND recruiter_id = auth.uid())
  OR (public.get_my_role() = 'admin' AND admin_id = auth.uid())
);

-- ── 6. AUDIT TABLES RLS (admin-tenant scoped) ────────────────────

ALTER TABLE public.pii_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pii_audit_log_select" ON public.pii_audit_log;
DROP POLICY IF EXISTS "pii_audit_log_insert" ON public.pii_audit_log;
CREATE POLICY "pii_audit_log_select" ON public.pii_audit_log FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "pii_audit_log_insert" ON public.pii_audit_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.override_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "override_log_select" ON public.override_log;
DROP POLICY IF EXISTS "override_log_insert" ON public.override_log;
CREATE POLICY "override_log_select" ON public.override_log FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "override_log_insert" ON public.override_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interview_slots_select" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_insert" ON public.interview_slots;
DROP POLICY IF EXISTS "interview_slots_update" ON public.interview_slots;
CREATE POLICY "interview_slots_select" ON public.interview_slots FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "interview_slots_insert" ON public.interview_slots FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "interview_slots_update" ON public.interview_slots FOR UPDATE
  USING (auth.role() = 'authenticated');

-- ── 7. EXISTING DATA: assign admin_id to existing sessions ──────
-- For any existing sessions with no admin_id, assign to first admin
UPDATE public.sessions
SET admin_id = (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
WHERE admin_id IS NULL;

-- For any existing resumes with no recruiter_id/admin_id, backfill
UPDATE public.resumes r
SET
  recruiter_id = s.created_by,
  admin_id = s.admin_id
FROM public.sessions s
WHERE r.session_id = s.id
  AND r.recruiter_id IS NULL;

-- ── 8. VERIFY ────────────────────────────────────────────────────
SELECT 'users' AS tbl, COUNT(*) FROM public.users
UNION ALL SELECT 'sessions', COUNT(*) FROM public.sessions
UNION ALL SELECT 'resumes', COUNT(*) FROM public.resumes;
