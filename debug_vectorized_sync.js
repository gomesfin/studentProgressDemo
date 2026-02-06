import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runVectorTest() {
    console.log("=== VECTORIZED IMPORT DEBUG ===");

    // 1. Mock Input
    const mockAssignments = [
        { studentId: null, subject: 'math', activityName: '1.1.3 Quiz: Rational and Irrational Numbers', score: 100 }, // Extracted: 1.1.3
        { studentId: null, subject: 'math', activityName: '1.2.3 Quiz: Algebraic Properties', score: 90 }, // Extracted: 1.2.3
        { studentId: null, subject: 'math', activityName: '9.9.9 Bad Code', score: 0 } // Invalid
    ];

    // Get Real Student ID
    const { data: s } = await supabase.from('students').select('id').ilike('name', 'Yahya%').limit(1);
    const sId = s[0].id;
    console.log("Student ID:", sId);
    mockAssignments.forEach(a => a.studentId = sId);

    // 2. EXTRACT KEYS
    const uniqueStudentIds = new Set([sId]);

    // 3. BULK FETCH ENROLLMENTS
    console.log("Fetching Enrollments...");
    const { data: allEnrollments } = await supabase
        .from('enrollments')
        .select('id, student_id, class_id, classes(subject_id, title)')
        .in('student_id', Array.from(uniqueStudentIds));

    // Build Map
    const enrollmentMap = new Map();
    const involvedClassIds = new Set();
    allEnrollments.forEach(e => {
        if (e.classes?.subject_id) {
            const key = `${e.student_id}_${e.classes.subject_id.toLowerCase()}`;
            enrollmentMap.set(key, { id: e.id, classId: e.class_id, title: e.classes.title });
            involvedClassIds.add(e.class_id);
            console.log(`Mapped Enrol: ${key} -> Class ${e.classes.title}`);
        }
    });

    // 4. BULK FETCH CURRICULUM
    console.log("Fetching Curriculum...");
    let curriculumMap = new Map();
    if (involvedClassIds.size > 0) {
        const { data: allCurriculum } = await supabase
            .from('curriculum_assignments')
            .select('id, class_id, title')
            .in('class_id', Array.from(involvedClassIds));

        console.log("Sample DB Titles:");
        allCurriculum.slice(0, 5).forEach(c => console.log(` - '${c.title}'`));

        const idRegex = /^(\d+\.\d+\.\d+)/;
        allCurriculum.forEach(c => {
            const match = c.title.match(idRegex);
            if (match) {
                const code = match[1];
                const key = `${c.class_id}_${code}`;
                curriculumMap.set(key, c.id);
            }
        });
        console.log(`Mapped ${curriculumMap.size} curriculum items.`);
        console.log("Sample Keys in Map:", Array.from(curriculumMap.keys()).slice(0, 3));
    }

    // 5. SIMULATE MATCHING
    console.log("\nMatching Results:");
    const rowsToUpsert = [];
    const idRegex = /^(\d+\.\d+\.\d+)/;

    mockAssignments.forEach(assign => {
        const enrolKey = `${assign.studentId}_${assign.subject.toLowerCase()}`;
        const enrol = enrollmentMap.get(enrolKey);

        if (!enrol) {
            console.log(`❌ No Enrollment: ${assign.subject}`);
            return;
        }

        const match = assign.activityName.match(idRegex);
        if (!match) {
            console.log(`❌ Invalid Format: ${assign.activityName}`);
            return;
        }
        const code = match[1];
        const currKey = `${enrol.classId}_${code}`;
        const assignmentId = curriculumMap.get(currKey);

        if (!assignmentId) {
            console.log(`❌ Strict Mode Skip: ${code} (Not in DB)`);
            return;
        }

        console.log(`✅ MATCH: ${assign.activityName} -> AssignmentID: ${assignmentId}`);
        rowsToUpsert.push({ enrollment_id: enrol.id, assignment_id: assignmentId, score: assign.score });
    });

    console.log(`\nValid Rows to Upsert: ${rowsToUpsert.length}`);
}

runVectorTest();
