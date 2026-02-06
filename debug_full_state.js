
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkState() {
    console.log("--- FULL DB STATE DIAGNOSTIC ---");

    // 1. Classes & Subjects
    const { count: sCount } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
    const { count: cCount } = await supabase.from('classes').select('*', { count: 'exact', head: true });
    console.log(`Subjects: ${sCount} (Expected ~5)`);
    console.log(`Classes: ${cCount} (Expected ~90-100)`);

    // 2. Students
    const { count: stCount } = await supabase.from('students').select('*', { count: 'exact', head: true });
    console.log(`Students: ${stCount}`);

    // 3. Enrollments
    const { count: eCount } = await supabase.from('enrollments').select('*', { count: 'exact', head: true });
    console.log(`Enrollments: ${eCount} (Crucial for linking)`);

    // 4. Curriculum
    const { count: curCount } = await supabase.from('curriculum_assignments').select('*', { count: 'exact', head: true });
    console.log(`Curriculum Items: ${curCount}`);

    // 5. Student Assignments
    const { count: saCount } = await supabase.from('student_assignments').select('*', { count: 'exact', head: true });
    console.log(`Student Assignments: ${saCount}`);

    // 6. Detailed checks if counts are low
    if (eCount === 0 && stCount > 0) {
        console.warn("WARNING: Zero enrollments despite having students. Sync failure?");
    }
    if (saCount === 0 && curCount > 0) {
        console.warn("WARNING: Zero student assignments despite having curriculum.");
    }
}

checkState();
