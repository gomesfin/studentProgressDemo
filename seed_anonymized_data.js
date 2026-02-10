
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load .env manually since we are running a standalone node script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SUBJECTS = [
    { id: 'science', name: 'Science', color: '#2dd4bf' },
    { id: 'math', name: 'Math', color: '#60a5fa' },
    { id: 'english', name: 'English', color: '#f87171' },
    { id: 'socialStudies', name: 'Social Studies', color: '#a78bfa' },
    { id: 'electives', name: 'Electives', color: '#f59e0b' }
];

const CLASSES = {
    science: ['Biology A', 'Chemistry', 'Physics'],
    math: ['Algebra I', 'Geometry', 'Calculus'],
    english: ['English 9', 'English 10', 'Literature'],
    socialStudies: ['World History', 'US History', 'Civics'],
    electives: ['Art', 'Music', 'PE']
};

const CLASS_IDS = {}; // cache

async function seed() {
    console.log("Starting Anonymized Seed...");

    // 0. CLEAN SLATE
    console.log("Cleaning Database...");
    // clear tables in reverse order of dependencies
    await supabase.from('class_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('student_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Deleting students cascades to enrollments/progress usually, but we do it explicitly above to be safe.
    const { error: delErr } = await supabase.from('students').delete().neq('id', 'x');
    if (delErr) console.error("Clean Error:", delErr);

    console.log("Database Wiped.");

    // 1. Subjects
    console.log("Seeding Subjects...");
    const { error: subErr } = await supabase.from('subjects').upsert(SUBJECTS);
    if (subErr) throw subErr;

    // 2. Classes
    console.log("Seeding Classes...");
    for (const [subId, titles] of Object.entries(CLASSES)) {
        for (const title of titles) {
            // Check existence
            const { data: existing } = await supabase.from('classes')
                .select('id')
                .eq('subject_id', subId)
                .eq('title', title)
                .maybeSingle();

            if (existing) {
                CLASS_IDS[`${subId}:${title}`] = existing.id;
            } else {
                const { data: newClass, error } = await supabase.from('classes')
                    .insert({ subject_id: subId, title })
                    .select()
                    .single();
                if (error) throw error;
                CLASS_IDS[`${subId}:${title}`] = newClass.id;
            }
        }
    }

    // 3. Students & Enrollments
    console.log("Generating Students...");
    const STUDENTS_PER_ROOM = 15;
    const TOTAL_STUDENTS = STUDENTS_PER_ROOM * 4;

    // We will place 15 students in each of the 4 main homerooms
    const HOMEROOMS = ['science', 'math', 'english', 'socialStudies'];

    for (const room of HOMEROOMS) {
        for (let i = 1; i <= STUDENTS_PER_ROOM; i++) {
            const num = Math.floor(Math.random() * 9000) + 1000;
            const name = `Student ${num}`; // Anonymized Name
            const id = `s-${num}-${room}`;

            // Upsert Student
            const studentPayload = {
                id,
                name,
                grade: ['9th', '10th', '11th', '12th'][Math.floor(Math.random() * 4)],
                homeroom: room,
                x: 0,
                y: 0,
                manual_position: false,
                enrolled_classes: {}, // JSON fallback
                progress: {}
            };

            const { error: sErr } = await supabase.from('students').upsert(studentPayload);
            if (sErr) console.error("Student Error:", sErr);

            // Create Enrollments & Progress for each subject
            for (const subId of Object.keys(CLASSES)) {
                // Pick a random class for this subject
                const titles = CLASSES[subId];
                const title = titles[Math.floor(Math.random() * titles.length)];
                const classId = CLASS_IDS[`${subId}:${title}`];

                if (!classId) continue;

                // Generate Random Progress stats
                const totalAssign = 20;
                const completed = Math.floor(Math.random() * 21); // 0-20
                const percent = Math.round((completed / totalAssign) * 100);

                // Upsert Enrollment
                await supabase.from('enrollments').upsert({
                    student_id: id,
                    class_id: classId,
                    current_grade: Math.floor(Math.random() * 40) + 60, // 60-100
                    status: 'ACTIVE',
                    student_name_cache: name,
                    class_name_cache: title
                }, { onConflict: 'student_id, class_id' });

                // Upsert Class Progress (V8 Snapshot)
                // We fake the JSON blob for the graph
                const fakeAssignments = Array.from({ length: totalAssign }, (_, idx) => ({
                    activityName: `Unit ${Math.floor(idx / 5) + 1} - Task ${idx % 5}`,
                    score: idx < completed ? 10 : null,
                    possible: 10,
                    percentage: idx < completed ? 100 : 0,
                    status: idx < completed ? 'Complete' : 'Missing',
                    date: new Date().toISOString()
                }));

                await supabase.from('class_progress').upsert({
                    student_id: id,
                    class_id: classId,
                    total_assignments: totalAssign,
                    completed_count: completed,
                    assignment_data: fakeAssignments,
                    last_updated: new Date().toISOString()
                }, { onConflict: 'student_id, class_id' });
            }
        }
    }

    console.log("Seeding Complete!");
}

seed().catch(err => console.error("Seed Failed:", err));
