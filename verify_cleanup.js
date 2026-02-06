
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function verify() {
    console.log("--- Verifying Cleanup ---");

    // Check for specific fillers
    const fillers = ['Physics Intro', 'Chem Lab', 'Eco Project', 'Bio Test'];
    const { data: found, error } = await supabase
        .from('curriculum_assignments')
        .select('id, title')
        .in('title', fillers);

    if (found && found.length > 0) {
        console.log(`[WARNING] Found ${found.length} filler items still in DB!`);
        console.log(found.map(f => f.title));

        // Force delete again?
        console.log("Attempting Force Delete by ID...");
        const ids = found.map(f => f.id);
        const { error: delErr } = await supabase.from('curriculum_assignments').delete().in('id', ids);
        if (delErr) console.error(delErr);
        else console.log("Force deleted by ID.");
    } else {
        console.log("[OK] No filler curriculum found by title.");
    }

    // Check Behavior
    const { data: students } = await supabase.from('students').select('name, attendance, writeups').limit(5);
    console.log("Sample Student Stats (Should be 100 / 0):");
    console.table(students);
}

verify();
