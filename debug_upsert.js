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

async function runUpsertTest() {
    console.log("=== UPSERT DEBUG TEST ===");

    // 1. Target: Yahya Habib / Algebra 1A
    const studentName = "Yahya Habib";
    const className = "Algebra 1A";
    const activityName = "1.1.3 Quiz: Rational and Irrational Numbers";

    // 2. Resolve IDs
    const { data: students } = await supabase.from('students').select('id').ilike('name', studentName).limit(1);
    if (!students || students.length === 0) { console.error("No student"); return; }
    const sId = students[0].id;
    console.log("Student ID:", sId);

    const { data: classes } = await supabase.from('classes').select('id, title').eq('title', className).limit(1);
    if (!classes || classes.length === 0) { console.error("No class"); return; }
    const cId = classes[0].id;
    console.log("Class ID:", cId);

    const { data: enrollment } = await supabase.from('enrollments').select('id').eq('student_id', sId).eq('class_id', cId).single();
    if (!enrollment) { console.error("No enrollment"); return; }
    const eId = enrollment.id;
    console.log("Enrollment ID:", eId);

    // 3. Resolve Curriculum
    const { data: curr } = await supabase.from('curriculum_assignments').select('id').eq('class_id', cId).eq('title', activityName).single();
    if (!curr) { console.error("No curriculum item"); return; }
    const assignId = curr.id;
    console.log("Assignment ID:", assignId);

    // 4. PERFORM INSERT
    console.log("Attempting Upsert...");
    const payload = {
        enrollment_id: eId,
        assignment_id: assignId, // Correct Column Name V3
        status: 'Completed',
        score: 85,
        submitted_at: new Date()
    };

    // Using 'student_assignments' table
    const { data, error } = await supabase.from('student_assignments').upsert(payload, { onConflict: 'enrollment_id, assignment_id' }).select();

    if (error) {
        console.error("❌ INSERT FAILED:", error);
    } else {
        console.log("✅ INSERT SUCCESS:", data);
    }

    // 5. READ BACK
    console.log("Reading back...");
    const { data: readBack } = await supabase.from('student_assignments')
        .select('*, curriculum_assignments!assignment_id(title)')
        .eq('enrollment_id', eId);

    console.log(`Assignments found: ${readBack.length}`);
    if (readBack.length > 0) {
        console.log("Sample:", readBack[0]);
    }
}

runUpsertTest();
