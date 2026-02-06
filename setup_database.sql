-- MASTER SETUP SCRIPT
-- Run this entire script in the Supabase SQL Editor to initialize your database.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STUDENTS TABLE (Legacy Base)
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE,
  grade TEXT,
  homeroom TEXT,
  x NUMERIC,
  y NUMERIC,
  manual_position BOOLEAN,
  enrolled_classes JSONB,
  progress JSONB
);

-- 3. SUBJECT DOMAINS
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY, -- e.g. 'science'
  name TEXT NOT NULL,  -- 'Science'
  color TEXT,          -- UI Theme Color
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CLASSES
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id TEXT REFERENCES subjects(id),
  title TEXT NOT NULL, -- "Algebra 101"
  teacher TEXT,
  period INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, title) -- Constraint from V3
);

-- 5. CURRICULUM ASSIGNMENTS
CREATE TABLE IF NOT EXISTS curriculum_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,         -- "Unit 1 Quiz"
  max_points INTEGER DEFAULT 100,
  category TEXT,               -- 'Homework', 'Test', 'Lab'
  due_date DATE,
  class_name_cache TEXT,       -- From V4
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, title)      -- Constraint from V3
);

-- 6. ENROLLMENTS
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  current_grade NUMERIC,       -- Cached average (e.g. 85.5)
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'DROPPED', 'COMPLETED'
  metadata JSONB,              -- Import logs/timestamps
  last_import_timestamp TIMESTAMPTZ, -- From V3
  student_name_cache TEXT,     -- From V4
  class_name_cache TEXT,       -- From V4
  UNIQUE(student_id, class_id) -- Constraint from V3
);

-- 7. STUDENT ASSIGNMENTS (The Gradebook)
CREATE TABLE IF NOT EXISTS student_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES curriculum_assignments(id), -- Nullable via V6
  
  score NUMERIC,               -- Student's points
  percentage NUMERIC,          -- (score / max_points * 100) or override
  status TEXT,                 -- 'Complete', 'Missing', 'Excused'
  submitted_at TIMESTAMPTZ,
  
  student_name_cache TEXT,     -- From V4
  class_name_cache TEXT,       -- From V4
  assignment_name_cache TEXT,  -- From V4
  last_import_timestamp TIMESTAMPTZ, -- From V5
  
  UNIQUE(enrollment_id, assignment_id) -- Constraint from V3
);

-- 8. CLASS PROGRESS (V8 - Replaces Class Snapshots)
CREATE TABLE IF NOT EXISTS class_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id TEXT NOT NULL REFERENCES students(id),
    class_id UUID NOT NULL REFERENCES classes(id),
    total_assignments INTEGER,
    completed_count INTEGER,
    assignment_data JSONB, -- The JSON Blob
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, class_id)
);

-- 9. INDICES
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_class ON curriculum_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_enrollment ON student_assignments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_class_progress_lookup ON class_progress(student_id, class_id);

-- 10. POLICIES (Development Mode - Open Access)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access Students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Classes" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Enrollments" ON enrollments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Curriculum" ON curriculum_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Student Assignments" ON student_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Class Progress" ON class_progress FOR ALL USING (true) WITH CHECK (true);
