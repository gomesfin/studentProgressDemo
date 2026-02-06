
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function targetedCleanup() {
    console.log("--- TARGETED CLEANUP (Trig Worksheet - BATCHED) ---");

    const targets = ['Trig Worksheet'];

    // 1. Fetch IDs
    const { data: items, error } = await supabase.from('curriculum_assignments').select('id').in('title', targets);
    if (error) { console.error(error); return; }

    if (items.length > 0) {
        console.log(`Found ${items.length} instances of 'Trig Worksheet'.`);
        const ids = items.map(i => i.id);

        const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunk(ids, 100);

        let totalSa = 0;
        let totalCa = 0;

        for (const batch of batches) {
            // Delete Assignments first
            const { count: saCount, error: saError } = await supabase.from('student_assignments').delete({ count: 'exact' }).in('assignment_id', batch);
            if (saError) console.error("SA Error:", saError.message);
            else totalSa += (saCount || 0);

            // Delete Curriculum
            const { count: caCount, error: caError } = await supabase.from('curriculum_assignments').delete({ count: 'exact' }).in('id', batch);
            if (caError) console.error("CA Error:", caError.message);
            else totalCa += (caCount || 0);
        }

        console.log(`Deleted ${totalSa} student assignments.`);
        console.log(`Deleted ${totalCa} curriculum items.`);
    } else {
        console.log("No 'Trig Worksheet' found.");
    }
}

targetedCleanup();
