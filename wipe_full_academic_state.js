
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
// Standard client settings
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function wipeState() {
    console.log("--- FULL ACADEMIC & BEHAVIORAL WIPE ---");
    console.log("Preserving Seating (Student Shells). Deleting Data.");

    // 1. Delete Dependent Tables
    const { count: saCount, error: saError } = await supabase.from('student_assignments').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000'); // Delete All
    if (saError) console.error("SA Error", saError.message);
    else console.log(`Deleted ${saCount} Student Assignments.`);

    const { count: caCount, error: caError } = await supabase.from('curriculum_assignments').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (caError) console.error("CA Error", caError.message);
    else console.log(`Deleted ${caCount} Curriculum Items.`);

    const { count: eCount, error: eError } = await supabase.from('enrollments').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (eError) console.error("Enrollment Error", eError.message);
    else console.log(`Deleted ${eCount} Enrollments.`);

    // 2. Clear Student JSON & Behavior Columns
    // Note: We update ALL students.
    // We try to set absences/writeups even if they don't exist (it usually just ignores if strict, or errors).
    // Safest is to try; if error, try without behavior cols.

    console.log("Clearing Student JSON (enrolled_classes, progress)...");

    // Batch update to avoid timeouts if 1000 students
    const { data: students } = await supabase.from('students').select('id');
    const ids = students.map(s => s.id);
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const batches = chunk(ids, 100);

    let updated = 0;
    for (const batch of batches) {
        // Attempt 1: Full Update (if columns exist)
        // Schema inspection said they DON'T exist, so this will likely fail if strict.
        // We will stick to JSON reset.
        const { error: upError } = await supabase
            .from('students')
            .update({
                enrolled_classes: {},
                progress: {},
                // absences: 0, // Removed based on prior schema check
                // writeups: 0 
            })
            .in('id', batch);

        if (upError) {
            console.error("Update Error:", upError.message);
        } else {
            updated += batch.length;
        }
        process.stdout.write(`Result cleared for ${updated} students... \r`);
    }

    console.log("\n--- WIPE COMPLETE ---");
}

wipeState();
