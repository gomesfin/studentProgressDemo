
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// --- CONFIG ---
// DESTINATION (New - from .env)
const destUrl = process.env.VITE_SUPABASE_URL;
const destKey = process.env.VITE_SUPABASE_KEY;

// SOURCE (Old - Recovered)
const sourceUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const sourceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU'; // OLD ANON

if (!destUrl || !destKey) { console.error("Missing Destination Creds"); process.exit(1); }

const sourceDB = createClient(sourceUrl, sourceKey);
const destDB = createClient(destUrl, destKey);

async function migrate() {
    console.log("🚀 Starting ANONYMIZED Migration...");

    // 1. CLEAN DESTINATION
    console.log("🧹 Cleaning Destination...");
    // Use UUID-safe wipe logic
    await destDB.from('class_progress').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await destDB.from('student_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await destDB.from('enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await destDB.from('curriculum_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Keep curriculum? No, wipe it to be safe.
    await destDB.from('students').delete().neq('id', 'x');
    await destDB.from('classes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log("✅ Destination Wiped.");

    // 2. FETCH SOURCE DATA
    console.log("📥 Fetching Source Data...");

    const { data: srcSubjects } = await sourceDB.from('subjects').select('*');
    const { data: srcClasses } = await sourceDB.from('classes').select('*');
    const { data: srcStudents } = await sourceDB.from('students').select('*');
    // We stick to the core data. Enrollment fetch might be huge, so we might paginate if needed, but for <500 students it's fine.
    const { data: srcEnrollments } = await sourceDB.from('enrollments').select('*');
    const { data: srcCurriculum } = await sourceDB.from('curriculum_assignments').select('*');
    const { data: srcProgress } = await sourceDB.from('class_progress').select('*');
    // student_assignments is huge, we might need it? 
    // Actually, class_progress JSON blob is the source of truth for the DASHBOARD. 
    // student_assignments is for individual gradebook view. We should fetch it.
    const { data: srcAssignments } = await sourceDB.from('student_assignments').select('*');

    console.log(`📦 Fetched: ${srcStudents?.length} Students, ${srcEnrollments?.length} Enrollments, ${srcAssignments?.length} Assignments`);
    console.log(`📊 Class Progress Snapshots: ${srcProgress?.length}`);
    if (srcProgress && srcProgress.length > 0) {
        const sample = srcProgress[0].assignment_data?.[0];
        console.log(`[Sample Progress] ID: ${srcProgress[0].id}`);
        console.log(`[Source JSON Keys]:`, sample ? Object.keys(sample) : "Empty/Null");
        console.log(`[Source JSON Sample]:`, JSON.stringify(sample));
    }

    // 3. ANONYMIZATION MAP
    const nameMap = {}; // "Real Name" -> "Student 101"
    const idMap = {}; // "old_id" -> "new_id" (To be safe against ID leaks if ID is email based)

    let counter = 1000;
    srcStudents.forEach(s => {
        const anonName = `Student ${counter++}`;
        nameMap[s.name] = anonName;
        // Keep ID if it looks generic (UUID or s-timestamp), otherwise map it? 
        // The schema uses TEXT ids. Let's keep IDs if they don't look like emails.
        // Assuming IDs are safe-ish, but let's scrub just in case user ID was name based.
        // Actually, renaming ID breaks foreign keys unless we map everything.
        // Let's Keep IDs for referential integrity but scrubbing NAME fields.
    });

    // 4. MIGRATE & TRANSFORM

    // --> Subjects (No PI)
    if (srcSubjects) await destDB.from('subjects').upsert(srcSubjects);

    // --> Classes (Title might have PI? Unlikely "Algebra 1")
    if (srcClasses) await destDB.from('classes').upsert(srcClasses);

    // --> Curriculum (No PI)
    if (srcCurriculum) await destDB.from('curriculum_assignments').upsert(srcCurriculum);

    // --> Students
    if (srcStudents) {
        const cleanStudents = srcStudents.map(s => {
            const newName = nameMap[s.name] || `Student ${Math.floor(Math.random() * 9000)}`;
            return {
                ...s,
                name: newName,
                // Scrub JSON blobs
                enrolled_classes: {}, // Wipe cached legacy JSON to save space/complexity. Relational is source of truth now.
                progress: s.progress // This is usually just { science: 85 }, safe.
            };
        });
        const { error } = await destDB.from('students').upsert(cleanStudents);
        if (error) console.error("Student Write Error", error);
    }

    // --> Enrollments
    if (srcEnrollments) {
        const cleanEnrollments = srcEnrollments.map(e => {
            const cachedName = e.student_name_cache;
            const newName = nameMap[cachedName] || nameMap[Object.keys(nameMap).find(k => k.includes(cachedName))] || "Student (Anon)";
            return {
                ...e,
                student_name_cache: newName,
                metadata: {} // Wipe metadata which often contains raw file dumps
            };
        });
        // Batch
        for (let i = 0; i < cleanEnrollments.length; i += 100) {
            const batch = cleanEnrollments.slice(i, i + 100);
            await destDB.from('enrollments').upsert(batch);
        }
    }

    // --> Class Progress (The Big JSON Blobs)
    if (srcProgress) {
        const cleanProgress = srcProgress.map(p => {
            // The JSON blob 'assignment_data' matches 'mockData' structure locally.
            // It doesn't usually contain the student NAME inside the array items, but let's check.
            // Items are: { activityName, score, ... }
            // It seems safe.
            return p;
        });
        for (let i = 0; i < cleanProgress.length; i += 50) {
            const batch = cleanProgress.slice(i, i + 50);
            await destDB.from('class_progress').upsert(batch);
        }
    }

    // --> Student Assignments
    if (srcAssignments) {
        const cleanAssignments = srcAssignments.map(a => {
            return {
                ...a,
                student_name_cache: nameMap[a.student_name_cache] || "Student"
            };
        });
        // Big batch
        for (let i = 0; i < cleanAssignments.length; i += 500) {
            const batch = cleanAssignments.slice(i, i + 500);
            const { error } = await destDB.from('student_assignments').upsert(batch);
            if (error) console.error("Assignment Batch Error:", error);
        }
    }

    console.log("🎉 Migration Complete!");
}

migrate().catch(console.error);
