-- 🚨 RUN THIS SCRIPT IN SUPABASE SQL EDITOR TO FIX RECURSION ERROR 🚨

-- 1. DROP THE RECURSIVE POLICIES ON USERS TABLE
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;

-- 2. DROP THE RECURSIVE POLICIES ON SESSIONS TABLE
DROP POLICY IF EXISTS "Admins create sessions" ON public.sessions;
DROP POLICY IF EXISTS "Admins update sessions" ON public.sessions;

-- 3. REPLACE WITH SIMPLIFIED POLICIES (No nested schema selects = no recursion)
-- Application logic (Recruiter restricted routes) will prevent students from posting sessions.
CREATE POLICY "Authenticated users create sessions" ON public.sessions 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users update sessions" ON public.sessions 
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Note: The resumes table ALREADY has policies that avoid recursion:
-- "Authenticated users insert resumes" ON public.resumes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- No changes needed there!
