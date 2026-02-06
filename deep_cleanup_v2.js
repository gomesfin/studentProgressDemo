
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function deepCleanup() {
    console.log("--- STARTING DEEP CLEANUP (BATCHED) ---");

    const fillers = [
        'Lab Report', 'Periodic Quiz', 'Eco Project', 'Bio Test', 'Chem Lab', 'Physics Intro', 'Cells Unit',
        'Calculus Intro', 'Geometry Proofs', 'Algebra Quiz', 'Poetry Unit', 'Essay Draft', 'Shakespeare',
        'Grammar Test', 'Civics Quiz', 'History Essay', 'Geo Map', 'Econ Test', 'Assignment 1', 'Unit 1 Test'
    ];

    // 1. Find IDs of filler curriculum
    // Fetch ALL first
    // Note: If 1000 is max page, we need to loop if > 1000. But for now 1000 is fine.
    const { data: fillerItems, error: findError } = await supabase
        .from('curriculum_assignments')
        .select('id')
        .in('title', fillers)
        .limit(10000);

    if (findError) { console.error("Find Error:", findError); return; }

    if (!fillerItems || fillerItems.length === 0) {
        console.log("No filler items found to delete.");
    } else {
        const fillerIds = fillerItems.map(f => f.id);
        console.log(`Found ${fillerIds.length} filler curriculum items.`);

        // Helper to chunk array
        const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunk(fillerIds, 100);

        // 2. Delete Student Assignments (Cascading manually)
        console.log(`Deleting SA in ${batches.length} batches...`);
        let saDeleted = 0;
        for (const batch of batches) {
            const { count, error } = await supabase
                .from('student_assignments')
                .delete({ count: 'exact' })
                .in('assignment_id', batch);
            if (error) console.error("SA Batch Error:", error);
            else saDeleted += (count || 0);
        }
        console.log(`Deleted ${saDeleted} linked student assignments.`);

        // 3. Delete Curriculum Items
        console.log(`Deleting Curriculum in ${batches.length} batches...`);
        let cDeleted = 0;
        for (const batch of batches) {
            const { count, error } = await supabase
                .from('curriculum_assignments')
                .delete({ count: 'exact' })
                .in('id', batch);
            if (error) console.error("Curri Batch Error:", error);
            else cDeleted += (count || 0);
        }
        console.log(`Deleted ${cDeleted} filler curriculum items.`);
    }

    // 4. Reset Behavior Stats
    console.log("Resetting Student Behavior (Absences=0, Writeups=0)...");
    const { error: sError } = await supabase
        .from('students')
        .update({ absences: 0, writeups: 0 }) // Corrected 'attendance' to 'absences'
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (sError) console.error("Student behavior reset failed:", sError);
    else console.log("Student behavior stats reset to clean.");

    console.log("--- DEEP CLEANUP COMPLETE ---");
}

deepCleanup();
