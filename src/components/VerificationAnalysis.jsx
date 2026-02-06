import React from 'react';
import './DataVerificationModal.css'; // Re-use styles for now

const VerificationAnalysis = ({
    classroomData,
    filterIds = null, // Set of IDs to filter by (optional)
    viewMode = 'student', // 'student' | 'class'
    searchTerm = '',
    showMissingOnly = false,
    activeStudentHomeroomFilter = 'ALL',
    activeHomeroomFilter = 'ALL',
    onToggleExpand,
    expandedIds = new Set(),
    onToggleCategory,
    expandedCategories = new Set(),
    onToggleClass,
    expandedClasses = new Set(),
    onToggleCategoryIssue,
    categoryIssueExpanded = null,
    setActiveHomeroomFilter
}) => {

    // Homeroom Mapping
    const SUBJECT_MAPPING = React.useMemo(() => ({
        'ELA': ['English 10A', 'English 10B', 'English 11A', 'English 9A', 'English  9A', 'English 9B', 'English  9B', 'Media Literacy'],
        'Math': ['Algebra 1A', 'Algebra 1B', 'Algebra 2A', 'Algebra 2B', 'Geometry A', 'Geometry B', 'Mathematics of Personal Finance A'],
        'Science': ['Biology A', 'Biology B', 'Environmental Science A', 'Environmental Science B', 'Physical Science A', 'Physical Science B'],
        'Social Studies': ['U.S. Government', 'Multicultural Studies', 'U.S. History since the Civil War A', 'U.S. History since the Civil War B', 'Modern World History from 1600 A', 'World History A'],
        'Electives': ['Art Appreciation', 'College and Career Preparation I', 'Financial Literacy', 'Health', 'Musical Appreciation', 'Physical Education']
    }), []);

    // 1. Aggregation Logic
    const { studentList, classHierarchy } = React.useMemo(() => {
        const studentMap = new Map();

        // Flatten Students & Tag Homeroom
        Object.keys(classroomData || {}).forEach(room => {
            classroomData[room].forEach(student => {
                // FILTER: Only include if filterIds is null OR student is in filterIds
                if (filterIds && !filterIds.has(student.id)) return;

                if (!studentMap.has(student.id)) {
                    // Tagging homeroom for filter later
                    studentMap.set(student.id, { ...student, homeroom: room });
                }
            });
        });

        const analyzedStudents = Array.from(studentMap.values()).map(student => {
            const classes = [];
            let totalMissing = 0;
            let totalPartial = 0;
            const enrollments = student.enrolledClasses || {};

            Object.keys(enrollments).forEach(subKey => {
                if (subKey === 'metadata') return;

                // STRICT FILTER BUG FIX:
                // Only include assignments that actually belong to this class title.
                // Otherwise multiple classes in same subject (e.g. PE + Science) get merged.
                const targetClassTitle = (typeof enrollments[subKey] === 'object') ? enrollments[subKey].title : null;

                const subAssignments = (student.assignments || []).filter(a => {
                    if (targetClassTitle && a.classTitle) {
                        // Loose match to handle "Physical Science" vs "Physical Science A" inconsistencies if any, 
                        // but ideally strict. Let's try Strict first, or normalization.
                        return a.classTitle === targetClassTitle;
                    }
                    return a.subject === subKey;
                });

                // FIX: Count only COMPLETED assignments (numerator)
                const count = subAssignments.filter(a => a.status === 'Complete' || a.date).length;

                let status = 'good';
                if (count === 0) {
                    status = 'missing';
                    totalMissing++;
                } else if (count < 5) {
                    status = 'partial';
                    totalPartial++;
                }

                let dateRange = 'No Data';
                if (count > 0) {
                    const validDates = subAssignments
                        .map(a => new Date(a.date))
                        .filter(d => !isNaN(d.getTime()) && d.getFullYear() > 2000);

                    if (validDates.length > 0) {
                        const min = new Date(Math.min(...validDates));
                        const max = new Date(Math.max(...validDates));
                        dateRange = `${min.toLocaleDateString()} - ${max.toLocaleDateString()}`;
                    }
                }

                // Metadata Extraction
                const meta = (enrollments.metadata && enrollments.metadata[subKey]) || {};
                const lastUpdated = meta.lastUpdated || 'N/A';
                const importedAt = meta.importedAt ? new Date(meta.importedAt).toLocaleString() : 'N/A';

                const enrolData = enrollments[subKey];
                const className = (enrolData && typeof enrolData === 'object') ? enrolData.title : enrolData;

                // FIX: Calculate Total Possible directly from the strictly filtered list.
                // Previously calculated separately using loose 'subject' matching, which fails when subKey is a specific Title.
                const totalPossible = subAssignments.length;

                // Check Completion (TRUE Logic based on Curriculum Framework)
                // We compare student's assignment count against the class's Total Curriculum
                // We also require all present assignments to be 'Complete' (quality check)
                // If totalPossible is 0, we can't determine completion safely, so false.
                const isCompleted = totalPossible > 0 && count >= totalPossible && subAssignments.every(a => a.status === 'Complete');

                classes.push({
                    subject: subKey,
                    name: className,
                    count,
                    totalPossible,
                    status, // 'good', 'partial', 'missing' (Health)
                    isCompleted, // NEW: Archive Flag
                    dateRange,
                    lastUpdated,
                    importedAt
                });
            });

            let health = 'good';
            if (totalMissing > 0) health = 'missing';
            else if (totalPartial > 0) health = 'partial';

            // Split for UI
            const activeClasses = classes.filter(c => !c.isCompleted);
            const completedClasses = classes.filter(c => c.isCompleted);

            return { ...student, classes, activeClasses, completedClasses, health };
        });

        // Hierarchy Aggregation
        const hierarchy = {};
        Object.keys(SUBJECT_MAPPING).forEach(category => {
            const studentsWithCategoryIssues = analyzedStudents.filter(s => {
                const catClasses = s.classes.filter(c => SUBJECT_MAPPING[category].includes(c.name));
                return catClasses.length > 0 && catClasses.every(c => c.status === 'missing');
            });

            hierarchy[category] = {
                subjects: {},
                categoryIssues: studentsWithCategoryIssues
            };

            SUBJECT_MAPPING[category].forEach(subjectName => {
                const enrolledStudents = analyzedStudents.filter(s =>
                    s.classes.some(c => c.name === subjectName)
                );

                if (enrolledStudents.length > 0) {
                    const enrolledDetails = enrolledStudents.map(s => {
                        const cls = s.classes.find(c => c.name === subjectName);
                        return {
                            ...s,
                            classStatus: cls.status,
                            classDateRange: cls.dateRange
                        };
                    });

                    hierarchy[category].subjects[subjectName] = {
                        totalEnrolled: enrolledStudents.length,
                        students: enrolledDetails
                    };
                }
            });
        });

        return { studentList: analyzedStudents, classHierarchy: hierarchy };
    }, [classroomData, SUBJECT_MAPPING, filterIds]);

    // 2. Filter & Sort (Student View)
    const filteredStudentList = React.useMemo(() => {
        let list = studentList.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (activeStudentHomeroomFilter !== 'ALL') {
            list = list.filter(s => s.homeroom === activeStudentHomeroomFilter);
        }

        if (showMissingOnly) {
            list = list.filter(s => s.health === 'missing' || s.health === 'partial');
        }
        list.sort((a, b) => {
            const score = s => (s.health === 'missing' ? 0 : s.health === 'partial' ? 1 : 2);
            return score(a) - score(b);
        });
        return list;
    }, [studentList, searchTerm, showMissingOnly, activeStudentHomeroomFilter]);


    return (
        <div className="verification-body">
            {viewMode === 'student' ? (
                <>
                    <div className="verification-list">
                        {/* Controls are moved out or passed in? 
                             The original had them *above* the list but inside the body div. 
                             Let's assume the parent handles the layout of controls if needed, 
                             OR we render them here if this component owns the body. 
                             
                             Wait, the original layout had:
                             Body -> { Controls-Col, List }
                             Let's keep that structure.
                         */}

                        {filteredStudentList.map(student => (
                            <div key={student.id} className="student-verification-row">
                                <div className="student-row-header" onClick={() => onToggleExpand(student.id)}>
                                    <div className="student-info">
                                        <h4>{student.name}</h4>
                                        <span>
                                            {student.grade} • {student.activeClasses.length} Active / {student.classes.length} Total
                                            {student.completedClasses.length > 0 && <span style={{ color: '#10b981', marginLeft: '8px' }}>• {student.completedClasses.length} Completed</span>}
                                        </span>
                                    </div>
                                    <div className="health-status-row">
                                        {/* Layout: If > 4 classes, show 5th on left. Others in 2x2 grid. */}
                                        {(() => {
                                            const cards = student.activeClasses;
                                            const hasFifth = cards.length > 4;
                                            const mainCards = cards.slice(0, 4);
                                            const fifthCard = hasFifth ? cards[4] : null;

                                            const formatDate = (dateStr) => {
                                                if (!dateStr || dateStr === 'N/A') return '-';
                                                try {
                                                    // dateStr might be '1/27/2026 07:38 AM' or ISO
                                                    const d = new Date(dateStr);
                                                    if (isNaN(d.getTime())) return dateStr;
                                                    // MM/DD/YY
                                                    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
                                                } catch (e) { return dateStr; }
                                            };

                                            const Card = ({ cls }) => (
                                                <div className="mini-status-pill" title={`last updated on ${cls.lastUpdated}`}>
                                                    <span className={`status-dot ${cls.status}`}></span>
                                                    <span className="subj-code">{cls.subject.substring(0, 3).toUpperCase()}</span>
                                                    <span className="time-ago">{formatDate(cls.lastUpdated)}</span>
                                                </div>
                                            );

                                            return (
                                                <div className="status-layout-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {fifthCard && (
                                                        <div className="fifth-card-col">
                                                            <Card cls={fifthCard} />
                                                        </div>
                                                    )}
                                                    <div className="main-status-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                                        {mainCards.map(cls => <Card key={cls.subject} cls={cls} />)}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                {(expandedIds.has(student.id) || showMissingOnly) && (
                                    <div className="student-classes-list-view">
                                        {/* ACTIVE CLASSES */}
                                        <h5 style={{ margin: '0.5rem 0', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Courses</h5>
                                        <table className="history-table">
                                            <thead>
                                                <tr>
                                                    <th>Class Name</th>
                                                    <th>Status (Completed / Total)</th>
                                                    <th>Date Range</th>
                                                    <th>Last Update (File)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {student.activeClasses.map(cls => {
                                                    const pct = cls.totalPossible > 0 ? Math.round((cls.count / cls.totalPossible) * 100) : 0;
                                                    return (
                                                        <tr key={cls.subject} className={`history-row ${cls.status}`}>
                                                            <td className="cell-name">
                                                                <div className="cls-name">{cls.name}</div>
                                                                <div className="cls-subj">{cls.subject}</div>
                                                            </td>
                                                            <td className="cell-status">
                                                                <span className={`status-badge ${cls.status}`}>
                                                                    {cls.count} / {cls.totalPossible || '?'} ({pct}%)
                                                                </span>
                                                            </td>
                                                            <td className="cell-range">{cls.dateRange}</td>
                                                            <td className="cell-meta">
                                                                <div className="meta-date">{cls.lastUpdated}</div>
                                                                <div className="meta-import">Imported: {cls.importedAt}</div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {student.activeClasses.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: '#cbd5e1' }}>No active courses</td></tr>}
                                            </tbody>
                                        </table>

                                        {/* COMPLETED CLASSES */}
                                        {student.completedClasses.length > 0 && (
                                            <>
                                                <h5 style={{ margin: '1rem 0 0.5rem', color: '#10b981', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completed Courses</h5>
                                                {/* Removed opacity: 0.8 per user request for visibility */}
                                                <table className="history-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Class Name</th>
                                                            <th>Status</th>
                                                            <th>Date Range</th>
                                                            <th>Last Update (File)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {student.completedClasses.map(cls => (
                                                            <tr key={cls.subject} className={`history-row completed`} style={{ background: '#f0fdf4' }}>
                                                                <td className="cell-name">
                                                                    <div className="cls-name" style={{ color: '#166534', fontWeight: 600 }}>{cls.name}</div>
                                                                    <div className="cls-subj" style={{ color: '#334155' }}>{cls.subject}</div>
                                                                </td>
                                                                <td className="cell-status">
                                                                    <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #15803d', fontWeight: 700 }}>COMPLETED</span>
                                                                </td>
                                                                {/* Darkened text colors to #334155 (Slate-700) matching headers */}
                                                                <td className="cell-range" style={{ color: '#334155', fontWeight: 500 }}>{cls.dateRange}</td>
                                                                <td className="cell-meta">
                                                                    <div className="meta-date" style={{ color: '#334155', fontWeight: 500 }}>{cls.lastUpdated}</div>
                                                                    <div className="meta-import" style={{ color: '#475569' }}>Imported: {cls.importedAt}</div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {filteredStudentList.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No students found matching criteria.</div>}
                    </div>
                </>
            ) : (
                <div className="class-hierarchy-view">
                    {Object.entries(classHierarchy).map(([category, data]) => (
                        <div key={category} className="category-block">
                            <div className="category-header">
                                <div className="cat-title-group" onClick={() => onToggleCategory(category)}>
                                    <span className={`chevron ${expandedCategories.has(category) ? 'open' : ''}`}>▼</span>
                                    <h4 className="category-title-text">{category}</h4>
                                </div>

                                {/* Category Issue Badge */}
                                {data.categoryIssues.length > 0 && (
                                    <div
                                        className="category-issue-badge"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleCategoryIssue(category);
                                        }}
                                    >
                                        ⚠️ {data.categoryIssues.length} Students with Missing Data
                                    </div>
                                )}
                            </div>

                            {/* Issues Expansion - Phase 3 UI Update */}
                            {categoryIssueExpanded === category && data.categoryIssues.length > 0 && (
                                <div className="category-issues-panel">
                                    <h5>Students missing data for ALL {category} classes:</h5>

                                    {/* Filter Tabs for Issue List */}
                                    <div className="detail-filters">
                                        {['ALL', 'science', 'math', 'ela', 'socialStudies'].map(hr => (
                                            <button
                                                key={hr}
                                                className={`detail-filter-pill ${activeHomeroomFilter === hr ? 'active' : ''}`}
                                                onClick={() => setActiveHomeroomFilter(hr)}
                                            >
                                                {hr === 'ALL' ? 'All Homerooms' : `${hr.charAt(0).toUpperCase() + hr.slice(1)} HR`}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Detailed Issue Table */}
                                    <div className="detail-student-table">
                                        <div className="table-header">
                                            <span>Student</span>
                                            <span>Homeroom</span>
                                            <span>Status</span>
                                            <span>Items</span>
                                        </div>
                                        {data.categoryIssues
                                            .filter(s => activeHomeroomFilter === 'ALL' || s.homeroom === activeHomeroomFilter)
                                            .map(s => (
                                                <div key={s.id} className="table-row">
                                                    <span className="row-name">{s.name}</span>
                                                    <span className="row-hr">{s.homeroom}</span>
                                                    <span className="row-status missing">Missing All Data</span>
                                                    <span className="row-date">0 Items / {s.classes.filter(c => SUBJECT_MAPPING[category].includes(c.name)).length} Classes</span>
                                                </div>
                                            ))}
                                        {data.categoryIssues.filter(s => activeHomeroomFilter === 'ALL' || s.homeroom === activeHomeroomFilter).length === 0 && (
                                            <div className="empty-table-msg">No students found for this filter.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Class List */}
                            {expandedCategories.has(category) && (
                                <div className="category-subjects">
                                    {Object.entries(data.subjects).length === 0 ? (
                                        <div className="empty-category">No enrolled classes found</div>
                                    ) : (
                                        Object.entries(data.subjects).map(([subjectName, classData]) => (
                                            <div key={subjectName} className="subject-container">
                                                <div className="subject-header-row" onClick={() => onToggleClass(subjectName)}>
                                                    <div className="subject-name-block">
                                                        <h5>{subjectName}</h5>
                                                    </div>
                                                    <div className="enrollment-pill">{classData.totalEnrolled} Enrolled</div>
                                                </div>

                                                {/* Details Expansion */}
                                                {expandedClasses.has(subjectName) && (
                                                    <div className="class-detailed-view">
                                                        <div className="detail-filters">
                                                            {['ALL', 'science', 'math', 'ela', 'socialStudies'].map(hr => (
                                                                <button
                                                                    key={hr}
                                                                    className={`detail-filter-pill ${activeHomeroomFilter === hr ? 'active' : ''}`}
                                                                    onClick={() => setActiveHomeroomFilter(hr)}
                                                                >
                                                                    {hr === 'ALL' ? 'All Homerooms' : `${hr.charAt(0).toUpperCase() + hr.slice(1)} HR`}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        <div className="detail-student-table">
                                                            <div className="table-header">
                                                                <span>Student</span>
                                                                <span>Homeroom</span>
                                                                <span>Status</span>
                                                                <span>Date Range</span>
                                                            </div>
                                                            {classData.students
                                                                .filter(s => activeHomeroomFilter === 'ALL' || s.homeroom === activeHomeroomFilter)
                                                                .map(s => (
                                                                    <div key={s.id} className="table-row">
                                                                        <span className="row-name">{s.name}</span>
                                                                        <span className="row-hr">{s.homeroom}</span>
                                                                        <span className={`row-status ${s.classStatus}`}>
                                                                            {s.classStatus === 'missing' ? 'Missing' : s.classStatus === 'partial' ? 'Partial' : 'Good'}
                                                                        </span>
                                                                        <span className="row-date">{s.classDateRange}</span>
                                                                    </div>
                                                                ))}
                                                            {classData.students.filter(s => activeHomeroomFilter === 'ALL' || s.homeroom === activeHomeroomFilter).length === 0 && (
                                                                <div className="empty-table-msg">No students found for this filter.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default VerificationAnalysis;
