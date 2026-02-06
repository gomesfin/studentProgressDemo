
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function dumpStudent() {
    console.log("--- DUMPING RAW STUDENT DATA ---");
    const { data: students } = await supabase.from('students').select('*').limit(1);

    if (students && students.length > 0) {
        const s = students[0];
        console.log("Keys:", Object.keys(s));
        console.log("Full Object:", JSON.stringify(s, null, 2));
    }
}

dumpStudent();
