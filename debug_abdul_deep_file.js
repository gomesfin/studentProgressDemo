
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const debugDeep = async () => {
    let log = "Deep Debug Abdulnasir Report\n============================\n";

    // 1. Find Student
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Abdulnasir%');
    const student = students[0];
    log += `Student: ${student.id} (${student.name})\n`;

    // 2. Fetch Progress
    const { data: progress } = await supabase
        .from('class_progress')
        .select(`
            id,
            class_id,
            assignment_data,
            classes:class_id ( title, subject_id )
        `)
        .eq('student_id', student.id);

    progress.forEach(p => {
        const clsTitle = p.classes?.title;
        const clsSub = p.classes?.subject_id;
        log += `\n--- Class: ${clsTitle} (${clsSub}) ---\n`;

        const assignments = p.assignment_data || [];
        log += `Total Assignments: ${assignments.length}\n`;

        // Analyze Tags
        const subjectCounts = {};
        const titleCounts = {};

        assignments.forEach(a => {
            const s = a.subject || 'UNDEFINED';
            const t = a.classTitle || 'UNDEFINED';
            subjectCounts[s] = (subjectCounts[s] || 0) + 1;
            titleCounts[t] = (titleCounts[t] || 0) + 1;
        });

        log += `Subject Tags: ${JSON.stringify(subjectCounts)}\n`;
        log += `ClassTitle Tags: ${JSON.stringify(titleCounts)}\n`;

        // Sample
        if (assignments.length > 0) {
            log += `Sample Item: ${JSON.stringify(assignments[0])}\n`;
        }
    });

    fs.writeFileSync('debug_abdul_output.txt', log);
    console.log("Report written to debug_abdul_output.txt");
};

debugDeep();
