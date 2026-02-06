
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function verifyChunkedFetch() {
    console.log("--- VERIFYING CHUNKED FETCH LOGIC ---");

    // 1. Fetch Students (Mocking api.js flow)
    const { data: students } = await supabase.from('students').select('*');
    console.log(`Students: ${students.length}`);

    // 2. Fetch Enrollments ONLY
    console.log("Fetching Enrollments...");
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, classes(title, subject_id)');

    console.log(`Enrollments Fetched: ${enrollments.length}`);

    // 3. Setup Map
    const enrollmentMap = {};
    enrollments.forEach(enrol => {
        if (!enrollmentMap[enrol.student_id]) {
            enrollmentMap[enrol.student_id] = { assignments: [] };
        }
        // Link for re-assembly
        enrol.tempRef = enrollmentMap[enrol.student_id];
    });

    // 4. Chunked Fetch of Assignments
    const allEnrollmentIds = enrollments.map(e => e.id);
    const ASSIGN_CHUNK_SIZE = 20; // Reduced from 100 to avoid 1000-row limit
    let totalFetchedAssignments = 0;

    console.log(`Starting Assignment Fetch in chunks of ${ASSIGN_CHUNK_SIZE}...`);

    for (let i = 0; i < allEnrollmentIds.length; i += ASSIGN_CHUNK_SIZE) {
        const chunkIds = allEnrollmentIds.slice(i, i + ASSIGN_CHUNK_SIZE);

        // Use exact query from api.js
        const { data: chunkAssignments, error } = await supabase
            .from('student_assignments')
            .select('*, curriculum_assignments(title, max_points)')
            .in('enrollment_id', chunkIds);

        if (error) {
            console.error("Chunk Error:", error);
            break;
        }

        if (chunkAssignments) {
            totalFetchedAssignments += chunkAssignments.length;
            process.stdout.write(`.`); // Visual progress

            chunkAssignments.forEach(sa => {
                const parentEnrol = enrollments.find(e => e.id === sa.enrollment_id);
                if (parentEnrol && parentEnrol.tempRef) {
                    parentEnrol.tempRef.assignments.push({
                        id: sa.id,
                        title: sa.curriculum_assignments?.title
                    });
                }
            });
        }
    }
    console.log("\nDone.");
    console.log(`Total Assignments Retrieved: ${totalFetchedAssignments}`);

    // 5. Verify Hidayo
    const hidayo = students.find(s => s.name.includes('Hidayo'));
    if (hidayo && enrollmentMap[hidayo.id]) {
        console.log(`Hidayo Ahmed Assignments: ${enrollmentMap[hidayo.id].assignments.length}`);
        if (enrollmentMap[hidayo.id].assignments.length > 0) {
            console.log("SUCCESS: Data re-assembled correctly.");
        } else {
            console.error("FAILURE: Hidayo has 0 assignments.");
        }
    }
}

verifyChunkedFetch();
