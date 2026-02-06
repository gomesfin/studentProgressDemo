-- Schema V8: Class Progress (Renamed from class_snapshots)
-- Stores student progress as a JSON snapshot.

CREATE TABLE IF NOT EXISTS class_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id TEXT NOT NULL REFERENCES students(id), -- Matches students.id type
    class_id UUID NOT NULL REFERENCES classes(id),    -- Matches classes.id type
    total_assignments INTEGER,
    completed_count INTEGER,
    assignment_data JSONB, -- The JSON Blob
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: One record per student per class
    UNIQUE(student_id, class_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_class_progress_lookup ON class_progress(student_id, class_id);

-- SECURITY: Explicitly Open Access (Just in case)
ALTER TABLE class_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to class_progress"
ON class_progress
FOR ALL
USING (true)
WITH CHECK (true);
