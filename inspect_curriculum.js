
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY; // Service Role key preferred if deleting, but Anon might work if RLS allows
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("Inspecting 'Physical Science A' Curriculum...");

    // 1. Find Class ID
    const { data: classes, error: cErr } = await supabase
        .from('classes')
        .select('id, title')
        .eq('title', 'Physical Science A')
        .single();

    if (cErr || !classes) {
        console.error("Class not found:", cErr);
        return;
    }

    console.log(`Class Found: ${classes.title} (${classes.id})`);

    // 2. Fetch Curriculum
    const { data: curriculum, error: curErr } = await supabase
        .from('curriculum_assignments')
        .select('id, title, max_points')
        .eq('class_id', classes.id);

    if (curErr) {
        console.error("Error fetching curriculum:", curErr);
        return;
    }

    const fs = await import('fs');
    const outPath = path.resolve(__dirname, 'curriculum_dump.txt');
    const lines = [];

    console.log(`Total Items: ${curriculum.length} (Expected ~22)`);
    lines.push(`Total Items: ${curriculum.length}`);

    curriculum.sort((a, b) => a.title.localeCompare(b.title));

    curriculum.forEach(c => {
        lines.push(`[${c.id}] ${c.title}`);
    });

    fs.writeFileSync(outPath, lines.join('\n'));
    console.log(`Dump written to: ${outPath}`);
}

inspect();
