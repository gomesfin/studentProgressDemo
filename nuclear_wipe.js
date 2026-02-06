
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function nuclearWipe() {
    console.log("⚠️  WARNING: INITIATING NUCLEAR WIPE ⚠️");
    console.log("Dropped tables will track 'students', 'classes', 'curriculum', 'enrollments'...");

    // We can't DROP TABLE via supabase-js client usually (needs RLS off/SQL editor).
    // However, we can DELETE ALL rows.
    // User requested "Delete existing databases as well not just their contents".
    // I cannot DROP DATABASE via client. I can only DROP TABLES via RPC if a function exists, or DELETE rows.
    // Assuming I have to work with what I have: I will DELETE ALL ROWS first.
    // If the user meant "Re-create schema", I might need to provide SQL to run in dashboard?
    // Or I can try to run raw SQL if I have a helper? 
    // I'll stick to TRUNCATE/DELETE CASCADE logic which is effectively a wipe.

    // Actually, if I can't drop tables, I can't "Design new schema" fully if columns change.
    // Wait, `api.js` in previous steps implies I am using Supabase Client.
    // I can't change Schema DDL via `supabase-js` unless I call a Postgres Function (RPC).

    // PROPOSAL: I will assume the user has a `exec_sql` RPC or I have to guide them.
    // BUT the user said "I want you to delete... then DESIGN new schema".
    // Since I am an agent, maybe I assume I can't DROP tables without permissions.
    // I will try to DELETE ALL DATA.
    // AND I will use `rpc` if available.

    // Let's try to just DELETE ALL DATA for now, effectively resetting the state.
    // If I need new columns (like `last_import_timestamp`), I might need to ask user to run SQL?
    // Or I can try to use `rpc` "exec_sql" if it exists (common in some setups).
    // If not, I will just delete data and assume standard schema, OR I will tell user "Please run this SQL".

    // Actually, I can use the `postgres` library
    // 2. Truncate Tables (Cascade to clear relationships)
    const { error } = await supabase.rpc('truncate_tables', {
        tables: [
            'student_assignments',
            'curriculum_assignments',
            'enrollments',
            'class_snapshots', // New JSON table
            'classes',
            'students'
        ]
    });

    // Fallback if RPC fails (try direct delete)
    if (error) {
        console.warn("RPC Truncate failed, trying raw deletes...", error);
        await supabase.from('class_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('student_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('curriculum_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('enrollments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('classes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    console.log("Verify Empty:");
    const { count } = await supabase.from('students').select('*', { count: 'exact', head: true });
    console.log(`Student Count: ${count}`);
}

nuclearWipe();
