
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const debugGlobal = async () => {
    console.log("Scanning Global Inflation...");
    const { data: records } = await supabase.from('class_progress').select('id, student_id, total_assignments, assignment_data');

    let inflatedCount = 0;
    records.forEach(r => {
        const len = r.assignment_data ? r.assignment_data.length : 0;
        if (len > 500) {
            console.log(`[INFLATED] Record ${r.id} (Student: ${r.student_id}): ${len} assignments.`);
            inflatedCount++;
        }
    });

    if (inflatedCount === 0) {
        console.log("No inflated records found (> 500 assignments).");
        // Check MAX length
        let max = 0;
        records.forEach(r => {
            const len = r.assignment_data ? r.assignment_data.length : 0;
            if (len > max) max = len;
        });
        console.log(`Max Assignments found: ${max}`);
    } else {
        console.log(`Found ${inflatedCount} inflated records.`);
    }
};

debugGlobal();
