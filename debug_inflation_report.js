
import fs from 'fs';

// ... (existing imports)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MASTER_CURRICULUM } from './curriculum_standards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function run() {
    const studentName = 'Muntase Jama';
    const className = 'Physical Science A';

    console.log(`Analyzing Inflation for ${studentName} in ${className}...`);

    // 1. Get Student & Enrollment
    const { data: s } = await sb.from('students').select('id').ilike('name', `%${studentName}%`).single();
    if (!s) return console.log("Student not found");

    const { data: cls } = await sb.from('classes').select('id').eq('title', className).single();
    if (!cls) return console.log("Class not found");

    const { data: enrol } = await sb.from('enrollments').select('id').eq('student_id', s.id).eq('class_id', cls.id).single();
    if (!enrol) return console.log("Enrollment not found");

    // 2. Get Student Assignments
    const { data: assigns } = await sb.from('student_assignments')
        .select('curriculum_assignments(title)')
        .eq('enrollment_id', enrol.id);

    const studentItems = assigns.map(a => a.curriculum_assignments.title);
    console.log(`Student has ${studentItems.length} assignments.`);

    // 3. Get Master List
    const masterItems = MASTER_CURRICULUM[className] || [];
    console.log(`Master Curriculum has ${masterItems.length} assignments.`);

    // 4. Compare
    const extras = studentItems.filter(i => !masterItems.includes(i));
    const missing = masterItems.filter(i => !studentItems.includes(i));

    const report = [
        `Analyzing Inflation for ${studentName} in ${className}...`,
        `Student has ${studentItems.length} assignments.`,
        `Master Curriculum has ${masterItems.length} assignments.`,
        `\n--- INFLATED ITEMS (${extras.length}) ---`,
        `(These exist in the Imported File but NOT in your Master List)`,
        ...extras.sort().map(i => `[+] ${i}`),
        `\n--- MISSING ITEMS (${missing.length}) ---`,
        `(These exist in Master List but were NOT in the Imported File)`,
        ...missing.sort().map(i => `[-] ${i}`)
    ].join('\n');

    // Write report
    fs.writeFileSync('inflation_report.txt', report);
    console.log("Report generated: inflation_report.txt");
}

run();
