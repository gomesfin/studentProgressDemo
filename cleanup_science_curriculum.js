
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
    console.log("Cleaning 'Physical Science A' Curriculum (Cascade Mode)...");

    const { data: classes } = await supabase.from('classes').select('id, title').eq('title', 'Physical Science A').single();
    if (!classes) { console.error("Class not found"); return; }
    console.log(`Class ID: ${classes.id}`);

    const { data: curriculum } = await supabase.from('curriculum_assignments').select('id, title').eq('class_id', classes.id);
    console.log(`Current Total Items: ${curriculum.length}`);

    // Expanded Blacklist (Biology + Env Science)
    const keywords = [
        "Biologist", "Biology",
        "Living Things", "Carbohydrates", "Nucleic Acids", "Lipids",
        "Protein", "Enzymes", "Enzyme", "Chloroplasts",
        "Cell ", "Cells", "Cellular",
        "Photosynthesis", "Respiration",
        "Ecosystem", "Food Web", "Climate Change",
        "Human Population", "Oxygen Cycles", "Nitrogen Cycles",
        "Anaerobic", "Yeast",
        "Semester Exam", "Final Exam" // Often duplicates if imported from multiple tracks, let's include if risky? 
        // User said Physical Science A has 22 items. 
        // 90 items total. 
        // Biology items ~30. 
        // Env Sci items ~20?
    ];
    // Note: Be careful with "Exam".

    const toDelete = curriculum.filter(c => {
        const title = c.title;
        return keywords.some(k => title.includes(k));
    });

    console.log(`Found ${toDelete.length} invalid items to delete.`);

    if (toDelete.length > 0) {
        const ids = toDelete.map(c => c.id);

        // 1. Delete Child Assignments FIRST (Cascade)
        const { error: saError, count: saCount } = await supabase
            .from('student_assignments')
            .delete({ count: 'exact' })
            .in('assignment_id', ids);

        if (saError) {
            console.error("Error deleting entries from student_assignments:", saError);
            return;
        }
        console.log(`Deleted ${saCount} linked student_assignments.`);

        // 2. Delete Master Curriculum
        const { error: cError, count: cCount } = await supabase
            .from('curriculum_assignments')
            .delete({ count: 'exact' })
            .in('id', ids);

        if (cError) {
            console.error("Error deleting curriculum_assignments:", cError);
        } else {
            console.log(`Successfully DELETED ${cCount} curriculum items.`);
            // console.log("Deleted Titles:");
            // toDelete.forEach(c => console.log(` - ${c.title}`));
        }
    } else {
        console.log("No items matched the delete list.");
    }
}

cleanup();
