import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv'; // Load env vars

// Helper to load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugStudent() {
    const studentName = 'Hanaan Daud';
    console.log(`Searching for: ${studentName}...`);

    // 1. Get Student ID
    const { data: students, error: sErr } = await supabase
        .from('students')
        .select('*')
        .ilike('name', `%${studentName}%`);

    if (sErr || !students.length) {
        console.error("Student not found:", sErr);
        return;
    }

    const student = students[0];
    console.log(`Found Student: ${student.name} (${student.id})`);

    // 2. Get Enrollments + Classes
    const { data: enrollments, error: eErr } = await supabase
        .from('enrollments')
        .select('*, classes(title, subject_id)')
        .eq('student_id', student.id);

    if (eErr) {
        console.error("Enrollment Error:", eErr);
        return;
    }

    console.log(`\nEnrollments (${enrollments.length}):`);
    enrollments.forEach(e => {
        console.log(`- [${e.classes?.subject_id}] ${e.classes?.title} (ID: ${e.id})`);
    });

    // 3. Get Assignments
    const enrollmentIds = enrollments.map(e => e.id);
    const { data: assignments, error: aErr } = await supabase
        .from('student_assignments')
        .select('*, curriculum_assignments(title)')
        .in('enrollment_id', enrollmentIds);

    if (aErr) {
        console.error("Assignment Error:", aErr);
        return;
    }

    console.log(`\nAssignments (${assignments.length}):`);

    // Group by Class Title
    const byClass = {};
    const undatedComplete = [];
    const dated = [];

    const incompleteSamples = [];

    assignments.forEach(a => {
        // Find which class this belongs to
        const enrol = enrollments.find(e => e.id === a.enrollment_id);
        const title = enrol?.classes?.title || 'Unknown';

        if (!byClass[title]) byClass[title] = { total: 0, completed: 0, dated: 0, undatedComplete: 0, incompleteSample: [] };
        byClass[title].total++;
        if (a.status === 'Complete') {
            byClass[title].completed++;
        } else {
            if (byClass[title].incompleteSample.length < 3) byClass[title].incompleteSample.push(`${a.curriculum_assignments?.title} (${a.status})`);
        }
        if (a.submitted_at) {
            byClass[title].dated++;
            dated.push({ title, date: a.submitted_at, status: a.status });
        } else {
            if (a.status === 'Complete') {
                byClass[title].undatedComplete++;
                undatedComplete.push({ title, status: a.status });
            }
        }
    });

    Object.entries(byClass).forEach(([title, stats]) => {
        console.log(`\nClass: ${title}`);
        console.log(`  Total Assignments: ${stats.total}`);
        console.log(`  Marked 'Complete': ${stats.completed}`);
        if (stats.incompleteSample && stats.incompleteSample.length) {
            console.log(`  Incomplete Examples: ${stats.incompleteSample.join(', ')}`);
        }
        console.log(`  With Date: ${stats.dated}`);
        console.log(`  Undated & Complete: ${stats.undatedComplete}`);

        const graphStart = stats.undatedComplete; // Expected Pre-Start
        const graphEnd = stats.undatedComplete + stats.dated; // Expected Max Cumulative
        const pct = Math.round((graphEnd / stats.total) * 100);
        console.log(`  Expected Graph End %: ${pct}% (${graphEnd}/${stats.total})`);
    });

}

debugStudent();
