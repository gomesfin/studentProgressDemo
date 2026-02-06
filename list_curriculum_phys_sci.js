
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listCurriculum() {
    console.log("Listing Curriculum for Physical Science A...");

    // 1. Get Class
    const { data: classes } = await supabase.from('classes').select('id, title').eq('title', 'Physical Science A');
    if (classes.length === 0) { console.error("No class found!"); return; }

    // Check all duplicate classes
    for (const cls of classes) {
        console.log(`\nClass: '${cls.title}' (${cls.id})`);

        const { count, data } = await supabase.from('curriculum_assignments')
            .select('id, title', { count: 'exact' })
            .eq('class_id', cls.id)
            .order('title');

        console.log(`Curriculum Count: ${count}`);

        data.forEach(c => {
            // Print IDs and Titles to check for "History" topics
            const isHistory = c.title.toLowerCase().includes('history') || c.title.includes('War') || c.title.includes('Gov');
            const prefix = isHistory ? "[SUSPICIOUS]" : "[OK]";
            console.log(` ${prefix} ${c.title} (${c.id})`);
        });
    }
}

listCurriculum();
