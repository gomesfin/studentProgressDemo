
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkScience() {
    console.log("--- SCIENCE DIAGNOSTIC ---");

    // 1. Check Science Classes
    const { data: classes, error: cError } = await supabase
        .from('classes')
        .select('id, title')
        .eq('subject_id', 'science');

    if (cError) {
        console.error("Error fetching classes:", cError);
        return;
    }
    console.log(`Science Classes in DB (${classes.length}):`);
    classes.forEach(c => console.log(` - [${c.id}] "${c.title}"`));

    // 2. Check Enrollments for these classes
    const classIds = classes.map(c => c.id);
    if (classIds.length > 0) {
        const { count: eCount } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .in('class_id', classIds);
        console.log(`Total Enrollments in Science classes: ${eCount}`);

        // 3. Check specific broken students?
        // Let's check if there are any enrollments with 'science' subject directly? 
        // No, enrollments link to class_id.
    } else {
        console.log("No Science classes found! This explains why enrollments fail.");
    }
}

checkScience();
