
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateStudent = (id, firstName, lastName, gradeNum) => {
    let gradeDisplay = `${gradeNum}th`;
    if (gradeNum == 1) gradeDisplay = "1st";
    if (gradeNum == 2) gradeDisplay = "2nd";
    if (gradeNum == 3) gradeDisplay = "3rd";
    if (gradeNum >= 4 && gradeNum <= 20) gradeDisplay = `${gradeNum}th`;

    const subjects = ['science', 'math', 'english', 'socialStudies'];
    const assignments = [];
    const today = new Date();

    subjects.forEach(subj => {
        const count = getRandomInt(5, 15);
        for (let i = 0; i < count; i++) {
            const daysAgo = getRandomInt(0, 120);
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);

            assignments.push({
                id: `a-${id}-${subj}-${i}`,
                date: date.toISOString().split('T')[0],
                score: getRandomInt(60, 100),
                subject: subj,
                activityName: `${subj} Unit ${i}`, // Generic Activity Name
                possible: 100,
                percentage: getRandomInt(60, 100)
            });
        }
    });

    return {
        id: id,
        name: `${firstName} ${lastName}`,
        grade: gradeDisplay,
        progress: {
            science: getRandomInt(60, 100),
            math: getRandomInt(60, 100),
            english: getRandomInt(60, 100),
            socialStudies: getRandomInt(60, 100),
        },
        attendance: getRandomInt(60, 100),
        writeups: 0,
        assignments: assignments,
        assignmentsCompleted: assignments.length
    };
};

const scienceStudents = Array.from({ length: 25 }, (_, i) => generateStudent(100 + i, "Student", `S${100 + i}`, 9));
const mathStudents = Array.from({ length: 25 }, (_, i) => generateStudent(200 + i, "Student", `M${200 + i}`, 10));
const elaStudents = Array.from({ length: 25 }, (_, i) => generateStudent(300 + i, "Student", `E${300 + i}`, 11));
const socialStudents = Array.from({ length: 25 }, (_, i) => generateStudent(400 + i, "Student", `H${400 + i}`, 12));

export const classrooms = {
    science: socialStudents,
    math: elaStudents,
    ela: scienceStudents,
    socialStudies: mathStudents
};

export const students = classrooms.science;
