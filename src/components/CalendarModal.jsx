import React, { useMemo, useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import './CalendarModal.css';

const BadgeIcon = ({ color }) => (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill={color}>
        <path d="M240-40v-329L110-580l185-300h370l185 300-130 211v329l-240-80-240 80Zm80-111 160-53 160 53v-129H320v129Zm20-649L204-580l136 220h280l136-220-136-220H340Zm98 383L296-558l57-57 85 85 169-170 57 56-226 227ZM320-280h320-320Z" />
    </svg>
);

const CustomSubjectDropdown = ({ subjects, currentKey, onChange, currentColor }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    const selectedSubject = subjects.find(s => s.key === currentKey) || subjects[0];

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="custom-dropdown-container" ref={containerRef}>
            <div
                className="custom-dropdown-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{ color: currentColor }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                    <span>{selectedSubject?.fullName || 'Select Subject'}</span>
                    {selectedSubject?.isCompleted && <BadgeIcon color={currentColor} />}
                </div>
                {/* Standard Chevron SVG */}
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '1rem' }}>
                    <path d="M1 1L5 5L9 1" />
                </svg>
            </div>

            {isOpen && (
                <div className="custom-dropdown-menu">
                    {subjects.map(subj => (
                        <div
                            key={subj.key}
                            className={`custom-option ${subj.key === currentKey ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(subj.key);
                                setIsOpen(false);
                            }}
                            style={{ color: subj.color }}
                        >
                            <span>{subj.fullName}</span>
                            {subj.isCompleted && <BadgeIcon color={subj.color} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CalendarModal = ({ student, subject, students = [], onStudentChange, homeroomLabel, onClose, subjectTotals = {}, semester = 'FALL_2025' }) => {
    // ---- Dynamic Subject Configuration ----
    const availableSubjects = useMemo(() => {
        // defined keys for color mapping
        const BASE_CONFIG = {
            'science': { label: 'Sci', color: '#2ECC71', fullName: 'Science' },
            'math': { label: 'Math', color: '#3498DB', fullName: 'Math' },
            'english': { label: 'Eng', color: '#E74C3C', fullName: 'English' },
            'socialStudies': { label: 'Soc', color: '#F1C40F', fullName: 'Social Studies' },
            'electives': { label: 'Elec', color: '#9B59B6', fullName: 'Electives' }
        };

        const subjects = [];
        const enrollments = student.enrolledClasses || {};

        // 1. Identification: Iterate all subjects present in enrollments OR assignments
        const keys = new Set([
            ...Object.keys(enrollments).filter(k => k !== 'metadata'),
            ...(student.assignments || []).map(a => a.subject).filter(Boolean)
        ]);

        // Config: Map subjects to colors
        const configMap = {
            science: { color: '#2ECC71', label: 'SCIENCE' },
            math: { color: '#3498DB', label: 'MATH' },
            english: { color: '#E74C3C', label: 'ELA' },
            socialStudies: { color: '#F1C40F', label: 'SOC' },
            electives: { color: '#9B59B6', label: 'ELECTIVE' }
        };

        const history = student.enrolledClassesHistory || {};
        const legacy = student.enrolledClasses || {};

        // Helper to add subject
        const addClassOption = (key, classData) => {
            const conf = configMap[key] || configMap['electives'];
            // FIX: Handle both Object (New) and String (Legacy) class definitions
            const rawTitle = (classData && typeof classData === 'object') ? classData.title : classData;
            const title = rawTitle || conf.label;

            // Determine Completion
            // 1. Filter assignments for this SPECIFIC class
            const subAssignments = (student.assignments || []).filter(a => {
                if (a.classTitle) return a.classTitle === title;
                return a.subject === key; // Fallback
            });

            const stats = (student.classStats && student.classStats[title]) || null;
            // Use metadata total if available (Total Curriculum), else subAssignments count (Total Imported)
            const total = stats ? stats.total : subAssignments.length;
            const completedCount = subAssignments.filter(a => a.status === 'Complete' || a.status === 'COMPLETED').length;

            // Mark as complete if effectively 100% of curriculum is done.
            const isCompleted = total > 0 && (completedCount / total) >= 0.99;

            // Avoid duplicates
            if (subjects.find(s => s.key === title)) return;

            subjects.push({
                key: title, // Use TITLE as key for specific class filtering
                subjectKey: key, // Keep ref to parent subject type
                label: conf.label,
                color: conf.color,
                fullName: title,
                isCompleted
            });
        };

        // 1. Try History First (Multi-Class)
        ['science', 'math', 'english', 'socialStudies', 'electives'].forEach(subjKey => {
            if (history[subjKey] && Array.isArray(history[subjKey])) {
                history[subjKey].forEach(cls => addClassOption(subjKey, cls));
            } else if (legacy[subjKey]) {
                // Fallback to legacy singleton
                addClassOption(subjKey, legacy[subjKey]);
            }
        });

        // Sort: Maintain subject order, then alpha
        const order = ['science', 'socialStudies', 'english', 'math', 'electives'];
        subjects.sort((a, b) => {
            const ixA = order.indexOf(a.subjectKey);
            const ixB = order.indexOf(b.subjectKey);
            if (ixA !== ixB) return ixA - ixB;
            return a.fullName.localeCompare(b.fullName);
        });

        return subjects;
    }, [student]);

    // ---- Local State for Subject Switching ----
    // Ensure currentSubjectKey is valid, fallback to first available
    const initialKey = React.useMemo(() => {
        if (subject && availableSubjects.find(s => s.key === subject)) {
            return subject;
        }
        return availableSubjects.length > 0 ? availableSubjects[0].key : 'General';
    }, [subject, availableSubjects]);

    const [currentSubjectKey, setCurrentSubjectKey] = useState(initialKey);

    // Effect: Update key if student changes (and old key not present)
    React.useEffect(() => {
        const exists = availableSubjects.find(s => s.key === currentSubjectKey);
        if (!exists && availableSubjects.length > 0) {
            setCurrentSubjectKey(availableSubjects[0].key);
        }
    }, [student.id, availableSubjects]); // Only if student/list changes

    // Derived Subject Object
    const currentSubject = availableSubjects.find(s => s.key === currentSubjectKey) || availableSubjects[0] || { color: '#ccc' };

    // ---- Data Logic ----
    // ---- Data Logic ----
    // ---- Data Logic: Dynamic Date Range ----
    const dynamicConfig = useMemo(() => {
        // 1. Get relevant assignments
        // Filter by CLASS TITLE if possible, else Subject (Legacy)
        const relevantAssignments = (student.assignments || []).filter(a => {
            if (!a.date) return false;
            // Strict Title Match (V3)
            if (a.classTitle && a.classTitle === currentSubjectKey) return true;
            // Fallback: Subject Match (Legacy)
            if (!a.classTitle && a.subject === currentSubject.subjectKey) return true;
            return false;
        });

        // 2. Find Earliest Date
        let minDate = new Date(); // Fallback
        let hasData = false;

        if (relevantAssignments.length > 0) {
            // Sort by date strings is safe for ISO
            const dates = relevantAssignments.map(a => a.date).sort();
            const [y, m, d] = dates[0].split('-').map(Number);
            minDate = new Date(y, m - 1, d); // Month is 0-indexed
            hasData = true;
        } else {
            // Default to Aug 2025 if no data
            minDate = new Date(2025, 7, 1);
        }

        // 3. Determine Start Month & Year
        const startYear = minDate.getFullYear();
        const startMonth = minDate.getMonth();

        // 4. Generate 4 Months (handle year rollover)
        const months = []; // Array of { year, monthIndex }
        for (let i = 0; i < 4; i++) {
            let m = startMonth + i;
            let y = startYear;
            if (m > 11) {
                m -= 12;
                y += 1;
            }
            months.push({ year: y, monthIndex: m });
        }

        // 5. Determine Abs Start/End
        const startDate = new Date(months[0].year, months[0].monthIndex, 1);
        // End date is last day of last month in range
        const lastM = months[3];
        const endDate = new Date(lastM.year, lastM.monthIndex + 1, 0);

        return { months, startDate, endDate, hasData };
    }, [student.assignments, currentSubjectKey]);

    const SEMESTER_MONTHS = dynamicConfig.months.map(m => m.monthIndex);
    // Note: We need year context for rendering now, so SEMESTER_MONTHS map might be insufficient if year changes
    // Refactoring render to use detailed objects

    const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const getDaysForMonth = (year, month) => {
        const firstDay = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= totalDays; i++) days.push(i);
        return days;
    };

    // Helper: Robo-Parse Date
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        // Case 1: ISO YYYY-MM-DD
        if (dateStr.includes('-')) {
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        // Case 2: Slash MM/DD/YYYY
        if (dateStr.includes('/')) {
            const [m, d, y] = dateStr.split('/').map(Number);
            return new Date(y, m - 1, d);
        }
        // Case 3: Timestamp
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    const { semesterData, weeklyData, weeklyGrades, weeklyCompletion, assignmentDetails, weekLabels } = useMemo(() => {
        const sData = {};
        const weeks = [];
        const details = [];
        const wLabels = [];
        const grades = [];
        const wCompletion = [];

        // Data source based on filter
        const rawAssignments = (student.assignments || []).filter(a => {
            // Fix: Compare against subjectKey (e.g. 'science'), not the Title Key (e.g. 'Biology')
            if (a.subject && currentSubject.subjectKey && a.subject !== currentSubject.subjectKey) return false;

            // Fix: Filter by Specific Class Title (if available) to avoid Subject Aggregation
            // This ensures "Physical Science" graph doesn't include "Biology" assignments
            if (a.classTitle && currentSubject.fullName && a.classTitle !== currentSubject.fullName) return false;

            if (!a.date) return false;

            const [y, m, d] = a.date.split('-').map(Number);
            const aDate = new Date(y, m - 1, d);

            return aDate >= dynamicConfig.startDate && aDate <= dynamicConfig.endDate;
        });

        // 1. Populate Semester Data (Daily List of Assignments)
        rawAssignments.forEach(a => {
            if (!a.date) return;
            const [y, m, d] = a.date.split('-').map(Number);
            // Key format: "monthIndex - day"
            const key = `${m - 1} -${d} `;
            if (!sData[key]) sData[key] = [];
            sData[key].push(a);
        });

        // 2. Generate Weekly Bins (Strict 7-day intervals from Start)
        let currentStart = new Date(dynamicConfig.startDate);
        const semesterEnd = new Date(dynamicConfig.endDate);

        // Running Totals for Cumulative Grade
        let runningSum = 0;
        let runningCount = 0;

        // Fix: Calculate initial cumulative count for assignments BEFORE the start date
        // Must belong to this SPECIFIC class and be marked Complete
        const preStartAssignments = (student.assignments || []).filter(a => {
            // Must belong to this SPECIFIC class
            const aTitle = (a.classTitle || '').trim().toLowerCase();
            const bTitle = (currentSubject.fullName || '').trim().toLowerCase();
            if (!aTitle || !bTitle || aTitle !== bTitle) return false;

            if (a.date) {
                const aDate = parseDate(a.date);
                // If before start
                if (aDate && aDate < dynamicConfig.startDate) return a.status === 'Complete' || a.status === 'COMPLETED';
                return false;
            }

            // Case 2: No Date + Completed (Treat as Prior Progress)
            return a.status === 'Complete' || a.status === 'COMPLETED';
        });

        let cumulativeAssignments = preStartAssignments.length;

        while (currentStart <= semesterEnd) {
            const currentEnd = new Date(currentStart);
            currentEnd.setDate(currentStart.getDate() + 6);

            // Filter assignments in this 7-day range
            // Match ISO date string comparison or timestamp
            const startTs = currentStart.getTime();
            const endTs = currentEnd.getTime();

            const weeklyAssignments = rawAssignments.filter(a => {
                const aDate = parseDate(a.date);
                if (!aDate) return false;
                const aTs = aDate.getTime();
                return aTs >= startTs && aTs <= endTs;
            });

            // A. Count
            weeks.push(weeklyAssignments.length);

            // B. Details
            details.push(weeklyAssignments.map(t => {
                // Use the explicit title from API, or activityName, or fallback.
                // Do NOT overwrite if it contains "Assignment" - trust the data.
                const name = t.title || t.activityName || 'Unnamed Assignment';
                const scoreDisplay = t.percentage !== undefined ? `${t.percentage}%` : (t.score || '-');
                return `${name} (${scoreDisplay})`;
            }));

            // C. Labels: "W-dd/mm"
            const mm = String(currentStart.getMonth() + 1).padStart(2, '0');
            const dd = String(currentStart.getDate()).padStart(2, '0');
            wLabels.push(`W-${dd}/${mm}`);

            // D. Overall Cumulative Grade (Running Average)
            if (weeklyAssignments.length > 0) {
                weeklyAssignments.forEach(t => {
                    let p = 0;
                    // 1. Prefer Max Score calculation (Most accurate)
                    if (typeof t.score === 'number' && t.possible > 0) {
                        p = (t.score / t.possible) * 100;
                    }
                    // 2. Fallback to provided percentage
                    else if (typeof t.percentage === 'number' && !isNaN(t.percentage)) {
                        p = t.percentage;
                    }
                    // 3. Fallback to raw score (Mock data support, assumed /100)
                    else if (typeof t.score === 'number') {
                        p = t.score;
                    }

                    // 4. Heuristic: If value is decimal (0 < p <= 1), assume it needs x100 scaling
                    // (Unlikely a student has < 1% grade average, very likely it's a decimal format)
                    if (p > 0 && p <= 1.0) {
                        p *= 100;
                    }

                    runningSum += p;
                    runningCount++;
                });
            }

            if (runningCount > 0) {
                const cumulativeAvg = Math.round(runningSum / runningCount);
                grades.push(cumulativeAvg);
            } else {
                grades.push(null);
            }

            // E. Class Completion % (Cumulative)
            // Strategy: 
            // 1. Denominator = Total Assignments in Class (from DB Stats)
            // 2. Numerator = Cumulative Count of "Complete" assignments up to this week

            const stats = student.classStats && currentSubject.fullName ? student.classStats[currentSubject.fullName] : null;
            const total = stats ? stats.total : (student.assignments || []).filter(a => {
                const aTitle = (a.classTitle || '').trim().toLowerCase();
                const bTitle = (currentSubject.fullName || '').trim().toLowerCase();
                return aTitle && bTitle && aTitle === bTitle;
            }).length;

            // Filter weekly assignments for THIS class specifically (since weeklyAssignments is Subject-wide)
            // Probe: Log the first non-empty week
            const weeklyCompletedCount = weeklyAssignments.filter(a => a.status === 'Complete' || a.status === 'COMPLETED').length;

            if (weeklyAssignments.length > 0 && wLabels.length < 5) { // Limit log spam
                console.log(`[Audit Week ${wLabels.length}] Total: ${weeklyAssignments.length}, Completed: ${weeklyCompletedCount}`);
                if (weeklyCompletedCount === 0 && weeklyAssignments.length > 0) {
                    console.log("   -> Audit Mismatch! First Item:", JSON.stringify(weeklyAssignments[0]));
                }
            }

            cumulativeAssignments += weeklyCompletedCount; // Re-using variable name, but now tracks COMPLETED

            const completion = total > 0 ? Math.round((cumulativeAssignments / total) * 100) : 0;
            wCompletion.push(completion);

            // Iterate
            currentStart.setDate(currentStart.getDate() + 7);
        }

        return {
            semesterData: sData,
            weeklyData: weeks,
            weeklyGrades: grades,
            weeklyCompletion: wCompletion,
            assignmentDetails: details,
            weekLabels: wLabels
        };
    }, [student.assignments, currentSubjectKey, subjectTotals, dynamicConfig]);

    // Mock behavior data (All Zeros per user request)
    const behaviorData = React.useMemo(() => {
        if (!weeklyData || !Array.isArray(weeklyData)) return { absences: [], writeups: [] };
        return {
            absences: weeklyData.map(() => 0),
            writeups: weeklyData.map(() => 0)
        };
    }, [weeklyData]);

    const [selectedWeek, setSelectedWeek] = React.useState(null);
    const [selectedBehavior, setSelectedBehavior] = React.useState(null);

    // Renders the behavior graph (Dual Line: Absences vs Write-ups)
    const renderBehaviorGraph = () => {
        const height = 90; // Height matches CSS
        const width = 1150; // Match main graph
        const padding = { top: 15, right: 50, bottom: 20, left: 45 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        const { absences = [], writeups = [] } = behaviorData || {};

        // 1. Scales
        // Absences (Left Axis) - Min 5 for scale
        const maxAbs = Math.max(5, ...absences);
        // Write-ups (Right Axis) - Min 3 for scale
        const maxWrt = Math.max(3, ...writeups);

        const getX = (i) => {
            const step = graphWidth / (weeklyData.length > 1 ? weeklyData.length - 1 : 1);
            return padding.left + (i * step);
        };

        const getY_Abs = (val) => (height - padding.bottom) - (val / maxAbs) * graphHeight;
        const getY_Wrt = (val) => (height - padding.bottom) - (val / maxWrt) * graphHeight;

        // Path Generators
        const generatePath = (data, getY) => {
            if (!data || !data.length) return "";
            return data.map((val, i) => {
                const x = getX(i);
                const y = getY(val);
                return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
            }).join(' ');
        };

        const absPath = generatePath(absences, getY_Abs);
        const wrtPath = generatePath(writeups, getY_Wrt);

        return (
            <div className="behavior-chart-wrapper">
                <svg className="chart-svg behavior-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                    {/* Grid Lines (Based on Absences - 3 lines) */}
                    {[0, 0.5, 1].map(ratio => {
                        const y = (height - padding.bottom) - ratio * graphHeight;
                        return <line key={ratio} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" />;
                    })}

                    {/* Left Axis (Absences) - Sky-300 */}
                    <text x={35} y={padding.top} textAnchor="end" fill="#7dd3fc" fontSize="11px" fontWeight="600">{maxAbs}</text>
                    <text x={35} y={height - padding.bottom} textAnchor="end" fill="#7dd3fc" fontSize="11px" fontWeight="600">0</text>
                    <text
                        x={-height / 2}
                        y={12}
                        transform="rotate(-90)"
                        textAnchor="middle"
                        fill="#7dd3fc"
                        fontSize="9px"
                        fontWeight="700"
                        letterSpacing="0.5px"
                    >
                        ABSENCES
                    </text>

                    {/* Right Axis (Write-ups) - Orange-300 */}
                    <text x={width - 45} y={padding.top} textAnchor="start" fill="#fdba74" fontSize="11px" fontWeight="600">{maxWrt}</text>
                    <text x={width - 45} y={height - padding.bottom} textAnchor="start" fill="#fdba74" fontSize="11px" fontWeight="600">0</text>
                    <text
                        x={-height / 2}
                        y={width - 8}
                        transform="rotate(-90)"
                        textAnchor="middle"
                        fill="#fdba74"
                        fontSize="9px"
                        fontWeight="700"
                        letterSpacing="0.5px"
                    >
                        WRITE-UPS
                    </text>

                    {/* Absences Line (Sky-300) - Layer 1 */}
                    <path d={absPath} fill="none" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Write-ups Line (Orange-300) - Layer 2 */}
                    <path d={wrtPath} fill="none" stroke="#fdba74" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Interactive Dots - Absences */}
                    {absences.map((val, i) => (
                        <circle key={`abs-${i}`} cx={getX(i)} cy={getY_Abs(val)} r="2.5" fill="#7dd3fc" />
                    ))}

                    {/* Interactive Dots - Write-ups */}
                    {writeups.map((val, i) => (
                        <circle key={`wrt-${i}`} cx={getX(i)} cy={getY_Wrt(val)} r="2.5" fill="#fdba74" />
                    ))}
                </svg>
            </div>
        );
    };

    const renderAssignmentGraph = () => {
        const height = 180; // Compact height
        const width = 1150;
        const padding = { top: 20, right: 50, bottom: 30, left: 45 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        // Data Safe Check
        if (!weeklyData || weeklyData.length === 0) return <div className="no-data-graph">No Data Check</div>;

        // Max Y for Count Assignment
        const maxCount = Math.max(...weeklyData, 5);

        // Helper: Get X Coordinate
        const getX = (index) => {
            const step = graphWidth / (weeklyData.length > 1 ? weeklyData.length - 1 : 1);
            return padding.left + (index * step);
        };

        // Helper: Get Y Coordinate (Left Axis - Count)
        const getY_Count = (count) => {
            return (height - 30) - (count / maxCount) * (graphHeight);
        };

        // Helper: Get Y Coordinate (Right Axis - Percentage)
        const getY_Percent = (percent) => {
            return (height - 30) - (percent / 100) * (graphHeight);
        };

        // Points for Assignment Line
        const assignmentPoints = weeklyData.map((count, i) => `${getX(i)},${getY_Count(count)}`).join(' ');

        // Points for Grade Line
        const gradePoints = weeklyGrades.map((g, i) => {
            if (g === null) return null;
            return `${getX(i)},${getY_Percent(g)}`;
        }).filter(p => p !== null).join(' ');

        // Points for Completion Line
        const completionPoints = weeklyCompletion.map((c, i) => `${getX(i)},${getY_Percent(c)}`).join(' ');

        return (
            <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                {/* Grid Lines (Right Axis - Percentage) */}
                {[0, 25, 50, 75, 100].map(p => {
                    const y = getY_Percent(p);
                    return (
                        <g key={`grid-y-${p}`}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                            {/* Right Axis Tick Labels */}
                            <text x={width - 50 + 5} y={y + 3} textAnchor="start" fill="#f1f5f9" fontSize="9px" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">{p}%</text>
                        </g>
                    )
                })}

                {/* Left Axis - Activity Count Labels */}
                {[0, Math.round(maxCount / 2), maxCount].map(c => {
                    const y = getY_Count(c);
                    return (
                        <text key={`left-${c}`} x={35} y={y + 4} textAnchor="end" fill="#f1f5f9" fontSize="11px" fontWeight="600" fontFamily="Inter, system-ui, sans-serif">{c}</text>
                    );
                })}

                {/* Left Axis Title */}
                <text
                    x={-height / 2}
                    y={9}
                    transform="rotate(-90)"
                    textAnchor="middle"
                    fill={currentSubject.color}
                    fontSize="10px"
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                    letterSpacing="1px"
                >
                    ACTIVITIES COMPLETED
                </text>

                {/* Right Axis Title (Combined) */}
                <text
                    x={-height / 2}
                    y={width - 2}
                    transform="rotate(-90)"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="10px"
                    fontWeight="600"
                    fontFamily="Inter, system-ui, sans-serif"
                    letterSpacing="1px"
                >
                    <tspan fill="#e2e8f0">AVG GRADE</tspan>
                    <tspan dx="5" fill="#64748b">|</tspan>
                    <tspan dx="5" fill="#87A96B">COMPLETION</tspan>
                </text>

                {/* X Axis Labels */}
                {weekLabels.map((label, i) => {
                    if (i % 2 !== 0) return null; // Filter for space
                    return (
                        <text key={`x-${i}`} x={getX(i)} y={height - 5} textAnchor="middle" fill="#f1f5f9" fontSize="10px">
                            {label}
                        </text>
                    );
                })}

                {/* PLOTS */}

                {/* 1. Activities Completed (Line Only) */}
                <polyline points={assignmentPoints} fill="none" stroke={currentSubject.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* 2. Class Completion Line (Green) - SOLID per spec, with shading */}
                <polyline
                    points={`${padding.left},${height - 30} ${completionPoints} ${getX(weeklyData.length - 1)},${height - 30}`}
                    fill="#87A96B"
                    fillOpacity="0.15"
                    stroke="none"
                />
                <polyline points={completionPoints} fill="none" stroke="#87A96B" strokeWidth="2" strokeDasharray="" className="chart-line" />

                {/* 3. Average Grade Line (White/Grey) - DASHED per spec */}
                <polyline
                    points={gradePoints}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    className="chart-line"
                />

                {/* INTERACTIVE NODES - HOLLOW STYLE */}

                {/* Assignment Nodes */}
                {weeklyData.map((count, i) => (
                    <circle
                        key={`node-ass-${i}`}
                        cx={getX(i)}
                        cy={getY_Count(count)}
                        r="3.5"
                        fill="#0f172a" /* HOLLOW CENTER */
                        stroke={currentSubject.color}
                        strokeWidth="2"
                        className="graph-node"
                        onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.target.getBoundingClientRect();
                            setSelectedWeek({
                                weekIndex: i,
                                value: count,
                                left: rect.left + rect.width / 2,
                                top: rect.top,
                                type: 'assignments',
                                sticky: true
                            });
                        }}
                        onMouseEnter={(e) => {
                            if (selectedWeek?.sticky) return;
                            const rect = e.target.getBoundingClientRect();
                            setSelectedWeek({
                                weekIndex: i,
                                value: count,
                                left: rect.left + rect.width / 2,
                                top: rect.top,
                                type: 'assignments',
                                sticky: false
                            });
                        }}
                        onMouseLeave={() => {
                            if (!selectedWeek?.sticky) setSelectedWeek(null);
                        }}
                    />
                ))}

                {/* Grade Nodes */}
                {weeklyGrades.map((g, i) => {
                    if (g === null) return null;
                    return (
                        <circle
                            key={`node-grade-${i}`}
                            cx={getX(i)}
                            cy={getY_Percent(g)}
                            r="3"
                            fill="#0f172a" /* HOLLOW CENTER */
                            stroke="#e2e8f0"
                            strokeWidth="2"
                            className="graph-node"
                            onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.target.getBoundingClientRect();
                                setSelectedWeek({
                                    weekIndex: i,
                                    value: g,
                                    left: rect.left + rect.width / 2,
                                    top: rect.top,
                                    type: 'grade',
                                    sticky: true
                                });
                            }}
                            onMouseEnter={(e) => {
                                if (selectedWeek?.sticky) return; // Don't disrupt sticky
                                const rect = e.target.getBoundingClientRect();
                                setSelectedWeek({
                                    weekIndex: i,
                                    value: g,
                                    left: rect.left + rect.width / 2,
                                    top: rect.top,
                                    type: 'grade',
                                    sticky: false
                                });
                            }}
                            onMouseLeave={() => {
                                if (!selectedWeek?.sticky) setSelectedWeek(null);
                            }}
                        />
                    );
                })}

                {/* Completion Nodes - Solid & Smaller */}
                {weeklyCompletion.map((c, i) => (
                    <circle
                        key={`node-comp-${i}`}
                        cx={getX(i)}
                        cy={getY_Percent(c)}
                        r="2.5"
                        fill="#87A96B" /* SOLID FILL */
                        stroke="none"
                        className="graph-node"
                        onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.target.getBoundingClientRect();
                            setSelectedWeek({
                                weekIndex: i,
                                value: c,
                                left: rect.left + rect.width / 2,
                                top: rect.top,
                                type: 'completion',
                                sticky: true
                            });
                        }}
                        onMouseEnter={(e) => {
                            if (selectedWeek?.sticky) return;
                            const rect = e.target.getBoundingClientRect();
                            setSelectedWeek({
                                weekIndex: i,
                                value: c,
                                left: rect.left + rect.width / 2,
                                top: rect.top,
                                type: 'completion',
                                sticky: false
                            });
                        }}
                        onMouseLeave={() => {
                            if (!selectedWeek?.sticky) setSelectedWeek(null);
                        }}
                    />
                ))}
            </svg>
        );
    };

    // behavior state removed

    // Renders the behavior graph (Dual Line: Absences vs Write-ups)
    // Renders the behavior graph (Dual Line: Absences vs Write-ups)



    const studentNameOnly = student.name;
    const enrolledClass = (student.enrolledClasses && student.enrolledClasses[currentSubject.key]);

    return (
        <div className="modal-overlay calendar-modal-overlay" onClick={() => setSelectedWeek(null)}>
            <div className="calendar-modal calendar-modal-content" onClick={(e) => e.stopPropagation()}>
                {homeroomLabel && <span className="homeroom-badge">{homeroomLabel}</span>}
                <div className="modal-top-bar">
                    <div className="modal-title-left">
                        <h2>
                            <select
                                className="student-dropdown"
                                value={student.id}
                                onChange={(e) => {
                                    const selected = students.find(s => String(s.id) === e.target.value);
                                    if (selected) onStudentChange(selected);
                                }}
                            >
                                {students.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            <span style={{ margin: '0 0.5rem', opacity: 0.3 }}>/</span>

                            {/* CUSTOM SUBJECT DROPDOWN */}
                            <CustomSubjectDropdown
                                subjects={availableSubjects}
                                currentKey={currentSubjectKey}
                                onChange={setCurrentSubjectKey}
                                currentColor={currentSubject.color}
                            />
                        </h2>
                    </div>
                    <div data-html2canvas-ignore="true">
                        <button className="export-btn" onClick={() => {
                            const element = document.querySelector('.calendar-modal-content');
                            html2canvas(element, {
                                backgroundColor: '#1e293b',
                                scale: 2, // Retain high quality
                                useCORS: true
                            }).then(canvas => {
                                const link = document.createElement('a');
                                // Sanitize filename: remove non-alphanumeric chars (keep underscores/hyphens)
                                const safeName = (student.name || 'Student').replace(/[^a-zA-Z0-9-_]/g, '_');
                                link.download = `${safeName}_Progress.png`;
                                link.href = canvas.toDataURL('image/png');
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }).catch(err => {
                                console.error("Export failed:", err);
                            });
                        }}>Export</button>
                        <button className="close-btn-text" onClick={onClose}>Close</button>
                    </div>
                </div>

                <div className="modal-body" onClick={() => setSelectedWeek(null)}>
                    {/* Semester View - Compacted */}
                    <div className="semester-section">
                        <div className="semester-grid">
                            {dynamicConfig.months.map(mObj => (
                                <div key={`${mObj.year}-${mObj.monthIndex}`} className="month-card">
                                    <div className="month-name">{MONTH_NAMES[mObj.monthIndex]} <span style={{ fontSize: '0.7em', paddingLeft: '4px', opacity: 0.5 }}>{mObj.year}</span></div>
                                    <div className="mini-calendar">
                                        <div className="mini-day-header">S</div>
                                        <div className="mini-day-header">M</div>
                                        <div className="mini-day-header">T</div>
                                        <div className="mini-day-header">W</div>
                                        <div className="mini-day-header">T</div>
                                        <div className="mini-day-header">F</div>
                                        <div className="mini-day-header">S</div>
                                        {getDaysForMonth(mObj.year, mObj.monthIndex).map((d, i) => {
                                            const key = `${mObj.monthIndex} -${d} `;
                                            const assignments = d ? (semesterData[key] || []) : [];
                                            const count = assignments.length;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`mini-day ${count > 0 ? 'active' : ''}`}
                                                    style={count > 0 ? {
                                                        backgroundColor: currentSubject.color, // Use current subject color
                                                        opacity: count >= 3 ? 1 : count === 2 ? 0.7 : 0.4,
                                                        cursor: 'pointer' // Pointing finger
                                                    } : {}}
                                                    onMouseEnter={(e) => {
                                                        if (count === 0 || selectedWeek?.sticky) return;
                                                        const rect = e.target.getBoundingClientRect();
                                                        setSelectedWeek({
                                                            dateLabel: `${MONTH_NAMES[mObj.monthIndex]} ${d}, ${mObj.year}`,
                                                            dayData: assignments,
                                                            left: rect.left + rect.width / 2,
                                                            top: rect.top,
                                                            type: 'day',
                                                            sticky: false
                                                        });
                                                    }}
                                                    onClick={(e) => {
                                                        if (count === 0) return;
                                                        e.stopPropagation();
                                                        const rect = e.target.getBoundingClientRect();
                                                        setSelectedWeek({
                                                            dateLabel: `${MONTH_NAMES[mObj.monthIndex]} ${d}, ${mObj.year}`,
                                                            dayData: assignments,
                                                            left: rect.left + rect.width / 2,
                                                            top: rect.top,
                                                            type: 'day',
                                                            sticky: true
                                                        });
                                                    }}
                                                    onMouseLeave={() => {
                                                        if (!selectedWeek?.sticky) setSelectedWeek(null);
                                                    }}
                                                >
                                                    {d}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Graphs Section */}
                    <div className="graph-section">
                        {/* Assignment Graph */}
                        <div className="graph-container assignment-graph">
                            {renderAssignmentGraph()}
                            {/* Popover logic... */}
                            {selectedWeek && (() => {
                                // Smart Positioning
                                const viewportWidth = window.innerWidth;
                                const viewportHeight = window.innerHeight;
                                const POPOVER_WIDTH = 300; // Est max width
                                const POPOVER_HEIGHT = 200; // Est height

                                // Horizontal Logic
                                let leftPos = selectedWeek.left;
                                let transformX = '-50%';

                                // Collision Right
                                if (leftPos + (POPOVER_WIDTH / 2) > viewportWidth - 20) {
                                    leftPos = viewportWidth - 20;
                                    transformX = '-100%'; // Anchor right
                                }
                                // Collision Left
                                else if (leftPos - (POPOVER_WIDTH / 2) < 20) {
                                    leftPos = 20;
                                    transformX = '0%'; // Anchor left
                                }

                                // Vertical Logic
                                const isTopConstrained = selectedWeek.top < 250;
                                const transformY = isTopConstrained ? '15px' : '-100%';
                                const verticalOffset = isTopConstrained ? 0 : -10;

                                return (
                                    <div
                                        className={`popover-container popover-visible ${isTopConstrained ? 'popover-bottom' : ''}`}
                                        style={{
                                            position: 'fixed',
                                            left: leftPos,
                                            top: selectedWeek.top,
                                            transform: `translate(${transformX}, ${transformY}) translateY(${verticalOffset}px)`,
                                            zIndex: 1000
                                        }}
                                    >
                                        {selectedWeek.type === 'grade' ? (
                                            <>
                                                <div className="popover-title">Week {selectedWeek.weekIndex + 1} Average</div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#334155', textAlign: 'center' }}>
                                                    {selectedWeek.value}%
                                                </div>
                                            </>
                                        ) : selectedWeek.type === 'completion' ? (
                                            <>
                                                <div className="popover-title">Class Completion</div>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#334155', textAlign: 'center' }}>
                                                    {selectedWeek.value}%
                                                </div>
                                            </>
                                        ) : selectedWeek.type === 'day' ? (
                                            <>
                                                <div className="popover-title">{selectedWeek.dateLabel}</div>
                                                <ul className="popover-list">
                                                    {selectedWeek.dayData.map((t, k) => {
                                                        // Helper to format name/score same as weekly
                                                        let name = t.title || t.activityName || 'Assignment';
                                                        const scoreDisplay = t.percentage !== undefined ? `${t.percentage}%` : (t.score || '-');
                                                        return (
                                                            <li key={k} className="popover-item">
                                                                <div className="popover-bullet" style={{ color: currentSubject.color }}></div>
                                                                {name} ({scoreDisplay})
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </>
                                        ) : (
                                            <>
                                                <div className="popover-title">Week {selectedWeek.weekIndex + 1} Assignments</div>
                                                <ul className="popover-list">
                                                    {assignmentDetails[selectedWeek.weekIndex]?.map((task, k) => (
                                                        <li key={k} className="popover-item">
                                                            <div className="popover-bullet" style={{ color: currentSubject.color }}></div>
                                                            {task}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Behavior Graph - Minimalist Tally */}
                        <div className="graph-container behavior-graph">
                            {/* Small labels relative to this graph */}
                            {renderBehaviorGraph()}
                        </div>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default CalendarModal;
