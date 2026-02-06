
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findTruncatedImports() {
    console.log("--- Scanning for Truncated Imports ---");

    // 1. Fetch all class progress snapshots
    // We need to join with classes to get the Title
    const { data: snapshots, error } = await supabase
        .from('class_progress')
        .select('student_id, class_id, total_assignments, assignment_data');

    if (error) {
        console.error("Error fetching snapshots:", error);
        return;
    }

    // 2. Fetch Classes to map IDs to Titles
    const { data: classes } = await supabase.from('classes').select('id, title');
    const classMap = {};
    classes.forEach(c => classMap[c.id] = c.title);

    // 3. Fetch Student Names
    const { data: students } = await supabase.from('students').select('id, name');
    const studentMap = {};
    students.forEach(s => studentMap[s.id] = s.name);

    console.log(`Debug: Found ${snapshots.length} snapshots and ${classes.length} classes.`);

    // 4. Group by Class Title
    const classStats = {}; // { "Biology A": { max: 30, counts: [30, 30, 5, 30] } }

    snapshots.forEach(snap => {
        const title = classMap[snap.class_id] || 'Unknown Class';
        const count = snap.total_assignments || (snap.assignment_data ? snap.assignment_data.length : 0);

        if (!classStats[title]) classStats[title] = { max: 0, students: [] };

        if (count > classStats[title].max) classStats[title].max = count;

        classStats[title].students.push({
            id: snap.student_id,
            name: studentMap[snap.student_id] || 'Unknown Student (' + snap.student_id + ')',
            count: count
        });
    });

    // 5. Analyze and Report Outliers
    Object.keys(classStats).forEach(title => {
        const stats = classStats[title];
        console.log(`\n[CLASS] ${title} (Max: ${stats.max}, Students: ${stats.students.length})`);

        // Print everyone for now to see what's going on
        stats.students.forEach(s => {
            console.log(`  - ${s.name}: ${s.count}`);
        });
    });

    console.log("\n--- Scan Complete ---");
}

findTruncatedImports();
