
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const auditDB = async () => {
    console.log("Starting DB Audit...");

    // 1. Get a Student (Mahmoud or Abdulnasir as examples)
    const { data: students, error: sErr } = await supabase
        .from('students')
        .select('*')
        .ilike('name', '%Mahmoud%') // Using Mahmoud as a test case
        .limit(1);

    if (sErr || !students.length) {
        console.error("Student Not Found", sErr);
        return;
    }

    const student = students[0];
    console.log(`Auditing Student: ${student.name} (${student.id})`);

    // 2. Get Raw Class Progress Blob
    const { data: progress, error: pErr } = await supabase
        .from('class_progress')
        .select('*')
        .eq('student_id', student.id);

    if (pErr) {
        console.error("Progress Fetch Error", pErr);
        return;
    }

    console.log(`Found ${progress.length} class entries.`);

    // 3. Dump Raw JSON to File
    const report = {
        student: student.name,
        timestamp: new Date().toISOString(),
        rawData: progress
    };

    fs.writeFileSync('audit_db_dump.json', JSON.stringify(report, null, 2));
    console.log("Raw Data dumped to 'audit_db_dump.json'");
};

auditDB();
