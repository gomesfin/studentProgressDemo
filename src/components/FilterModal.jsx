import React from 'react';
import '../App.css';
import './FilterModal.css';
import { filterStudents, getFilteredAssignmentCount, getFilteredAverage } from '../utils/filterUtils';

const FilterModal = ({ isOpen, room, students = [], currentFilters, onApply, onClose }) => {
    // Initialize local state with current filters
    const [localFilters, setLocalFilters] = React.useState(currentFilters);

    // Compute available classes for the current subject room
    const subjectKey = React.useMemo(() => {
        if (room === 'ela') return 'english';
        // Map other rooms if necessary, but 'science', 'math', 'socialStudies' match keys
        return room;
    }, [room]);

    // Live preview data
    // If a specific class is selected, we disable strict Room Context (subjectKey) so we can see 
    // assignments for that class even if they are from a different subject (e.g. English class in Science room).
    const previewList = React.useMemo(() => {
        const strictContext = localFilters.enrolledClass ? null : subjectKey;
        return filterStudents(students, localFilters, strictContext);
    }, [students, localFilters, subjectKey]);

    // Compute available classes & their subjects (Global Scope)
    const { classList, classSubjectMap } = React.useMemo(() => {
        const classes = new Set();
        const map = {};

        students.forEach(s => {
            if (!s.enrolledClasses) return;

            // Scan ALL enrolled classes (Global Access)
            Object.values(s.enrolledClasses).forEach(cls => {
                if (typeof cls === 'object' && cls.title) {
                    classes.add(cls.title);
                    if (cls.subject) map[cls.title] = cls.subject;
                }
            });
        });
        return {
            classList: Array.from(classes).sort(),
            classSubjectMap: map
        };
    }, [students]); // Removed subjectKey dependency to allow global list

    const handleSortChange = (e) => {
        setLocalFilters(prev => ({ ...prev, sortBy: e.target.value }));
    };

    const handleGradeToggle = (grade) => {
        setLocalFilters(prev => {
            const newGrades = prev.gradeFilter.includes(grade)
                ? prev.gradeFilter.filter(g => g !== grade)
                : [...prev.gradeFilter, grade];
            return { ...prev, gradeFilter: newGrades };
        });
    };

    const handleProgressChange = (e) => {
        setLocalFilters(prev => ({ ...prev, minProgress: parseInt(e.target.value) }));
    };

    const handleAssignmentChange = (e) => {
        setLocalFilters(prev => ({ ...prev, minAssignments: parseInt(e.target.value) }));
    };

    const handleDateChange = (field, value) => {
        setLocalFilters(prev => ({ ...prev, [field]: value || null }));
    };

    const formatHomeroomLabel = (key) => {
        if (!key) return '';
        if (key === 'socialStudies') return 'SOCIAL STUDIES HR';
        return `${key.toUpperCase()} HR`;
    };

    // Calculate dynamic assignment count for display
    const getAssignmentCount = (student) => {
        const strictContext = localFilters.enrolledClass ? null : subjectKey;
        return getFilteredAssignmentCount(student, localFilters.startDate, localFilters.endDate, strictContext, localFilters.enrolledClass);
    };

    const [expandedStudentId, setExpandedStudentId] = React.useState(null);
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        if (previewList.length === 0) return;

        const text = previewList.map(s => {
            const count = getAssignmentCount(s);
            const strictContext = localFilters.enrolledClass ? null : subjectKey;
            const avg = getFilteredAverage(s, localFilters.startDate, localFilters.endDate, strictContext, localFilters.enrolledClass);
            return `${s.name} (${s.grade}) - ${count} completed - Avg: ${avg}%`;
        }).join('\n');

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content filter-modal" onClick={e => e.stopPropagation()}>
                <button className="close-btn-text" onClick={onClose}>Close</button>

                <div className="filter-header">
                    <h3>
                        <span className="homeroom-label">{formatHomeroomLabel(room)}</span>
                    </h3>
                </div>

                <div className="filter-body">
                    {/* Left Column: Controls */}
                    <div className="filter-controls">

                        {/* 1. Time Window */}
                        <div className="filter-row">
                            <div className="filter-group">
                                <label>Time Window</label>
                                <div className="date-row">
                                    <input
                                        type="date"
                                        className="date-input compact"
                                        value={localFilters.startDate || ''}
                                        onChange={(e) => handleDateChange('startDate', e.target.value)}
                                    />
                                    <span style={{ color: '#64748b' }}>-</span>
                                    <input
                                        type="date"
                                        className="date-input compact"
                                        value={localFilters.endDate || ''}
                                        onChange={(e) => handleDateChange('endDate', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Class Filter (Global) */}
                        {classList.length > 0 && (
                            <div className="filter-row">
                                <div className="filter-group">
                                    <label>Class</label>
                                    <select
                                        className="filter-select"
                                        value={localFilters.enrolledClass || ''}
                                        onChange={(e) => {
                                            const cls = e.target.value;
                                            setLocalFilters(prev => ({
                                                ...prev,
                                                enrolledClass: cls,
                                                // If class selected, switch context to that class's subject. 
                                                // If cleared, revert to current room subject (though previewList logic handles the 'null' check).
                                                enrolledSubject: cls ? classSubjectMap[cls] : subjectKey
                                            }));
                                        }}
                                    >
                                        <option value="">All Classes</option>
                                        {classList.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* 3. Grade Filter (Compact) */}
                        <div className="filter-section compact">
                            <label>Grades</label>
                            <div className="grade-checkboxes compact">
                                {['9th', '10th', '11th', '12th'].map(grade => (
                                    <label key={grade} className="checkbox-label compact">
                                        <input
                                            type="checkbox"
                                            checked={localFilters.gradeFilter.includes(grade)}
                                            onChange={() => handleGradeToggle(grade)}
                                        />
                                        {grade}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 4. Academics (Assignments & Progress - Side by Side) */}
                        <div className="filter-row">
                            <div className="filter-group">
                                <label>Min Assignments: {localFilters.minAssignments}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="30"
                                    value={localFilters.minAssignments}
                                    onChange={handleAssignmentChange}
                                    className="filter-range"
                                />
                            </div>
                            <div className="filter-group">
                                <label>Min Avg Grade: {localFilters.minProgress}%</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={localFilters.minProgress}
                                    onChange={handleProgressChange}
                                    className="filter-range"
                                />
                            </div>
                        </div>

                        {/* 5. Behavior (Attendance & Writeups - Side by Side) */}
                        <div className="filter-row">
                            <div className="filter-group">
                                <label>Min Attendance: {localFilters.minAttendance || 0}%</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={localFilters.minAttendance || 0}
                                    onChange={(e) => setLocalFilters(prev => ({ ...prev, minAttendance: parseInt(e.target.value) }))}
                                    className="filter-range"
                                />
                            </div>
                            <div className="filter-group">
                                <label>Max Writeups: {localFilters.maxWriteups !== undefined ? localFilters.maxWriteups : 'Any'}</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    value={localFilters.maxWriteups !== undefined ? localFilters.maxWriteups : 5}
                                    onChange={(e) => setLocalFilters(prev => ({ ...prev, maxWriteups: parseInt(e.target.value) }))}
                                    className="filter-range"
                                />
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Live Preview */}
                    <div className="filter-preview">
                        <div className="preview-header">
                            <div className="preview-title">
                                <span>Live Preview ({previewList.length})</span>
                            </div>

                            <div className="header-controls">
                                <select
                                    value={localFilters.sortBy}
                                    onChange={handleSortChange}
                                    className="sort-select-compact"
                                    title="Sort Order"
                                >
                                    <option value="name">Name (A-Z)</option>
                                    <option value="progress">Avg Grade ↑</option>
                                    <option value="progress_desc">Avg Grade ↓</option>
                                    <option value="assignments">Assign. ↑</option>
                                    <option value="assignments_desc">Assign. ↓</option>
                                </select>

                                <button
                                    className={`copy-btn ${copied ? 'copied' : ''}`}
                                    onClick={handleCopy}
                                    title="Copy list to clipboard"
                                >
                                    {copied ? 'Copied!' : 'Copy List'}
                                </button>
                            </div>
                        </div>
                        <div className="preview-list">
                            {previewList.length === 0 ? (
                                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
                                    No students match these filters.
                                </div>
                            ) : (
                                previewList.map(student => {
                                    const assignmentCount = getAssignmentCount(student);
                                    const strictContext = localFilters.enrolledClass ? null : subjectKey;
                                    const avgProgress = getFilteredAverage(student, localFilters.startDate, localFilters.endDate, strictContext, localFilters.enrolledClass);
                                    const isExpanded = expandedStudentId === student.id;

                                    // Filter assignments for the expanded view
                                    const filteredAssignments = isExpanded ? (student.assignments || []).filter(a => {
                                        if (!a.date) return false; // Hide incomplete
                                        const d = new Date(a.date);
                                        const start = localFilters.startDate ? new Date(localFilters.startDate) : null;
                                        const end = localFilters.endDate ? new Date(localFilters.endDate) : null;
                                        if (start && d < start) return false;
                                        if (end && d > end) return false;
                                        if (strictContext && a.subject && a.subject !== strictContext) return false;
                                        if (localFilters.enrolledClass && a.classTitle !== localFilters.enrolledClass) return false;
                                        return true;
                                    }) : [];

                                    return (
                                        <div
                                            key={student.id}
                                            className={`preview-item ${isExpanded ? 'active' : ''}`}
                                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                                        >
                                            <div className="preview-main-row">
                                                <div>
                                                    <div className="preview-name">{student.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {student.grade} • Avg Grade: {avgProgress}%
                                                    </div>
                                                </div>
                                                <div className="preview-meta">
                                                    <span className="meta-highlight" style={{ fontSize: '1.1rem' }}>
                                                        {assignmentCount}
                                                    </span>
                                                    <span>completed</span>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="preview-details" onClick={e => e.stopPropagation()}>
                                                    <table className="details-table">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '45%' }}>Assignment</th>
                                                                <th style={{ width: '30%' }}>Grade</th>
                                                                <th style={{ width: '25%' }}>Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredAssignments.length > 0 ? (
                                                                filteredAssignments.map((a, idx) => (
                                                                    <tr key={a.id || idx}>
                                                                        <td>{a.title || a.activityName}</td>
                                                                        <td>
                                                                            {a.score}/{a.max_points || a.possible}{' '}
                                                                            <span style={{
                                                                                color: a.percentage >= 70 ? '#10b981' : a.percentage >= 60 ? '#f59e0b' : '#ef4444',
                                                                                marginLeft: '4px'
                                                                            }}>
                                                                                ({a.percentage}%)
                                                                            </span>
                                                                        </td>
                                                                        <td>{a.date}</td>
                                                                    </tr>
                                                                ))
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan="3" style={{ textAlign: 'center', fontStyle: 'italic', padding: '1rem' }}>
                                                                        No assignments found.
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilterModal;
