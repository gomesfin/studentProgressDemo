-- PROPOSED SCHEMA REDESIGN FOR STUDENT DASHBOARD

-- 1. Subject Domains
-- Defines the core pillars (e.g., 'science', 'math'). 
-- Currently hardcoded in UI, this allows dynamic expansion.
CREATE TABLE subjects (
  id TEXT PRIMARY KEY, -- e.g. 'science'
  name TEXT NOT NULL,  -- 'Science'
  color TEXT,          -- UI Theme Color
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Classes (Actual Courses)
-- Represents "Algebra I", "Physics 101", etc.
-- Linked to a parent Subject via 'subject_id' (Standard SQL One-to-Many).
-- NOTE: We do NOT list classes in the 'subjects' table. Instead, each class "points" to its subject.
-- This allows us to have infinite classes for a subject without changing the 'subjects' table.
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id TEXT REFERENCES subjects(id),
  title TEXT NOT NULL, -- "Algebra 101"
  teacher TEXT,
  period INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Curriculum / Master Assignments
-- Defines what "Assignments" exist for a class globally.
-- Solves the issue where assignments are ad-hoc per student.
CREATE TABLE curriculum_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,         -- "Unit 1 Quiz"
  max_points INTEGER DEFAULT 100,
  category TEXT,               -- 'Homework', 'Test', 'Lab'
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enrollments (The Join Table)
-- Links Students to Classes for a specific Term/Semester.
-- Handles "Enrolled Classes" logic.
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  term TEXT,                   -- 'FALL_2025'
  current_grade NUMERIC,       -- Cached average (e.g. 85.5)
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'DROPPED', 'COMPLETED'
  metadata JSONB,              -- Import logs/timestamps
  UNIQUE(student_id, class_id, term)
);

-- 5. Student Assignments (The Gradebook)
-- The actual score a student got on a curriculum item.
CREATE TABLE student_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES curriculum_assignments(id),
  
  score NUMERIC,               -- Student's points
  percentage NUMERIC,          -- (score / max_points * 100) or override
  status TEXT,                 -- 'Complete', 'Missing', 'Excused'
  submitted_at TIMESTAMPTZ,
  
  UNIQUE(enrollment_id, assignment_id)
);

-- MIGRATION NOTES:
-- 1. 'students' table remains mostly the same, but 'progress' and 'enrolled_classes' JSON columns 
--    become derived/cached values from the 'enrollments' table.
-- 2. 'assignments' table (legacy) should be migrated to 'student_assignments'.
