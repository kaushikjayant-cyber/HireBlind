-- ============================================================
-- HireBlind Pro — Quick Patch SQL
-- Run this in Supabase SQL Editor if you have already run supabase_schema_v2.sql
-- This patches the resumes table file_type CHECK to allow .doc and .txt
-- ============================================================

-- 1. Fix resumes.file_type CHECK to allow doc and txt
ALTER TABLE public.resumes
  DROP CONSTRAINT IF EXISTS resumes_file_type_check;

ALTER TABLE public.resumes
  ADD CONSTRAINT resumes_file_type_check
  CHECK (file_type IN ('pdf', 'docx', 'doc', 'txt'));

-- 2. Ensure identity_revealed columns exist (idempotent)
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS identity_revealed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS identity_revealed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_revealed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS manually_adjusted BOOLEAN DEFAULT FALSE;

-- 3. Ensure identity_reveal_log table exists
CREATE TABLE IF NOT EXISTS public.identity_reveal_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resume_id       TEXT REFERENCES public.resumes(id) ON DELETE CASCADE,
  session_id      UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  revealed_by     UUID REFERENCES public.users(id),
  revealed_at     TIMESTAMPTZ DEFAULT NOW(),
  already_revealed BOOLEAN DEFAULT FALSE
);

-- Enable RLS if not already done
ALTER TABLE public.identity_reveal_log ENABLE ROW LEVEL SECURITY;

-- Drop and re-create to avoid conflicts
DROP POLICY IF EXISTS "reveal_log_select" ON public.identity_reveal_log;
DROP POLICY IF EXISTS "reveal_log_insert" ON public.identity_reveal_log;

CREATE POLICY "reveal_log_select"
  ON public.identity_reveal_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "reveal_log_insert"
  ON public.identity_reveal_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Make sure resumes table RLS allows delete
DROP POLICY IF EXISTS "resumes_delete_authenticated" ON public.resumes;
CREATE POLICY "resumes_delete_authenticated"
  ON public.resumes FOR DELETE
  USING (auth.role() = 'authenticated');

-- Done.
SELECT 'Patch applied successfully' AS status;
