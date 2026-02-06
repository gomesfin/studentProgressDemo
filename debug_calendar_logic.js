
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';
const supabase = createClient(supabaseUrl, supabaseKey);

const debugCalendar = async () => {
    // 1. Fetch a student with known data (e.g., Abdulnasir)
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Abdulnasir%').limit(1);
    const studentId = students[0].id;
    console.log(`Analyzing Student: ${students[0].name} (${studentId})`);

    // 2. Fetch Assignments via Class Progress (Simulate API logic)
    const { data: snapshots } = await supabase
        .from('class_progress')
        .select(`
            class_id,
            assignment_data,
            classes ( title, subject_id )
        `)
        .eq('student_id', studentId);

    // reconstruct student.assignments like API.js
    let assignments = [];
    snapshots.forEach(snap => {
        const title = snap.classes?.title;
        const sub = snap.classes?.subject_id;
        const data = snap.assignment_data || [];

        const mapped = data.map(a => ({
            ...a,
            classTitle: title, // This is what we filter by
            subject: sub
        }));
        assignments = [...assignments, ...mapped];
    });

    console.log(`Total Assignments Loaded: ${assignments.length}`);

    // 3. Simulate CalendarModal "Available Subjects" Logic
    // In Modal, we look at enrolledClasses or unique keys.
    // Let's simplified version:
    const uniqueTitles = [...new Set(assignments.map(a => a.classTitle))];
    console.log("Unique Titles in Assignments:", uniqueTitles);

    uniqueTitles.forEach(targetTitle => {
        console.log(`\nTesting Filter for Subject/Title: "${targetTitle}"`);

        // Target Logic
        const currentSubject = { fullName: targetTitle };

        const filtered = assignments.filter(a => {
            // Logic from CalendarModal.jsx
            return a.classTitle && currentSubject.fullName && a.classTitle === currentSubject.fullName;
        });

        console.log(`  > Match Count: ${filtered.length}`);

        if (filtered.length === 0) {
            console.log("  > FAIL: 0 Matches found. Checking samples:");
            const samples = assignments.slice(0, 3);
            samples.forEach(s => {
                console.log(`    - Assign Title: '${s.classTitle}' vs Target: '${currentSubject.fullName}' | Eq? ${s.classTitle === currentSubject.fullName}`);
                console.log(`    - Debug Type: TitleType=${typeof s.classTitle} TargetType=${typeof currentSubject.fullName}`);
            });
        } else {
            const completed = filtered.filter(a => a.status === 'Complete').length;
            const pct = Math.round((completed / filtered.length) * 100);
            console.log(`  > Success! ${completed}/${filtered.length} = ${pct}%`);
        }
    });

};

debugCalendar();
