import React from 'react';
import './StudentCard.css';
import writeupIcon from '../assets/writeup.png';
import attendanceIcon from '../assets/attendance.png';
// Import or use SVG for calendar to avoid dependency issues if possible
// Using inline SVG for "Details/Calendar" icon

const StudentCard = ({ student, room, scale = 1, style = {}, expanded = true, onToggleExpand, onSubjectClick, onContextMenu }) => {
    const [hoveredSubject, setHoveredSubject] = React.useState(null);
    const [hoveredIcon, setHoveredIcon] = React.useState(null);

    // Defensive check
    if (!student) {
        return <div className="student-card error">Invalid Student Data</div>;
    }

    const { name, grade, progress, absences = 0, writeups = 0 } = student;

    // Extract number and suffix from grade string
    const gradeMatch = (grade || '').match(/^(\d+)(st|nd|rd|th)/);
    const gradeNumber = gradeMatch ? gradeMatch[1] : '';
    const gradeSuffix = gradeMatch ? gradeMatch[2] : '';

    const subjects = [
        { key: 'science', label: 'Sci', color: '#2ECC71', fullName: 'Science' },
        { key: 'math', label: 'Math', color: '#3498DB', fullName: 'Math' },
        { key: 'english', label: 'Eng', color: '#E74C3C', fullName: 'English' },
        { key: 'socialStudies', label: 'Soc', color: '#F1C40F', fullName: 'Social Studies' },
        { key: 'electives', label: 'Elec', color: '#9B59B6', fullName: 'Electives' }, // New Electives
    ];

    // Determine context subject
    const getContextSubject = () => {
        if (!room) return subjects[0];
        let keys = [room];
        if (room === 'ela') keys = ['english'];
        if (room === 'socialStudies') keys = ['socialStudies'];
        return subjects.find(s => keys.includes(s.key)) || subjects[0];
    };

    const handleDetailsClick = (e) => {
        e.stopPropagation(); // Stop expansion
        const targetSubject = getContextSubject();
        if (onSubjectClick) onSubjectClick(student, targetSubject);
    };

    // Helper: Find latest class for this subject category
    const getLatestClassInfo = (subjKey) => {
        // 1. Try History (Sorted by Date)
        if (student.enrolledClassesHistory && student.enrolledClassesHistory[subjKey]) {
            const history = student.enrolledClassesHistory[subjKey];
            if (history.length > 0) {
                // Sort descending by last_import string (ISO format works with string compare)
                // Use spread to avoid mutating props
                const sorted = [...history].sort((a, b) => (b.last_import || '').localeCompare(a.last_import || ''));
                return sorted[0];
            }
        }

        // 2. Fallback: Scan enrolledClasses values for matching subject
        if (student.enrolledClasses) {
            const match = Object.values(student.enrolledClasses).find(c => {
                if (typeof c === 'object') return c.subject === subjKey;
                return false;
            });
            if (match) return match;
        }

        return null;
    };

    // Helper for colors
    const getAbsenceColor = (val) => {
        if (val <= 2) return 'var(--color-success)'; // Green (Good)
        if (val <= 5) return 'var(--color-warning)'; // Yellow (Warning)
        return 'var(--color-danger)'; // Red (Bad)
    };

    const getWriteupColor = (val) => {
        if (val === 0) return 'var(--color-success)';
        if (val <= 2) return 'var(--color-warning)';
        return 'var(--color-danger)';
    };

    const handleContextMenu = (e) => {
        e.preventDefault(); // Block default right-click menu
        if (onContextMenu) {
            onContextMenu(e, student);
        }
    };

    return (
        <div
            className={`student-card ${!expanded ? 'collapsed' : ''}`}
            style={{ ...style, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            onContextMenu={handleContextMenu}
        >
            <div className="student-header" onDoubleClick={onToggleExpand}>
                <h3
                    className="student-name"
                    title={name}
                >
                    {expanded ? name : `${name.split(' ')[0]} ${name.split(' ')[1] ? name.split(' ')[1][0] + '.' : ''}`}
                </h3>

                {/* Reverted extra icon per user request */}

                {gradeNumber && (
                    <div
                        className="grade-circle"
                        onClick={handleDetailsClick}
                        title={`Open ${getContextSubject().fullName} Details`}
                    >
                        <span className="grade-number">{gradeNumber}</span>
                        <sup className="grade-suffix">{gradeSuffix}</sup>
                    </div>
                )}
                {!gradeNumber && grade && (
                    <span
                        className="student-grade-fallback"
                        onClick={handleDetailsClick}
                        style={{ cursor: 'pointer' }}
                    >
                        {grade}
                    </span>
                )}
            </div>

            {expanded && (
                <div className="card-body">
                    {/* Bars Section (Left) */}
                    <div className="progress-container">
                        {subjects.map((subject) => {
                            const classInfo = getLatestClassInfo(subject.key);
                            // Look up progress by Title if classInfo exists, or try key fallback (rare legacy)
                            const progressVal = classInfo ? student.progress[classInfo.title] : undefined;

                            return (
                                <div
                                    key={subject.key}
                                    className="progress-column"
                                    onMouseEnter={() => setHoveredSubject(subject.key)}
                                    onMouseLeave={() => setHoveredSubject(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const target = classInfo ? classInfo.title : subject.key;
                                        onSubjectClick && onSubjectClick(student, target);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="bar-track">
                                        {progressVal !== undefined ? (
                                            <div
                                                className="bar-fill"
                                                style={{
                                                    height: `${progressVal}%`,
                                                    backgroundColor: subject.color
                                                }}
                                            ></div>
                                        ) : null}
                                    </div>
                                    <span className="subject-label">{subject.label}</span>

                                    {hoveredSubject === subject.key && (
                                        <div className="bar-tooltip">
                                            <div className="tooltip-name">
                                                {classInfo ? classInfo.title : subject.fullName}
                                            </div>
                                            <div className="tooltip-value">
                                                {progressVal !== undefined ? `${progressVal}%` : 'N/A'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Icons Section (Right) */}
                    <div className="icons-container">

                        {/* Attendance/Absence (Top) */}
                        <div
                            className="icon-row"
                            style={{ color: getAbsenceColor(absences), cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredIcon('absence')}
                            onMouseLeave={() => setHoveredIcon(null)}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSubjectClick && onSubjectClick(student, subjects[0]);
                            }}
                        >
                            <div
                                className="icon-mask"
                                style={{
                                    maskImage: `url(${attendanceIcon})`,
                                    WebkitMaskImage: `url(${attendanceIcon})`,
                                    maskSize: 'contain',
                                    WebkitMaskSize: 'contain',
                                    maskRepeat: 'no-repeat',
                                    WebkitMaskRepeat: 'no-repeat',
                                    maskPosition: 'center',
                                    WebkitMaskPosition: 'center',
                                    backgroundColor: 'currentColor'
                                }}
                            ></div>
                            <span className="icon-value">{absences}</span>

                            {hoveredIcon === 'absence' && (
                                <div className="icon-tooltip">
                                    Absence count
                                </div>
                            )}
                        </div>

                        {/* Writeup (Bottom) */}
                        <div
                            className="icon-row"
                            style={{ color: getWriteupColor(writeups), cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredIcon('writeup')}
                            onMouseLeave={() => setHoveredIcon(null)}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSubjectClick && onSubjectClick(student, subjects[0]);
                            }}
                        >
                            <div
                                className="icon-mask"
                                style={{
                                    maskImage: `url(${writeupIcon})`,
                                    WebkitMaskImage: `url(${writeupIcon})`,
                                    maskSize: 'contain',
                                    WebkitMaskSize: 'contain',
                                    maskRepeat: 'no-repeat',
                                    WebkitMaskRepeat: 'no-repeat',
                                    maskPosition: 'center',
                                    WebkitMaskPosition: 'center',
                                    backgroundColor: 'currentColor'
                                }}
                            ></div>
                            <span className="icon-value">{writeups}</span>

                            {hoveredIcon === 'writeup' && (
                                <div className="icon-tooltip">
                                    Writeup count
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default StudentCard;
