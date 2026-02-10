
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log(`Checking DB: ${supabaseUrl}`);

    const { count, error: countErr } = await supabase.from('class_progress').select('*', { count: 'exact', head: true });
    console.log(`Class Progress Count: ${count}`);

    const { data, error } = await supabase.from('class_progress').select('assignment_data').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        if (data && data.length > 0 && data[0].assignment_data) {
            console.log("Sample Assignment JSON Match:");
            console.log(JSON.stringify(data[0].assignment_data[0], null, 2));
        } else {
            console.log("No progress data found.");
        }
    }
}

check();
