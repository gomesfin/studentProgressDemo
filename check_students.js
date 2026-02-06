
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cjppvbmiyibelaougphp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcHB2Ym1peWliZWxhb3VncGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzczODMsImV4cCI6MjA4NDU1MzM4M30.vAqY9w7WA1csd12my9W3c0Fk-juYIZt0MBp_EMVYVYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const check = async () => {
    const { data: students, error } = await supabase.from('students').select('*');
    if (error) console.error("Error:", error);
    else {
        console.log(`Checking Students Table (${students.length} rows):`);
        students.forEach(s => console.log(`- ${s.name} (ID: ${s.id})`));
    }
};

check();
