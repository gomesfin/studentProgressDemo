
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkSchema() {
    console.log("--- Checking 'students' table columns ---");
    // We can't query schema directly easily with JS client without permissions, but we can try to select * limit 1 and see keys
    const { data, error } = await supabase.from('students').select('*').limit(1);
    if (error) {
        console.error("Select Error:", error);
    } else if (data && data.length > 0) {
        console.log("Columns found on student record:");
        console.log(Object.keys(data[0]).join(', '));
    } else {
        console.log("No students found, inserting dummy to check schema...");
        const { data: ins, error: insErr } = await supabase.from('students').insert({ id: '00000000-0000-0000-0000-000000000000', name: 'Schema Check' }).select();
        if (insErr) console.error("Insert Error:", insErr);
        else console.log("Columns:", Object.keys(ins[0]).join(', '));
    }
}

checkSchema();
