
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const debugMahmoudFile = async () => {
    let log = "Debug Mahmoud Output\n================\n";

    // 1. Find Student
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Mahmoud%');
    const student = students[0];
    log += `Student: ${student.id} (${student.name})\n`;

    // 2. Fetch Progress
    const { data: progress } = await supabase
        .from('class_progress')
        .select(`
            id,
            class_id,
            total_assignments,
            assignment_data,
            classes:class_id ( title, subject_id )
        `)
        .eq('student_id', student.id);

    progress.forEach(p => {
        const title = p.classes?.title || 'Unknown Class';
        const sub = p.classes?.subject_id || 'Unknown Sub';

        log += `\n--- Class: ${title} (${sub}) ---\n`;
        log += `DB Count: ${p.total_assignments}\n`;

        const assignments = p.assignment_data || [];
        log += `JSON Length: ${assignments.length}\n`;

        const tags = {};
        const subs = {};
        assignments.forEach(a => {
            const t = a.classTitle || 'MISSING_TITLE';
            const s = a.subject || 'MISSING_SUB';
            tags[t] = (tags[t] || 0) + 1;
            subs[s] = (subs[s] || 0) + 1;
        });

        log += `ClassTitle Tags: ${JSON.stringify(tags)}\n`;
        log += `Subject Tags: ${JSON.stringify(subs)}\n`;
    });

    fs.writeFileSync('debug_mahmoud_output.txt', log);
    console.log("Written to debug_mahmoud_output.txt");
};

debugMahmoudFile();
