
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('c:\\Users\\ketes\\.gemini\\antigravity\\scratch\\apex-dashboard\\.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_KEY);

async function checkReadLimit() {
    console.log("--- DEBUG READ LIMIT ---");

    // Simulate the query from api.js
    console.log("Attempting to fetch ALL enrollments with nested assignments...");
    const { data: enrollments, error, count } = await supabase
        .from('enrollments')
        .select(`
            id,
            student_assignments (id)
        `, { count: 'exact' });
    // Note: No explicit limit set, so it defaults to Supabase default (1000)

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Enrollments Fetched: ${enrollments.length}`);

    let totalAssignments = 0;
    let maxAssignsPerEnrol = 0;
    enrollments.forEach(e => {
        const len = e.student_assignments?.length || 0;
        totalAssignments += len;
        if (len > maxAssignsPerEnrol) maxAssignsPerEnrol = len;
    });

    console.log(`Total Nested Assignments Fetched: ${totalAssignments}`);
    console.log(`Max Assignments in single enrollment: ${maxAssignsPerEnrol}`);

    // Check Actual Count separately
    const { count: realCount } = await supabase.from('student_assignments').select('*', { count: 'exact', head: true });
    console.log(`REAL Total Assignments in DB: ${realCount}`);

    if (totalAssignments < realCount) {
        console.warn(`WARNING: MISSING DATA! Fetched ${totalAssignments} vs DB ${realCount}`);
        console.warn("Hypothesis Confirmed: Supabase Read Limit truncating nested data.");
    } else {
        console.log("Data matches. No truncation.");
    }
}

checkReadLimit();
