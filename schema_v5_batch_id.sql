-- SCHEMA V5: BATCH IDENTIFIER
-- Run this in the Supabase SQL Editor

-- 1. ADD BATCH IDENTIFIER COLUMN
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS last_import_timestamp TIMESTAMPTZ;

-- 2. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload config';
