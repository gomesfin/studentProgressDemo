
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const verify = async () => {
    console.log("Verifying Column Sync for Abdulnasir...");

    // 1. Find Student
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Abdulnasir%');
    const student = students[0];

    // 2. Find Class
    const { data: progress } = await supabase
        .from('class_progress')
        .select('*')
        .eq('student_id', student.id);

    progress.forEach(p => {
        const arr = p.assignment_data || [];
        const jsonCount = arr.length;
        const colCount = p.total_assignments;

        console.log(`\nRecord: ${p.id}`);
        console.log(`JSON Length: ${jsonCount}`);
        console.log(`Column Count: ${colCount}`);

        if (jsonCount !== colCount) {
            console.log("!!! MISMATCH DETECTED !!!");
            console.log(`Inflation Delta: ${colCount - jsonCount}`);
        } else {
            console.log("Sync OK.");
        }
    });
};

verify();
