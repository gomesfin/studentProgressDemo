
const fs = require('fs');

// 1. Load the RAW Database Dump
const rawDump = JSON.parse(fs.readFileSync('audit_db_dump.json', 'utf8'));
const progressData = rawDump.rawData;

console.log(`Loaded ${progressData.length} class progress entries.`);

// 2. Mock the API Transformation (Exact logic from api.js)
// "api.js" creates 'student.assignments' by flattening the blobs.
let studentAssignments = [];
let studentClassStats = {};

progressData.forEach(snap => {
    const rawAssignments = snap.assignment_data || [];

    // api.js logic:
    // const classTitle = classTitleMap[snap.class_id]; -> In dump, classTitle is inside assignment? 
    // Wait, in audit_db_dump.json, the assignments ALREADY have "classTitle".
    // Let's verify if api.js does anything else.
    // It maps: status 'Complete' -> 'COMPLETED'.
    // It maps: date -> completed_at.

    // In api.js:
    // status: a.status === 'Complete' ? 'COMPLETED' : 'PENDING',
    // But verify: Does the DB have 'Complete'? Yes, dump shows "status": "Complete".

    // SIMULATION: We will mimic what api.js produces for the frontend.
    const processed = rawAssignments.map(a => ({
        id: a.activityName,
        title: a.activityName,
        score: a.score,
        max_points: a.possible,
        percentage: a.percentage,
        status: a.status, // api.js does: a.status === 'Complete' ? 'COMPLETED' : 'PENDING'
        // WAIT! CalendarModal checks `a.status === 'Complete'`.
        // If api.js changes it to 'COMPLETED', then CalendarModal check `=== 'Complete'` FAILs.
        // Let's check api.js code again.
        // api.js line 129: status: a.status === 'Complete' ? 'COMPLETED' : 'PENDING',
        // CalendarModal line 408: const weeklyCompletedCount = weeklyAssignments.filter(a => a.status === 'Complete').length;

        // FOUND POTENTIAL BUG: Case mismatch! 'COMPLETED' vs 'Complete'.

        date: a.date,
        subject: 'science', // Mocking subject key (derived in api.js)
        classTitle: a.classTitle
    }));

    studentAssignments.push(...processed);
});

console.log(`Total Frontend Assignments: ${studentAssignments.length}`);
console.log(`Sample Status: ${studentAssignments[0].status}`); // Expect 'Complete' or 'COMPLETED'

// 3. Mock the CalendarModal Logic (Exact logic)
const currentSubject = { fullName: 'Physical Science A', subjectKey: 'science' };
// const currentSubject = { fullName: 'Physical Science B', subjectKey: 'science' }; // Try B if needed

console.log(`\n--- Simulating CalendarModal for '${currentSubject.fullName}' ---`);

// "dynamicConfig" logic
const configStartDate = new Date(2025, 8, 1); // Sept 1 2025
const configEndDate = new Date(2026, 0, 1);   // Jan 1 2026

// "rawAssignments" Filter
const rawAssignments = studentAssignments.filter(a => {
    // 1. Subject Check
    if (a.subject !== currentSubject.subjectKey) return false;
    // 2. Class Title Check (Strict)
    if (a.classTitle && a.classTitle !== currentSubject.fullName) return false;
    // 3. Date Check
    if (!a.date) return false;

    // Parse Date (Using the Helper Logic I added or the basic logic?)
    // Basic logic in 'rawAssignments' filter:
    const [y, m, d] = a.date.split('-').map(Number);
    const aDate = new Date(y, m - 1, d);

    return aDate >= configStartDate && aDate <= configEndDate;
});

console.log(`Filtered 'rawAssignments' (In Window): ${rawAssignments.length}`);
if (rawAssignments.length > 0) {
    console.log(`First Item Status: '${rawAssignments[0].status}'`);
}

// 4. The Loop
let currentStart = new Date(configStartDate);
let cumulative = 0;
const semesterEnd = configEndDate;
let weekCount = 0;

while (currentStart <= semesterEnd && weekCount < 5) { // Test first 5 weeks
    weekCount++;
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + 6);

    const startTs = currentStart.getTime();
    const endTs = currentEnd.getTime();

    // "weeklyAssignments" Filter
    const weeklyAssignments = rawAssignments.filter(a => {
        // Robust Parse? Or old split?
        // Let's assume the new 'parseDate' is not there yet in this simulation, 
        // or check if I updated it in the real file. I did update it.
        // But let's use the basic split for now as it works for ISO.
        const [y, m, d] = a.date.split('-').map(Number);
        const aDate = new Date(y, m - 1, d);
        const aTs = aDate.getTime();
        return aTs >= startTs && aTs <= endTs;
    });

    // THE COUNT
    // CalendarModal check: a.status === 'Complete'
    const countOriginal = weeklyAssignments.filter(a => a.status === 'Complete').length;

    // Check for 'COMPLETED' mismatch?
    const countUpper = weeklyAssignments.filter(a => a.status === 'COMPLETED').length;

    console.log(`Week ${weekCount}: Total Items ${weeklyAssignments.length}`);
    console.log(` -> Count (status==='Complete'): ${countOriginal}`);
    console.log(` -> Count (status==='COMPLETED'): ${countUpper}`);

    currentStart.setDate(currentStart.getDate() + 7);
}
