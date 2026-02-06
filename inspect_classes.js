
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listClasses() {
    console.log("Dumping ALL Classes...");

    const { data: classes } = await supabase.from('classes').select('id, title, subject_id');

    classes.forEach(c => {
        // Enclose in quotes to reveal whitespace
        console.log(`[${c.id}] '${c.title}' (Subj: ${c.subject_id})`);
    });
}

listClasses();
