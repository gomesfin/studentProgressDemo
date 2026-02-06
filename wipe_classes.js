
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function wipeClasses() {
    console.log("--- WIPING CLASSES & SUBJECTS ---");

    // 1. Enrollments/Curriculum/Assignments should be empty.
    // Explicitly delete to ensure clean slate (in case of missing cascades)
    console.log("Deleting Student Assignments...");
    await supabase.from('student_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log("Deleting Curriculum Assignments...");
    await supabase.from('curriculum_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const { count: eCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true });
    if (eCount > 0) {
        console.log(`Warning: ${eCount} enrollments exist. Deleting them first...`);
        await supabase.from('enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // 2. Delete Classes
    const { count: cCount, error: cError } = await supabase.from('classes').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (cError) {
        console.error("Error deleting classes:", cError.message);
    } else {
        console.log(`Deleted ${cCount} Classes.`);
    }

    // 3. Delete Subjects (Optional, but ensures clean slate)
    const { count: sCount, error: sError } = await supabase.from('subjects').delete({ count: 'exact' }).neq('id', 'placeholder');
    if (sError) {
        console.error("Error deleting subjects:", sError.message);
    } else {
        console.log(`Deleted ${sCount} Subjects.`);
    }

    console.log("--- CLASSES WIPED. APP WILL RE-SEED ON NEXT LOAD. ---");
}

wipeClasses();
