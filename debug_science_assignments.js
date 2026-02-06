
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkScienceAssignments() {
    console.log("--- SCIENCE ASSIGNMENTS DIAGNOSTIC ---");

    // 1. Get Science Enrollments
    const { data: classes } = await supabase.from('classes').select('id').eq('subject_id', 'science');
    const classIds = classes.map(c => c.id);

    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, student_id')
        .in('class_id', classIds);

    console.log(`Science Enrollments: ${enrollments.length}`);
    const enrollmentIds = enrollments.map(e => e.id);

    // 2. Check Assignments for these Enrollments
    if (enrollmentIds.length > 0) {
        const { count: saCount } = await supabase
            .from('student_assignments')
            .select('*', { count: 'exact', head: true })
            .in('enrollment_id', enrollmentIds);

        console.log(`Total Student Assignments for Science: ${saCount}`);
        console.log(`Average Assignments per Student: ${Math.round(saCount / enrollments.length)}`);

        // Check if any enrollment has ZERO assignments
        // (Sample check)
        const { data: sampleSA } = await supabase
            .from('student_assignments')
            .select('enrollment_id')
            .in('enrollment_id', enrollmentIds);

        const authorizedEnrols = new Set(sampleSA.map(s => s.enrollment_id));
        const emptyEnrols = enrollmentIds.filter(id => !authorizedEnrols.has(id));

        if (emptyEnrols.length > 0) {
            console.log(`WARNING: ${emptyEnrols.length} Science Enrollments have ZERO assignments.`);

            // Fetch details
            const { data: details } = await supabase
                .from('enrollments')
                .select('student_id, classes(title), students(name)')
                .in('id', emptyEnrols)
                .limit(10);

            console.log("Sample Broken Enrollments:");
            details.forEach(d => {
                console.log(` - ${d.students?.name} (${d.classes?.title})`);
            });
        } else {
            console.log("All Science Enrollments have at least one assignment.");
        }

    }
}

checkScienceAssignments();
