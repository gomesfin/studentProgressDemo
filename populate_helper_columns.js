import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function populateCacheColumns() {
    console.log("=== Populating Helper Columns (Cache) ===");

    // 1. Populate Enrollments Cache
    // We need to fetch ID -> Name mappings
    console.log("Fetching Dimensions...");
    const { data: students } = await supabase.from('students').select('id, name');
    const { data: classes } = await supabase.from('classes').select('id, title');

    if (!students || !classes) {
        console.error("Failed to fetch dimensions.");
        return;
    }

    const sMap = new Map(students.map(s => [s.id, s.name]));
    const cMap = new Map(classes.map(c => [c.id, c.title])); // Class ID -> Title

    // Update Enrollments
    console.log("\n--- Updating Enrollments ---");
    const { data: rawEnrollments } = await supabase.from('enrollments').select('id, student_id, class_id');
    const bSize = 100;

    if (rawEnrollments) {
        let updates = [];
        for (const e of rawEnrollments) {
            const sName = sMap.get(e.student_id);
            const cName = cMap.get(e.class_id);
            if (sName || cName) {
                updates.push({
                    id: e.id,
                    student_name_cache: sName,
                    class_name_cache: cName
                });
            }
        }

        // Bulk Upsert? No, strictly update. 
        // Supabase Upsert works if PK is present.
        for (let i = 0; i < updates.length; i += bSize) {
            const chunk = updates.slice(i, i + bSize);
            const { error } = await supabase.from('enrollments').upsert(chunk);
            if (error) console.error("Enrollment Cache Error:", error);
            else console.log(`Updated ${chunk.length} enrollments.`);
        }
    }

    // 2. Update Curriculum Assignments
    console.log("\n--- Updating Curriculum ---");
    const { data: rawCurriculum } = await supabase.from('curriculum_assignments').select('id, class_id');
    if (rawCurriculum) {
        const updates = rawCurriculum.map(c => ({
            id: c.id,
            class_name_cache: cMap.get(c.class_id)
        })).filter(u => u.class_name_cache);

        for (let i = 0; i < updates.length; i += bSize) {
            const chunk = updates.slice(i, i + bSize);
            const { error } = await supabase.from('curriculum_assignments').upsert(chunk);
            if (error) console.error("Curriculum Cache Error:", error);
            else console.log(`Updated ${chunk.length} curriculum items.`);
        }
    }

    // 3. Update Student Assignments
    // Need mapping: Enrollment ID -> {Student Name, Class Name}
    // Need mapping: Assignment ID -> Assignment Title
    console.log("\n--- Updating Student Assignments (This may take a while) ---");

    // Map Enrollment -> Cache Info
    // We can reuse `updates` from step 1 actually, or `rawEnrollments` + Map
    const enrolCacheMap = new Map();
    // We need to fetch timestamps now too
    const { data: allEnrolsDetailed } = await supabase.from('enrollments').select('id, student_id, class_id, last_import_timestamp');

    allEnrolsDetailed?.forEach(e => {
        enrolCacheMap.set(e.id, {
            sName: sMap.get(e.student_id),
            cName: cMap.get(e.class_id),
            ts: e.last_import_timestamp
        });
    });

    // Map Assignment -> Title
    const { data: allCurriculum } = await supabase.from('curriculum_assignments').select('id, title');
    const assignTitleMap = new Map(allCurriculum?.map(c => [c.id, c.title]));

    // Fetch batch
    // This table might be large, use pagination
    const PAGE = 1000;
    let hasMore = true;
    let from = 0;

    while (hasMore) {
        const { data: saChunk } = await supabase.from('student_assignments')
            .select('id, enrollment_id, assignment_id')
            .range(from, from + PAGE - 1);

        if (!saChunk || saChunk.length === 0) {
            hasMore = false;
            break;
        }

        const saUpdates = saChunk.map(sa => {
            const enrolInfo = enrolCacheMap.get(sa.enrollment_id);
            const title = assignTitleMap.get(sa.assignment_id);
            return {
                id: sa.id,
                student_name_cache: enrolInfo?.sName,
                class_name_cache: enrolInfo?.cName,
                assignment_name_cache: title,
                last_import_timestamp: enrolInfo?.ts
            };
        });

        // Write back
        const { error } = await supabase.from('student_assignments').upsert(saUpdates);
        if (error) {
            console.error(`Error updating chunk ${from}:`, error);
        } else {
            console.log(`Updated rows ${from} to ${from + saUpdates.length}`);
        }

        if (saChunk.length < PAGE) hasMore = false;
        from += PAGE;
    }

    console.log("Population Complete.");
}

populateCacheColumns();
