import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDebug() {
    console.log("Debugging V3 Fetch Logic...");

    // 1. Get an enrollment for Yahya Habib
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Yahya%').limit(1);
    const student = students[0];
    console.log("Student:", student);

    const { data: enrollments } = await supabase.from('enrollments').select('id, class_id').eq('student_id', student.id);
    console.log("Enrollments:", enrollments.length);
    const enrolIds = enrollments.map(e => e.id);

    // 2. Run the EXACT query from api.js
    const { data: assignments, error } = await supabase
        .from('student_progress')
        .select('*, curriculum_assignments!curriculum_item_id(title, max_points)')
        .in('enrollment_id', enrolIds)
        .limit(5);

    if (error) {
        console.error("Query Error:", error);
    } else {
        console.log("Query Success! First Record:");
        if (assignments.length > 0) {
            console.log(JSON.stringify(assignments[0], null, 2));

            // Validate Structure
            const a = assignments[0];
            const title = a.curriculum_assignments?.title;
            const points = a.curriculum_assignments?.max_points;
            console.log("\nField Check:");
            console.log(`curriculum_assignments.title: '${title}'`);
            console.log(`curriculum_assignments.max_points: '${points}'`);
        } else {
            console.log("No assignments found for this student.");
        }
    }
}

runDebug();
