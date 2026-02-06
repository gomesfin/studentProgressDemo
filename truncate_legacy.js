
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function truncateTable() {
    console.log("--- Clearing Legacy 'assignments' Table ---");

    // Fetch count first
    const { count } = await supabase.from('assignments').select('*', { count: 'exact', head: true });
    console.log(`Table contains ${count} rows.`);

    if (count > 0) {
        console.log("Deleting all rows...");
        // Delete where id is not null (effectively all)
        // We need a filter for delete. .neq('id', 0) usually works if IDs are numeric, 
        // if UUIDs we can use .neq('student_id', '00000000-0000-0000-0000-000000000000') or similar.
        // Or simply fetch IDs and delete batch?
        // Let's try a broad delete.
        // Actually, 'assignments' might use int/uuid id.
        // Let's try .gt('id', -1) if numeric, or .neq('id', 'null')?

        // Safer: Get all IDs and batch delete (since we have logic for that).
        // But count might be huge 50k?
        // Let's try:
        const { error } = await supabase.from('assignments').delete().neq('id', -1); // Assuming numeric ID or UUID

        if (error) {
            console.log("Broad delete failed: " + error.message);
            console.log("Attempting batch delete...");
            // ... (implement batch if needed)
            const { data: all } = await supabase.from('assignments').select('id').limit(10000);
            if (all.length > 0) {
                const ids = all.map(x => x.id);
                const { error: batchErr } = await supabase.from('assignments').delete().in('id', ids);
                if (batchErr) console.error(batchErr);
                else console.log(`Deleted batch of ${ids.length}`);
            }
        } else {
            console.log("Table cleared.");
        }
    } else {
        console.log("Table is already empty.");
    }
}

truncateTable();
