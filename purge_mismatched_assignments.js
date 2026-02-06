
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeMismatchedFullJoin() {
    console.log("=== SYSTEMIC PURGE V2: Deep Join Validation ===");
    console.log("Goal: Delete assignments where Enrollment.ClassID != Curriculum.ClassID");

    let totalDeleted = 0;
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        // Fetch Batch with Deep Joins
        // We need: 
        // 1. Enrollment -> Class (The "Expected" Class)
        // 2. Assignment (Curriculum) -> Class (The "Actual" Class)

        const { data: assignments, error } = await supabase.from('student_assignments')
            .select(`
                id, assignment_id, enrollment_id,
                enrollment:enrollments (
                    id, class_id,
                    class:classes ( id, title )
                ),
                assignment:curriculum_assignments (
                    id, class_id, title,
                    class:classes ( id, title )
                )
            `)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) { console.error("Fetch Error:", error); break; }
        if (!assignments || assignments.length === 0) { hasMore = false; break; }

        console.log(`Processing batch ${page + 1} (${assignments.length} items)...`);

        const toDeleteIds = [];
        let mismatchCount = 0;

        assignments.forEach(a => {
            const expectedClassId = a.enrollment?.class_id;
            const expectedClassTitle = a.enrollment?.class?.title;

            // If link is missing (orphaned curriculum), we normally shouldn't touch it unless we are sure.
            // But if assignment_id exists but returns null assignment data, it's a dead link. Safe to delete? 
            // Yes, dead links are bad.

            const actualClassId = a.assignment?.class_id;
            const actualClassTitle = a.assignment?.class?.title;

            if (!a.assignment_id || !a.assignment) {
                // Dead Link (Curriculum Deleted)
                // SAFE TO DELETE
                // console.log(`[DEAD LINK] ID:${a.id}`);
                toDeleteIds.push(a.id);
                return;
            }

            // Comparison
            if (expectedClassId && actualClassId) {
                if (expectedClassId !== actualClassId) {
                    mismatchCount++;
                    // console.log(`[MISMATCH] ID:${a.id}`);
                    // console.log(`   Expected: '${expectedClassTitle}' (${expectedClassId})`);
                    // console.log(`   Actual:   '${actualClassTitle}' (${actualClassId})`);
                    toDeleteIds.push(a.id);
                }
            }
        });

        if (toDeleteIds.length > 0) {
            console.log(`  -> Found ${toDeleteIds.length} items to purge (Mismatches + Dead Links).`);

            // Batched Delete
            for (let i = 0; i < toDeleteIds.length; i += 50) {
                const chunk = toDeleteIds.slice(i, i + 50);
                const { error: delErr, count } = await supabase.from('student_assignments')
                    .delete({ count: 'exact' })
                    .in('id', chunk);

                if (delErr) console.error("Delete Error:", delErr);
                else totalDeleted += count;
            }
        } else {
            // console.log("  -> Batch clean.");
        }

        page++;
    }

    console.log("==================================================");
    console.log(`SYSTEMIC PURGE COMPLETE.`);
    console.log(`Total Mismatched/Dead Records Deleted: ${totalDeleted}`);
}

purgeMismatchedFullJoin();
