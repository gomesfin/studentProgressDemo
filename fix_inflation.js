
import { createClient } from '@supabase/supabase-js';

// Hardcoded for immediate execution
const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const fixInflation = async () => {
    console.log("Starting De-Inflation...");

    // 1. Fetch all class_progress
    const { data: records, error } = await supabase
        .from('class_progress')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Scanning ${records.length} records...`);

    let fixedCount = 0;

    for (const rec of records) {
        const assignments = rec.assignment_data || [];
        const uniqueMap = {};

        // Strategy: Keep LATEST entry for each activityName
        // If duplicates exist, we iterate and overwrite, ensuring 1 per name.
        assignments.forEach(a => {
            if (a.activityName && typeof a.activityName === 'string' && a.activityName.trim()) {
                uniqueMap[a.activityName.trim()] = a;
            }
        });

        const deduped = Object.values(uniqueMap);

        if (deduped.length < assignments.length) {
            console.log(`Fixing [${rec.id}]: Reduced ${assignments.length} -> ${deduped.length}`);

            // Recalculate Stats
            const total = deduped.length;
            const completed = deduped.filter(a => a.status === 'Complete').length;

            const { error: upErr } = await supabase
                .from('class_progress')
                .update({
                    assignment_data: deduped,
                    total_assignments: total,
                    completed_count: completed,
                    last_updated: new Date().toISOString()
                })
                .eq('id', rec.id);

            if (upErr) console.error("Update failed:", upErr);
            else fixedCount++;
        }
    }

    console.log(`De-Inflation Complete. Fixed ${fixedCount} records.`);
};

fixInflation();
