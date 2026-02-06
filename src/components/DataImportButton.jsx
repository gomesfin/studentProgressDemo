import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import './DataImportButton.css';

const DataImportButton = ({ onDataImported }) => {
    const fileInputRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importContext, setImportContext] = useState(null);

    const handleFileSelect = (context) => {
        setImportContext(context);
        // Add a small delay to ensure state updates before click (mostly superstitious in React 18 but safe)
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 50);
    };

    const processFile = async (file) => {
        console.log("Processing file:", file.name, "Context:", importContext);
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // ROSTER MODE DETECTION
                    // 1. Explicit Context
                    // 2. Filename contains "roster"
                    const isRoster = importContext === 'roster' || file.name.toLowerCase().includes('roster');

                    if (isRoster) {
                        console.log("Detected Roster Import");
                        const rosterData = {};
                        // Map 4 sheets to subjects. 
                        // If sheets are named "Sheet1", "Sheet2" etc, we assume order: Science, SS, Math, ELA
                        // Or we can try to respect the sheet names if they match? 
                        // Let's stick to the user's known structure: 4 sheets.
                        const subjectKeys = ['science', 'socialStudies', 'math', 'ela'];

                        // Filter out hidden sheets if possible, otherwise just use names
                        // Note: xlsx exposes workbook.Workbook.Sheets for visibility, but standard SheetNames is usually just keys.
                        // Let's rely on logging to help diagnose.

                        const MAX_SHEETS = subjectKeys.length;
                        console.log("Roster Import: Found Sheets:", workbook.SheetNames);

                        for (let i = 0; i < workbook.SheetNames.length; i++) {
                            if (i >= MAX_SHEETS) break; // STRICT STOP

                            const sheetName = workbook.SheetNames[i];
                            const key = subjectKeys[i];
                            console.log(`Mapping Sheet [${i}] '${sheetName}' -> '${key}'`);

                            const sheet = workbook.Sheets[sheetName];
                            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                            const students = [];

                            rows.forEach((row, rowIndex) => {
                                // Skip Row 0 ONLY if it looks like a header
                                if (rowIndex === 0) {
                                    const rowStr = (row || []).join(' ').toLowerCase();
                                    if (rowStr.includes('name') || rowStr.includes('student') || rowStr.includes('last')) {
                                        return;
                                    }
                                }

                                // Col 0 = Last, Col 1 = First
                                const validRow = row && row.length >= 2;
                                if (!validRow) return;

                                const last = String(row[0]).trim();
                                const first = String(row[1]).trim();

                                if (last && first && last.toLowerCase() !== 'last name') {
                                    students.push(`${first} ${last}`);
                                }
                            });

                            if (students.length > 0) {
                                rosterData[key] = students;
                            }
                        }

                        if (Object.keys(rosterData).length === 0) {
                            resolve({ file: file.name, status: 'error', reason: 'No students found in roster' });
                        } else {
                            resolve({
                                file: file.name,
                                status: 'success',
                                type: 'roster',
                                data: rosterData
                            });
                        }
                        return;
                    }

                    // ---- NORMAL PROGRESS REPORT PARSER (Legacy) ----
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    // 2. Extract Metadata
                    // Row 2 (Index 1): "Last, First - NW Class Name"
                    const headerInfo = (jsonData[1] || []).join(' ');
                    // Row 3 (Index 2): "Data is current as of January 27, 2026 07:38 AM"
                    const rawDateStr = (jsonData[2] || [])[0];
                    let dataCurrentAsOf = null;
                    if (rawDateStr && typeof rawDateStr === 'string' && rawDateStr.includes('Data is current as of')) {
                        dataCurrentAsOf = rawDateStr.replace('Data is current as of', '').trim();
                    } else {
                        // V3 Fallback: Use File Metadata if header is missing
                        // This allows drag-and-drop of exported spreadsheets without manual editing
                        if (file.lastModified) {
                            dataCurrentAsOf = new Date(file.lastModified).toISOString();
                            console.log("Using File LastModified Timestamp:", dataCurrentAsOf);
                        }
                    }

                    let studentName = null;
                    let className = 'Unknown Class';

                    if (headerInfo) {
                        const parts = headerInfo.split(' - ');
                        if (parts.length >= 1) studentName = parts[0].trim();
                        if (parts.length >= 2) {
                            let rawClass = parts[1].trim();
                            className = rawClass.replace(/^NW\s+/i, '');
                        }
                    }

                    if (!studentName) {
                        // If we can't find a name, invalid file
                        console.warn("Invalid file structure", file.name);
                        resolve({ file: file.name, status: 'error', reason: 'Invalid file format' });
                        return;
                    }

                    // Parse Assignments (Row 7+)
                    const assignments = [];
                    const rows = jsonData.slice(6);
                    let droppedRows = 0;

                    console.log(`[Parser Debug] Raw Rows Found: ${rows.length}`);

                    rows.forEach((row, idx) => {
                        if (!row || row.length < 1) {
                            droppedRows++;
                            return;
                        }
                        const activity = row[0];
                        const score = row[1];
                        const possible = row[2];
                        const percent = row[3];
                        const dateVal = row[5];

                        // CRITICAL FIX: Capture incomplete assignments for denominator
                        if (activity) {
                            let dateStr = null;
                            if (typeof dateVal === 'number') {
                                const d = XLSX.SSF.parse_date_code(dateVal);
                                dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
                            } else if (typeof dateVal === 'string') dateStr = dateVal;

                            assignments.push({
                                activityName: activity,
                                classTitle: className, // Self-Describing Data
                                score: (score !== undefined && score !== '') ? Number(score) : null,
                                possible: Number(possible) || 0,
                                percentage: Number(percent) || 0,
                                date: dateStr,
                                status: dateStr ? 'Complete' : 'Not Complete'
                            });
                        } else {
                            // Log why we dropped it (First 5 only)
                            if (droppedRows < 5) console.log(`[Parser Drop] Row ${idx + 7} dropped. Activity: '${activity}'. Raw:`, JSON.stringify(row));
                            droppedRows++;
                        }
                    });

                    console.log(`[Parser Result] Assignments Extracted: ${assignments.length}. Dropped: ${droppedRows}`);

                    resolve({
                        file: file.name,
                        status: 'success',
                        studentExcelName: studentName,
                        className: className,
                        entries: assignments, // Contains ALL assignments (complete + incomplete)
                        dataAsOf: dataCurrentAsOf, // Pass explicit timestamp
                        metadata: { lastUpdated: rawDateStr },
                    });

                } catch (error) {
                    console.error("Error processing file:", file.name, error);
                    resolve({ file: file.name, status: 'error', reason: error.message });
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileChange = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsProcessing(true);
        const processingPromises = [];

        for (let i = 0; i < files.length; i++) {
            processingPromises.push(processFile(files[i]));
        }

        try {
            const results = await Promise.all(processingPromises);

            // Fix: Inject the selected context (e.g. 'science', 'math') into the results
            // This prevents App.jsx from guessing the subject if the file header is ambiguous
            const resultsWithContext = results.map(r => ({ ...r, context: importContext }));

            if (onDataImported) {
                onDataImported(resultsWithContext);
            } else {
                console.error("onDataImported prop is missing!");
            }
        } catch (error) {
            console.error("Error importing files", error);
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setImportContext(null);
        }
    };

    return (
        <div className="data-import-container">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
            />

            <button className="import-header-btn" disabled={isProcessing}>
                {isProcessing ? 'SCANNING...' : 'IMPORT DATA'}
                {!isProcessing && <span style={{ fontSize: '1.2em' }}>📥</span>}
            </button>

            {!isProcessing && (
                <div className="import-dropdown-menu">
                    <div className="import-menu-item">
                        <span>Academic</span>
                        <span className="arrow-right">▶</span>
                        <div className="import-submenu">
                            <div className="import-submenu-item item-science" onClick={() => handleFileSelect('science')}>Science</div>
                            <div className="import-submenu-item item-math" onClick={() => handleFileSelect('math')}>Math</div>
                            <div className="import-submenu-item item-social" onClick={() => handleFileSelect('socialStudies')}>Social Studies</div>
                            <div className="import-submenu-item item-english" onClick={() => handleFileSelect('english')}>ELA</div>
                            <div className="import-submenu-item item-electives" onClick={() => handleFileSelect('electives')}>Electives</div>
                        </div>
                    </div>

                    <div className="import-menu-item">
                        <span>Behavioral</span>
                        <span className="arrow-right">▶</span>
                        <div className="import-submenu">
                            <div className="import-submenu-item">Attendance</div>
                            <div className="import-submenu-item">Write-ups</div>
                        </div>
                    </div>

                    <div className="import-menu-item" onClick={() => handleFileSelect('roster')}>
                        <span>Roster</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataImportButton;
