import React from 'react';
import { createPortal } from 'react-dom';
import './DataVerificationModal.css'; // Reuse styles for now
import VerificationAnalysis from './VerificationAnalysis';

const ProgressHistoryModal = ({ isOpen, onClose, classroomData }) => {
    // Shared State for Visualization
    const [searchTerm, setSearchTerm] = React.useState('');
    const [showMissingOnly, setShowMissingOnly] = React.useState(false);
    const [expandedIds, setExpandedIds] = React.useState(new Set());
    const [viewMode, setViewMode] = React.useState('student'); // 'student' | 'class'
    const [expandedCategories, setExpandedCategories] = React.useState(new Set(['ELA', 'Math', 'Science', 'Social Studies']));
    const [expandedClasses, setExpandedClasses] = React.useState(new Set());
    const [categoryIssueExpanded, setCategoryIssueExpanded] = React.useState(null);
    const [activeHomeroomFilter, setActiveHomeroomFilter] = React.useState('ALL');
    const [activeStudentHomeroomFilter, setActiveStudentHomeroomFilter] = React.useState('ALL');


    // Toggles
    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleCategory = (cat) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };
    const toggleClass = (cls) => {
        setExpandedClasses(prev => {
            const next = new Set(prev);
            if (next.has(cls)) next.delete(cls);
            else next.add(cls);
            return next;
        });
    };
    const toggleCategoryIssue = (cat) => setCategoryIssueExpanded(prev => prev === cat ? null : cat);


    if (!isOpen) return null;

    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content verification-modal" onClick={e => e.stopPropagation()}>
                <div className="verification-header">
                    <h3>Class Progress History</h3>
                    <div className="view-toggle">
                        <button
                            className={`toggle-option ${viewMode === 'student' ? 'active' : ''}`}
                            onClick={() => setViewMode('student')}
                        >
                            By Student
                        </button>
                        <button
                            className={`toggle-option ${viewMode === 'class' ? 'active' : ''}`}
                            onClick={() => setViewMode('class')}
                        >
                            By Class
                        </button>
                    </div>
                </div>

                <div className="verification-controls-col" style={{ padding: '0 1.5rem 1rem' }}>
                    {viewMode === 'student' && (
                        <>
                            <div className="detail-filters" style={{ marginBottom: '1rem' }}>
                                {['ALL', 'science', 'math', 'ela', 'socialStudies'].map(hr => (
                                    <button
                                        key={hr}
                                        className={`detail-filter-pill ${activeStudentHomeroomFilter === hr ? 'active' : ''}`}
                                        onClick={() => setActiveStudentHomeroomFilter(hr)}
                                    >
                                        {hr === 'ALL' ? 'All Homerooms' : `${hr.charAt(0).toUpperCase() + hr.slice(1)} HR`}
                                    </button>
                                ))}
                            </div>
                            <div className="verification-controls">
                                <input type="text" placeholder="Search students..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <button className={`filter-btn-toggle ${showMissingOnly ? 'active' : ''}`} onClick={() => setShowMissingOnly(!showMissingOnly)}>
                                    {showMissingOnly ? 'Show All' : 'Show Issues Only'}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <VerificationAnalysis
                    classroomData={classroomData}
                    viewMode={viewMode}
                    searchTerm={searchTerm}
                    showMissingOnly={showMissingOnly}
                    activeStudentHomeroomFilter={activeStudentHomeroomFilter}
                    activeHomeroomFilter={activeHomeroomFilter}
                    expandedIds={expandedIds}
                    expandedCategories={expandedCategories}
                    expandedClasses={expandedClasses}
                    categoryIssueExpanded={categoryIssueExpanded}
                    onToggleExpand={toggleExpand}
                    onToggleCategory={toggleCategory}
                    onToggleClass={toggleClass}
                    onToggleCategoryIssue={toggleCategoryIssue}
                    setActiveHomeroomFilter={setActiveHomeroomFilter}
                />

                <div style={{ padding: '1rem 1.5rem', textAlign: 'right', borderTop: '1px solid #e2e8f0' }}>
                    <button className="confirm-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProgressHistoryModal;
