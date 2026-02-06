
// Simulate CalendarModal Graph Logic
const studentAssignments = [
    { activityName: 'Unit 1 Quiz', date: '2025-08-20', status: 'Complete', classTitle: 'Physical Science A', subject: 'science' },
    { activityName: 'Unit 2 Quiz', date: '2025-09-10', status: 'Complete', classTitle: 'Physical Science A', subject: 'science' },
    { activityName: 'Unit 3 Quiz', date: '2025-09-20', status: 'Complete', classTitle: 'Physical Science A', subject: 'science' },
    { activityName: 'Unit 4 Quiz', date: '2025-10-05', status: 'Complete', classTitle: 'Physical Science A', subject: 'science' },
    { activityName: 'Future Quiz', date: '2025-12-01', status: 'Pending', classTitle: 'Physical Science A', subject: 'science' }
];

const currentSubject = { fullName: 'Physical Science A', subjectKey: 'science' };

// Config similar to App
const dynamicConfig = {
    startDate: new Date(2025, 8, 1), // Sept 1, 2025
    endDate: new Date(2026, 0, 1)    // Jan 1, 2026
};

// --- LOGIC FROM CalendarModal.jsx ---

// 1. Semester Start
const semesterStart = new Date(dynamicConfig.startDate);
const semesterEnd = new Date(dynamicConfig.endDate);

console.log(`Semester Range: ${semesterStart.toISOString()} to ${semesterEnd.toISOString()}`);

// 2. Pre-Start Assignments (Prior Progress)
const preStartAssignments = studentAssignments.filter(a => {
    // Class Filter
    const aTitle = (a.classTitle || '').trim().toLowerCase();
    const bTitle = (currentSubject.fullName || '').trim().toLowerCase();
    if (aTitle !== bTitle) return false;

    // Date Check
    if (a.date) {
        const parts = a.date.split('-'); // ISO 2025-08-20
        // MOCK: In CalendarModal code: const [y, m, d] = a.date.split('-').map(Number);
        const [y, m, d] = parts.map(Number); // [2025, 8, 20]
        const aDate = new Date(y, m - 1, d); // Month is 0-indexed: Aug = 7

        console.log(`Checking '${a.activityName}' (${a.date}) -> Parsed: ${aDate.toISOString()} < Start? ${aDate < semesterStart}`);

        if (aDate < semesterStart) return a.status === 'Complete';
        return false;
    }
    return a.status === 'Complete';
});

console.log(`Pre-Start Count: ${preStartAssignments.length}`);
let cumulativeAssignments = preStartAssignments.length;

// 3. Raw Assignments (In-Window)
// Note: CalendarModal filters rawAssignments SEPARATE from preStart
const rawAssignments = studentAssignments.filter(a => {
    // Subject/Class Filter
    const aTitle = (a.classTitle || '').trim().toLowerCase();
    const bTitle = (currentSubject.fullName || '').trim().toLowerCase();
    if (aTitle !== bTitle) return false;

    if (!a.date) return false;
    const [y, m, d] = a.date.split('-').map(Number);
    const aDate = new Date(y, m - 1, d);
    return aDate >= semesterStart && aDate <= semesterEnd;
});
console.log(`Raw In-Window Assignments: ${rawAssignments.length}`);


// 4. Loop
let currentStart = new Date(semesterStart);
const wCompletion = [];
const total = studentAssignments.length; // Simplified Total

let weekCount = 0;
while (currentStart <= semesterEnd && weekCount < 20) {
    weekCount++;
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + 6);

    // Filter Weekly
    const startTs = currentStart.getTime();
    const endTs = currentEnd.getTime();

    const weeklyAssignments = rawAssignments.filter(a => {
        const [y, m, d] = a.date.split('-').map(Number);
        const aDate = new Date(y, m - 1, d);
        const aTs = aDate.getTime();
        return aTs >= startTs && aTs <= endTs;
    });

    const weeklyCompleted = weeklyAssignments.filter(a => a.status === 'Complete').length;

    cumulativeAssignments += weeklyCompleted;

    const pct = Math.round((cumulativeAssignments / total) * 100);
    wCompletion.push(pct);

    console.log(`Week ${weekCount} (${currentStart.toLocaleDateString()}): +${weeklyCompleted} -> Cumul: ${cumulativeAssignments}/${total} (${pct}%)`);

    currentStart.setDate(currentStart.getDate() + 7);
}

console.log("Final Graph Data:", wCompletion);
