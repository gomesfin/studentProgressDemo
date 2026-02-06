import React from 'react';
import { createPortal } from 'react-dom';
import VerificationAnalysis from './VerificationAnalysis';

const ImportSummaryModal = ({ isOpen, onClose, summary, onResolveFuzzyMatch, classroomData }) => {
    // Tabs: 'summary' | 'details'
    const [activeTab, setActiveTab] = React.useState('summary');

    // Verification State (Local to this modal)
    const [viewMode, setViewMode] = React.useState('student');
    const [expandedIds, setExpandedIds] = React.useState(new Set());
    const [searchTerm, setSearchTerm] = React.useState('');
    const [activeStudentHomeroomFilter, setActiveStudentHomeroomFilter] = React.useState('ALL');
    const [activeHomeroomFilter, setActiveHomeroomFilter] = React.useState('ALL');
    const [expandedCategories, setExpandedCategories] = React.useState(new Set(['ELA', 'Math', 'Science', 'Social Studies']));
    const [expandedClasses, setExpandedClasses] = React.useState(new Set());
    const [categoryIssueExpanded, setCategoryIssueExpanded] = React.useState(null);

    // Filter Set for Detailed View
    const touchedIds = React.useMemo(() => {
        return summary?.touchedStudentIds ? new Set(summary.touchedStudentIds) : null;
    }, [summary?.touchedStudentIds]);

    if (!isOpen) return null;

    // Helpers
    const toggleExpand = (id) => setExpandedIds(prev => prev.has(id) ? new Set([...prev].filter(x => x !== id)) : new Set([...prev, id]));
    const toggleCategory = (cat) => setExpandedCategories(prev => prev.has(cat) ? new Set([...prev].filter(x => x !== cat)) : new Set([...prev, cat]));
    const toggleClass = (cls) => setExpandedClasses(prev => prev.has(cls) ? new Set([...prev].filter(x => x !== cls)) : new Set([...prev, cls]));
    const toggleCategoryIssue = (cat) => setCategoryIssueExpanded(prev => prev === cat ? null : cat);


    return createPortal(
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content confirmation-modal"
                style={{ maxWidth: activeTab === 'details' ? '900px' : '600px', width: '90%', transition: 'max-width 0.3s' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header with Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>Import Results</h3>
                    <div className="view-toggle" style={{ margin: 0 }}>
                        <button
                            className={`toggle-option ${activeTab === 'summary' ? 'active' : ''}`}
                            onClick={() => setActiveTab('summary')}
                        >
                            Summary
                        </button>
                        <button
                            className={`toggle-option ${activeTab === 'details' ? 'active' : ''}`}
                            onClick={() => setActiveTab('details')}
                            disabled={!summary?.touchedStudentIds || summary.touchedStudentIds.length === 0}
                            title={(!summary?.touchedStudentIds || summary.touchedStudentIds.length === 0) ? "No data to verify" : "Verify changes"}
                        >
                            Detailed Verification
                        </button>
                    </div>
                </div>

                <div className="import-summary-content" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 0.5rem' }}>

                    {activeTab === 'summary' && (
                        <>
                            {/* Summary Stats */}
                            <div style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                                Processed <strong>{summary.totalFiles}</strong> files.
                                {summary.touchedStudentIds && (
                                    <span style={{ marginLeft: '1rem' }}>
                                        Updated <strong>{summary.touchedStudentIds.length}</strong> student records.
                                    </span>
                                )}
                            </div>

                            {/* Dependencies: Re-used original code for success/fuzzy/errors */}
                            {/* Successes */}
                            {summary?.successes?.length > 0 && (
                                <div className="summary-section">
                                    <h4 style={{ color: '#10b981', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Successfully Imported</h4>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {summary?.successes?.map((item, idx) => (
                                            <li key={idx} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', padding: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
                                                <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.studentName}</div>
                                                <div style={{ color: '#94a3b8', fontSize: '0.8em', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>New Data: {item.addedCount} entries</span>
                                                    <span style={{ opacity: 0.7 }}>{item.fileName}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Fuzzy Matches */}
                            {summary?.fuzzyMatches?.length > 0 && (
                                <div className="summary-section" style={{ marginTop: '1rem' }}>
                                    <h4 style={{ color: '#f59e0b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Fuzzy Matches ({summary.fuzzyMatches.length}) - Please Verify</h4>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {summary?.fuzzyMatches?.map((item) => (
                                            <li key={item.id} style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', padding: '8px', marginBottom: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>"{item.importedName}"</span>
                                                        <span style={{ color: '#94a3b8' }}>→</span>
                                                        <span style={{ fontWeight: 600, color: '#fcd34d' }}>{item.matchedName}</span>
                                                    </div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.8em', marginTop: '4px' }}>{item.fileName} <span style={{ opacity: 0.6 }}>(Score: {item.score})</span></div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                                                    <button title="Approve Merge" onClick={() => onResolveFuzzyMatch(item, 'approve')} style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}>✔</button>
                                                    <button title="Deny / Discard" onClick={() => onResolveFuzzyMatch(item, 'deny')} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Errors */}
                            {summary?.errors?.length > 0 && (
                                <div className="summary-section" style={{ marginTop: '1.5rem' }}>
                                    <h4 style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Issues / No Data</h4>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {summary?.errors?.map((item, idx) => (
                                            <li key={idx} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
                                                <div style={{ color: '#e2e8f0' }}>{item.fileName}</div>
                                                <div style={{ color: '#f87171', fontSize: '0.8em' }}>{item.reason}</div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'details' && (
                        <div style={{ marginTop: '1rem' }}>
                            <div className="verification-header" style={{ marginBottom: '1rem' }}>
                                <div className="view-toggle">
                                    <button className={`toggle-option ${viewMode === 'student' ? 'active' : ''}`} onClick={() => setViewMode('student')}>By Student</button>
                                    <button className={`toggle-option ${viewMode === 'class' ? 'active' : ''}`} onClick={() => setViewMode('class')}>By Class</button>
                                </div>
                                <input type="text" placeholder="Search..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ marginLeft: '1rem' }} />
                            </div>

                            <VerificationAnalysis
                                classroomData={classroomData}
                                filterIds={touchedIds} // Key prop: Filters to just imported students
                                viewMode={viewMode}
                                searchTerm={searchTerm}
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
                        </div>
                    )}

                </div>
                <div className="modal-actions">
                    <button className="modal-btn confirm" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImportSummaryModal;
