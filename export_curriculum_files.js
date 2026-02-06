
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MASTER_CURRICULUM } from './curriculum_standards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function exportFiles() {
    console.log("Exporting Curriculum Files...");

    for (const [className, items] of Object.entries(MASTER_CURRICULUM)) {
        // Safe filename
        const safeName = className.replace(/ /g, '_') + "_Curriculum.txt";
        const filePath = path.resolve(__dirname, safeName);

        const content = items.join('\n');
        fs.writeFileSync(filePath, content);
        console.log(`Created: ${safeName} (${items.length} items)`);
    }
}

exportFiles();
