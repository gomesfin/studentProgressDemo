
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function simulateFetch() {
    console.log("--- SIMULATING FETCH CLASSROOM DATA ---");

    // 1. Fetch Students
    const { data: students } = await supabase.from('students').select('*');

    // 2. Fetch Enrollments (Exact query from api.js)
    const { data: enrollments } = await supabase
        .from('enrollments')
        .select('*, classes(title, subject_id), student_assignments(id, assignment_id, status, score, percentage, submitted_at, curriculum_assignments(*))');

    // 2a. Curriculum Counts
    const { data: allCurriculum } = await supabase.from('curriculum_assignments').select('id, class_id');
    const curriculumCounts = {};
    if (allCurriculum) allCurriculum.forEach(c => curriculumCounts[c.class_id] = (curriculumCounts[c.class_id] || 0) + 1);

    // 4. Construct Data
    const classroomData = { science: [], math: [], ela: [], socialStudies: [], electives: [] };
    const enrollmentMap = {};

    if (enrollments) {
        enrollments.forEach(enrol => {
            if (!enrollmentMap[enrol.student_id]) {
                enrollmentMap[enrol.student_id] = { classes: {}, assignments: [], progress: {} };
            }
            const subj = enrol.classes?.subject_id;
            const title = enrol.classes?.title;
            const classId = enrol.class_id;

            if (subj) {
                enrollmentMap[enrol.student_id].classes[subj] = {
                    title: title,
                    totalCurriculum: curriculumCounts[classId] || 0
                };
                // enrollmentMap[enrol.student_id].progress[subj] = enrol.current_grade || 0;

                if (enrol.student_assignments) {
                    enrol.student_assignments.forEach(sa => {
                        enrollmentMap[enrol.student_id].assignments.push({
                            id: 'sql-' + Math.random().toString(36),
                            activityName: sa.curriculum_assignments?.title || 'Unknown',
                            subject: subj, // <--- CRITICAL
                            score: sa.score,
                            status: sa.status
                        });
                    });
                }
            }
        });
    }

    // Process Students
    students.forEach(s => {
        if (!s.name.includes('Hidayo')) return;

        console.log(`Processing ${s.name} (${s.id})...`);
        const sqlData = enrollmentMap[s.id];

        const hasSqlData = sqlData && Object.keys(sqlData.classes).length > 0;
        console.log(`Has SQL Data: ${hasSqlData}`);

        let student = {};
        if (hasSqlData) {
            student = {
                id: s.id,
                name: s.name,
                enrolledClasses: sqlData.classes,
                assignments: sqlData.assignments
            };
            console.log(`Enrolled Classes: ${Object.keys(student.enrolledClasses).join(', ')}`);
            console.log(`Total Assignments: ${student.assignments.length}`);

            // Check ELA Assignments
            const elaAssigns = student.assignments.filter(a => a.subject === 'english');
            console.log(`English Assignments: ${elaAssigns.length}`);

            const ssAssigns = student.assignments.filter(a => a.subject === 'socialStudies');
            console.log(`Social Studies Assignments: ${ssAssigns.length}`);

        } else {
            console.log("FALLBACK TO JSON (Legacy Data)");
            console.log("Legacy JSON:", s.enrolled_classes);
        }
    });
}

simulateFetch();
