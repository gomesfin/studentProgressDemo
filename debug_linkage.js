
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkLinkage() {
    console.log("--- STUDENT & ENROLLMENT LINKAGE ---");

    // 1. Check Student Homerooms
    const { data: students } = await supabase.from('students').select('id, name, homeroom, enrolled_classes');
    const hrDist = {};
    students.forEach(s => {
        hrDist[s.homeroom] = (hrDist[s.homeroom] || 0) + 1;
    });
    console.log("Student Homeroom Distribution:", hrDist);

    // 2. Check Enrollment Links
    // Get all enrollments
    const { data: enrollments } = await supabase.from('enrollments').select('student_id, class_id, classes(title, subject_id)');

    // Check how many students have enrollments
    const studentsWithEnrollments = new Set();
    const brokenLinks = [];
    let scienceEnrollments = 0;

    enrollments.forEach(e => {
        if (!e.classes) {
            // Broken Class Link
            console.log(`[Broken Class Link] Enrollment for student ${e.student_id} points to missing class ${e.class_id}`);
        } else {
            studentsWithEnrollments.add(e.student_id);
            if (e.classes.subject_id === 'science') {
                scienceEnrollments++;
            }
        }
    });

    console.log(`Students with at least 1 enrollment: ${studentsWithEnrollments.size} / ${students.length}`);
    console.log(`Total Science Enrollments: ${scienceEnrollments}`);

    // 3. Find Science Students without Enrollments
    // Assuming 'science' homeroom students should have science enrollments
    const scienceStudents = students.filter(s => s.homeroom === 'science');
    console.log(`Students in Science Homeroom: ${scienceStudents.length}`);

    const scienceMissing = scienceStudents.filter(s => !studentsWithEnrollments.has(s.id));
    if (scienceMissing.length > 0) {
        console.log(`WARNING: ${scienceMissing.length} Science students have ZERO enrollments in DB.`);
        console.log("Sample Names:", scienceMissing.slice(0, 3).map(s => s.name));
    } else {
        console.log("All Science students have at least one enrollment.");
    }
}

checkLinkage();
