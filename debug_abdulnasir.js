
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const debugAbdul = async () => {
    console.log("Debugging Abdulnasir...");

    // 1. Find Student
    const { data: students } = await supabase
        .from('students')
        .select('id, name')
        .ilike('name', '%Abdulnasir%');

    if (!students || students.length === 0) {
        console.log("Student not found.");
        return;
    }
    const student = students[0];
    console.log(`Found: ${student.name} (${student.id})`);

    // 2. Find Class Progress for Physical Science A
    // We'll look for any class with "Physical" in title
    const { data: progress } = await supabase
        .from('class_progress')
        .select(`
            *,
            classes ( title )
        `)
        .eq('student_id', student.id);

    progress.forEach(p => {
        const title = p.classes?.title || 'Unknown Class';
        if (title.includes('Physical') || title.includes('Science')) {
            console.log(`\nClass: ${title}`);
            const assignments = p.assignment_data || [];
            console.log(`Total Count: ${assignments.length}`);

            console.log("--- Assignment List ---");
            assignments.forEach((a, i) => {
                console.log(`${i + 1}. [${a.status}] "${a.activityName}" (Score: ${a.score}/${a.possible})`);
            });

            // Check for duplicate names (case insensitive, trimmed)
            const seen = {};
            assignments.forEach(a => {
                const key = a.activityName.trim().toLowerCase();
                if (seen[key]) {
                    console.log(`!!! DUPLICATE: "${a.activityName}" matches "${seen[key]}"`);
                }
                seen[key] = a.activityName;
            });
        }
    });
};

debugAbdul();
