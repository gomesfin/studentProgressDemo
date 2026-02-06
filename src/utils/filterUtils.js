// Helper: Calculate assignments in window
// Note: We define this helper to bridge strict context to the utility function
const getAssignmentCountInternal = (student, filterState, subjectKey) => {
    return getFilteredAssignmentCount(
        student,
        filterState.startDate,
        filterState.endDate,
        subjectKey || filterState.enrolledSubject,
        filterState.enrolledClass // Use specific class if selected
    );
};

export const filterStudents = (students, filterState, subjectKey = null) => {
    let filtered = [...students];
    const { gradeFilter, minProgress, minAssignments, sortBy, startDate, endDate, minAttendance, maxWriteups, enrolledClass } = filterState;

    // Use subjectKey passed from Modal as primary context, or fallback to filter context
    const contextSubject = subjectKey || filterState.enrolledSubject;

    // 1. Grade Filter
    if (gradeFilter && gradeFilter.length > 0) {
        filtered = filtered.filter(s => gradeFilter.includes(s.grade));
    }

    // 2. Progress Filter
    if (minProgress > 0) {
        filtered = filtered.filter(s => {
            // Use Strict filtered average
            const avg = getFilteredAverage(s, startDate, endDate, contextSubject, enrolledClass);
            return avg >= minProgress;
        });
    }

    // 3. Assignment Filter (uses window if set)
    if (minAssignments > 0) {
        filtered = filtered.filter(s => getAssignmentCountInternal(s, filterState, contextSubject) >= minAssignments);
    }

    // 4. Behavior Filters
    if (minAttendance > 0) {
        filtered = filtered.filter(s => (s.attendance !== undefined ? s.attendance : 100) >= minAttendance);
    }

    if (maxWriteups !== undefined && maxWriteups !== null) {
        filtered = filtered.filter(s => (s.writeups || 0) <= maxWriteups);
    }

    // 5. Enrolled Class Filter
    if (enrolledClass && contextSubject) { // Changed enrolledSubject to contextSubject for consistency
        filtered = filtered.filter(s => {
            if (!s.enrolledClasses) return false;

            // Scan for any class that matches Subject AND Title
            const hasClass = Object.values(s.enrolledClasses).some(cls => {
                // Check for Object structure (Preferred)
                if (typeof cls === 'object') {
                    return cls.subject === contextSubject && cls.title === enrolledClass;
                }
                // Legacy string check (Weak)
                return cls === enrolledClass;
            });

            return hasClass;
        });
    }

    // 4. Sort
    filtered.sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'grade') return a.grade.localeCompare(b.grade);

        if (sortBy === 'progress' || sortBy === 'progress_desc') {
            // FIX: Use filtered average (Time Window + Subject + Class)
            const avgA = getFilteredAverage(a, startDate, endDate, contextSubject, enrolledClass);
            const avgB = getFilteredAverage(b, startDate, endDate, contextSubject, enrolledClass);
            return sortBy === 'progress' ? avgA - avgB : avgB - avgA;
        }

        if (sortBy === 'assignments' || sortBy === 'assignments_desc') {
            const countA = getAssignmentCountInternal(a, filterState, contextSubject);
            const countB = getAssignmentCountInternal(b, filterState, contextSubject);
            return sortBy === 'assignments' ? countA - countB : countB - countA;
        }

        return 0;
    });

    return filtered;
};

// Also export the counter for UI usage if needed
export const getFilteredAssignmentCount = (student, startDate, endDate, subjectKey = null, classTitle = null) => {
    if (!student.assignments) return student.assignmentsCompleted || 0;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (!start && !end && !subjectKey && !classTitle) return student.assignments.length;

    return student.assignments.filter(a => {
        // 1. Subject Filter (Strict)
        if (subjectKey && a.subject && a.subject !== subjectKey) return false;

        // 1b. Class Title Filter (Specific)
        if (classTitle && a.classTitle !== classTitle) return false;

        // 2. Date Filter
        if (!a.date) return false; // Enforce: Must have completion date
        const d = new Date(a.date);
        if (start && d < start) return false;
        if (end && d > end) return false;

        return true;
    }).length;
};

// Export average calculator for UI
export const getFilteredAverage = (student, startDate, endDate, subjectKey = null, classTitle = null) => {
    if (!student.assignments || student.assignments.length === 0) return 0;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    // Filter first
    const relevantAssignments = student.assignments.filter(a => {
        if (subjectKey && a.subject && a.subject !== subjectKey) return false;
        if (classTitle && a.classTitle !== classTitle) return false;

        const d = new Date(a.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    });

    if (relevantAssignments.length === 0) return 0;

    // Calculate Average Percentage
    const total = relevantAssignments.reduce((sum, a) => sum + (a.percentage || 0), 0);
    return Math.round(total / relevantAssignments.length);
};
