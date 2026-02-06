
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MASTER_CURRICULUM } from './curriculum_standards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Target directory in brain artifacts
const outDir = path.resolve(__dirname, '../../brain/53098520-e2c0-4b32-8e18-d60b1154d3f1/curriculum_verification');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

console.log(`Exporting ${Object.keys(MASTER_CURRICULUM).length} classes to ${outDir}...`);

Object.entries(MASTER_CURRICULUM).forEach(([title, items]) => {
    // Sanitize filename
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeTitle}.txt`;
    const filePath = path.join(outDir, filename);

    const content = `${title}\n${'-'.repeat(title.length)}\n\n${items.join('\n')}`;

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Expected: ${filename}`);
});

console.log("Export complete.");
