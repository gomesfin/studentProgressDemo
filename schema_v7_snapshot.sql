-- Schema V7: Class Snapshots for Atomic Updates (Fixed Types)
-- This table stores the entire assignment list as a JSON blob.

CREATE TABLE IF NOT EXISTS class_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id TEXT NOT NULL REFERENCES students(id), -- FIXED: Changed from UUID to TEXT
    class_id UUID NOT NULL REFERENCES classes(id),    -- Correct: Classes use UUID
    last_updated TIMESTAMPTZ,
    total_assignments INTEGER,
    completed_count INTEGER,
    assignment_data JSONB, -- The entire list of assignments
    
    -- Ensure one snapshot per student per class
    UNIQUE(student_id, class_id)
);

-- Index for faster lookups during fetch
CREATE INDEX IF NOT EXISTS idx_class_snapshots_lookup ON class_snapshots(student_id, class_id);

-- SECURITY: Enable RLS and Allow Access
ALTER TABLE class_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to class_snapshots"
ON class_snapshots
FOR ALL
USING (true)
WITH CHECK (true);
