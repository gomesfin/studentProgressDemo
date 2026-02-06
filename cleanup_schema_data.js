import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function cleanupData() {
    console.log("=== Data Cleanup ===");

    // 1. Delete 'TestClass' artifacts
    // We search for them first to be safe
    const { data: testClasses } = await supabase.from('classes')
        .select('id, title')
        .ilike('title', '%TestClass%');

    if (testClasses && testClasses.length > 0) {
        console.log(`Found ${testClasses.length} test classes. Deleting...`);
        const ids = testClasses.map(c => c.id);

        // Delete enrollments first if cascade isn't perfect (safety)
        await supabase.from('enrollments').delete().in('class_id', ids);
        await supabase.from('curriculum_assignments').delete().in('class_id', ids);

        const { error } = await supabase.from('classes').delete().in('id', ids);
        if (error) console.error("Error deleting classes:", error);
        else console.log("✅ Deleted test classes.");
    } else {
        console.log("No 'TestClass' artifacts found.");
    }

    // 2. Clear 'assignments' legacy table
    // We can't DROP it via JS, but we can empty it.
    const { count } = await supabase.from('assignments').select('*', { count: 'exact', head: true });
    if (count > 0) {
        console.log(`Clearing ${count} rows from legacy 'assignments' table...`);
        const { error } = await supabase.from('assignments').delete().neq('id', 0); // Hack to delete all? or use generic
        // Actually better to delete where id is not null
        const { error: delErr } = await supabase.from('assignments').delete().not('id', 'is', null);
        if (delErr) console.error("Error clearing assignments:", delErr);
        else console.log("✅ Cleared 'assignments' table.");
    } else {
        console.log("Legacy 'assignments' table is already empty.");
    }
}

cleanupData();
