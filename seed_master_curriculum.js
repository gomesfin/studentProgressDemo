import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function seedCurriculum() {
    console.log("=== Seeding Master Curriculum ===");

    // 1. Read File
    const filePath = path.join(__dirname, 'Class-by-class-curricula.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    // 2. Parse File
    const curricula = new Map(); // Class Title -> [Assignments]
    let currentClass = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Heuristic: If previous line was empty (or start), and this line is text...
        // But simpler: If it matches a known Class Title (we can check DB first).
        // Let's rely on the structure: Header is alone.

        // Actually, let's fetch classes first to validate headers.
        // It's safer.
    }

    // Fetch Classes
    const { data: classes } = await supabase.from('classes').select('id, title, subject_id');
    const classMap = new Map(classes.map(c => [c.title.toLowerCase(), c.id])); // title -> id

    console.log(`Loaded ${classes.length} classes from DB.`);

    let currentClassId = null;
    let currentClassTitle = null;
    let itemsToInsert = [];

    // Parse loop again
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            currentClassId = null; // Reset on blank line implies end of section? 
            // The file has multiple blank lines between sections.
            // But assignments are contiguous. 
            continue;
        }

        // Check if this line is a Class Header
        const lowerLine = line.toLowerCase();
        if (classMap.has(lowerLine)) {
            currentClassId = classMap.get(lowerLine);
            currentClassTitle = line;
            console.log(`Found Class Section: ${line}`);
            continue;
        }

        // If not a header, and we have a current class, it's an assignment
        if (currentClassId) {
            // Check for max points heuristic (Test/Exam = 100, Quiz = 20/30? Default to 50?)
            // Logic from API: 'quiz' -> 20, else 50. Tests usually 100?
            let points = 50;
            const lowerTitle = line.toLowerCase();
            if (lowerTitle.includes('quiz')) points = 20;
            else if (lowerTitle.includes('test') || lowerTitle.includes('exam')) points = 100;
            else if (lowerTitle.includes('project') || lowerTitle.includes('practice')) points = 50;

            itemsToInsert.push({
                class_id: currentClassId,
                title: line,
                category: 'Core',
                max_points: points,
                class_name_cache: currentClassTitle
            });
        }
    }

    if (itemsToInsert.length === 0) {
        console.error("No items parsed! Check file format or class names.");
        return;
    }

    console.log(`Parsed ${itemsToInsert.length} curriculum items.`);

    // 3. Clear Existing Core/Imported Items for these classes? 
    // User wants "Accurate". We should probably wipe `curriculum_assignments` to be safe,
    // assuming we are replacing the WHOLE thing.
    // Since we wiped data previously with `clean_slate_wipe.js`, `curriculum_assignments` ONLY has Core items.
    // But we might have minimal seeded items from `ensureClassesExist` logic if any? 
    // Actually `ensureClassesExist` only seeds Classes, not curriculum.
    // `api.js` used to seed generic curriculum but we stopped that.

    // Let's plain DELETE everything in `curriculum_assignments` to be fresh.
    console.log("Clearing old curriculum table...");
    const { error: delErr } = await supabase.from('curriculum_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) {
        console.error("Error clearing curriculum:", delErr);
        return;
    }

    // 4. Insert Batch
    // Batch in chunks
    const BATCH_SIZE = 1000;
    for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
        const chunk = itemsToInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('curriculum_assignments').insert(chunk);
        if (error) {
            console.error("Error inserting batch:", error);
        } else {
            console.log(`Inserted rows ${i} to ${i + chunk.length}`);
        }
    }

    console.log("✅ Seeding Complete.");
}

seedCurriculum();
