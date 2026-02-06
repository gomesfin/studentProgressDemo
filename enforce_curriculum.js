
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MASTER_CURRICULUM } from './curriculum_standards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function enforceCurriculum(className) {
    if (!MASTER_CURRICULUM[className]) {
        console.error(`Error: No master curriculum defined for '${className}'`);
        return;
    }

    console.log(`\n=== ENFORCING CURRICULUM: ${className} ===`);
    const masterList = MASTER_CURRICULUM[className];
    console.log(`Master Count: ${masterList.length} items`);

    // 1. Get Class ID
    // Use .range() to handle duplicates if needed, but assuming unique title constraint logic in App? 
    // Just select all.
    const { data: classes } = await supabase.from('classes').select('id, title').eq('title', className);
    if (!classes || classes.length === 0) {
        console.error("Class not found in DB.");
        return;
    }

    // Iterate over all matching classes (if duplicates exist, clean ALL)
    for (const cls of classes) {
        console.log(`Processing Class ID: ${cls.id}`);
        const classId = cls.id;

        // 2. WIPE Existing Curriculum (Batched Cascade)

        // Fetch IDs to delete
        // Loop until empty? Or just fetch all.
        // Fetching all might be large.
        // Let's fetch in chunks of 50.

        let hasMore = true;
        while (hasMore) {
            const { data: existing, error: eErr } = await supabase.from('curriculum_assignments')
                .select('id')
                .eq('class_id', classId)
                .range(0, 99); // Limit 100

            if (eErr) { console.error("Fetch Err:", eErr); break; }
            if (!existing || existing.length === 0) {
                hasMore = false;
                break;
            }

            const ids = existing.map(e => e.id);
            console.log(` Batch: Targeting ${ids.length} items for deletion...`);

            // Cascade delete from student_assignments (Batch 20)
            // URL limit safe.
            const chunkSize = 20;
            for (let i = 0; i < ids.length; i += chunkSize) {
                const chunk = ids.slice(i, i + chunkSize);
                const { error: saError, count: saCount } = await supabase
                    .from('student_assignments')
                    .delete({ count: 'exact' })
                    .in('assignment_id', chunk);

                if (saError) console.error(`  Student Assign Delete Error (Chunk ${i}):`, saError);
                else console.log(`  - Deleted ${saCount} linked student records.`);

                // Also delete from curriculum_assignments (Chunk 20)
                const { error: cError, count: cCount } = await supabase
                    .from('curriculum_assignments')
                    .delete({ count: 'exact' })
                    .in('id', chunk);

                if (cError) console.error(`  Curriculum Delete Error (Chunk ${i}):`, cError);
                else console.log(`  - Deleted ${cCount} curriculum items.`);
            }
        }

        console.log(" Cleaned old curriculum.");

        // 3. SEED Master List
        // Insert new items
        const inserts = masterList.map(title => {
            let pts = 20;
            if (title.includes('Final Exam') || title.includes('Semester Item')) pts = 100;
            else if (title.includes('Test') || title.includes('TST') || title.includes('CST')) pts = 50;

            return {
                class_id: classId,
                title: title,
                category: 'Core',
                max_points: pts
            };
        });

        // Batch Inserts (50)
        for (let i = 0; i < inserts.length; i += 50) {
            const chunk = inserts.slice(i, i + 50);
            const { error: insErr } = await supabase.from('curriculum_assignments').insert(chunk);
            if (insErr) console.error("Insert Error:", insErr);
            else console.log(`  + Seeded ${chunk.length} items.`);
        }
    }
}

async function run() {
    // Run for Physical Science A specifically first (priority)
    await enforceCurriculum('Physical Science A');

    // Optionally run others? 
    // for (const cls of Object.keys(MASTER_CURRICULUM)) { ... }
}

run();
