import React from 'react';
import { createPortal } from 'react-dom';
import ClassroomGrid from './components/ClassroomGrid';
import { classrooms } from './data/mockData';
import CalendarModal from './components/CalendarModal';
import ConfirmationModal from './components/ConfirmationModal';
import FilterModal from './components/FilterModal';
import { filterStudents } from './utils/filterUtils';
import { packStudents } from './utils/layoutUtils';
import filterIcon from './assets/filter-icon.png';
import DataImportButton from './components/DataImportButton';
import ImportSummaryModal from './components/ImportSummaryModal';
import ProgressHistoryModal from './components/ProgressHistoryModal';
import ContextMenu from './components/ContextMenu';
import './App.css';
import { fetchClassroomData, updateStudentPosition, syncStudent, syncAssignments, deleteStudent, ensureSubjectsExist, syncStudentsBatch, syncAssignmentsBatch, processStudentData, HIERARCHY } from './services/api';
import { supabase } from './supabaseClient';

import Login from './components/Login';

function App() {
  // Helper to initialize positions (Spiral)
  const initializePositions = (data) => {
    const newData = { ...data };
    Object.keys(newData).forEach(room => {
      const mockWidth = 500;
      const mockHeight = 250;
      newData[room] = packStudents(newData[room], mockWidth, mockHeight);
    });
    return newData;
  };

  const [classroomData, setClassroomData] = React.useState({ science: [], math: [], ela: [], socialStudies: [] });
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [importSuccess, setImportSuccess] = React.useState(false);

  // Auth Subscription
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initial Load
  React.useEffect(() => {
    if (!session) return; // Only load if session exists
    const loadData = async () => {
      // Ensure DB Structure (Self-healing Schema)
      await ensureSubjectsExist();

      const data = await fetchClassroomData();
      if (data) {
        const packed = initializePositions(data);
        const deduped = performDeduplication(packed);
        setClassroomData(deduped);
      } else {
        // Fallback: Use EMPTY state, do NOT use mock data.
        // const inited = initializePositions(classrooms); // DISABLED MOCK FALLBACK
        const inited = initializePositions({ science: [], math: [], ela: [], socialStudies: [], electives: [] });
        const deduped = performDeduplication(inited);
        setClassroomData(deduped);
      }
      setLoading(false);
    };
    loadData();
  }, [session]); // Add session dependency

  // REALTIME SUBSCRIPTION
  React.useEffect(() => {
    if (!session) return; // Only subscribe if session exists

    const channel = supabase
      // ... existing logic ...
      .channel('public:students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, (payload) => {
        // console.log('RT Update:', payload);
        const { eventType, new: newRec, old: oldRec } = payload;

        setClassroomData(prev => {
          const newState = { ...prev };
          let changed = false;

          // UPDATE STATE LOGIC
          const roomKey = newRec?.homeroom || 'science'; // Default fallback

          if (eventType === 'INSERT') {
            // Avoid adding if already exists (local optimization check)
            let exists = false;
            Object.values(newState).forEach(room => {
              if (room.some(s => s.id === newRec.id)) exists = true;
            });

            if (!exists) {
              // Formatting needs to match frontend object structure (camelCase vs snake_case)
              // We might need a mapper here. Ideally API usually handles this.
              // For quick prototype, we assume the DB data (snake_case) might need mapping.
              // However, fetchClassroomData does mapping. Let's reuse a small mapper or standard object.
              const mappedStudent = {
                id: newRec.id,
                name: newRec.name,
                grade: newRec.grade,
                x: Number(newRec.x),
                y: Number(newRec.y),
                manual: newRec.manual_position,
                enrolledClasses: newRec.enrolled_classes || {},
                progress: newRec.progress || {},
                assignments: [], // New student via RT has no assignments loaded yet (requires separate RT for assignments or fetch)
                assignmentsCompleted: 0
              };

              if (!newState[roomKey]) newState[roomKey] = [];
              newState[roomKey] = [...newState[roomKey], mappedStudent];
              changed = true;
            }
          } else if (eventType === 'UPDATE') {
            // Find and Update
            Object.keys(newState).forEach(r => {
              const idx = newState[r].findIndex(s => s.id === newRec.id);
              if (idx !== -1) {
                // Preserve assignments if not provided in payload
                const existing = newState[r][idx];
                newState[r][idx] = {
                  ...existing,
                  name: newRec.name,
                  grade: newRec.grade,
                  x: Number(newRec.x),
                  y: Number(newRec.y),
                  manual: newRec.manual_position,
                  enrolledClasses: newRec.enrolled_classes || existing.enrolledClasses,
                  progress: newRec.progress || existing.progress
                  // assignments preserved
                };

                // Handle Room Change?
                if (newRec.homeroom && newRec.homeroom !== r) {
                  // Remove from old room, add to new
                  const mover = newState[r][idx]; // updated
                  newState[r] = newState[r].filter(s => s.id !== newRec.id);
                  if (!newState[newRec.homeroom]) newState[newRec.homeroom] = [];
                  newState[newRec.homeroom].push(mover);
                }
                changed = true;
              }
            });
          } else if (eventType === 'DELETE') {
            Object.keys(newState).forEach(r => {
              const preLen = newState[r].length;
              newState[r] = newState[r].filter(s => s.id !== oldRec.id);
              if (newState[r].length !== preLen) changed = true;
            });
          }

          return changed ? newState : prev;
        });

        // Trigger repack if needed? (optional, maybe too jumping)
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Deduplication Helper - Run once on mount or when data significantly changes?
  // We'll run it inside the effect above effectively by preprocessing 'final'.
  const performDeduplication = (data) => {
    const cleanedData = { ...data };
    let removedTotal = 0;

    Object.keys(cleanedData).forEach(room => {
      const students = cleanedData[room];
      // Group by Name Lowercase
      const nameMap = {};
      students.forEach(s => {
        const key = s.name.trim().toLowerCase();
        if (!nameMap[key]) nameMap[key] = [];
        nameMap[key].push(s);
      });

      const uniqueStudents = [];
      Object.keys(nameMap).forEach(key => {
        const group = nameMap[key];
        if (group.length === 1) {
          uniqueStudents.push(group[0]);
        } else {
          // DUPLICATE DETECTED - RESOLVE
          // Strategy: Keep the one with most assignments, then most progress, then new ID
          // Sort descending by value
          group.sort((a, b) => {
            const aCount = a.assignmentsCompleted || a.assignments?.length || 0;
            const bCount = b.assignmentsCompleted || b.assignments?.length || 0;
            if (aCount !== bCount) return bCount - aCount;
            return 0;
          });

          // Keep index 0
          const winner = group[0];
          uniqueStudents.push(winner);

          // Delete losers
          for (let i = 1; i < group.length; i++) {
            deleteStudent(group[i].id);
            removedTotal++;
          }
        }
      });
      cleanedData[room] = uniqueStudents;
    });

    if (removedTotal > 0) {
      console.log(`Deduplication: Removed ${removedTotal} duplicate student records.`);
    }
    return cleanedData;
  };



  const [currentSemester, setCurrentSemester] = React.useState('FALL_2025');
  const [selectedStudentSubject, setSelectedStudentSubject] = React.useState(null);

  // Ref to track classroomData for event listeners without triggering re-effects
  const classroomDataRef = React.useRef(classroomData);
  React.useEffect(() => {
    classroomDataRef.current = classroomData;
  }, [classroomData]);

  const [activeDragQuadrant, setActiveDragQuadrant] = React.useState(null);

  // Confirmation Modal State
  const [pendingMove, setPendingMove] = React.useState(null);

  // Refs for drop zones
  const scienceRef = React.useRef(null);
  const mathRef = React.useRef(null);
  const elaRef = React.useRef(null);
  const socialRef = React.useRef(null);

  const handleSubjectClick = (student, subject) => {
    setSelectedStudentSubject({ student, subject });
  };

  const handleCloseModal = () => {
    setSelectedStudentSubject(null);
  };

  // Delete & Notification State
  const [contextMenu, setContextMenu] = React.useState(null); // { x, y, options }
  const [pendingDelete, setPendingDelete] = React.useState(null); // { student, room }

  const handleManualDelete = (room, studentId) => {
    // Optimistic update
    setClassroomData(prev => {
      const newData = { ...prev };
      if (newData[room]) {
        newData[room] = newData[room].filter(s => s.id !== studentId);
      }
      return newData;
    });
    // API Call
    deleteStudent(studentId);
  };

  const confirmDelete = () => {
    if (pendingDelete) {
      handleManualDelete(pendingDelete.room, pendingDelete.student.id);
      setPendingDelete(null);
    }
  };

  const handleCardContextMenu = (e, student, room) => {
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      options: [
        {
          label: 'Delete Student',
          danger: true,
          icon: '🗑️',
          onClick: () => setPendingDelete({ student, room })
        }
      ]
    });
  };

  const handleDragStart = (quadrant) => {
    setActiveDragQuadrant(quadrant);
  };

  const handleDragStop = () => {
    setActiveDragQuadrant(null);
  };

  // Drag Drop Logic (Centralized)
  const handleStudentDrop = (student, coords, cardRect) => {
    const { x, y } = coords;

    // Helper to check if point is in rect

    const isInside = (rect) => {
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      return inside;
    };

    let targetRoom = null;
    let targetRef = null;

    if (scienceRef.current && isInside(scienceRef.current.getBoundingClientRect())) { targetRoom = 'science'; targetRef = scienceRef; }
    else if (mathRef.current && isInside(mathRef.current.getBoundingClientRect())) { targetRoom = 'math'; targetRef = mathRef; }
    else if (elaRef.current && isInside(elaRef.current.getBoundingClientRect())) { targetRoom = 'ela'; targetRef = elaRef; }
    else if (socialRef.current && isInside(socialRef.current.getBoundingClientRect())) { targetRoom = 'socialStudies'; targetRef = socialRef; }

    console.log('Target Room Detected:', targetRoom);

    if (targetRoom) {
      // Find current room of student
      let currentRoom = null;
      Object.keys(classroomData).forEach(room => {
        if (classroomData[room].find(s => s.id === student.id)) {
          currentRoom = room;
        }
      });
      console.log('Current Room:', currentRoom);

      if (currentRoom && currentRoom !== targetRoom && targetRef.current) {
        console.log('Cross-room move initiated.');
        // Cross-room transfer DETECTED - Display Confirmation
        const containerRect = targetRef.current.getBoundingClientRect();
        const headerOffset = 60;
        const paddingOffset = 16;

        let newX = cardRect.left - containerRect.left - paddingOffset;
        let newY = cardRect.top - containerRect.top - headerOffset;

        // Enforce boundaries within the new room
        const CARD_WIDTH = 125;
        const CARD_HEIGHT = 44;

        const maxX = containerRect.width - CARD_WIDTH - paddingOffset;
        const maxY = containerRect.height - headerOffset - CARD_HEIGHT - paddingOffset;

        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        setPendingMove({
          student,
          currentRoom,
          targetRoom,
          newX,
          newY
        });
      } else if (currentRoom === targetRoom && targetRef.current) {
        console.log('Same room move. Updating position.');
        // Same room drop - just update position (No confirmation needed)
        const containerRect = targetRef.current.getBoundingClientRect();
        const headerOffset = 60;
        const paddingOffset = 16;

        let newX = cardRect.left - containerRect.left - paddingOffset;
        let newY = cardRect.top - containerRect.top - headerOffset;

        // Use raw coordinates for free movement, just clamp to container
        const maxX = containerRect.width - cardRect.width - paddingOffset;
        const maxY = containerRect.height - headerOffset - cardRect.height - paddingOffset;

        // Debug calc
        // console.log('Calc pos:', { cardLeft: cardRect.left, contLeft: containerRect.left, newX, maxX });

        const updatedStudent = {
          ...student,
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
          manual: true // Mark as manually positioned
        };

        setClassroomData(prev => {
          const newData = { ...prev };
          newData[currentRoom] = newData[currentRoom].map(s => s.id === student.id ? updatedStudent : s);
          return newData;
        });

        // Sync to Supabase
        updateStudentPosition(updatedStudent);

        // Force re-render/reset ONLY if we need to snap to a grid (which we don't anymore)
        // OR if we want to sync state. But react-draggable overrides visual anyway.
        // removing setResetKeys here PREVENTS the jump/collapse on double-click (micro-drag).
        // setResetKeys(prev => ({ ...prev, [currentRoom]: prev[currentRoom] + 1 }));
      }
    } else {
      console.log('Invalid drop (outside any room). Resetting.');
      // Invalid drop
      setResetKeys(prev => ({
        science: prev.science + 1,
        math: prev.math + 1,
        ela: prev.ela + 1,
        socialStudies: prev.socialStudies + 1
      }));
    }
  };

  const confirmMove = () => {
    if (!pendingMove) return;

    const { student, currentRoom, targetRoom, newX, newY } = pendingMove;

    setClassroomData(prev => {
      const newData = { ...prev };
      newData[currentRoom] = newData[currentRoom].filter(s => s.id !== student.id);
      const updatedStudent = { ...student, x: newX, y: newY, manual: true }; // Mark as manual
      newData[targetRoom] = [...newData[targetRoom], updatedStudent];
      return newData;
    });

    setPendingMove(null);
  };

  const cancelMove = () => {
    setPendingMove(null);
    setResetKeys(prev => ({
      science: prev.science + 1,
      math: prev.math + 1,
      ela: prev.ela + 1,
      socialStudies: prev.socialStudies + 1
    })); // Snap back all to be safe
  };

  const [resetKeys, setResetKeys] = React.useState({
    science: 0,
    math: 0,
    ela: 0,
    socialStudies: 0,
    electives: 0
  });

  const getQuadrantStyle = (quadrantName) => {
    return activeDragQuadrant === quadrantName ? { zIndex: 1000 } : {};
  };

  // Seating Arrangement State
  const [savedLayouts, setSavedLayouts] = React.useState({
    science: null,
    math: null,
    ela: null,
    socialStudies: null,
    electives: null
  });

  const handleSaveLayout = (room) => {
    const layout = {};
    classroomData[room].forEach(student => {
      layout[student.id] = { x: student.x, y: student.y };
    });
    setSavedLayouts(prev => ({ ...prev, [room]: layout }));
  };

  const handleRestoreLayout = (room) => {
    const layout = savedLayouts[room];
    if (!layout) return;

    setClassroomData(prev => {
      const newData = { ...prev };
      newData[room] = newData[room].map(student => {
        if (layout[student.id]) {
          return { ...student, x: layout[student.id].x, y: layout[student.id].y, manual: true };
        }
        return student;
      });
      return newData;
    });
    setResetKeys(prev => ({ ...prev, [room]: prev[room] + 1 })); // Only re-render this room
  };

  // SeatingControls moved to module scope to avoid shadowing and allow cleaner implementation


  // Helper to format room name for display
  const formatRoomName = (key) => {
    if (key === 'socialStudies') return 'Social S. HR';
    return key.charAt(0).toUpperCase() + key.slice(1) + ' HR';
  };

  // Filter State
  const [filterState, setFilterState] = React.useState({
    science: { sortBy: 'name', gradeFilter: [], minProgress: 0, minAssignments: 0, startDate: null, endDate: null },
    math: { sortBy: 'name', gradeFilter: [], minProgress: 0, minAssignments: 0, startDate: null, endDate: null },
    ela: { sortBy: 'name', gradeFilter: [], minProgress: 0, minAssignments: 0, startDate: null, endDate: null },
    socialStudies: { sortBy: 'name', gradeFilter: [], minProgress: 0, minAssignments: 0, startDate: null, endDate: null },
    electives: { sortBy: 'name', gradeFilter: [], minProgress: 0, minAssignments: 0, startDate: null, endDate: null }
  });

  const [activeFilterModal, setActiveFilterModal] = React.useState(null);

  // Import Summary State
  const [importSummary, setImportSummary] = React.useState(null); // { successes: [], errors: [], totalFiles: 0 }
  const [activeVerificationModal, setActiveVerificationModal] = React.useState(false);

  // Checking if a room has active filters (to decide visual mode)
  const isFiltered = (room) => {
    const f = filterState[room];
    return f.sortBy !== 'name' || f.gradeFilter.length > 0 || f.minProgress > 0 || f.minAssignments > 0 || f.startDate || f.endDate;
  };

  const handleApplyFilter = (room, newFilters) => {
    setFilterState(prev => ({ ...prev, [room]: newFilters }));
    setActiveFilterModal(null);
  };

  const getDisplayData = (room) => {
    const rawStudents = classroomData[room];
    const f = filterState[room];

    // Use shared filter logic
    const filtered = filterStudents(rawStudents, f);

    // Dynamic repack for filtered view to look nice
    if (isFiltered(room)) {
      return packStudents(filtered, 380, 320);
    }

    return filtered;
  };

  /* Self-Correcting Layout Effect (Spiral on Resize) */
  React.useEffect(() => {
    const handleResize = () => {
      // Measure one quadrant to get current dimensions
      if (!scienceRef.current) return;

      const containerRect = scienceRef.current.getBoundingClientRect();
      if (containerRect.width === 0) return;

      const currentData = classroomDataRef.current;
      const newClassroomData = { ...currentData };
      let hasChanges = false;

      Object.keys(newClassroomData).forEach(room => {
        // Repack all students in this room
        const currentStudents = newClassroomData[room];
        const packedStudents = packStudents(currentStudents, containerRect.width, containerRect.height);

        // Check if any position changed significantly
        // CHANGE: Respect manual positioning
        let roomChanged = false;
        const finalStudents = packedStudents.map((s, i) => {
          const old = currentStudents[i]; // Corresponding student (assuming order preserved)

          // If manually positioned, keep the OLD position (ignore packer) BUT CLAMP IT within bounds
          if (old.manual) {
            // Rough card dimensions (Standard collapsed)
            const CARD_WIDTH = 120; // Approx scaled width
            const CARD_HEIGHT = 40;

            const maxX = containerRect.width - CARD_WIDTH;
            const maxY = containerRect.height - CARD_HEIGHT;

            const clampedX = Math.max(0, Math.min(old.x, maxX));
            const clampedY = Math.max(0, Math.min(old.y, maxY));

            if (clampedX !== old.x || clampedY !== old.y) {
              roomChanged = true;
              return { ...old, x: clampedX, y: clampedY };
            }
            return old;
          }

          if (Math.abs(s.x - old.x) > 1 || Math.abs(s.y - old.y) > 1) {
            roomChanged = true;
            return s;
          }

          return old;
        });

        if (roomChanged) {
          newClassroomData[room] = finalStudents;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        console.log('LayoutCorrector: Re-packed students via spiral (respecting manual).');
        setClassroomData(newClassroomData);
        // Force UI update
        setResetKeys(prev => ({
          science: prev.science + 1,
          math: prev.math + 1,
          ela: prev.ela + 1,
          socialStudies: prev.socialStudies + 1
        }));
      }
    };

    // Debounce to prevent thrashing
    const timeoutId = setTimeout(handleResize, 200);
    window.addEventListener('resize', handleResize);

    // Also run once on mount
    handleResize();

    // Forced re-check after mount (to allow paint)
    const mountTimeout = setTimeout(handleResize, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
      clearTimeout(mountTimeout);
    };
  }, []); // Run only on mount (and setup listeners), essentially.

  const FilterButton = ({ room }) => (
    <button className="filter-btn" onClick={() => setActiveFilterModal(room)} title="Filter & Sort">
      <img src={filterIcon} alt="Filter" className="filter-icon-img" />
    </button>
  );

  // Data Import Handler
  const handleDataImport = async (results) => {
    console.log("handleDataImport received:", results);
    setIsImporting(true);
    try {
      // results is array of { file, status, ?studentExcelName, ?entries, ?reason }
      if (!results || results.length === 0) return;

      // Get current state snapshot
      const currentData = classroomDataRef.current;
      const newData = { ...currentData };

      let hasChanges = false;
      const syncPromises = []; // Parallelize DB operations
      // ROSTER IMPORT HANDLER
      if (results[0].type === 'roster') {
        console.log("Handling Roster Import (Strict Mode)");
        const rosterImport = results[0].data; // { science: ["First Last", ...], ... }

        let addedCount = 0;
        let removedCount = 0;

        for (const roomKey of Object.keys(rosterImport)) {
          const rawNames = rosterImport[roomKey] || [];
          if (rawNames.length === 0) continue;

          // 1. Deduplicate the import list itself
          const uniqueImportNames = [...new Set(rawNames.map(n => n.trim()))];
          const uniqueImportNamesLower = new Set(uniqueImportNames.map(n => n.toLowerCase()));

          // Ensure room exists
          if (!newData[roomKey]) newData[roomKey] = [];

          // 2. Identify students to KEEP vs DELETE
          const currentStudents = newData[roomKey];
          const survivors = [];

          for (const student of currentStudents) {
            // Normalize name for comparison
            if (uniqueImportNamesLower.has(student.name.toLowerCase())) {
              survivors.push(student);
            } else {
              // DELETE: Student not in new roster
              // DELETE: Student not in new roster
              syncPromises.push(deleteStudent(student.id));
              removedCount++;
            }
          }

          // 3. Identify NEW students to ADD
          const survivorNamesLower = new Set(survivors.map(s => s.name.toLowerCase()));

          for (const fullName of uniqueImportNames) {
            if (!survivorNamesLower.has(fullName.toLowerCase())) {
              addedCount++;
              // Create new student
              const newStudent = {
                id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                name: fullName,
                grade: '9th', // Default
                assignments: [],
                assignmentsCompleted: 0,
                enrolledClasses: {}, // No academic classes yet
                progress: { science: 0, math: 0, english: 0, socialStudies: 0 },
                x: 0, y: 0, // Will need packing later
                manual: false
              };
              survivors.push(newStudent);
              // Sync new student to Supabase
              // Sync new student to Supabase
              syncPromises.push(syncStudent(newStudent, roomKey));
            }
          }

          newData[roomKey] = survivors;
          hasChanges = true;
        }

        console.log(`Strict Import Complete: Added ${addedCount}, Removed ${removedCount}`);

        if (hasChanges) {
          setClassroomData(newData);
          // Trigger re-pack 
          setResetKeys(prev => ({
            science: prev.science + 1,
            math: prev.math + 1,
            ela: prev.ela + 1,
            socialStudies: prev.socialStudies + 1
          }));
        }

        setImportSummary({
          totalFiles: 1,
          successes: [{ fileName: 'Roster Import', studentName: 'Multiple', addedCount: 'Batch (Strict)' }],
          errors: []
        });
        return;
      }

      const successes = [];
      const errors = [];
      const fuzzyMatches = []; // Track inexact matches
      const touchedStudentIds = new Set();

      const batchStudents = {}; // room -> [students]
      const batchAssignments = []; // [assignments] (with studentId attached)
      const batchDeletions = []; // [{ studentId, subject }] for Replace Mode

      for (const res of results) {
        if (res.status === 'error') {
          errors.push({ fileName: res.file, reason: res.reason });
          continue;
        }

        const { studentExcelName, entries, className, metadata } = res;

        // Parse "Last, First" -> ["Last", "First"]
        const nameParts = studentExcelName.split(',').map(s => s.trim());
        if (nameParts.length < 2) {
          errors.push({ fileName: res.file, reason: `Invalid name format: ${studentExcelName}` });
          continue;
        }

        const excelLastName = nameParts[0].toLowerCase();
        const excelFirstName = nameParts[1].toLowerCase();

        // Detect Subject from Class Name (Prioritize Context)
        let subjectKey = res.context || 'science';
        const lowerClass = (className || '').toLowerCase();

        if (!res.context) {
          if (lowerClass.includes('math') || lowerClass.includes('algebra') || lowerClass.includes('geometry') || lowerClass.includes('calc')) {
            subjectKey = 'math';
          } else if (lowerClass.includes('english') || lowerClass.includes('ela') || lowerClass.includes('lit') || lowerClass.includes('writ')) {
            subjectKey = 'english';
          } else if (lowerClass.includes('social') || lowerClass.includes('history') || lowerClass.includes('geography') || lowerClass.includes('gov')) {
            subjectKey = 'socialStudies';
          } else if (lowerClass.includes('art') || lowerClass.includes('career') || lowerClass.includes('financial') || lowerClass.includes('health') || lowerClass.includes('musical') || lowerClass.includes('physical') || lowerClass.includes('pe')) {
            subjectKey = 'electives';
          } else {
            subjectKey = null;
          }
        }

        // 1. Find the Best Match Student across all rooms
        let bestMatch = null;
        let bestMatchScore = 0;
        let matchRoom = null;

        Object.keys(newData).forEach(room => {
          newData[room].forEach(student => {
            const studentNameLower = student.name.toLowerCase();
            let score = 0;

            // Check for exact token matches
            if (studentNameLower.includes(excelLastName)) score += 2;
            if (studentNameLower.includes(excelFirstName)) score += 2;

            // Boost for exact full name match (reversed or normal)
            if (studentNameLower === `${excelFirstName} ${excelLastName}`) score += 5;

            if (score > bestMatchScore) {
              bestMatchScore = score;
              bestMatch = student;
              matchRoom = room;
            }
          });
        });

        // Threshold for "best match"
        const FUZZY_THRESHOLD = 2;
        const EXACT_THRESHOLD = 9;

        if (bestMatch && bestMatchScore >= FUZZY_THRESHOLD) {

          // Determine Subject Key Early
          if (!subjectKey) {
            // STRICT FALLBACK: Try to match className against HIERARCHY
            // We strip "NW " prefix just in case it wasn't stripped? No, res.className should be clean-ish but let's be safe.
            const cleanTitle = (className || '').replace(/^NW\s+/i, '').trim();

            // Search HIERARCHY
            for (const [subj, titles] of Object.entries(HIERARCHY)) {
              if (titles.includes(cleanTitle)) {
                subjectKey = subj;
                break;
              }
            }

            // If still no subject key, we CANNOT proceed safely.
            // Old Logic: "if (matchRoom === 'ela') subjectKey = 'english'; else subjectKey = matchRoom;"
            // This OLD logic caused the "Biology -> Social Studies" bug. 
            // We must now ERROR if we can't find it.
            if (!subjectKey) {
              errors.push({ fileName: res.file, reason: `Could not determine valid subject for class: '${className}'` });
              continue; // Skip this student
            }
          }

          // DOUBLE CHECK: Even if we have a subjectKey (e.g. from context), 
          // does the class actually match that subject's hierarchy?
          // If context says 'science' but class is 'Gym', simple logic might let it pass?
          // Strict Validation:
          let cleanTitleStrict = (className || '').replace(/^NW\s+/i, '').trim();

          // NORMALIZATION: Strip trailing asterisks (e.g. "Physical Education*")
          cleanTitleStrict = cleanTitleStrict.replace(/\*+$/, '').trim();

          // NORMALIZATION: "Physical Sciences" -> "Physical Science" (User Request)
          // Handle potential "Physical Sciences*" -> "Physical Science"
          if (cleanTitleStrict.toLowerCase() === 'physical sciences') {
            cleanTitleStrict = 'Physical Science';
            // Note: 'Physical Science' isn't in HIERARCHY (Only A/B), so this might still fail 
            // unless the user actually implies "Physical Education" or adds "Physical Science" to HIERARCHY.
            // But we follow instructions. If HIERARCHY only has A/B, this will still likely fail strict check 
            // unless we fuzzy match or if "Physical Science" is effectively a partial match.

            // Actually, looking at HIERARCHY: 'Physical Science A', 'Physical Science B'.
            // If the import is just "Physical Science", it won't match A or B strict.
            // However, let's also check "Physical Education" since that was the context.
          }

          // Allow 'General Class' bypass? NO. User wants strict.
          const validTitles = HIERARCHY[subjectKey];
          if (!validTitles || !validTitles.includes(cleanTitleStrict)) {
            // FIX: If user EXPLICITLY selected a context (e.g. Science), DO NOT AUTO-CORRECT.
            // Reject the file to prevent "Subject Mixing" (e.g. uploading History into Science).
            if (res.context) {
              errors.push({ fileName: res.file, reason: `Class '${cleanTitleStrict}' does not belong to ${subjectKey}.` });
              continue;
            }

            // Fallback: If no context (Auto-Detect mode), try to find if it belongs elsewhere
            let realSubject = null;
            for (const [subj, titles] of Object.entries(HIERARCHY)) {
              if (titles.includes(cleanTitleStrict)) {
                realSubject = subj;
                break;
              }
            }

            if (realSubject) {
              // Auto-Correct (Only safe if no strict context was enforced)
              subjectKey = realSubject;
            } else {
              // Truly Invalid Class
              errors.push({ fileName: res.file, reason: `Class '${cleanTitleStrict}' is not in the approved list.` });
              continue;
            }
          }

          // EXACT MATCH OR AUTO-MERGE
          if (bestMatchScore >= EXACT_THRESHOLD) {
            // Attach Resolved ID to result for API
            res.resolvedStudentId = bestMatch.id;


            // Check Timestamps for "Replace Mode"
            const newDateStr = res.dataAsOf; // "January 27, 2026..." or ISO
            const currentMeta = (bestMatch.enrolledClasses.metadata && bestMatch.enrolledClasses.metadata[subjectKey]) || {};
            const oldDateStr = currentMeta.lastUpdated;

            let shouldReplace = false;

            if (newDateStr) {
              // If we have a new timestamp:
              if (!oldDateStr) {
                // No previous record? REPLACE (First valid import logic for this schema)
                shouldReplace = true;
                console.log(`[Import Mode] Fresh import detected for ${bestMatch.name}. Mode: REPLACE`);
              } else {
                const newDate = new Date(newDateStr);
                const oldDate = new Date(oldDateStr);
                // If New is Newer, REPLACE.
                if (newDate > oldDate) {
                  shouldReplace = true;
                  console.log(`[Import Mode] New data (${newDateStr}) is newer than old (${oldDateStr}). Mode: REPLACE`);
                } else {
                  console.log(`[Import Mode] Old data is newer/same. Fallback to MERGE.`);
                }
              }
            } else {
              // No timestamp in file? Fallback to MERGE to be safe
              console.log(`[Import Mode] No timestamp found in import. Defaulting to MERGE.`);
              shouldReplace = false;
            }

            const existingAssignments = bestMatch.assignments || [];
            let newAssignments = [];

            if (shouldReplace) {
              // REPLACE MODE: Take ALL new entries, ignore old for this subject
              // Mark for deletion in DB
              batchDeletions.push({ studentId: bestMatch.id, subject: subjectKey });

              // Map entries to Assignment Objects
              newAssignments = entries.map(entry => ({
                id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                date: entry.date,
                score: entry.score !== undefined ? Number(entry.score) : null,
                activityName: entry.activityName,
                possible: entry.possible !== undefined ? Number(entry.possible) : null,
                percentage: entry.percentage !== undefined ? Number(entry.percentage) : null,
                status: entry.status,
                subject: subjectKey,
                classTitle: className, // FIX: Tag with Class Name immediately for frontend filters
                studentId: bestMatch.id
              }));

            } else {
              // MERGE MODE (Legacy)
              // Filter out duplicates
              entries.forEach(entry => {
                const isDuplicate = existingAssignments.some(ex => (
                  ex.subject === subjectKey && // Must match subject! 
                  ex.activityName === entry.activityName &&
                  ex.date === entry.date
                ));
                if (!isDuplicate) {
                  newAssignments.push({
                    id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    date: entry.date,
                    score: entry.score !== undefined ? Number(entry.score) : null,
                    activityName: entry.activityName,
                    possible: entry.possible !== undefined ? Number(entry.possible) : null,
                    percentage: entry.percentage !== undefined ? Number(entry.percentage) : null,
                    status: entry.status,
                    subject: subjectKey,
                    classTitle: className, // FIX: Tag with Class Name immediately for frontend filters
                    studentId: bestMatch.id
                  });
                }
              });
            }

            successes.push({
              fileName: res.file,
              studentName: bestMatch.name,
              addedCount: newAssignments.length,
              mode: shouldReplace ? 'Replace' : 'Merge'
            });

            // Update Enrolled Classes & Metadata
            const updatedEnrolledClasses = { ...(bestMatch.enrolledClasses || {}) };
            if (className && className !== 'Unknown Class') updatedEnrolledClasses[subjectKey] = className;

            // Try to use the parsed date, fallback to metadata default
            const importDate = res.dataAsOf || (metadata && metadata.lastUpdated);

            if (importDate) {
              updatedEnrolledClasses.metadata = {
                ...(updatedEnrolledClasses.metadata || {}),
                [subjectKey]: {
                  lastUpdated: importDate,
                  importFile: res.file,
                  importedAt: new Date().toISOString()
                }
              };
            }

            // Recalculate Progress
            // If Replace: use newAssignments only (plus assignments from OTHER subjects)
            // If Merge: use existing + new
            let allAssignments;
            if (shouldReplace) {
              // Keep assignments from OTHER subjects, replace ONLY this subject
              const otherSubjectAssignments = existingAssignments.filter(a => a.subject !== subjectKey);
              allAssignments = [...otherSubjectAssignments, ...newAssignments];
            } else {
              allAssignments = [...existingAssignments, ...newAssignments];
            }

            let newProgressValue = (bestMatch.progress && bestMatch.progress[subjectKey]) || 0;
            let countWithPercent = 0;
            let totalScore = 0;
            let totalPossible = 0;
            let totalPercent = 0;

            if (allAssignments.length > 0) {
              const subjectAssignments = allAssignments.filter(a => a.subject === subjectKey);
              subjectAssignments.forEach(a => {
                if (a.possible > 0) {
                  totalScore += (a.score || 0);
                  totalPossible += a.possible;
                }
                if (a.percentage !== undefined && a.percentage !== null) {
                  totalPercent += a.percentage;
                  countWithPercent++;
                }
              });

              if (totalPossible > 0) newProgressValue = Math.round((totalScore / totalPossible) * 100);
              else if (countWithPercent > 0) newProgressValue = Math.round(totalPercent / countWithPercent);
            }

            const updatedProgress = { ...bestMatch.progress, [subjectKey]: newProgressValue };
            const updatedStudent = {
              ...bestMatch,
              assignments: allAssignments,
              assignmentsCompleted: allAssignments.length,
              progress: updatedProgress,
              enrolledClasses: updatedEnrolledClasses
            };

            // BATCH ACCUMULATION
            // 1. Add/Update Student in Batch Map (Use Map to prevent overwrite of same student by different files)
            if (!batchStudents[matchRoom]) batchStudents[matchRoom] = new Map();
            batchStudents[matchRoom].set(updatedStudent.id, updatedStudent);

            // 2. Add Assignments to Batch List
            batchAssignments.push(...newAssignments);

            // Update Local State (Mutable approach fine here before setClassroomData)
            newData[matchRoom] = newData[matchRoom].map(s => s.id === updatedStudent.id ? updatedStudent : s);
            hasChanges = true;
            touchedStudentIds.add(updatedStudent.id);

          } else {
            // FUZZY MATCH - QUEUE FOR APPROVAL
            res.skipPersistence = true; // DO NOT send to API yet
            fuzzyMatches.push({
              id: `fuzzy-${Date.now()}-${Math.random()}`, // unique id for list key
              importedName: studentExcelName,
              matchedName: bestMatch.name,
              score: bestMatchScore,
              fileName: res.file,
              // Payload for later merge
              studentId: bestMatch.id,
              matchRoom: matchRoom,
              entries: entries,
              subjectKey: subjectKey,
              className: className,
              metadata: metadata
            });
          }

        } else {
          errors.push({ fileName: res.file, reason: `Student not found: ${studentExcelName}` });
        }
      }

      if (hasChanges) {
        // Convert Map back to array for final state set? No, we already updated 'newData' array inside loop.
        // We just need to persist the batch updates to DB.

        // EXECUTE BATCH SYNC (V3: Snapshot Architecture)
        // Replaces legacy relational sync
        const validResults = results.filter(r => !r.skipPersistence);
        if (validResults.length > 0) {
          console.log(`[Import] Processing ${validResults.length} files via Snapshot Engine...`);
          await processStudentData(validResults);
        } else {
          console.log("[Import] All files queued for fuzzy approval or skipped.");
        }

        // Legacy Syncs (Disabled)
        /*
        const syncPromises = [];
        // 1. Sync Students (per room)
        for (const room of Object.keys(batchStudents)) {
            // ...
        }
        */

        // await Promise.all(syncPromises); // Removed parallel execution

        setClassroomData(newData);
      } else {
        // No changes to persist, but check if we need to resolve promises if we added any logic? 
        // No, syncPromises only populated if hasChanges true (mostly).
      }

      setImportSummary({
        totalFiles: results.length,
        successes,
        errors,
        fuzzyMatches, // Pass to modal
        touchedStudentIds: Array.from(touchedStudentIds)
      });
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);

      // Trigger re-render keys
      setResetKeys(prev => ({
        science: prev.science + 1,
        math: prev.math + 1,
        ela: prev.ela + 1,
        socialStudies: prev.socialStudies + 1
      }));
    } catch (err) {
      console.error("CRITICAL IMPORT ERROR:", err);
      alert("An error occurred during import: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  /* 
   * Handle Approval/Denial of Fuzzy Matches 
   */
  const handleResolveFuzzyMatch = async (match, action) => {
    try {
      // 1. Update lists immediately (Optimistic UI for list removal)
      setImportSummary(prev => {
        const remaining = prev.fuzzyMatches.filter(m => m.id !== match.id);
        const newSuccesses = [...prev.successes];
        // Don't add to success yet until await finishes, but UI needs responsiveness.
        // We'll trust the process or add error handling if it fails.
        return { ...prev, fuzzyMatches: remaining };
      });

      if (action === 'deny') {
        return;
      }

      // 2. Action === 'approve': Execute Merge
      if (action === 'approve') {
        // Use Ref for current state
        const currentData = classroomDataRef.current;
        const newData = { ...currentData };
        const room = match.matchRoom;

        if (!newData[room]) return;

        const studentIndex = newData[room].findIndex(s => s.id === match.studentId);
        if (studentIndex === -1) return;

        const student = newData[room][studentIndex];
        const subjectKey = match.subjectKey;

        // MERGE LOGIC
        const existingAssignments = student.assignments || [];
        const newAssignments = [];

        match.entries.forEach(entry => {
          const isDuplicate = existingAssignments.some(ex => (ex.date === entry.date && ex.activityName === entry.activityName));
          if (!isDuplicate) {
            newAssignments.push({
              id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              date: entry.date,
              score: entry.score !== undefined ? Number(entry.score) : null,
              activityName: entry.activityName,
              possible: entry.possible !== undefined ? Number(entry.possible) : null,
              percentage: entry.percentage !== undefined ? Number(entry.percentage) : null,
              status: entry.status,
              subject: subjectKey
            });
          }
        });

        // Update Metadata
        const updatedEnrolledClasses = { ...(student.enrolledClasses || {}) };
        if (match.className && match.className !== 'Unknown Class') updatedEnrolledClasses[subjectKey] = match.className;
        if (match.metadata && match.metadata.lastUpdated) {
          updatedEnrolledClasses.metadata = {
            ...(updatedEnrolledClasses.metadata || {}),
            [subjectKey]: {
              lastUpdated: match.metadata.lastUpdated,
              importFile: match.fileName,
              importedAt: new Date().toISOString()
            }
          };
        }

        // Recalculate Progress
        const allAssignments = [...existingAssignments, ...newAssignments];
        let newProgressValue = (student.progress && student.progress[subjectKey]) || 0;
        let countWithPercent = 0;
        let totalScore = 0;
        let totalPossible = 0;
        let totalPercent = 0;

        if (allAssignments.length > 0) {
          const subjectAssignments = allAssignments.filter(a => a.subject === subjectKey);
          subjectAssignments.forEach(a => {
            if (a.possible > 0) {
              totalScore += (a.score || 0);
              totalPossible += a.possible;
            }
            if (a.percentage !== undefined && a.percentage !== null) {
              totalPercent += a.percentage;
              countWithPercent++;
            }
          });
          if (totalPossible > 0) newProgressValue = Math.round((totalScore / totalPossible) * 100);
          else if (countWithPercent > 0) newProgressValue = Math.round(totalPercent / countWithPercent);
        }

        const updatedProgress = { ...student.progress, [subjectKey]: newProgressValue };
        const updatedStudent = {
          ...student,
          assignments: allAssignments,
          assignmentsCompleted: allAssignments.length,
          progress: updatedProgress,
          enrolledClasses: updatedEnrolledClasses
        };

        // Sync
        await syncStudent(updatedStudent, room); // AWAIT HERE
        await syncAssignments(newAssignments, student.id); // AWAIT HERE

        // Update List in State
        newData[room][studentIndex] = updatedStudent;
        setClassroomData(newData);

        // Post-facto update summary to show success
        setImportSummary(s => {
          if (!s) return null;
          return {
            ...s,
            successes: [...(s.successes || []), { fileName: match.fileName, studentName: student.name, addedCount: newAssignments.length }]
          };
        });

        // Trigger Render
        setResetKeys(prev => ({ ...prev, [match.matchRoom]: prev[match.matchRoom] + 1 }));
      }
    } catch (err) {
      console.error("Fuzzy Resolve Error", err);
      alert("Failed to save merge: " + err.message);
    }
  };

  if (!session) return <Login />;

  return (
    <div className="dashboard-container">
      <div className="header">
        <h1>Northwoods Focus Student Dashboard</h1>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            className="import-header-btn"
            onClick={() => setActiveVerificationModal(true)}
          >
            CLASS HISTORY <span style={{ fontSize: '1.2em', marginLeft: '0.5rem' }}>📅</span>
          </button>

          <DataImportButton
            onDataImported={handleDataImport}
            classroomData={classroomData}
          />


        </div>
      </div>

      {/* Science HR (TL) */}
      <div className="homeroom-quadrant science" ref={scienceRef} style={getQuadrantStyle('science')}>
        <div className="quadrant-header">
          Science HR <span style={{ opacity: 0.6, fontSize: '0.7em' }}>#{classroomData.science.length}</span>
          <SeatingControls
            room="science"
            onSave={handleSaveLayout}
            onRestore={handleRestoreLayout}
            hasSaved={!!savedLayouts.science}
          />
          <FilterButton room="science" />
        </div>
        <ClassroomGrid
          room="science"
          students={getDisplayData('science')}
          onSubjectClick={handleSubjectClick}
          onDrop={handleStudentDrop}
          onDragStart={() => handleDragStart('science')}
          onDragStop={handleDragStop}
          resetKey={resetKeys.science + (isFiltered('science') ? 100 : 0)}
          onContextMenu={(e, s) => handleCardContextMenu(e, s, 'science')}
        />
      </div>

      {/* Math HR (TR) */}
      <div className="homeroom-quadrant math" ref={mathRef} style={getQuadrantStyle('math')}>
        <div className="quadrant-header">
          Math HR <span style={{ opacity: 0.6, fontSize: '0.7em' }}>#{classroomData.math.length}</span>
          <SeatingControls
            room="math"
            onSave={handleSaveLayout}
            onRestore={handleRestoreLayout}
            hasSaved={!!savedLayouts.math}
          />
          <FilterButton room="math" />
        </div>
        <ClassroomGrid
          room="math"
          students={getDisplayData('math')}
          onSubjectClick={handleSubjectClick}
          onDrop={handleStudentDrop}
          onDragStart={() => handleDragStart('math')}
          onDragStop={handleDragStop}
          resetKey={resetKeys.math + (isFiltered('math') ? 100 : 0)}
          onContextMenu={(e, s) => handleCardContextMenu(e, s, 'math')}
        />
      </div>

      {/* ELA HR (BL) */}
      <div className="homeroom-quadrant ela" ref={elaRef} style={getQuadrantStyle('ela')}>
        <div className="quadrant-header">
          ELA HR <span style={{ opacity: 0.6, fontSize: '0.7em' }}>#{classroomData.ela.length}</span>
          <SeatingControls
            room="ela"
            onSave={handleSaveLayout}
            onRestore={handleRestoreLayout}
            hasSaved={!!savedLayouts.ela}
          />
          <FilterButton room="ela" />
        </div>
        <ClassroomGrid
          room="ela"
          students={getDisplayData('ela')}
          onSubjectClick={handleSubjectClick}
          onDrop={handleStudentDrop}
          onDragStart={() => handleDragStart('ela')}
          onDragStop={handleDragStop}
          resetKey={resetKeys.ela + (isFiltered('ela') ? 100 : 0)}
          onContextMenu={(e, s) => handleCardContextMenu(e, s, 'ela')}
        />
      </div>

      {/* Social Studies HR (BR) */}
      <div className="homeroom-quadrant social" ref={socialRef} style={getQuadrantStyle('socialStudies')}>
        <div className="quadrant-header">
          Social S. HR <span style={{ opacity: 0.6, fontSize: '0.7em' }}>#{classroomData.socialStudies.length}</span>
          <SeatingControls
            room="socialStudies"
            onSave={handleSaveLayout}
            onRestore={handleRestoreLayout}
            hasSaved={!!savedLayouts.socialStudies}
          />
          <FilterButton room="socialStudies" />
        </div>
        <ClassroomGrid
          room="socialStudies"
          students={getDisplayData('socialStudies')}
          onSubjectClick={handleSubjectClick}
          onDrop={handleStudentDrop}
          onDragStart={() => handleDragStart('socialStudies')}
          onDragStop={handleDragStop}
          resetKey={resetKeys.socialStudies + (isFiltered('socialStudies') ? 100 : 0)}
          onContextMenu={(e, s) => handleCardContextMenu(e, s, 'socialStudies')}
        />
      </div>



      {/* Define activeStudent for modal logic */}
      {
        (() => {
          const activeStudent = selectedStudentSubject ? selectedStudentSubject.student : null;
          return (
            activeStudent && (
              <CalendarModal
                isOpen={!!activeStudent}
                student={activeStudent}
                subject={selectedStudentSubject ? selectedStudentSubject.subject : null} // Correctly pass context subject
                students={
                  // Get Peer List for "Next Student" arrows
                  // Logic: Find current room's list
                  (() => {
                    const sId = activeStudent.id;
                    const room = Object.keys(classroomData).find(r => classroomData[r].find(s => s.id === sId));
                    return room ? classroomData[room] : [];
                  })()
                } onStudentChange={(newStudent) => {
                  setSelectedStudentSubject(prev => ({ ...prev, student: newStudent }));
                }}
                homeroomLabel={(() => {
                  const sId = selectedStudentSubject.student.id;
                  const room = Object.keys(classroomData).find(r => classroomData[r].find(s => s.id === sId));
                  return room ? formatRoomName(room) : '';
                })()}
                subjectTotals={(() => {
                  // Calculate max assignments subject-wise using configured keys
                  const totals = {};
                  const allStudents = Object.values(classroomData).flat();

                  const subjectKeys = ['math', 'science', 'english', 'socialStudies', 'electives']; // Add all known keys

                  subjectKeys.forEach(key => {
                    let max = 0;
                    allStudents.forEach(s => {
                      const count = (s.assignments || []).filter(a => a.subject === key).length;
                      if (count > max) max = count;
                    });
                    totals[key] = max || 90; // Fallback
                  });
                  return totals;
                })()}
                semester={currentSemester}
                onClose={handleCloseModal}
              />
            )
          );
        })()}

      {
        activeFilterModal && (
          <FilterModal
            isOpen={!!activeFilterModal}
            room={activeFilterModal}
            students={classroomData[activeFilterModal]}
            currentFilters={filterState[activeFilterModal]}
            onClose={() => setActiveFilterModal(null)}
          />
        )
      }

      {
        importSummary && (
          <ImportSummaryModal
            isOpen={!!importSummary}
            summary={importSummary}
            onResolveFuzzyMatch={handleResolveFuzzyMatch}
            classroomData={classroomData}
            onClose={() => setImportSummary(null)}
          />
        )
      }

      <ProgressHistoryModal
        isOpen={activeVerificationModal}
        onClose={() => setActiveVerificationModal(false)}
        classroomData={classroomData}
      />

      <ConfirmationModal
        isOpen={!!pendingMove}
        message={pendingMove ? `Are you sure you want to move ${pendingMove.student.name} to ${formatRoomName(pendingMove.targetRoom)}?` : ''}
        onConfirm={confirmMove}
        onClose={cancelMove}
        title="Confirm Move"
      />

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!pendingDelete}
        title="Confirm Deletion"
        message={pendingDelete ? `Are you sure you want to delete ${pendingDelete.student.name}? This cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onClose={() => setPendingDelete(null)}
      />

      {/* Context Menu */}
      {
        contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={contextMenu.options}
            onClose={() => setContextMenu(null)}
          />
        )
      }

      {/* Import Processing Toast */}
      {
        isImporting && (
          <div className="import-processing-toast">
            <div className="spinner"></div>
            <span>Processing Import...</span>
          </div>
        )
      }

      {/* Import Success Toast */}
      {
        importSuccess && (
          <div className="import-processing-toast" style={{ backgroundColor: '#10b981' }}>
            <span>✅ Import Data Saved!</span>
          </div>
        )
      }
    </div >
  );
}



const SeatingControls = ({ room, onSave, onRestore, hasSaved }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [menuStyle, setMenuStyle] = React.useState({});
  const btnRef = React.useRef(null);

  const toggleOpen = (e) => {
    e.stopPropagation(); // Prevent immediate close
    if (!isOpen) {
      // Calculate position before opening
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setMenuStyle({
          top: `${rect.bottom + 8}px`,
          left: `${rect.left + rect.width / 2}px`,
        });
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close on click outside or scroll/resize
  React.useEffect(() => {
    const handleGlobalClick = (event) => {
      // If clicking inside the menu (portal), don't close.
      // Note: The portal is in document.body, so checking event.target.closest('.seating-menu') works.
      if (event.target.closest('.seating-menu') || event.target.closest('.seating-main-btn')) return;
      setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      if (isOpen) setIsOpen(false); // Close on scroll/resize for simplicity/robustness
    };

    if (isOpen) {
      window.addEventListener('click', handleGlobalClick);
      window.addEventListener('resize', handleScrollOrResize);
      window.addEventListener('scroll', handleScrollOrResize, true); // Capture for scrolling inner containers
    }

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  return (
    <div className={`seating-controls ${isOpen ? 'is-open' : ''}`}>
      <button
        ref={btnRef}
        className="seating-main-btn"
        onClick={toggleOpen}
        title="Seating Arrangement Options"
      >
        SEATING▾
      </button>

      {isOpen && createPortal(
        <div
          className="seating-menu"
          style={menuStyle}
          onClick={(e) => e.stopPropagation()} // Stop bubbling
        >
          <button
            className="seating-menu-item"
            onClick={() => {
              onSave(room);
              setIsOpen(false);
            }}
            title="Save Current Arrangement"
          >
            Save Layout
          </button>
          <button
            className="seating-menu-item"
            onClick={() => {
              onRestore(room);
              setIsOpen(false);
            }}
            disabled={!hasSaved}
            style={{ opacity: hasSaved ? 1 : 0.5, cursor: hasSaved ? 'pointer' : 'not-allowed' }}
          >
            Restore Layout
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default App;
