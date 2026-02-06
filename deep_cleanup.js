
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function deepCleanup() {
    console.log("--- STARTING DEEP CLEANUP ---");

    const fillers = [
        'Lab Report', 'Periodic Quiz', 'Eco Project', 'Bio Test', 'Chem Lab', 'Physics Intro', 'Cells Unit',
        'Calculus Intro', 'Geometry Proofs', 'Algebra Quiz', 'Poetry Unit', 'Essay Draft', 'Shakespeare',
        'Grammar Test', 'Civics Quiz', 'History Essay', 'Geo Map', 'Econ Test', 'Assignment 1', 'Unit 1 Test'
    ];

    // 1. Find IDs of filler curriculum
    const { data: fillerItems, error: findError } = await supabase
        .from('curriculum_assignments')
        .select('id, title')
        .in('title', fillers);

    if (findError) { console.error("Find Error:", findError); return; }

    if (!fillerItems || fillerItems.length === 0) {
        console.log("No filler items found to delete.");
    } else {
        const fillerIds = fillerItems.map(f => f.id);
        console.log(`Found ${fillerIds.length} filler curriculum items. Deleting linked assignments first...`);

        // 2. Delete Student Assignments (Cascading manually)
        const { error: saError, count: saCount } = await supabase
            .from('student_assignments')
            .delete({ count: 'exact' })
            .in('assignment_id', fillerIds);

        if (saError) console.error("SA Delete Error:", saError);
        else console.log(`Deleted ${saCount} linked student assignments.`);

        // 3. Delete Curriculum Items
        const { error: cError, count: cCount } = await supabase
            .from('curriculum_assignments')
            .delete({ count: 'exact' })
            .in('id', fillerIds);

        if (cError) console.error("Curriculum Delete Error:", cError);
        else console.log(`Deleted ${cCount} filler curriculum items.`);
    }

    // 4. Reset Behavior Stats
    console.log("Resetting Student Behavior...");
    const { error: sError } = await supabase
        .from('students')
        .update({ attendance: 100, writeups: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (sError) console.error("Student behavior reset failed:", sError);
    else console.log("Student behavior stats reset to clean.");

    console.log("--- DEEP CLEANUP COMPLETE ---");
}

deepCleanup();
