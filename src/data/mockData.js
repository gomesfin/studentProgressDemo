
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateStudent = (id, firstName, lastName, gradeNum) => {
    let gradeDisplay = `${gradeNum}th`;
    if (gradeNum == 1) gradeDisplay = "1st";
    if (gradeNum == 2) gradeDisplay = "2nd";
    if (gradeNum == 3) gradeDisplay = "3rd";
    // Basic suffixes logic if needed, but 9-12 are all 'th'
    if (gradeNum >= 4 && gradeNum <= 20) gradeDisplay = `${gradeNum}th`;

    // Assignments for each subject
    const subjects = ['science', 'math', 'english', 'socialStudies'];
    const subjectActivities = {
        science: ['Lab Report', 'Periodic Quiz', 'Eco Project', 'Bio Test', 'Chem Lab', 'Physics Intro', 'Cells Unit'],
        math: ['Algebra Quiz', 'Geometry Test', 'Calc Intro', 'Trig Worksheet', 'Stats Project', 'Math Midterm', 'Formulas'],
        english: ['Hamlet Essay', 'Reading Log', 'Poetry Unit', 'Grammar Quiz', 'Journal Entry', 'Novel Study', 'Speech'],
        socialStudies: ['History Essay', 'Civics Quiz', 'Map Quiz', 'WWII Project', 'Econ Basics', 'Gov Test', 'Debate']
    };

    const assignments = [];
    const today = new Date();

    // Generate assignments for each subject independently to ensure decent data density
    subjects.forEach(subj => {
        const count = getRandomInt(5, 15); // Ensure 5-15 assignments per subject
        for (let i = 0; i < count; i++) {
            const daysAgo = getRandomInt(0, 120);
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);

            const activities = subjectActivities[subj];
            const activityName = activities[getRandomInt(0, activities.length - 1)];

            assignments.push({
                id: `a-${id}-${subj}-${i}`,
                date: date.toISOString().split('T')[0], // YYYY-MM-DD
                score: getRandomInt(60, 100),
                subject: subj,
                activityName: activityName,
                possible: 100,
                percentage: getRandomInt(60, 100) // Self-consistent with score
            });
        }
    });

    return {
        id: id,
        name: `${firstName} ${lastName}`,
        grade: gradeDisplay,
        progress: {
            science: getRandomInt(60, 100), // Optimistic grades
            math: getRandomInt(60, 100),
            english: getRandomInt(60, 100),
            socialStudies: getRandomInt(60, 100),
        },
        attendance: getRandomInt(60, 100), // Attendance %
        writeups: getRandomInt(0, 4) === 0 ? getRandomInt(1, 3) : 0, // 0-3 writeups
        assignments: assignments,
        assignmentsCompleted: assignments.length // Legacy/Total count
    };
};

const scienceStudents = [
    ["Abdirahman", "Ali", 9],
    ["Saeed", "Mahamud", 12],
    ["Fatima", "Yusuf", 10],
    ["Mohamed", "Aden", 10],
    ["Abdullahi", "Garcia", 10],
    ["Zuheyb", "Hajideer", 9],
    ["Fathi", "Gelle", 10],
    ["Dae", "Dean", 10],
    ["Ikram", "Noor", 9],
    ["Nina", "Silva", 9],
    ["Abdulrazak", "Idris", 9],
    ["Aisha", "Ahmed", 10],
    ["Khadra", "Yusuf", 11],
    ["Deko", "Amin", 9],
    ["Yahya", "Amin", 9],
    ["Yasir", "Ahmed", 9],
    ["Aweis", "Aden", 10],
    ["Asiya", "Hussein", 10],
    ["Ebrahim", "Abdinor", 10],
    ["Kalil", "Abdi", 10],
    ["Elhan", "Yussuf", 9],
    ["Kenberly", "Howell", 12],
    ["Anam", "Bashir", 9],
    ["Beautiful", "Medley", 9],
    ["Anusha", "Kami", 9],
    ["Hidayo", "Ahmed", 10]
].map((s, i) => generateStudent(100 + i, s[0], s[1], s[2]));

const mathStudents = [
    ["Maryam", "Idow", 10],
    ["Musa", "Musa", 10],
    ["Oumar", "Diallo", 10],
    ["Aaron", "Martinez-Trujillo", 10],
    ["Mohamedamin", "Abdullahi", 9],
    ["Charly", "Gonzalez", 11],
    ["Siham", "Hussein", 10],
    ["Ayan", "Yusuf", 10],
    ["Salma", "Yusuf", 10],
    ["Jibril", "Sow", 9],
    ["Miski", "Ali", 9],
    ["Ikramo", "Khaire", 12],
    ["Amuo", "Idris", 10],
    ["Hamza", "Abdiwahab", 9],
    ["Raliya", "Bilal Hussein", 10],
    ["Emiliano", "Silva", 9],
    ["Kedir", "Jama", 9],
    ["Asnino", "Idris", 9],
    ["Kalid", "Abdinor", 9],
    ["Asma", "Bashir", 9],
    ["Tajyira", "Whitaker", 9],
    ["Faiza", "Ali", 10],
    ["Suheyb", "Jama", 9],
    ["Munira", "Ahmed", 9]
].map((s, i) => generateStudent(200 + i, s[0], s[1], s[2]));

const elaStudents = [
    ["Zuhaib", "Mohamud", 9],
    ["Zakarie", "Ali", 9],
    ["Maeey", "Mohamed", 12],
    ["Farhan", "Ali", 9],
    ["Veronica", "Gamino", 12],
    ["Abass", "Abdi", 9],
    ["Mohamed", "Ahmed", 9],
    ["Joey", "Lacey", 10],
    ["Adnaan", "Getahun", 12],
    ["Mohamed", "Omar", 10],
    ["Micraaj", "Abdiwahab", 10],
    ["Halima", "Osman", 9],
    ["Oumu", "Tunkara", 10],
    ["Asha", "Ibrahim", 11],
    ["Imran", "Abdi", 9],
    ["Yahye", "Mohamoud", 9],
    ["Abdalla", "Haji", 9],
    ["Adnan", "Yusuf", 9],
    ["Abdisamad", "Ibrahim", 9],
    ["Darrell", "George", 9],
    ["Mabintou", "Sillah", 9],
    ["Ayuub", "Abow", 9],
    ["Mi'Yonna", "Hairston-Smith", 9],
    ["Ibrahim", "Ali", 9],
    ["Makenzie", "Dearmond", 9]
].map((s, i) => generateStudent(300 + i, s[0], s[1], s[2]));

const socialStudiesStudents = [
    ["Osama", "Hassan", 10],
    ["Abdihakim", "Ali", 9],
    ["Zakaria", "Amin", 11],
    ["Saqawe", "Mohamed", 10],
    ["Abdulnasir", "Ali", 9],
    ["Rahma", "Omar", 9],
    ["Hanaan", "Daud", 9],
    ["Abdiwahab", "Amin", 10],
    ["John", "Trujillo", 10],
    ["Ayub", "Abdirahman", 12],
    ["Mahmoud", "Mahmoud", 9],
    ["Ibrahim", "Yusuf", 12],
    ["Yahya", "Habib", 12],
    ["Daniel", "Lopez", 12],
    ["Muntase", "Jama", 10],
    ["Biibaaye", "Stewart", 9],
    ["Mohamed", "Mohamud", 9],
    ["Johorey", "Bilal", 10],
    ["Abdikarim", "Waise", 12],
    ["Abdiluahi", "Ali", 9],
    ["Caleb", "Crabtree", 9],
    ["Meymuno", "Mohamed", 9],
    ["Muhammad", "Sillah", 9],
    ["Sudeis", "Jama", 10],
    ["Siham", "Mohamed", 10]
].map((s, i) => generateStudent(400 + i, s[0], s[1], s[2]));

export const classrooms = {
    science: socialStudiesStudents,
    math: elaStudents,
    ela: scienceStudents,
    socialStudies: mathStudents
};

// Legacy support
export const students = classrooms.science;
