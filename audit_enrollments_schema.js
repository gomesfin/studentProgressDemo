
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const auditEnrollments = async () => {
    console.log("Auditing 'enrollments' table...");

    // Select one row to see columns
    const { data, error } = await supabase.from('enrollments').select('*').limit(1);

    if (error) {
        console.error("Error fetching enrollments:", error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
        console.log("Sample Row:", JSON.stringify(data[0], null, 2));
    } else {
        console.log("Table exists but appears empty or no access.");
    }

    // Also check 'classes' table if it exists, as enrollments links to it
    const { data: classData, error: classError } = await supabase.from('classes').select('*').limit(1);
    if (classData && classData.length > 0) {
        console.log("\nColumns found in 'classes':", Object.keys(classData[0]));
    }
};

auditEnrollments();
