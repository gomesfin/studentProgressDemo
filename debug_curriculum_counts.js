
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env from strictly defined path
const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log("--- Checking Curriculum Counts ---");

    // 1. Get all Classes
    const { data: classes, error: classError } = await supabase.from('classes').select('id, title, subject_id');
    if (classError) { console.error("Class Error:", classError); return; }

    console.log(`Found ${classes.length} classes.`);

    // 2. Get Curriculum Counts per Class
    const { data: curriculum, error: currError } = await supabase.from('curriculum_assignments').select('id, class_id, title');
    if (currError) { console.error("Curriculum Error:", currError); return; }

    const curriculumMap = {}; // class_id -> count

    curriculum.forEach(c => {
        curriculumMap[c.class_id] = (curriculumMap[c.class_id] || 0) + 1;
    });

    // 3. Print Report (Simple Logs)
    console.log("--- Curriculum Counts per Class ---");
    classes.forEach(c => {
        const count = curriculumMap[c.id] || 0;
        if (count === 0) {
            console.log(`[ALERT] Class '${c.title}' (ID: ${c.id}) has 0 curriculum items!`);
        } else {
            console.log(`Class '${c.title}': ${count} items`);
        }
    });

    console.log("\n--- Checking Student Assignment Inflation ---");
    // 4. Get Enrollments
    const { data: enrollments, error: enrolError } = await supabase.from('enrollments')
        .select('id, student_id, class_id, student:students(name), cls:classes(title, id)');

    if (enrolError) console.error("Enrollment Error:", enrolError);

    // Get assignment counts per enrollment
    const { data: assignments, error: assError } = await supabase.from('student_assignments').select('id, enrollment_id');
    if (assError) console.error("Assignment Error:", assError);

    const assignmentCounts = {}; // enrollment_id -> count
    assignments.forEach(a => {
        assignmentCounts[a.enrollment_id] = (assignmentCounts[a.enrollment_id] || 0) + 1;
    });

    const anomalies = [];
    enrollments.forEach(e => {
        const count = assignmentCounts[e.id] || 0;
        const totalPossible = curriculumMap[e.class_id] || 0;

        // Check for inflation (Completed > Possible)
        if (count > totalPossible && totalPossible > 0) {
            anomalies.push({
                student: e.student?.name,
                class: e.cls?.title,
                completed: count,
                possible: totalPossible,
                diff: count - totalPossible
            });
        }
    });

    if (anomalies.length > 0) {
        console.log(`[ALERT] Found ${anomalies.length} inflated enrollments (Completed > Possible):`);
        anomalies.slice(0, 10).forEach(a => {
            console.log(`[INFLATED] ${a.student} in ${a.class}: ${a.completed} / ${a.possible} (Diff: +${a.diff})`);
        });
        if (anomalies.length > 10) console.log(`... and ${anomalies.length - 10} more.`);
    } else {
        console.log("[OK] No inflated assignment counts found.");
    }
}

checkCounts();
