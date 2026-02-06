
-- SCHEMA V3: STRICT NORMALIZATION & IMPORT TRACKING
-- Run this in Supabase SQL Editor to enforce constraints.

-- 1. CLEANUP (Optional if not using cascade delete script)
-- DELETE FROM student_assignments;
-- DELETE FROM curriculum_assignments;
-- DELETE FROM enrollments;
-- DELETE FROM classes;
-- DELETE FROM subjects;
-- DELETE FROM students;

-- 2. ALTER TABLES to enforce V3 Architecture

-- A. STUDENTS: Ensure Name is Unique
ALTER TABLE students ADD CONSTRAINT unique_student_name UNIQUE (name);

-- B. CLASSES: Ensure Title is Unique per Subject
ALTER TABLE classes ADD CONSTRAINT unique_class_title_per_subject UNIQUE (subject_id, title);

-- C. ENROLLMENTS: Ensure Student can only enroll once in a Class
ALTER TABLE enrollments ADD CONSTRAINT unique_student_enrollment UNIQUE (student_id, class_id);

-- D. ENROLLMENTS: Add Timestamp for Import Versioning (Source of Truth)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS last_import_timestamp TIMESTAMPTZ;

-- E. CURRICULUM: Ensure Title is Unique per Class
ALTER TABLE curriculum_assignments ADD CONSTRAINT unique_curriculum_title UNIQUE (class_id, title);

-- F. STUDENT ASSIGNMENTS: Ensure 1 Record per Curriculum Item per Enrollment
-- Note: V3 uses curriculum metadata from the File, but usually we map to DB IDs.
-- If we keep using 'student_assignments', we should enforce uniqueness.
ALTER TABLE student_assignments ADD CONSTRAINT unique_assignment_per_enrollment UNIQUE (enrollment_id, assignment_id);

-- G. INDEXES for Performance
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_class ON curriculum_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_enrollment ON student_assignments(enrollment_id);

