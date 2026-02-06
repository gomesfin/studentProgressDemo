
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkDuplicates() {
    console.log("--- CHECKING FOR DUPLICATE STUDENTS ---");

    // Fetch all names
    const { data: students } = await supabase.from('students').select('id, name');

    const nameMap = {};
    const exactDuplicates = [];

    students.forEach(s => {
        const n = s.name.trim().toLowerCase();
        if (nameMap[n]) {
            exactDuplicates.push({ name: s.name, id1: nameMap[n].id, id2: s.id });
        } else {
            nameMap[n] = s;
        }
    });

    if (exactDuplicates.length > 0) {
        console.log(`Found ${exactDuplicates.length} Duplicate Names!`);
        exactDuplicates.forEach(d => {
            console.log(` - "${d.name}": IDs [${d.id1}, ${d.id2}]`);
        });
    } else {
        console.log("No exact duplicate names found.");
    }

    // Check Hidayo specifically
    const hidayos = students.filter(s => s.name.toLowerCase().includes('hidayo'));
    console.log(`Found ${hidayos.length} students matching 'Hidayo':`);
    hidayos.forEach(h => console.log(` - ${h.name} (${h.id})`));
}

checkDuplicates();
