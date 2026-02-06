
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function inspect() {
    console.log("--- Inspecting Curriculum Categories ---");
    const { data: categories, error } = await supabase
        .from('curriculum_assignments')
        .select('category, title, class_id')
        .limit(50);

    if (error) console.error(error);

    const counts = {};
    categories.forEach(c => {
        counts[c.category] = (counts[c.category] || 0) + 1;
    });
    console.table(counts);

    console.log("\n--- Sample 'Mock' Items ---");
    console.log(categories.filter(c => c.category !== 'Imported').slice(0, 5));

    console.log("\n--- Checking Student Attendance/Writeups ---");
    const { data: students } = await supabase.from('students').select('id, name, attendance, writeups').limit(10);
    console.table(students);
}

inspect();
