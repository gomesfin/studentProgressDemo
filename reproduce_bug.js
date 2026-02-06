const student = {
    assignments: [
        { subject: 'science', classTitle: 'Physical Science A', status: 'Complete' },
        { subject: 'science', classTitle: 'Biology A', status: 'Complete' }
    ]
};

// Start Scenario: User selects "Physical Science A"
const currentSubjectKey = 'Physical Science A';
const currentSubject = { subjectKey: 'science', fullName: 'Physical Science A' };

console.log("Scenario: Filtering assignments for 'Physical Science A'");

// Current Broken Logic in CalendarModal.jsx
const originalTotal = student.assignments.filter(a => {
    // Line 380 logic
    if (a.subject !== currentSubjectKey) {
        // console.log(`Rejected ${a.classTitle}: '${a.subject}' !== '${currentSubjectKey}'`);
        return false;
    }
    if (a.classTitle && currentSubject.fullName && a.classTitle !== currentSubject.fullName) return false;
    return true;
}).length;

console.log('Original Total (Expected 0):', originalTotal);

// Proposed Fix (matching VerificationAnalysis logic)
const fixedTotal = student.assignments.filter(a => {
    // 1. Subject Category Check first
    if (a.subject !== currentSubject.subjectKey) return false;

    // 2. Class Title Check (Strict)
    if (a.classTitle && currentSubject.fullName && a.classTitle !== currentSubject.fullName) return false;

    return true;
}).length;

console.log('Fixed Total (Expected 1):', fixedTotal);
