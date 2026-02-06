
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

async function systemicGarbageCollection() {
    console.log("=== SYSTEMIC GARBAGE COLLECTION: Enforcing Master Curriculum ===");
    console.log("Strategy: Iterate all classes, delete any curriculum item NOT in Master List.");

    for (const [className, validTitles] of Object.entries(MASTER_CURRICULUM)) {
        console.log(`\nProcessing '${className}'...`);
        const validSet = new Set(validTitles);

        // 1. Get Class ID(s)
        const { data: classes } = await supabase.from('classes').select('id, title').eq('title', className);

        for (const cls of classes) {
            console.log(`  Targeting ClassID: ${cls.id}`);

            // 2. Fetch Existing Curriculum
            const { data: items } = await supabase.from('curriculum_assignments')
                .select('id, title')
                .eq('class_id', cls.id);

            console.log(`  Existing Items: ${items.length} | Master Valid Items: ${validSet.size}`);

            // 3. Identify Garbage
            const garbage = [];
            items.forEach(item => {
                if (!validSet.has(item.title)) {
                    // console.log(`    [GARBAGE] ${item.title}`);
                    garbage.push(item.id);
                }
            });

            if (garbage.length > 0) {
                console.log(`  -> Found ${garbage.length} invalid items. Deleting...`);

                // Batched Delete
                for (let i = 0; i < garbage.length; i += 20) {
                    const chunk = garbage.slice(i, i + 20);

                    // Cascade Delete Student Assignments First
                    const { count: saCount } = await supabase.from('student_assignments')
                        .delete({ count: 'exact' })
                        .in('assignment_id', chunk);
                    console.log(`    Deleted ${saCount} linked student assignments.`);

                    // Delete Curriculum
                    const { error: cErr, count: cCount } = await supabase.from('curriculum_assignments')
                        .delete({ count: 'exact' })
                        .in('id', chunk);

                    if (cErr) console.error("    Delete Error:", cErr);
                    else console.log(`    Deleted ${cCount} curriculum items.`);
                }
            } else {
                console.log("  -> Clean.");
            }
        }
    }
}

systemicGarbageCollection();
