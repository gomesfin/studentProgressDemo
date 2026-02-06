import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runStrictDebug() {
    console.log("=== STRICT IMPORT DEBUGGER ===");

    // 1. Simulate Input Data (mimicking App.jsx payload)
    const mockStudent = "Yahya Habib";
    const mockClass = "Algebra 1A"; // Exact string
    const mockActivity = "1.1.3 Quiz: Rational and Irrational Numbers"; // Exact string from User

    console.log(`Testing Import For: ${mockStudent} in ${mockClass}`);

    // 2. Resolve Class
    const { data: classData } = await supabase.from('classes').select('id, title, subject_id').eq('title', mockClass).maybeSingle();

    if (!classData) {
        console.error("❌ CLASS SEARCH FAILED. Is the Title exact?");
        const { data: similar } = await supabase.from('classes').select('title').ilike('title', `%${mockClass.split(' ')[0]}%`).limit(5);
        console.log("Similar Classes found:", similar);
        return;
    }
    console.log(`✅ Class Resolved: ${classData.title} (${classData.id})`);

    // 3. Resolve Curriculum (Strict Mode)
    // Fetch ALL for this class
    const { data: curriculum } = await supabase.from('curriculum_assignments').select('id, title').eq('class_id', classData.id);
    console.log(`loaded ${curriculum.length} curriculum items.`);

    // Log first few to check formatting
    console.log("Sample DB Items:", curriculum.slice(0, 3).map(c => `'${c.title}'`));

    const dbTitleSet = new Set(curriculum.map(c => c.title));

    // 4. Test Match
    if (dbTitleSet.has(mockActivity)) {
        console.log(`✅ EXACT MATCH SUCCESS: '${mockActivity}'`);
    } else {
        console.error(`❌ STRICT MATCH FAILED: '${mockActivity}'`);

        // Try trimming?
        if (dbTitleSet.has(mockActivity.trim())) console.log("   -> Would match if trimmed.");

        // Fuzzy?
        const fuzzy = curriculum.find(c => c.title.includes("1.1.3"));
        if (fuzzy) console.log(`   -> Found Partial Match: '${fuzzy.title}'`);
    }

    // 5. Test Student & Enrollment
    const { data: student } = await supabase.from('students').select('id').ilike('name', mockStudent).maybeSingle();
    if (!student) {
        console.error("❌ STUDENT NOT FOUND");
        return;
    }
    console.log(`✅ Student Found: ${student.id}`);

    const { data: enrol } = await supabase.from('enrollments').select('id, class_id').eq('student_id', student.id).eq('class_id', classData.id).maybeSingle();

    if (!enrol) {
        console.error("❌ ENROLLMENT NOT FOUND (Student is not in this class?)");
        // Check what they ARE enrolled in
        const { data: allEnrols } = await supabase.from('enrollments').select('classes(title)').eq('student_id', student.id);
        console.log("   -> Current Enrollments:", allEnrols.map(e => e.classes?.title));
    } else {
        console.log(`✅ Enrollment Active: ${enrol.id}`);
    }
}

runStrictDebug();
