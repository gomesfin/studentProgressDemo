
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function inspectContent() {
    console.log("--- Inspecting 'students' JSON columns ---");
    const { data, error } = await supabase.from('students').select('name, progress, enrolled_classes').limit(5);

    if (data) {
        data.forEach(s => {
            console.log(`\nStudent: ${s.name}`);
            console.log("Progress:", JSON.stringify(s.progress));
            console.log("Enrolled:", JSON.stringify(s.enrolled_classes));
        });
    }
}

inspectContent();
