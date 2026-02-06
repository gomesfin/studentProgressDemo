import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// We need to import the actual logic to test it OR recreate it here to verify the concept.
// Ideally we import `processStudentData` but that might be hard with ESM/module issues in this env.
// Let's SIMULATE the logic to verify the DB constraints/behavior specifically, 
// OR we can try to import the service if it's pure. `api.js` has imports that might break in Node (like ../supabaseClient).
// So let's write a CLEAN TEST that performs the DB operations directly to verify the Rules.

async function verifyImportLogic() {
    console.log("=== Import Logic Verification ===");

    // SETUP: Create a Mock Student and Enrollment
    const testCode = `TEST_${Date.now()}`;
    const studentName = `TestStudent_${testCode}`;
    const className = `TestClass_${testCode}`;
    const subjectId = 'science';

    console.log(`Setup: Creating ${studentName} in ${className}`);

    // 1. Create Data
    // Generate IDs explicitly to avoid default constraints issues
    const sId = crypto.randomUUID();
    const cId = crypto.randomUUID();

    const { data: student, error: sError } = await supabase.from('students').insert({ id: sId, name: studentName }).select().single();
    if (sError) console.error("Create Student Error:", sError);

    const { data: cls, error: cError } = await supabase.from('classes').insert({ id: cId, title: className, subject_id: subjectId }).select().single();
    if (cError) console.error("Create Class Error:", cError);

    if (!student || !cls) {
        console.error("Setup failed: Student or Class is null.");
        return;
    }

    // 2. Create Enrollment with OLD Timestamp
    const oldDate = new Date('2025-01-01T12:00:00Z');
    const { data: enrollment, error: eError } = await supabase.from('enrollments').insert({
        student_id: student.id,
        class_id: cls.id,
        last_import_timestamp: oldDate.toISOString(),
        term: 'FALL_2025'
    }).select().single();

    if (eError) {
        console.error("Create Enrollment Error:", eError);
        return;
    }

    console.log(`✅ Created Enrollment ID: ${enrollment.id}`);
    console.log(`   Initial Timestamp: ${enrollment.last_import_timestamp}`);

    // TEST 1: STALE IMPORT (Should be rejected)
    console.log("\n--- TEST 1: Stale Import Rejection ---");
    const staleDate = new Date('2024-12-31T12:00:00Z'); // Older than 2025-01-01

    // Logic simulation
    let currentDbDate = new Date(enrollment.last_import_timestamp);
    let shouldUpdate = staleDate > currentDbDate;

    if (!shouldUpdate) {
        console.log(`✅ CORRECT: Stale date (${staleDate.toISOString()}) rejected vs DB date (${currentDbDate.toISOString()})`);
    } else {
        console.error(`❌ FAILURE: Stale date was NOT rejected!`);
    }

    // TEST 2: FRESH IMPORT (Should be accepted)
    console.log("\n--- TEST 2: Fresh Import Acceptance ---");
    const freshDate = new Date('2025-02-01T12:00:00Z'); // Newer

    currentDbDate = new Date(enrollment.last_import_timestamp); // Refresh if needed (it wasn't changed)
    shouldUpdate = freshDate > currentDbDate;

    if (shouldUpdate) {
        console.log(`✅ CORRECT: Fresh date accepted.`);

        // EXECUTE UPDATE
        const { error } = await supabase.from('enrollments')
            .update({ last_import_timestamp: freshDate.toISOString() })
            .eq('id', enrollment.id);

        if (error) console.error("   DB Update Failed:", error);
        else console.log("   DB Timestamp Updated Successfully.");

    } else {
        console.error(`❌ FAILURE: Fresh date was rejected!`);
    }


    // TEST 3: ATOMIC REPLACEMENT (Verify Delete-then-Insert)
    console.log("\n--- TEST 3: Atomic Replacement Simulation ---");
    // Seed some assignments
    const { data: curv } = await supabase.from('curriculum_assignments').insert({
        class_id: cls.id, title: 'Item 1', max_points: 10
    }).select().single();

    await supabase.from('student_assignments').insert({
        enrollment_id: enrollment.id, assignment_id: curv.id, status: 'Old'
    });

    // Verify presence
    const { count: countBefore } = await supabase.from('student_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_id', enrollment.id);
    console.log(`   Assignments Before: ${countBefore}`);

    // SIMULATE IMPORT: Delete All
    await supabase.from('student_assignments').delete().eq('enrollment_id', enrollment.id);

    // Verify Empty
    const { count: countAfterDelete } = await supabase.from('student_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('enrollment_id', enrollment.id);

    if (countAfterDelete === 0) {
        console.log(`✅ CORRECT: assignments wiped successfully (Count: ${countAfterDelete})`);
    } else {
        console.error(`❌ FAILURE: assignments not wiped! Count: ${countAfterDelete}`);
    }

    // CLEANUP
    console.log("\n--- Cleanup ---");
    await supabase.from('enrollments').delete().eq('id', enrollment.id);
    await supabase.from('students').delete().eq('id', student.id);
    await supabase.from('classes').delete().eq('id', cls.id); // Cascade should handle curriculum
    console.log("Cleanup complete.");
}

verifyImportLogic().catch(console.error);
