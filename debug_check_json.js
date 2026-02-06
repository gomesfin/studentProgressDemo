
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkJson() {
    console.log("--- CHECK JSON FOR HIDAYO ---");
    const { data: students } = await supabase.from('students').select('*').ilike('name', '%Hidayo%');

    if (students && students.length > 0) {
        const h = students[0];
        console.log(`Student: ${h.name} (${h.id})`);
        console.log("Enrolled Classes JSON:", JSON.stringify(h.enrolled_classes, null, 2));
    } else {
        console.log("Student not found.");
    }
}

checkJson();
