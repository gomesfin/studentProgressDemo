import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function exportAudit() {
    console.log("=== Generating Curriculum Audit Report ===");
    const outFile = path.join(__dirname, 'curriculum_audit_report.txt');

    // 1. Fetch Classes with Subjects
    const { data: classes } = await supabase.from('classes')
        .select('id, title, subject_id')
        .order('subject_id', { ascending: true })
        .order('title', { ascending: true });

    if (!classes || classes.length === 0) {
        console.log("No classes found.");
        return;
    }

    // 2. Fetch All Curriculum
    const { data: curriculum } = await supabase.from('curriculum_assignments')
        .select('id, class_id, title, category, max_points')
        .order('title', { ascending: true });

    const cMap = new Map(); // class_id -> [items]
    curriculum?.forEach(item => {
        if (!cMap.has(item.class_id)) cMap.set(item.class_id, []);
        cMap.get(item.class_id).push(item);
    });

    // 3. Build Report
    let report = `CURRICULUM AUDIT REPORT\nGenerated: ${new Date().toLocaleString()}\n`;
    report += `=================================================\n\n`;

    let totalCore = 0;
    let totalImported = 0;

    for (const cls of classes) {
        const items = cMap.get(cls.id) || [];
        const coreItems = items.filter(i => i.category === 'Core');
        const importedItems = items.filter(i => i.category !== 'Core');

        totalCore += coreItems.length;
        totalImported += importedItems.length;

        report += `CLASS: ${cls.title} (${cls.subject_id})\n`;
        report += `Total Items: ${items.length} | Core: ${coreItems.length} | Imported: ${importedItems.length}\n`;
        report += `-------------------------------------------------\n`;

        if (items.length === 0) {
            report += `  (No curriculum items found)\n`;
        } else {
            // Sort: Core first, then Imported. Within that, by Title.
            // Actually nice to sort by Title to see duplicates side-by-side
            const sorted = items.sort((a, b) => a.title.localeCompare(b.title));

            sorted.forEach(item => {
                const tag = item.category === 'Core' ? '[CORE]' : '[IMPORTED]';
                // Check for potential corruption (short names, weird chars)
                report += `  ${tag.padEnd(10)} ${item.title} (Max: ${item.max_points})\n`;
            });
        }
        report += `\n`;
    }

    report += `=================================================\n`;
    report += `SUMMARY:\n`;
    report += `Total Classes: ${classes.length}\n`;
    report += `Total Assignments: ${curriculum.length}\n`;
    report += `  - Core: ${totalCore}\n`;
    report += `  - Imported: ${totalImported}\n`;

    fs.writeFileSync(outFile, report);
    console.log(`✅ Audit Report saved to: ${outFile}`);
}

exportAudit();
