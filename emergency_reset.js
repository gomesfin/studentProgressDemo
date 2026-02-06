
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function emergencyReset() {
    console.log("--- EMERGENCY DATA RESET ---");
    console.log("Preserving Students/Seating/Enrollments.");
    console.log("Deleting ALL Assignments (Curriculum + Student Data).");

    // 1. Delete Student Assignments (Dependent)
    // Batch deletion for speed if huge, but let's try direct delete first.
    // 50k rows. Might timeout.
    // Let's iterate.

    // Count first
    const { count } = await supabase.from('student_assignments').select('*', { count: 'exact', head: true });
    console.log(`Deleting ${count} student assignments...`);

    // Just delete all where ID is not null. 
    // If timeout, we loop.
    let deletedSA = 0;
    while (true) {
        // Delete items older than tomorrow? Or just delete.
        // limit is ignored in delete usually.
        // We use ID list.
        const { data: ids, error: fetchErr } = await supabase.from('student_assignments').select('id').limit(200);
        if (fetchErr) { console.error(fetchErr); break; }
        if (ids.length === 0) break;

        const idList = ids.map(i => i.id);
        const { error } = await supabase.from('student_assignments').delete().in('id', idList);
        if (error) { console.error(error); break; }
        deletedSA += idList.length;
        process.stdout.write(`Deleted ${deletedSA} / ${count} ... \r`);
    }
    console.log("\nStudent Assignments Cleared.");

    // 2. Delete Curriculum
    const { count: cCount } = await supabase.from('curriculum_assignments').select('*', { count: 'exact', head: true });
    console.log(`Deleting ${cCount} curriculum items...`);

    let deletedCA = 0;
    while (true) {
        const { data: ids } = await supabase.from('curriculum_assignments').select('id').limit(200);
        if (!ids || ids.length === 0) break;
        const idList = ids.map(i => i.id);
        const { error } = await supabase.from('curriculum_assignments').delete().in('id', idList);
        if (error) { console.error(error); break; }
        deletedCA += idList.length;
        process.stdout.write(`Deleted ${deletedCA} / ${cCount} ... \r`);
    }
    console.log("\nCurriculum Cleared.");

    console.log("--- RESET COMPLETE. READY FOR CLEAN IMPORT. ---");
}

emergencyReset();
