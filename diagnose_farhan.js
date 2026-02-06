
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function diagnose() {
    console.log("--- Diagnosing Farhan Ali ---");

    // 1. Find Student
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Farhan%Ali%');
    if (!students || students.length === 0) { console.log("Student not found."); return; }
    const student = students[0];
    console.log(`Student: ${student.name} (${student.id})`);

    // 2. Find Enrollment in Geometry A
    // (We don't know exact class ID, so fetch all classes for this student)
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, class_id, classes(title)')
        .eq('student_id', student.id);

    if (!enrollments) return;

    // Filter for "Geometry"
    const geomEnrol = enrollments.find(e => e.classes?.title?.toLowerCase().includes('geometry'));
    if (!geomEnrol) { console.log("Geometry enrollment not found."); return; }

    console.log(`Class: ${geomEnrol.classes.title} (EnrolID: ${geomEnrol.id})`);

    // 3. Fetch Assignments
    const { data: assigns } = await supabase
        .from('student_assignments')
        .select('id, assignment_id, score, status, curriculum_assignments(title)')
        .eq('enrollment_id', geomEnrol.id);

    console.log(`Total Assignments Linked: ${assigns.length}`);

    // 4. Check for Duplicates
    const counts = {};
    const ids = {};
    assigns.forEach(a => {
        const title = a.curriculum_assignments?.title || 'Unknown';
        counts[title] = (counts[title] || 0) + 1;
        if (!ids[title]) ids[title] = [];
        ids[title].push(a.assignment_id);
    });

    const dupes = Object.entries(counts).filter(([t, c]) => c > 1);
    if (dupes.length > 0) {
        console.log(`\nDUPLICATES FOUND (${dupes.length} titles):`);
        dupes.slice(0, 10).forEach(([t, c]) => {
            console.log(`"${t}": ${c} copies. CurriculumIDs: ${ids[t].join(', ')}`);
        });
    } else {
        console.log("No duplicates found by title. Are there filler items?");
    }
}

diagnose();
