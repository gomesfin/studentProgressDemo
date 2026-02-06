
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkHidayo() {
    console.log("--- DEBUG HIDAYO AHMED ---");

    // 1. Find Student
    const { data: students } = await supabase.from('students').select('id, name, homeroom').ilike('name', '%Hidayo%');
    if (!students || students.length === 0) {
        console.log("Student 'Hidayo' not found.");
        return;
    }
    const hidayo = students[0];
    console.log(`Student: ${hidayo.name} (ID: ${hidayo.id})`);

    // 2. Check Enrollments
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, class_id, classes(title, subject_id, id)')
        .eq('student_id', hidayo.id);

    console.log(`Enrollments (${enrollments.length}):`);
    enrollments.forEach(e => {
        console.log(` - Class: ${e.classes?.title}`);
        console.log(`   Subject ID: '${e.classes?.subject_id}'`);
        console.log(`   Enrollment ID: ${e.id}`);
    });

    // 3. Check Assignments per Enrollment
    if (enrollments.length > 0) {
        for (const e of enrollments) {
            const { count } = await supabase
                .from('student_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('enrollment_id', e.id);
            console.log(`   -> Enrollment ${e.id} (${e.classes?.title}): ${count} Assignments`);
        }
    }
}

checkHidayo();
