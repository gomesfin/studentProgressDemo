
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const auditSchema = async () => {
    console.log("Starting Schema Audit...");
    const report = {};

    // 1. Students Table
    const { data: s, error: sErr } = await supabase.from('students').select('*').limit(1);
    report.students = sErr ? `Error: ${sErr.message}` : (s.length ? Object.keys(s[0]) : 'Empty Table');

    // 2. Class Progress
    const { data: c, error: cErr } = await supabase.from('class_progress').select('*').limit(1);
    report.class_progress = cErr ? `Error: ${cErr.message}` : (c.length ? Object.keys(c[0]) : 'Empty Table');

    // 3. User Settings (if exists)
    const { data: u, error: uErr } = await supabase.from('user_settings').select('*').limit(1);
    report.user_settings = uErr ? `Error: ${uErr.message}` : (u.length ? Object.keys(u[0]) : 'Empty Table');

    // 4. Enrollments (Inferred from api.js usage 'enrolled_classes' in DB? Or is it a separate table?)
    // api.js suggests 'student_history' or similar? Let's check api.js code again.
    // It seems to query `student_history` or something?
    // Actually, looking at previous api.js view, it queried `enrolled_classes`? No, it queried `class_progress`.
    // Let's check code traces for other tables.

    console.log("Schema Report:", JSON.stringify(report, null, 2));
};

auditSchema();
