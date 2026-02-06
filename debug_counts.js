
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkCounts() {
    console.log("--- Checking Curriculum Counts per Class ---");

    const { data: classes } = await supabase.from('classes').select('id, title, subject_id');
    const { data: counts } = await supabase.from('curriculum_assignments').select('class_id');

    const map = {};
    counts.forEach(c => map[c.class_id] = (map[c.class_id] || 0) + 1);

    console.log(
        String(classes.length).padEnd(10) + "Classes Found"
    );

    classes.forEach(c => {
        const count = map[c.id] || 0;
        if (count === 0 || count > 200) { // Highlight anomalies
            console.log(`[${c.subject_id}] ${c.title}: ${count} items (WARNING)`);
        } else {
            // console.log(`[${c.subject_id}] ${c.title}: ${count} items`);
        }
    });

    // Also check total assignments
    const { count: saCount } = await supabase.from('student_assignments').select('*', { count: 'exact', head: true });
    console.log(`Total Student Assignments in DB: ${saCount}`);
}

checkCounts();
