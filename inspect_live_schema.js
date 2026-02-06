import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function inspectTables() {
    const tables = ['assignments', 'classes', 'curriculum_assignments', 'enrollments', 'student_assignments'];

    console.log("=== Live Schema Inspection ===");

    for (const table of tables) {
        // Fetch one row to see keys, or we could query information_schema if we had permissions, 
        // but 'select * limit 1' is often enough to see column structure if rows exist.
        // Better: just try to select * from it.
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.log(`\nTable: ${table} -> ERROR or NOT FOUND: ${error.message}`);
        } else {
            console.log(`\nTable: ${table}`);
            if (data && data.length > 0) {
                console.log("Columns:", Object.keys(data[0]).join(', '));
            } else {
                console.log("(Table is empty, attempting to fetch structure via empty insert or assumption? No, will rely on known keys if empty)");
                // If empty, we can't easily see columns via JS client without an insert.
                // Let's rely on user report + code references for empty tables.
                console.log("Status: Empty");
            }
        }
    }

    // Special Check: Count Test Classes
    const { count } = await supabase.from('classes')
        .select('*', { count: 'exact', head: true })
        .ilike('title', '%TestClass%');
    console.log(`\n'TestClass' count in 'classes' table: ${count}`);
}

inspectTables();
