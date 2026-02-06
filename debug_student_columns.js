
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkColumns() {
    console.log("--- CHECKING STUDENT COLUMNS ---");

    const { data: students, error } = await supabase.from('students').select('*').limit(1);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (students && students.length > 0) {
        console.log("Student Keys:", Object.keys(students[0]));
        console.log("Sample Data:", students[0]);
    } else {
        console.log("No students found.");
    }
}

checkColumns();
