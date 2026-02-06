
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawPath = path.join(__dirname, 'raw_curriculum.txt');
const standardsPath = path.join(__dirname, 'curriculum_standards.js');

const rawText = fs.readFileSync(rawPath, 'utf8');

const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);

const newCurriculum = {};
let currentClass = null;

// Heuristic: Class names are usually lines that don't start with a number (like "1.1.2")
// Or specific class names provided by user.
// The user format is Title line, followed by items.
// Items start with "1.2.3 ...", "4.0.0-A ...", "1.2.1 Log:", etc.

const classTitleRegex = /^[A-Z][a-zA-Z\s\(\)]+( A| B| I| II| III| IV| V)?\*?$/;
// But some might differ. Let's look at the data.
// "U.S. History since the Civil War A" - starts with U.S., ends with A
// "Physical Education*"
// "Biology A"
// "Financial Literacy"
// Items start with digits.

lines.forEach(line => {
    // Check if line looks like an assignment (starts with digit)
    // Note: "4.0.0-A Custom (EC)" starts with digit
    if (/^\d+\./.test(line)) {
        if (currentClass) {
            newCurriculum[currentClass].push(line);
        }
    } else {
        // Assume it's a class title
        currentClass = line.replace('*', '').trim(); // Remove asterisk
        newCurriculum[currentClass] = [];
    }
});

console.log(`Parsed ${Object.keys(newCurriculum).length} classes.`);

// Read existing standards to merge
// We can't import easily because it's a module, but we can read text and replace the object.
// Or just overwrite it since we are asked to "Add this info... indicate if you do not".
// I will READ the existing file to get Biology A/B and Physical Science A/B if they are missing from new list.
// Actually, the new list HAS Physical Science A. Does it have Biology?
// "Physical Science A" is in new list. "Physical Science B" is NOT in new list (Wait, user list ended with Env Sci B).
// "Biology A" and "Biology B" are NOT in new list.
// So I need to PRESERVE existing Biology/Physical Science B if missing.

import { MASTER_CURRICULUM as existing } from './curriculum_standards.js';

const merged = { ...existing, ...newCurriculum };

console.log(`Merged Total: ${Object.keys(merged).length} classes.`);

// Sort keys alphabetically for neatness
const sortedKeys = Object.keys(merged).sort();
const finalObj = {};
sortedKeys.forEach(k => finalObj[k] = merged[k]);

// Generate file content
const fileContent = `// MASTER CURRICULUM STANDARDS
// Source: User provided text block (Jan 26, 2026) + Previous Standards

export const MASTER_CURRICULUM = ${JSON.stringify(finalObj, null, 4)};
`;

fs.writeFileSync(standardsPath, fileContent, 'utf8');
console.log("Updated curriculum_standards.js");
