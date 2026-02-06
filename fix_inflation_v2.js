
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const fixSpecific = async () => {
    console.log("Fetching Biibaaye...");
    const { data: students } = await supabase.from('students').select('id, name').ilike('name', '%Biibaaye%');
    const student = students[0];

    if (!student) { console.log("Student not found"); return; }
    console.log("Target:", student.id);

    const { data: progress } = await supabase.from('class_progress').select('*').eq('student_id', student.id);

    progress.forEach(async (p) => {
        console.log(`\nRecord ${p.id}:`);
        console.log("Assignment Data Valid Array?", Array.isArray(p.assignment_data));
        const arr = p.assignment_data || [];
        console.log("Length:", arr.length);

        if (arr.length > 0) {
            console.log("Sample Item:", JSON.stringify(arr[0]));
            // Check keys
            console.log("Keys:", Object.keys(arr[0]));
        }

        // Force Dedup Logic Check
        const unique = new Set(arr.map(x => x.activityName));
        console.log("Unique ActivityEntries:", unique.size);

        if (arr.length > unique.size) {
            console.log("Has Duplicates! Attempting Fix...");

            // Fix Logic
            const map = {};
            arr.forEach(a => map[a.activityName] = a);
            const fixedArr = Object.values(map);

            console.log(`Contracting ${arr.length} -> ${fixedArr.length}`);

            const total = fixedArr.length;
            const completed = fixedArr.filter(a => a.status === 'Complete').length;

            const { error } = await supabase
                .from('class_progress')
                .update({
                    assignment_data: fixedArr,
                    total_assignments: total,
                    completed_count: completed
                })
                .eq('id', p.id);

            console.log("Update Result:", error ? error.message : "Success");
        } else {
            console.log("No Duplicates found via Set check.");
        }
    });
};

fixSpecific();
