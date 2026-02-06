
import { createClient } from '@supabase/supabase-js';

// Hardcoded for immediate execution
const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const debug = async () => {
    console.log("Debugging Biibaaye's Data...");

    // 1. Find Student
    const { data: students } = await supabase
        .from('students')
        .select('id, name')
        .ilike('name', '%Biibaaye%');

    if (!students || students.length === 0) {
        console.log("Student not found.");
        return;
    }
    const student = students[0];
    console.log(`Found Student: ${student.name} (${student.id})`);

    // 2. Get Class Progress
    const { data: progress } = await supabase
        .from('class_progress')
        .select('*')
        .eq('student_id', student.id);

    if (!progress || progress.length === 0) {
        console.log("No progress data found.");
        return;
    }

    // 3. Analyze JSON
    progress.forEach(p => {
        console.log(`\n--- Class Progress: ${p.id} ---`);
        console.log(`Updated At: ${p.last_updated}`);

        const assignments = p.assignment_data || [];
        console.log(`Total Assignments in JSON: ${assignments.length}`);

        // Check for Duplicates
        const titles = assignments.map(a => a.activityName);
        const uniqueTitles = new Set(titles);
        console.log(`Unique Titles: ${uniqueTitles.size}`);

        if (titles.length > uniqueTitles.size) {
            console.log("!!! DUPLICATES DETECTED !!!");
            // Show frequencies
            const counts = {};
            titles.forEach(t => counts[t] = (counts[t] || 0) + 1);
            Object.keys(counts).forEach(k => {
                if (counts[k] > 1) console.log(`   "${k}": ${counts[k]} times`);
            });
        }

        // Dump first few assignments
        console.log("Sample Assignments:", assignments.slice(0, 3));
    });
};

debug();
