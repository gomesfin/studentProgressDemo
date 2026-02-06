
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
// Increase DB Timeout? Standard client usually fine.
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function deduplicateRobust() {
    console.log("--- STARTING CURRICULUM DEDUPLICATION (ROBUST) ---");

    // 1. Fetch ALL Curriculum
    const { count } = await supabase.from('curriculum_assignments').select('*', { count: 'exact', head: true });
    console.log(`Total Curriculum Items: ${count}`);

    const pageSize = 5000;
    let hasMore = true;
    let page = 0;
    let allItems = [];

    console.log("Fetching metadata...");
    while (hasMore) {
        const { data, error } = await supabase
            .from('curriculum_assignments')
            .select('id, class_id, title')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) { console.error(error); break; }
        if (data.length === 0) hasMore = false;
        else {
            allItems = allItems.concat(data);
            page++;
            process.stdout.write(`Fetched ${allItems.length}... \r`);
        }
    }
    console.log("\nFetch Complete.");

    // 2. Group by Class -> Title
    const groups = {}; // { class_id: { title: [ids...] } }
    let duplicateGroupsCount = 0;

    allItems.forEach(item => {
        if (!groups[item.class_id]) groups[item.class_id] = {};
        const title = item.title.trim();
        if (!groups[item.class_id][title]) groups[item.class_id][title] = [];
        groups[item.class_id][title].push(item.id);
    });

    // 3. Identify Duplicates
    const tasks = [];
    Object.keys(groups).forEach(classId => {
        Object.keys(groups[classId]).forEach(title => {
            const ids = groups[classId][title];
            if (ids.length > 1) {
                duplicateGroupsCount++;
                tasks.push({ title, ids }); // [winner, loser, loser...]
            }
        });
    });

    console.log(`Found ${duplicateGroupsCount} duplicate sets.`);
    if (tasks.length === 0) return;

    // 4. Resolve Duplicates (Sequential safe-mode to debug errors)
    // Batching still okay if we handle conflicts
    console.log("Resolving duplicates...");

    // Chunk tasks
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const taskBatches = chunk(tasks, 10); // Smaller batches for safety

    let processed = 0;
    for (const batch of taskBatches) {
        await Promise.all(batch.map(async (task) => {
            const winnerId = task.ids[0];
            const loserIds = task.ids.slice(1);

            // For each Loser ID, find linked student assignments
            // We need to iterate losers individually to handle constraints
            for (const loserId of loserIds) {
                const { data: assignments } = await supabase
                    .from('student_assignments')
                    .select('id, enrollment_id')
                    .eq('assignment_id', loserId);

                if (assignments && assignments.length > 0) {
                    for (const sa of assignments) {
                        // Check if this student (enrollment) ALREADY has the Winner assignment?
                        const { data: conflict } = await supabase
                            .from('student_assignments')
                            .select('id')
                            .eq('enrollment_id', sa.enrollment_id)
                            .eq('assignment_id', winnerId)
                            .maybeSingle();

                        if (conflict) {
                            // CONFLICT: Student has BOTH. Delete the Loser version.
                            // (Assuming Winner version is fine. We could compare scores but speed is key, usually duplicates are identical)
                            await supabase.from('student_assignments').delete().eq('id', sa.id);
                        } else {
                            // NO CONFLICT: Move Loser -> Winner
                            await supabase.from('student_assignments').update({ assignment_id: winnerId }).eq('id', sa.id);
                        }
                    }
                }
            }

            // Now safe to delete Losers (Curriculum)
            const { error: delError } = await supabase
                .from('curriculum_assignments')
                .delete()
                .in('id', loserIds);

            if (delError) console.error(`Error deleting losers for ${task.title}:`, delError);
        }));
        processed += batch.length;
        process.stdout.write(`Processed ${processed} / ${duplicateGroupsCount} sets... \r`);
    }

    console.log("\n--- DEDUPLICATION COMPLETE ---");
}

deduplicateRobust();
