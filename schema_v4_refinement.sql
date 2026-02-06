-- SCHEMA V4: REFINEMENT & VISIBILITY
-- Run this in the Supabase SQL Editor

-- 1. CLEANUP LEGACY
DROP TABLE IF EXISTS assignments;

-- 2. MODIFY ENROLLMENTS
-- Remove obsolete 'term'
ALTER TABLE enrollments DROP COLUMN IF EXISTS term;

-- Add Visibility Cache Columns
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS student_name_cache TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS class_name_cache TEXT;

-- 3. MODIFY STUDENT_ASSIGNMENTS
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS student_name_cache TEXT;
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS class_name_cache TEXT;
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS assignment_name_cache TEXT;

-- 4. MODIFY CURRICULUM_ASSIGNMENTS
ALTER TABLE curriculum_assignments ADD COLUMN IF NOT EXISTS class_name_cache TEXT;

-- 5. REFRESH SCHEMA CACHE (Optional, automatic usually)
NOTIFY pgrst, 'reload config';
