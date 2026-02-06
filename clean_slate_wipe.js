import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function cleanSlate() {
    console.log("=== CLEAN SLATE WIPE ===");
    console.log("This will delete ALL academic data to allow a fresh import.");

    // 1. Delete Student Assignments (The Grades/Progress)
    const { count: saCount, error: saError } = await supabase.from('student_assignments').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (saError) console.error("Error Deleting Assignments:", saError.message);
    else console.log(`🗑️  Deleted ${saCount} Student Assignments.`);

    // 2. Delete Enrollments (The Linkages)
    // This removes the "Term" links, metadata, and timestamps.
    const { count: eCount, error: eError } = await supabase.from('enrollments').delete({ count: 'exact' }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (eError) console.error("Error Deleting Enrollments:", eError.message);
    else console.log(`🗑️  Deleted ${eCount} Enrollments.`);

    // 3. Delete 'Imported' Curriculum (The Ad-Hoc Items)
    // We KEEP 'Core' curriculum because that is the Master Schedule.
    const { count: cCount, error: cError } = await supabase.from('curriculum_assignments')
        .delete({ count: 'exact' })
        .eq('category', 'Imported');

    if (cError) console.error("Error Cleaning Ad-Hoc Curriculum:", cError.message);
    else console.log(`🗑️  Deleted ${cCount} 'Imported' Curriculum Items (Kept Core).`);

    // 4. Clean Student Objects (The JSON Blobs)
    // We PRESERVE the Student Rows (ID, Name, X, Y) so Seating Charts remain intact.
    // If you want to delete them too, uncomment the block below.
    console.log("🧹 Clearing Student JSON Data (preserving Seating)...");

    const { error: upError } = await supabase.from('students')
        .update({
            enrolled_classes: {},
            progress: {}
            // absences: 0,
            // writeups: 0
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // All

    if (upError) console.error("Error Clearing Student JSON:", upError.message);
    else console.log("✅ Student JSON Cleared.");

    // OPTIONAL: Delete Students entirely?
    // User said "purge all student data".
    // If we delete students, X/Y is lost.
    // console.log("WARNING: Student Rows Preserved. Run manual delete if you want to wipe Seating.");
}

cleanSlate();
