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

async function runDryRun() {
    console.log("=== V3 Import Dry Run ===");

    // 1. Pick a class to test
    const targetClass = "Algebra 1A";
    const targetActivity = "1.1.3 Quiz: Rational and Irrational Numbers";

    console.log(`Checking Class: '${targetClass}'`);

    const { data: classes } = await supabase.from('classes').select('id, title, subject_id').eq('title', targetClass);

    if (!classes || classes.length === 0) {
        console.error("❌ CLASS NOT FOUND IN DB!");
        return;
    }

    const classId = classes[0].id;
    console.log(`✅ Found Class ID: ${classId} (Subject: ${classes[0].subject_id})`);

    // 2. Fetch Curriculum for this class
    const { data: curriculum } = await supabase.from('curriculum_assignments').select('id, title').eq('class_id', classId);

    console.log(`Curriculum Count in DB: ${curriculum.length}`);

    // 3. Check for specific item
    const match = curriculum.find(c => c.title === targetActivity);

    if (match) {
        console.log(`✅ MATCH FOUND: '${targetActivity}' -> ID: ${match.id}`);
    } else {
        console.log(`❌ NO MATCH: '${targetActivity}'`);
        console.log("Sample of DB Items:");
        curriculum.slice(0, 5).forEach(c => console.log(` - '${c.title}'`));
    }

    // 4. Check for Student Assignments Table
    console.log("\nChecking Table Validity ('student_assignments')...");
    const { error } = await supabase.from('student_assignments').select('id').limit(1);
    if (error) {
        console.error("❌ TABLE ERROR:", error.message);
    } else {
        console.log("✅ Table 'student_assignments' is accessible.");
    }
}

runDryRun();
