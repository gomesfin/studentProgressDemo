
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const debugMahmoud = async () => {
    console.log("Debugging Mahmoud...");

    // 1. Find Student
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Mahmoud%');

    if (!students || students.length === 0) {
        console.log("Student not found.");
        return;
    }

    const student = students[0];
    console.log(`Student: ${student.id} (${student.name})`);

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

        console.log(`\n--- Class: ${title} (${sub}) ---`);
        console.log(`DB Count: ${p.total_assignments}`);
        console.log(`JSON Length: ${p.assignment_data?.length}`);

        const tags = {};
        const subs = {};
        (p.assignment_data || []).forEach(a => {
            const t = a.classTitle || 'MISSING';
            const s = a.subject || 'MISSING';
            tags[t] = (tags[t] || 0) + 1;
            subs[s] = (subs[s] || 0) + 1;
        });

        console.log("ClassTitle Tags:", tags);
        console.log("Subject Tags:", subs);
    });
};

debugMahmoud();
