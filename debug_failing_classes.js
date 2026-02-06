
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkFailingClasses() {
    console.log("--- FAILING CLASSES DIAGNOSTIC ---");
    const titles = ['Physical Science A', 'Physical Science B', 'Biology A'];

    const { data: classes } = await supabase
        .from('classes')
        .select('id, title, subject_id')
        .in('title', titles);

    classes.forEach(c => {
        console.log(`Class: "${c.title}" | Subject: "${c.subject_id}" | ID: ${c.id}`);
    });
}

checkFailingClasses();
