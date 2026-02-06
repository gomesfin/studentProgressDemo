
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';
const supabase = createClient(supabaseUrl, supabaseKey);

const debugState = async () => {
    // 1. Fetch Student Enrollment Data (SQL)
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Abdulnasir%').limit(1);
    const s = students[0];
    console.log(`\nDebugging Student: ${s.name} (${s.id})`);

    // 2. Fetch Enrollments
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, classes(title, subject_id)')
        .eq('student_id', s.id);

    console.log(`Enrollments Found: ${enrollments.length}`);
    enrollments.forEach(e => {
        console.log(` - Class: ${e.classes?.title} (Sub: ${e.classes?.subject_id})`);
    });

    // 3. Fetch Class Progress (Assignments)
    const { data: snapshots } = await supabase
        .from('class_progress')
        .select('*, classes(title, subject_id)')
        .eq('student_id', s.id);

    console.log(`Snapshots Found: ${snapshots.length}`);

    // 4. Construct Assignments List
    const assignments = [];
    snapshots.forEach(snap => {
        const title = snap.classes?.title;
        const data = snap.assignment_data || [];
        console.log(`   Snapshot [${title}]: ${data.length} items. First item status: ${data[0]?.status}`);

        data.forEach(a => {
            assignments.push({
                ...a,
                classTitle: title, // This is how API constructs it
                subject: snap.classes?.subject_id
            });
        });
    });

    // 5. Simulate Calendar Logic matching
    console.log("\n--- Simulation ---");
    const targetTitle = enrollments[0]?.classes?.title; // Pick one
    if (!targetTitle) {
        console.log("No target class found to test.");
        return;
    }

    const currentSubject = { fullName: targetTitle };
    console.log(`Targeting: '${currentSubject.fullName}'`);

    const matches = assignments.filter(a => {
        const t1 = a.classTitle;
        const t2 = currentSubject.fullName;
        const eq = t1 === t2;
        // console.log(`      Compare: '${t1}' === '${t2}' ? ${eq}`);
        return eq;
    });

    console.log(`Matches Found: ${matches.length}`);

    if (matches.length === 0 && assignments.length > 0) {
        console.log("MISMATCH DETECTED!");
        console.log(`Sample Assignment Title: '${assignments[0].classTitle}'`);
        console.log(`Sample Target Title:     '${currentSubject.fullName}'`);
        console.log(`Strict Equality: ${assignments[0].classTitle === currentSubject.fullName}`);
        console.log(`Trim Equality:   ${assignments[0].classTitle?.trim() === currentSubject.fullName?.trim()}`);
    }
};

debugState();
