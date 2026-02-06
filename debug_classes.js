
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkClasses() {
    console.log("--- Checking Classes Table ---");
    const { data: classes } = await supabase.from('classes').select('subject_id, title');

    const science = classes.filter(c => c.subject_id === 'science');
    console.log(`Found ${science.length} Science Classes:`);
    science.forEach(c => console.log(`"${c.title}"`));

    // Check Enrollments count
    const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true });
    console.log(`Total Enrollments: ${count}`);
}

checkClasses();
