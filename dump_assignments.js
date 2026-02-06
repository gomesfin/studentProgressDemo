
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const dump = async () => {
    // 1. Find Student
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Abdulnasir%');
    if (!students || students.length === 0) return;
    const student = students[0];

    // 2. Find Class
    const { data: progress } = await supabase
        .from('class_progress')
        .select('*, classes(title)')
        .eq('student_id', student.id);

    const target = progress.find(p => p.classes?.title?.includes('Physical Science A')); // Target specific class

    if (target) {
        const assignments = target.assignment_data || [];
        let output = `Student: ${student.name}\nClass: ${target.classes.title}\nTotal: ${assignments.length}\n\n`;

        assignments.forEach((a, i) => {
            output += `${String(i + 1).padStart(2, '0')}. [${a.status}] "${a.activityName}"\n`;
        });

        fs.writeFileSync('dump_abdul.txt', output);
        console.log("Dump written to dump_abdul.txt");
    } else {
        console.log("Physical Science A not found for student.");
    }
};

dump();
