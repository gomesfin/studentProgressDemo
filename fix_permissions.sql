-- SECURE ACCESS (Authenticated Users Only)
-- Run this in your Supabase SQL Editor. 
-- This script (1) Removes old insecure "Public" policies and (2) Applies secure "Authenticated" policies.

-- 1. Enable RLS on tables
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- 2. CLEANUP: Remove old "Public" policies if they exist (from previous attempts)
DROP POLICY IF EXISTS "Public Access Subjects" ON subjects;
DROP POLICY IF EXISTS "Public Access Classes" ON classes;
DROP POLICY IF EXISTS "Public Access Curriculum" ON curriculum_assignments;
DROP POLICY IF EXISTS "Public Access Enrollments" ON enrollments;
DROP POLICY IF EXISTS "Public Access Student Assignments" ON student_assignments;
DROP POLICY IF EXISTS "Public Access Students" ON students;

-- 3. CLEANUP: Remove existing "Auth" policies to avoid duplicates/errors when re-running
DROP POLICY IF EXISTS "Auth Access Subjects" ON subjects;
DROP POLICY IF EXISTS "Auth Access Classes" ON classes;
DROP POLICY IF EXISTS "Auth Access Curriculum" ON curriculum_assignments;
DROP POLICY IF EXISTS "Auth Access Enrollments" ON enrollments;
DROP POLICY IF EXISTS "Auth Access Student Assignments" ON student_assignments;
DROP POLICY IF EXISTS "Auth Access Students" ON students;

-- 4. CREATE SECURE POLICIES for 'authenticated' users only
CREATE POLICY "Auth Access Subjects" ON subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Access Classes" ON classes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Access Curriculum" ON curriculum_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Access Enrollments" ON enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Access Student Assignments" ON student_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Access Students" ON students FOR ALL TO authenticated USING (true) WITH CHECK (true);
