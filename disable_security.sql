-- DANGER: DISABLE ALL SECURITY
-- This script removes all Row Level Security (RLS) policies.
-- This makes the database world-writable (Public).
-- Use this ONLY for debugging connectivity/permission issues.

-- 1. Disable RLS on all tables (Allows Public Access if no policies exist? No, Disable means OPEN)
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;

-- 2. Drop all policies just in case
DROP POLICY IF EXISTS "Auth Access Subjects" ON subjects;
DROP POLICY IF EXISTS "Auth Access Classes" ON classes;
DROP POLICY IF EXISTS "Auth Access Curriculum" ON curriculum_assignments;
DROP POLICY IF EXISTS "Auth Access Enrollments" ON enrollments;
DROP POLICY IF EXISTS "Auth Access Student Assignments" ON student_assignments;
DROP POLICY IF EXISTS "Auth Access Students" ON students;

DROP POLICY IF EXISTS "Public Access Subjects" ON subjects;
DROP POLICY IF EXISTS "Public Access Classes" ON classes;
DROP POLICY IF EXISTS "Public Access Curriculum" ON curriculum_assignments;
DROP POLICY IF EXISTS "Public Access Enrollments" ON enrollments;
DROP POLICY IF EXISTS "Public Access Student Assignments" ON student_assignments;
DROP POLICY IF EXISTS "Public Access Students" ON students;
