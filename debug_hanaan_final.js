
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugHanaan() {
    console.log("SURGICAL CLEANUP: Hanaan Daud's Physical Science A Data...");

    // 1. Get Physical Science A Class(es)
    const { data: classes } = await supabase.from('classes').select('id, title').eq('title', 'Physical Science A');
    console.log(`Classes Found (${classes.length}):`);
    if (classes.length === 0) { console.error("No class found!"); return; }

    // Use ALL classes found just in case of duplication (to check pollution everywhere)
    // But for curriculum validation, we use the active one?
    // Let's assume the first one is active.
    const targetClass = classes[0];

    // 2. Count Master Curriculum (The Truth)
    const { count: cCount, data: cData } = await supabase.from('curriculum_assignments')
        .select('id, title')
        .eq('class_id', targetClass.id);
    console.log(`Master Curriculum Valid Items: ${cData.length} (Expected 22)`);
    const validIds = new Set(cData.map(c => c.id));

    // 3. Find Hanaan
    const { data: student } = await supabase.from('students').select('id, name').ilike('name', '%Hanaan Daud%').single();
    if (!student) { console.error("Student not found"); return; }
    console.log(`Student: ${student.name} (${student.id})`);

    // 4. Find Enrollments linked to ANY of the classes found
    const classIds = classes.map(c => c.id);
    const { data: enrollments } = await supabase.from('enrollments')
        .select('id, class_id')
        .eq('student_id', student.id)
        .in('class_id', classIds);

    if (!enrollments || enrollments.length === 0) {
        console.error("No enrollment found for Physical Science A!");
        return;
    }

    const enrollmentIds = enrollments.map(e => e.id);
    console.log(`Target Enrollments: ${enrollmentIds.join(', ')}`);

    // 5. Fetch Assignments linked to these Enrollments
    const { data: assignments } = await supabase.from('student_assignments')
        .select('id, assignment_id') // We only need these to validate
        .in('enrollment_id', enrollmentIds);

    console.log(`Total Student Assignments: ${assignments.length}`);

    // 6. Identify Orphans
    const orphans = [];
    assignments.forEach(a => {
        // Condition: assignment_id is NULL OR assignment_id is NOT in validIds
        if (!a.assignment_id || !validIds.has(a.assignment_id)) {
            orphans.push(a.id);
        }
    });

    console.log(`Identified Orphans: ${orphans.length}`);
    console.log(`Valid Assignments: ${assignments.length - orphans.length}`);

    // 7. SURGICAL DELETE
    if (orphans.length > 0) {
        console.log(`Deleting ${orphans.length} orphaned assignment records...`);
        const { error, count } = await supabase.from('student_assignments')
            .delete({ count: 'exact' })
            .in('id', orphans);

        if (error) console.error("Delete Error:", error);
        else console.log(`SUCCESS: Deleted ${count} orphaned records.`);
    } else {
        console.log("No orphans found? The math doesn't add up if UI shows 48.");
        if (assignments.length > 22) {
            console.log("Wait... Valid Assignments > 22?");
            // This implies duplicates VALID items?
            // Or my Master Curriculum List is missing something?
        }
    }
}

debugHanaan();
