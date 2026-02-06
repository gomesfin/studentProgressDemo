
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function resetBehavior() {
    console.log("--- RESETTING BEHAVIOR DATA ---");

    // Try to update 'absences' and 'writeups'
    // Note: Column names might be snake_case in DB? 'write_ups'?
    // Let's try guessing both or check error.

    // Attempt 1: Standard Guess
    const { data, error, count } = await supabase
        .from('students')
        .update({ absences: 0, writeups: 0 })
        .neq('id', '000000') // Dummy filter to apply to all
        .select();

    if (error) {
        console.error("Error with 'absences/writeups':", error.message);

        // Attempt 2: Snake Case?
        if (error.message.includes('column') && error.message.includes('does not exist')) {
            console.log("Retrying with snake_case...");
            const { error: err2 } = await supabase
                .from('students')
                .update({ absences: 0, write_ups: 0 })
                .neq('id', '000000');

            if (err2) console.error("Error with 'write_ups':", err2.message);
            else console.log("Success with 'write_ups'!");
        }
    } else {
        console.log(`Success! Updated ${data.length} students.`);
    }
}

resetBehavior();
