-- SCHEMA V6: STRICT IMPORT (Nullable Links)
-- Run this in the Supabase SQL Editor

-- 1. MODIFY STUDENT_ASSIGNMENTS
-- Allow assignment_id to be NULL. 
-- This represents an assignment from a student file that does NOT match the Core Curriculum.
ALTER TABLE student_assignments ALTER COLUMN assignment_id DROP NOT NULL;

-- 2. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload config';
