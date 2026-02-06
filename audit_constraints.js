
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkConstraints() {
    console.log("--- AUDITING DATABASE CONSTRAINTS ---");

    // 1. Check Curriculum Duplication (Class + Title)
    // We'll look for a class, pick an existing title, and try to insert it AGAIN.
    const { data: cItem } = await supabase.from('curriculum_assignments').select('*').limit(1).maybeSingle();
    let curriculumSafe = false;

    if (cItem) {
        console.log(`[Probe] Trying to duplicate Curriculum: '${cItem.title}' in Class '${cItem.class_id}'...`);
        const { data: dup, error } = await supabase.from('curriculum_assignments').insert({
            class_id: cItem.class_id,
            title: cItem.title,
            max_points: cItem.max_points,
            category: 'AuditProbe'
        }).select();

        if (error) {
            console.log(`[PASS] Constraint Caught: ${error.message} (Code: ${error.code})`);
            curriculumSafe = true;
        } else {
            console.log(`[FAIL] Duplicate Inserted! (ID: ${dup[0].id}) - No Unique Constraint on (class_id, title)`);
            // Cleanup probing data
            await supabase.from('curriculum_assignments').delete().eq('id', dup[0].id);
        }
    } else {
        console.log("[Skip] No curriculum to test against.");
    }

    // 2. Check Enrollment Duplication (Student + Class + Term)
    const { data: enroll } = await supabase.from('enrollments').select('*').limit(1).maybeSingle();

    if (enroll) {
        console.log(`[Probe] Trying to duplicate Enrollment: Student ${enroll.student_id} in Class ${enroll.class_id}...`);
        const { data: dupE, error: errE } = await supabase.from('enrollments').insert({
            student_id: enroll.student_id,
            class_id: enroll.class_id,
            term: enroll.term, // Assuming 'term' is part of key? Or just Student+Class?
            status: 'AuditProbe'
        }).select();

        if (errE) {
            console.log(`[PASS] Constraint Caught: ${errE.message}`);
        } else {
            console.log(`[FAIL] Duplicate Enrollment Inserted! (ID: ${dupE[0].id})`);
            await supabase.from('enrollments').delete().eq('id', dupE[0].id);
        }
    }

    // 3. Check Student Assignment Duplication (Enrollment + Assignment)
    if (cItem && enroll) {
        // Need a valid assignment ID and enrollment ID.
        // Let's use existing relationship if possible.
        const { data: sa } = await supabase.from('student_assignments').select('*').limit(1).maybeSingle();
        if (sa) {
            console.log(`[Probe] Trying to duplicate Student Assignment...`);
            const { data: dupSA, error: errSA } = await supabase.from('student_assignments').insert({
                enrollment_id: sa.enrollment_id,
                assignment_id: sa.assignment_id,
            }).select();

            if (errSA) {
                console.log(`[PASS] Constraint Caught: ${errSA.message}`);
            } else {
                console.log(`[FAIL] Duplicate SA Inserted! (ID: ${dupSA[0].id})`);
                await supabase.from('student_assignments').delete().eq('id', dupSA[0].id);
            }
        }
    }
}

checkConstraints();
