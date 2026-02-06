
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBiibaaye() {
    console.log("Analyzing Biibaaye Stewart's Physical Science A Data...");

    // 1. Find Student
    const { data: student } = await supabase.from('students').select('id, name').ilike('name', '%Biibaaye%').single();
    if (!student) { console.error("Student not found"); return; }
    console.log(`Student: ${student.name} (${student.id})`);

    // 2. Fetch Assignments linked to 'Physical Science A' via text label
    const { data: assignments } = await supabase.from('student_assignments')
        .select(`
            id, assignment_id, class_title, subject, activity_name,
            assignment:curriculum_assignments ( 
                id, title, class_id, 
                class:classes ( id, title )
            )
        `)
        .eq('student_id', student.id);
    // We will filter in JS to catch all variants

    // Filter: Items that claim to be "Physical Science A" (via the student_assignment label)
    const physItems = assignments.filter(a =>
        (a.class_title && a.class_title.includes('Physical Science A')) ||
        (a.subject === 'science')
    );

    console.log(`Total 'Physical Science A' Student Records: ${physItems.length}`);

    // 3. Analyze Links
    let contaminationCount = 0;

    physItems.forEach(a => {
        const linkedClass = a.assignment?.class?.title;
        const linkedClassId = a.assignment?.class_id;

        // Is it actually linked to Physical Science A?
        if (linkedClass && linkedClass !== 'Physical Science A') {
            contaminationCount++;
            console.log(`[CONTAMINATION] ID:${a.id} | Label: '${a.class_title}' | LINKED TO: '${linkedClass}' (Success!)`);
        } else if (!linkedClass) {
            // Null link?
            // console.log(`[ORPHAN] ID:${a.id} | Link: ${a.assignment_id} (No Curriculum Found)`);
        } else {
            // Valid Logic
            // console.log(`[VALID] ID:${a.id} | Linked to ${linkedClass}`);
        }
    });

    console.log(`Found ${contaminationCount} Cross-Contaminated Items.`);
}

debugBiibaaye();
