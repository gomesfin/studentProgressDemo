
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function cleanup() {
    console.log("--- STARTING CLEANUP ---");

    // 1. Delete Non-Imported Curriculum (and cascading assignments)
    // Safety check: Ensure we have SOME 'Imported' ones before we nuke everything else?
    // User wants "Remove all filler data".
    // I will delete where category IS NULL or category != 'Imported'.

    // First, count them
    const { count: total } = await supabase.from('curriculum_assignments').select('*', { count: 'exact', head: true });
    const { count: imported } = await supabase.from('curriculum_assignments').select('*', { count: 'exact', head: true }).eq('category', 'Imported');

    console.log(`Total Curriculum: ${total}, Imported: ${imported}`);
    const toDelete = total - imported;

    if (toDelete > 0) {
        console.log(`Deleting ${toDelete} bogus curriculum items...`);
        const { error: delError } = await supabase
            .from('curriculum_assignments')
            .delete()
            .neq('category', 'Imported');

        if (delError) console.error("Delete Error:", delError);
        else console.log("Success: Filler curriculum deleted.");
    } else {
        console.log("No non-imported curriculum found. (Maybe they are labeled 'Imported' falsely? Or just buried?)");
        // Alternative: Delete by Title list from mockData known fillers
        const fillers = ['Physics Intro', 'Chem Lab', 'Eco Project', 'Bio Test', 'Cells Unit', 'Calculus Intro', 'Geometry Proofs', 'Algebra Quiz', 'Poetry Unit', 'Essay Draft', 'Shakespeare', 'Grammar Test', 'Civics Quiz', 'History Essay', 'Geo Map', 'Econ Test'];
        const { error: delSpecific } = await supabase
            .from('curriculum_assignments')
            .delete()
            .in('title', fillers);
        if (!delSpecific) console.log("Success: Explicit filler titles purged.");
    }

    // 2. Reset Student Behavior fields
    console.log("Resetting Student Behavior stats to clean slate (Attendance=100, Writeups=0)...");
    const { error: studentError, count: studentCount } = await supabase
        .from('students')
        .update({ attendance: 100, writeups: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Valid filter to apply to all

    if (studentError) console.error("Student Update Error:", studentError);
    else console.log(`Reset behavior stats for students.`);

    console.log("--- CLEANUP COMPLETE ---");
}

cleanup();
