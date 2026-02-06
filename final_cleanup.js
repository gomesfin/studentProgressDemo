
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function finalCleanup() {
    console.log("--- FINAL COMPREHENSIVE CLEANUP ---");

    const fullMockList = [
        // Science
        'Lab Report', 'Periodic Quiz', 'Eco Project', 'Bio Test', 'Chem Lab', 'Physics Intro', 'Cells Unit',
        // Math
        'Algebra Quiz', 'Geometry Test', 'Calc Intro', 'Trig Worksheet', 'Stats Project', 'Math Midterm', 'Formulas',
        // English
        'Hamlet Essay', 'Reading Log', 'Poetry Unit', 'Grammar Quiz', 'Journal Entry', 'Novel Study', 'Speech',
        // Social Studies
        'History Essay', 'Civics Quiz', 'Map Quiz', 'WWII Project', 'Econ Basics', 'Gov Test', 'Debate'
    ];

    // 1. Fetch IDs
    const { data: items, error: findError } = await supabase
        .from('curriculum_assignments')
        .select('id, title')
        .in('title', fullMockList);

    if (findError) { console.error("Find Error:", findError); return; }

    const ids = items.map(i => i.id);
    console.log(`Found ${ids.length} mock curriculum items (covering all subjects).`);

    if (ids.length > 0) {
        // Chunking just in case
        const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunk(ids, 100);

        console.log(`Deleting in ${batches.length} batches...`);
        let totalSa = 0;
        let totalCa = 0;

        for (const batch of batches) {
            // Delete Student Assignments
            const { count: saCount } = await supabase.from('student_assignments').delete({ count: 'exact' }).in('assignment_id', batch);

            // Delete Curriculum
            const { count: caCount } = await supabase.from('curriculum_assignments').delete({ count: 'exact' }).in('id', batch);

            totalSa += (saCount || 0);
            totalCa += (caCount || 0);
        }

        console.log(`Deleted ${totalSa} Student Assignments.`);
        console.log(`Deleted ${totalCa} Curriculum Items.`);
    } else {
        console.log("No mock items found.");
    }

    console.log("--- CLEANUP DONE ---");
}

finalCleanup();
