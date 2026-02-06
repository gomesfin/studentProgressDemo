
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function deduplicate() {
    console.log("--- STARTING CURRICULUM DEDUPLICATION ---");

    // 1. Fetch ALL Curriculum (We need to group them in memory due to lack of advanced SQL access)
    // 50k items might be too large for one fetch. Let's iterate by Class?
    // Or just fetch ID, ClassID, Title.
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
        // Normalize title? User said "Unit 1 Quiz" vs "Unit 1 Quiz ".
        // Let's trim().
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

    console.log(`Found ${duplicateGroupsCount} duplicate sets (same title in same class).`);

    if (tasks.length === 0) {
        console.log("No duplicates found. Database is clean.");
        return;
    }

    // 4. Resolve Duplicates
    // We can process these in parallel batches
    console.log("Resolving duplicates...");

    // Chunk tasks
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const taskBatches = chunk(tasks, 50); // Process 50 Duplicate Sets at a time

    let processed = 0;
    for (const batch of taskBatches) {
        await Promise.all(batch.map(async (task) => {
            const winnerId = task.ids[0];
            const loserIds = task.ids.slice(1);

            // A. Move Assignments from Losers to Winner
            const { error: moveError } = await supabase
                .from('student_assignments')
                .update({ assignment_id: winnerId })
                .in('assignment_id', loserIds);

            if (moveError) console.error(`Error moving ${task.title}:`, moveError);

            // B. Delete Losers
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

deduplicate();
