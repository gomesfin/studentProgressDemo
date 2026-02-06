import { supabase } from '../supabaseClient';

export const fetchClassroomData = async () => {
    try {
        console.log("Fetching Classroom Data (Verified Hybrid Mode)...");

        // 1. Fetch Core Student Data (Source of Truth for Existence)
        const { data: students, error: sError } = await supabase.from('students').select('*');
        if (sError) throw sError;
        console.log(`[Fetch] Students found: ${students?.length}`);

        // 2. Fetch New SQL Schema Data (Enrollments ONLY first - lighter payload)
        const { data: enrollments, error: eError } = await supabase
            .from('enrollments')
            .select('*, classes(title, subject_id)');

        if (eError) throw eError;
        console.log(`[Fetch] Enrollments found: ${enrollments?.length}`);

        // 3. Construct Data Structure
        const classroomData = { science: [], math: [], ela: [], socialStudies: [], electives: [] };
        const enrollmentMap = {};

        // 2a. Fetch Curriculum Stats
        const { data: allCurriculum } = await supabase.from('curriculum_assignments').select('id, class_id');
        const curriculumCounts = {};
        if (allCurriculum) {
            allCurriculum.forEach(c => {
                curriculumCounts[c.class_id] = (curriculumCounts[c.class_id] || 0) + 1;
            });
        }

        // Initialize Map
        if (enrollments) {
            enrollments.forEach(enrol => {
                const sId = enrol.student_id;
                if (!enrollmentMap[sId]) {
                    enrollmentMap[sId] = {
                        classes: {},
                        classes_history: { science: [], math: [], english: [], socialStudies: [], electives: [] }, // NEW: Multi-class support
                        classStats: {}, // NEW: Persisted stats from class_progress (Source of Truth)
                        assignments: [],
                        progress: {}
                    };
                }
                const subj = enrol.classes?.subject_id;
                const title = enrol.classes?.title;
                const classId = enrol.class_id;

                if (subj) {
                    const classObj = {
                        id: classId, // Vital for frontend filtering
                        title: title,
                        totalCurriculum: curriculumCounts[classId] || 0,
                        last_import: enrol.last_import_timestamp
                    };

                    // 1. Storage: Key by TITLE to support multiple classes per subject (e.g. Science A + Science B)
                    // Previously keyed by 'subj', causing overwrites.
                    const storageKey = title || subj;
                    enrollmentMap[sId].classes[storageKey] = {
                        ...classObj,
                        subject: subj // Preserve subject for badging/color
                    };

                    // 2. History (Multi-Class Support for Modal)
                    // Keep keyed by Subject for grouping
                    if (enrollmentMap[sId].classes_history[subj]) {
                        enrollmentMap[sId].classes_history[subj].push(classObj);
                    }

                    // Progress (Legacy)
                    enrollmentMap[sId].progress[storageKey] = enrol.current_grade || 0;

                    if (enrol.metadata) {
                        if (!enrollmentMap[sId].metadata) enrollmentMap[sId].metadata = {};
                        enrollmentMap[sId].metadata[storageKey] = enrol.metadata;
                    }
                }
                // Map enrollment ID back for assignment linking
                enrol.tempRef = enrollmentMap[sId];
                enrol.tempSubj = subj;
            });
        }

        // 4. ATOMIC FETCH: Class Snapshots (The new Unit of Truth)
        if (enrollments && enrollments.length > 0) {
            const studentIds = Object.keys(enrollmentMap);
            // Fetch ALL snapshots from class_progress
            const { data: snapshots, error: snapErr } = await supabase
                .from('class_progress')
                .select('*')
                .in('student_id', studentIds);

            if (snapErr) console.error("Error fetching snapshots:", snapErr);

            if (snapshots) {
                console.log(`[Fetch] Snapshots found: ${snapshots.length}`);

                // Helper to map Class ID -> Subject Key & Title
                const classSubjectMap = {};
                const classTitleMap = {}; // New: Map for Title

                enrollments.forEach(e => {
                    if (e.classes?.subject_id) {
                        classSubjectMap[e.class_id] = e.classes.subject_id;
                        classTitleMap[e.class_id] = e.classes.title; // Capture Title
                    }
                });

                snapshots.forEach(snap => {
                    const sId = snap.student_id;
                    const studentObj = enrollmentMap[sId];
                    if (!studentObj) return;

                    const subjectKey = classSubjectMap[snap.class_id];
                    const classTitle = classTitleMap[snap.class_id]; // Get Title

                    if (!subjectKey) return;

                    const rawAssignments = snap.assignment_data || [];

                    const processed = rawAssignments.map(a => ({
                        id: a.activityName,
                        title: a.activityName,
                        score: a.score,
                        max_points: a.possible,
                        percentage: a.percentage,
                        status: a.status === 'Complete' ? 'COMPLETED' : 'PENDING',
                        completed_at: a.date,
                        date: a.date, // Frontend uses 'date' prop directly
                        subject: subjectKey,
                        class_id: snap.class_id,
                        classTitle: classTitle, // CRITICAL: Frontend filters by this

                        // Mock relational sub-object for frontend compatibility
                        curriculum_assignments: {
                            title: a.activityName,
                            max_points: a.possible
                        }
                    }));

                    studentObj.assignments.push(...processed);

                    // SOURCE OF TRUTH: Persisted Stats
                    if (classTitle) {
                        studentObj.classStats[classTitle] = {
                            total: snap.total_assignments || 0,
                            completed: snap.completed_count || 0,
                            lastUpdated: snap.last_updated
                        };

                        // FIX: Update 'progress' to reflect Completion % (User Request), not Current Grade
                        // This aligns the Student Card bar with the Calendar Modal's completion logic.
                        if (snap.total_assignments > 0) {
                            const completionPct = Math.round((snap.completed_count / snap.total_assignments) * 100);
                            studentObj.progress[classTitle] = completionPct;
                        } else {
                            studentObj.progress[classTitle] = 0;
                        }
                    }
                });
            }
        }

        const repairPromises = [];

        students.forEach(s => {
            let student = null;
            const sqlData = enrollmentMap[s.id];

            // CHECK HEALTH: Does this student have SQL data?
            // "Healthy" means they have at least one enrollment if they have enrolled_classes in JSON.
            // Or if JSON is empty, maybe they are new.
            // Heuristic: If SQL data exists, use it. If not, fallback to JSON.

            const hasSqlData = sqlData && Object.keys(sqlData.classes).length > 0;
            const hasLegacyData = s.enrolled_classes && Object.keys(s.enrolled_classes).length > 0; // Check JSON

            if (hasSqlData) {
                // PRIMARY: Use SQL Data
                // Merge metadata from JSON if needed
                const mergedClasses = { ...sqlData.classes };
                if (sqlData.metadata || (s.enrolled_classes && s.enrolled_classes.metadata)) {
                    mergedClasses.metadata = { ...(s.enrolled_classes?.metadata || {}), ...(sqlData.metadata || {}) };
                }

                student = {
                    id: s.id,
                    name: s.name,
                    grade: s.grade,
                    x: Number(s.x),
                    y: Number(s.y),
                    manual: s.manual_position,
                    enrolledClasses: mergedClasses,
                    enrolledClassesHistory: sqlData.classes_history, // NEW
                    classStats: sqlData.classStats || {}, // NEW: Persisted Stats
                    progress: sqlData.progress,
                    assignments: sqlData.assignments,
                    assignmentsCompleted: sqlData.assignments.length
                };
            } else {
                // FALLBACK: Use Legacy JSON only (Assignments table removed)
                // If SQL data missing, likely a new student or one that needs migration from JSON.

                const myAssignments = []; // Legacy assignments table removed
                student = {
                    id: s.id,
                    name: s.name,
                    grade: s.grade,
                    x: Number(s.x),
                    y: Number(s.y),
                    manual: s.manual_position,
                    enrolledClasses: s.enrolled_classes || {}, // Use JSON source
                    progress: s.progress || {},
                    assignments: myAssignments,
                    assignmentsCompleted: 0
                };

                // TRIGGER REPAIR
                if (hasLegacyData) {
                    repairPromises.push(migrateStudentToNewSchema(student));
                }
            }

            const roomKey = s.homeroom || 'science';
            if (classroomData[roomKey]) classroomData[roomKey].push(student);

            // DEBUG HIDAYO
            if (s.name.includes('Hidayo')) {
                console.log(`[DEBUG HIDAYO] ID: ${s.id} (Type: ${typeof s.id})`);
                console.log(`[DEBUG HIDAYO] SQL Data Found: ${!!sqlData}`);
                if (sqlData) {
                    console.log(`[DEBUG HIDAYO] Classes Keys: ${Object.keys(sqlData.classes).join(', ')}`);
                    console.log(`[DEBUG HIDAYO] Assignments Count: ${sqlData.assignments.length}`);
                }
                console.log(`[DEBUG HIDAYO] Has Legacy Data: ${hasLegacyData}`);
                console.log(`[DEBUG HIDAYO] Falling back? ${!hasSqlData}`);
                console.log(`[DEBUG HIDAYO] Final Assignments Count: ${student.assignments.length}`);
            }
        });

        // Fire off repairs
        if (repairPromises.length > 0) {
            console.log(`Triggering Self - Healing for ${repairPromises.length} students...`);
            ensureSubjectsExist().then(() => {
                Promise.all(repairPromises).then(() => console.log("Self-Healing Complete"));
            });
        }

        return classroomData;

    } catch (error) {
        console.error("Error fetching data:", error);
        return null;
    }
};

export const updateStudentPosition = async (student) => {
    try {
        const { error } = await supabase
            .from('students')
            .update({
                x: student.x,
                y: student.y,
                manual_position: student.manual,
                homeroom: student.room // If room changed
            })
            .eq('id', student.id);

        if (error) throw error;
    } catch (error) {
        console.error("Error updating position:", error);
    }
};

export const syncStudent = async (student, room) => {
    // 1. Sync Base Student
    const { id, name, grade, x, y, manual, enrolledClasses, progress } = student;
    const { error } = await supabase
        .from('students')
        .upsert({
            id,
            name,
            grade,
            homeroom: room,
            x,
            y,
            manual_position: manual,
            enrolled_classes: enrolledClasses, // Still sync JSON for backup/meta
            progress
        });

    if (error) {
        console.error("Sync Student Base Error", error);
    } else {
        console.log("Sync Base Success:", student.name);
    }

    // 2. Sync Relational Data (Enrollments)
    // We reuse the migration logic because it handles "Get Class ID -> Upsert Enrollment" perfectly.
    // However, we need to be efficient.

    // We already have this logic!
    try {
        await ensureSubjectsExist(); // Cache this eventually
        await migrateStudentToNewSchema(student); // This performs the relational upserts
    } catch (err) {
        console.error("Sync Relational Error", err);
    }
};

export const syncAssignments = async (_assignments, _studentId) => {
    // Legacy support deprecated. New schema uses syncAssignmentsBatch or migrateStudentToNewSchema.
    // This function is kept for API compatibility but performs no operations on the deleted 'assignments' table.
};

export const deleteStudent = async (studentId) => {
    try {
        // New Schema (Cascade on FK should work, but explicit delete is fine)
        await supabase.from('enrollments').delete().eq('student_id', studentId);

        const { error: sError } = await supabase.from('students').delete().eq('id', studentId);
        if (sError) throw sError;
    } catch (error) {
        console.error("Error deleting student:", error);
    }
};

export const syncStudentsBatch = async (students, room) => {
    if (!students || students.length === 0) return;

    // 1. Prepare Upsert Payload (Base Students)
    const upsertPayload = students.map(s => ({
        id: s.id,
        name: s.name,
        grade: s.grade,
        homeroom: room,
        x: s.x,
        y: s.y,
        manual_position: s.manual,
        enrolled_classes: s.enrolledClasses || {},
        progress: s.progress || {}
    }));

    const { error } = await supabase.from('students').upsert(upsertPayload);
    if (error) {
        console.error("Batch Sync Students Error:", error);
    } else {
        console.log(`Batch Sync: Updated ${students.length} students in ${room}.`);
    }

    // 2. Relational Sync (Enrollments) - Simplified Backup Logic
    try {
        const { data: classes } = await supabase.from('classes').select('id, title, subject_id');
        const classMap = {};
        (classes || []).forEach(c => classMap[`${c.subject_id}:${c.title}`] = c.id);

        const enrollmentUpserts = [];

        for (const s of students) {
            const enrolledMap = s.enrolledClasses || {};
            for (const [subjectKey, className] of Object.entries(enrolledMap)) {
                if (subjectKey === 'metadata') continue;
                if (!['science', 'math', 'english', 'socialStudies', 'electives'].includes(subjectKey)) continue;

                let title = className || 'General Class';
                if (typeof title !== 'string') title = String(title || 'General Class');
                title = title.replace(/^NW\s+/i, '').trim();

                const classId = classMap[`${subjectKey}:${title}`];
                if (!classId) continue;

                enrollmentUpserts.push({
                    student_id: s.id,
                    class_id: classId,
                    term: 'FALL_2025',
                    current_grade: s.progress ? s.progress[subjectKey] : 0,
                    status: 'ACTIVE',
                    metadata: (enrolledMap.metadata && enrolledMap.metadata[subjectKey]) || null
                });
            }
        }

        if (enrollmentUpserts.length > 0) {
            const { error: enrolError } = await supabase.from('enrollments').upsert(enrollmentUpserts, { onConflict: 'student_id, class_id' });
            if (enrolError) console.error("Batch Sync Enrollments Error:", enrolError);
        }

    } catch (err) {
        console.error("Batch Relational Sync Error:", err);
    }
};

// --- PROCESS STUDENT DATA (V3: Strict Normalization & Import Tracker) ---
export const processStudentData = async (jsonData) => {
    try {
        console.log(`Processing V3 Batch: ${jsonData.length} files...`);

        // A. Setup Subjects & Classes Cache
        await ensureSubjectsExist();
        await ensureClassesExist();

        // Fetch Maps
        const { data: students } = await supabase.from('students').select('id, name');
        const { data: classes } = await supabase.from('classes').select('id, title, subject_id');
        const { data: enrollments } = await supabase.from('enrollments').select('id, student_id, class_id, last_import_timestamp');

        const studentMap = {}; // name -> id
        students?.forEach(s => studentMap[s.name.toLowerCase()] = s.id);

        const classMap = {}; // title -> id
        classes?.forEach(c => classMap[c.title.toLowerCase()] = { id: c.id, sub: c.subject_id });

        const enrollmentMap = {}; // "studentId:classId" -> { id, last_import_timestamp }
        enrollments?.forEach(e => enrollmentMap[`${e.student_id}:${e.class_id}`] = e);

        // B. Process Each File
        for (const fileData of jsonData) {
            const {
                studentExcelName, className, context, entries,
                dataAsOf
            } = fileData;

            if (!studentExcelName || !className) {
                console.warn("Skipping file missing metadata:", fileData.file);
                continue;
            }

            // 1. Resolve Student
            // PRIORITY: Use ID resolved by Frontend (App.jsx) if available
            // This ensures we respect "Fuzzy Matches" that were approved or "Exact Matches" found by client logic.
            let studentId = fileData.resolvedStudentId;

            const normalizedName = normalizeName(studentExcelName);
            if (!studentId) {
                studentId = studentMap[normalizedName.toLowerCase()];
            }

            if (!studentId) {
                console.log(`[Snapshot] New Student: ${normalizedName} (Original: ${studentExcelName})`);
                // Generate simple ID (Text based as per schema)
                const newId = 's-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

                const { data: newS, error: sErr } = await supabase.from('students')
                    .insert({ id: newId, name: normalizedName }) // Store normalized name
                    .select('id')
                    .single();
                if (sErr) { console.error("Create Student Error:", JSON.stringify(sErr, null, 2)); continue; }
                studentId = newS.id;
                studentMap[normalizedName.toLowerCase()] = studentId;
            }

            // 2. Resolve Class
            // 2. Resolve Class
            let classInfo = classMap[className.toLowerCase()];
            if (!classInfo) {
                // FALLBACK: Use context provided by App.jsx or Default to Science if absolutely missing (Legacy)
                // User requirement: "class name in exactly the same place in the file" -> App.jsx extracts this.
                // We should rely on 'context' (Subject Key) being passed correctly.
                const subjectId = context || 'science';

                console.log(`[Snapshot] New Class: ${className} (Subject: ${subjectId})`);

                const { data: newC, error: cErr } = await supabase.from('classes')
                    .insert({ title: className, subject_id: subjectId })
                    .select('id, subject_id')
                    .single();
                if (cErr) { console.error("Create Class Error:", cErr); continue; }
                classInfo = { id: newC.id, sub: newC.subject_id };
                classMap[className.toLowerCase()] = classInfo;
            }

            const classId = classInfo.id;
            const subjectId = classInfo.sub || context || 'science';

            // 3. Prepare JSON Snapshot Data
            const totalAssignments = entries.length;
            const completedCount = entries.filter(e => e.status === 'Complete').length;

            // Calculate Average Grade for Enrollment Metadata
            const scored = entries.filter(e => e.score !== null);
            const totalPoints = scored.reduce((acc, e) => acc + (e.score || 0), 0);
            const totalPossible = scored.reduce((acc, e) => acc + (e.possible || 0), 0);
            const currentGrade = totalPossible > 0 ? (totalPoints / totalPossible) * 100 : 0;

            console.log(`[Snapshot] Upserting for ${studentExcelName} in ${className} (Student: ${studentId}, Class: ${classId})`);

            // 4. ATOMIC UPSERT: Class Snapshot
            const snapshotPayload = {
                student_id: studentId,
                class_id: classId,
                last_updated: dataAsOf || new Date().toISOString(),
                total_assignments: totalAssignments,
                completed_count: completedCount,
                assignment_data: entries // The Raw JSON Blob
            };
            const { data: snapData, error: snapError } = await supabase
                .from('class_progress')
                .upsert(snapshotPayload, { onConflict: 'student_id, class_id' })
                .select();

            if (snapError) {
                console.error("Snapshot Upsert Error:", snapError);
            } else {
                console.log(`[Snapshot] Success! Saved ${entries.length} items. ID: ${snapData?.[0]?.id}`);
            }

            // 5. Update Enrollment (For Dashboard Cards / High Level Stats)
            // We still need this so the "Front Page" works without loading thousands of JSON blobs.
            const enrollmentPayload = {
                student_id: studentId,
                class_id: classId,
                // term: 'FALL_2025', // Removed: Column missing in DB
                current_grade: parseFloat(currentGrade.toFixed(2)),
                status: 'ACTIVE',
                // last_import_timestamp: ... // Removed: Column missing in DB
                metadata: {
                    last_file_date: dataAsOf,
                    assignment_count: totalAssignments,
                    missing_count: totalAssignments - completedCount
                }
            };

            const key = `${studentId}:${classId}`;
            const existingEnrollment = enrollmentMap[key];

            if (existingEnrollment) {
                // Update existing
                const { error: eErr } = await supabase
                    .from('enrollments')
                    .update(enrollmentPayload)
                    .eq('id', existingEnrollment.id);
                if (eErr) console.error("Enrollment Update Error:", eErr);
            } else {
                // Insert new
                const { error: eErr } = await supabase
                    .from('enrollments')
                    .insert(enrollmentPayload);
                if (eErr) console.error("Enrollment Insert Error:", eErr);
            }
        } // End File Loop

        console.log("Batch Processing Complete.");
    } catch (err) {
        console.error("Critical Process Error:", err);
    }
};

// --- NEW SCHEMA API METHODS ---

export const ensureSubjectsExist = async () => {
    const subjects = [
        { id: 'science', name: 'Science', color: '#2dd4bf' },
        { id: 'math', name: 'Math', color: '#60a5fa' },
        { id: 'english', name: 'English', color: '#f87171' },
        { id: 'socialStudies', name: 'Social Studies', color: '#a78bfa' },
        { id: 'electives', name: 'Electives', color: '#f59e0b' } // Amber/Orange
    ];

    // Upsert all
    const { error } = await supabase.from('subjects').upsert(subjects);
    if (error) console.error("Error seeding subjects:", error);

    // Trigger Class Seeding
    await ensureClassesExist();
};

export const HIERARCHY = {
    'electives': [
        'Art Appreciation', 'College and Career Preparation I', 'Financial Literacy',
        'Health', 'Musical Appreciation', 'Physical Education'
    ],
    'english': [
        'English 10A', 'English 10B', 'English 11A', 'English 9A', 'English  9A', 'English 9B', 'English  9B', 'Media Literacy'
    ],
    'math': [
        'Algebra 1A', 'Algebra 1B', 'Algebra 2A', 'Algebra 2B',
        'Geometry A', 'Geometry B', 'Mathematics of Personal Finance A'
    ],
    'science': [
        'Biology A', 'Biology B', 'Environmental Science A', 'Environmental Science B',
        'Physical Science A', 'Physical Science B'
    ],
    'socialStudies': [
        'U.S. Government', 'Multicultural Studies', 'U.S. History since the Civil War A', 'U.S. History since the Civil War B', 'Modern World History from 1600 A', 'World History A'
    ]
};

export const ensureClassesExist = async () => {
    const classInserts = [];
    Object.entries(HIERARCHY).forEach(([subId, titles]) => {
        titles.forEach(title => {
            classInserts.push({ subject_id: subId, title });
        });
    });

    // ... (rest of logic remains similar, simplified for brevity here if needed)
    // For this tool usage I need to match exact content or replace block
    // I will replace the function ensureClassesExist AND getOrCreateClass

    const { data: existing } = await supabase.from('classes').select('subject_id, title');
    const existingSet = new Set((existing || []).map(c => `${c.subject_id}:${c.title}`));

    const toInsert = classInserts.filter(c => !existingSet.has(`${c.subject_id}:${c.title}`));

    if (toInsert.length > 0) {
        console.log(`Seeding ${toInsert.length} new classes...`);
        const { error } = await supabase.from('classes').insert(toInsert);
        if (error) console.error("Error seeding classes:", error);
    }
};

export const getOrCreateClass = async (subjectId, title) => {
    // 0. STRICT VALIDATION - DISABLED to allow Import to work
    // const allowed = HIERARCHY[subjectId];
    // if (!allowed || !allowed.includes(title)) {
    //     console.warn(`Strict Mode (Bypassed): Auto-creating unknown class '${title}' for subject '${subjectId}'`);
    //     // return null; 
    // }

    // 1. Try find (Handle duplicates by taking first)
    const { data } = await supabase
        .from('classes')
        .select('id')
        .eq('subject_id', subjectId)
        .eq('title', title)
        .limit(1);

    if (data && data.length > 0) return data[0].id;

    // 2. Create if missing
    const { data: newData, error } = await supabase
        .from('classes')
        .insert({ subject_id: subjectId, title: title })
        .select()
        .limit(1)
        .single();

    if (error) {
        console.error("Error creating class:", error);
        // Fallback: maybe it was created in race condition?
        const { data: retry } = await supabase.from('classes').select('id').eq('subject_id', subjectId).eq('title', title).limit(1);
        if (retry && retry.length > 0) return retry[0].id;
        return null;
    }
    return newData.id;
};

export const migrateStudentToNewSchema = async (student) => {
    // This function takes a "Legacy" student object and populates the new tables
    // 1. Enrolled Classes
    const enrolledMap = student.enrolledClasses || {};

    try {
        const fileDate = new Date(); // Use current time for migration
        for (const [subjectKey, className] of Object.entries(enrolledMap)) {
            if (subjectKey === 'metadata') continue; // Skip metadata blob
            if (['science', 'math', 'english', 'socialStudies', 'electives'].includes(subjectKey)) {

                // A. Ensure Class Exists
                const classId = await getOrCreateClass(subjectKey, className || 'General Class');
                if (!classId) continue;

                // B. Manual Upsert Enrollment (More Robust than onConflict)
                const { data: existingEnrol } = await supabase.from('enrollments')
                    .select('id')
                    .eq('student_id', student.id)
                    .eq('class_id', classId)
                    .eq('term', 'FALL_2025')
                    .maybeSingle();

                let enrollment = null;
                let eError = null;

                const enrolPayload = {
                    student_id: student.id,
                    class_id: classId,
                    // term: 'FALL_2025', // Removed in V4
                    student_name_cache: student.name,
                    class_name_cache: className || 'General Class',
                    current_grade: student.progress ? student.progress[subjectKey] : 0,
                    status: 'ACTIVE',
                    metadata: (enrolledMap.metadata && enrolledMap.metadata[subjectKey]) || null
                };

                if (existingEnrol) {
                    // Update
                    const { data, error } = await supabase.from('enrollments')
                        .update(enrolPayload)
                        .eq('id', existingEnrol.id)
                        .select()
                        .single();
                    enrollment = data;
                    eError = error;
                } else {
                    // Insert
                    const { data, error } = await supabase.from('enrollments')
                        .insert(enrolPayload)
                        .select()
                        .single();
                    enrollment = data;
                    eError = error;
                }

                if (eError) {
                    console.error("Enrollment Write Error:", eError);
                    continue;
                }

                // C. Migrate Assignments for this Subject
                // Filter *Legacy* assignments for this subject
                const subjectAssignments = (student.assignments || []).filter(a => a.subject === subjectKey);

                for (const assign of subjectAssignments) {
                    // In new schema, assignments belong to a CURRICULUM item first.
                    // We must "Get or Create" the curriculum item for this class.
                    // Title = assign.activityName

                    // C1. Find Curriculum (Strict)
                    const { data: exCurv } = await supabase
                        .from('curriculum_assignments')
                        .select('id')
                        .eq('class_id', classId)
                        .eq('title', assign.activityName)
                        .maybeSingle(); // Use maybeSingle to avoid error if not found

                    const curvId = exCurv ? exCurv.id : null;

                    // STRICT MODE: Do NOT create 'Imported' curriculum. If not found, curvId is null.

                    if (!enrollment) continue;

                    // C2. Create Student Assignment (Manual Upsert)
                    const { data: existingSa } = await supabase.from('student_assignments')
                        .select('id')
                        .eq('enrollment_id', enrollment.id)
                        .eq('assignment_id', curvId)
                        .maybeSingle();

                    const saPayload = {
                        enrollment_id: enrollment.id,
                        assignment_id: curvId,
                        score: assign.score,
                        percentage: assign.percentage,
                        status: assign.status,
                        submitted_at: assign.date ? new Date(assign.date) : null,
                        student_name_cache: student.name,
                        class_name_cache: className || 'General Class',
                        assignment_name_cache: assign.activityName,
                        last_import_timestamp: fileDate.toISOString()
                    };

                    let saError = null;

                    if (existingSa) {
                        const { error } = await supabase.from('student_assignments')
                            .update(saPayload)
                            .eq('id', existingSa.id);
                        saError = error;
                    } else {
                        const { error } = await supabase.from('student_assignments')
                            .insert(saPayload);
                        saError = error;
                    }

                    if (saError) {
                        console.error("Student Assignment Write Error:", saError);
                    }
                }
            }
        }
    } catch (err) {
        console.error("ProcessStudentData Batch Error:", err);
    }
};

// ------------------------------------------------------------------
// BULK OPTIMIZED SYNC (Vectorized)
// ------------------------------------------------------------------
export const syncAssignmentsBatch = async (assignments, deletions) => {
    if ((!assignments || assignments.length === 0) && (!deletions || deletions.length === 0)) return;

    console.log(`[SyncBatch] Starting Vectorized Process. Assignments: ${assignments?.length || 0}, Deletions: ${deletions?.length || 0}`);

    // 1. EXTRACT KEYS & SCOPE
    const uniqueStudentIds = new Set();
    const uniqueSubjects = new Set();

    // Helper to normalize subject keys (App uses lowercase keys, DB uses capitalized in some places, but enrollment link is via subject_id)
    // We assume App passes the Key that matches `classes.subject_id`.
    // We will normalize to lowercase for comparison safety.

    assignments?.forEach(a => {
        if (a.studentId) uniqueStudentIds.add(a.studentId);
        if (a.subject) uniqueSubjects.add(a.subject.toLowerCase());
    });
    deletions?.forEach(d => {
        if (d.studentId) uniqueStudentIds.add(d.studentId);
        if (d.subject) uniqueSubjects.add(d.subject.toLowerCase());
    });

    if (uniqueStudentIds.size === 0) return;

    // 2. BULK FETCH ENROLLMENTS (O(1) Query)
    // Fetch ALL enrollments for these students. match in memory.
    const { data: allEnrollments, error: enrolError } = await supabase
        .from('enrollments')
        .select('id, student_id, class_id, classes(subject_id, title)')
        .in('student_id', Array.from(uniqueStudentIds));

    if (enrolError) {
        console.error("Critical Error Fetching Enrollments:", enrolError);
        return;
    }

    // Build Enrollment Map: `${studentId}_${subjectKey}` -> Enrollment Object
    const enrollmentMap = new Map();
    const involvedClassIds = new Set();

    allEnrollments?.forEach(e => {
        if (e.classes?.subject_id) {
            const key = `${e.student_id}_${e.classes.subject_id.toLowerCase()}`;
            // If multiple classes same subject, we take the last one or need logic. 
            // For now, overwrite is acceptable for simple active class logic.
            enrollmentMap.set(key, {
                id: e.id,
                classId: e.class_id,
                title: e.classes.title
            });
            involvedClassIds.add(e.class_id);
        }
    });

    // 3. BULK FETCH CURRICULUM (O(1) Query)
    // Fetch ALL curriculum items for the classes involved
    let curriculumMap = new Map(); // `${classId}_${code}` -> assignmentId

    if (involvedClassIds.size > 0) {
        const { data: allCurriculum, error: currError } = await supabase
            .from('curriculum_assignments')
            .select('id, class_id, title')
            .in('class_id', Array.from(involvedClassIds));

        if (currError) {
            console.error("Critical Error Fetching Curriculum:", currError);
        } else {
            // Build Map using 3-Digit ID Extraction
            const idRegex = /^(\d+\.\d+\.\d+)/;

            allCurriculum?.forEach(c => {
                const match = c.title.match(idRegex);
                if (match) {
                    const code = match[1]; // e.g., "1.2.3"
                    const key = `${c.class_id}_${code}`;
                    curriculumMap.set(key, c.id);
                }
            });
        }
    }

    // 4. PREPARE OPERATIONS (In-Memory Processing)

    // A. Deletions
    const enrollmentIdsToDelete = new Set();
    if (deletions) {
        deletions.forEach(del => {
            const key = `${del.studentId}_${del.subject.toLowerCase()}`;
            const enrol = enrollmentMap.get(key);
            if (enrol) {
                enrollmentIdsToDelete.add(enrol.id);
            }
        });
    }

    // B. Upserts
    const rowsToUpsert = [];
    const idRegex = /^(\d+\.\d+\.\d+)/;

    if (assignments) {
        assignments.forEach(assign => {
            if (!assign.studentId || !assign.subject || !assign.activityName) return;

            const enrolKey = `${assign.studentId}_${assign.subject.toLowerCase()}`;
            const enrol = enrollmentMap.get(enrolKey);

            if (!enrol) {
                // console.warn(`Skipping assignment: No enrollment for ${assign.studentId} in ${assign.subject}`);
                return;
            }

            // Extract Code from Input Title
            const match = assign.activityName.match(idRegex);
            if (!match) {
                // Strict Mode: If it doesn't look like "1.2.3 Quiz...", skip it.
                // console.warn(`Skipping invalid format: '${assign.activityName}'`);
                return;
            }
            const code = match[1];

            // Resolve Assignment ID
            const currKey = `${enrol.classId}_${code}`;
            const assignmentId = curriculumMap.get(currKey);

            if (!assignmentId) {
                // Strict Mode: No match in Master Curriculum
                // console.warn(`Skipping unknown curriculum: '${code}' in class '${enrol.title}'`);
                return;
            }

            rowsToUpsert.push({
                enrollment_id: enrol.id,
                assignment_id: assignmentId,
                status: assign.status,
                score: assign.score,
                submitted_at: assign.date ? new Date(assign.date) : null
            });
        });
    }

    // 5. EXECUTE DATABASE OPERATIONS

    // Delete Chunked
    if (enrollmentIdsToDelete.size > 0) {
        const ids = Array.from(enrollmentIdsToDelete);
        const { error: delError } = await supabase
            .from('student_assignments')
            .delete()
            .in('enrollment_id', ids);

        if (delError) console.error("Batch Delete Error:", delError);
        else console.log(`[SyncBatch] Cleared old data for ${ids.length} enrollments.`);
    }

    // Upsert Chunked (max 1000 per batch)
    if (rowsToUpsert.length > 0) {
        console.log(`[SyncBatch] Upserting ${rowsToUpsert.length} assignments...`);
        const BATCH_SIZE = 1000;
        for (let i = 0; i < rowsToUpsert.length; i += BATCH_SIZE) {
            const batch = rowsToUpsert.slice(i, i + BATCH_SIZE);
            const { error: upsertError } = await supabase
                .from('student_assignments')
                .upsert(batch, { onConflict: 'enrollment_id, assignment_id' });

            if (upsertError) console.error(`Batch Upsert Error (${i}-${i + BATCH_SIZE}):`, upsertError);
        }
        console.log("[SyncBatch] Upsert Complete.");
    } else {
        console.log("[SyncBatch] No valid assignments to upsert (Strict Mode Active).");
    }
};

// --- HELPER FUNCTIONS ---

const normalizeName = (name) => {
    if (!name) return "";
    let clean = name.trim();
    // Verify if "Last, First" format exists (contains comma)
    if (clean.includes(',')) {
        const parts = clean.split(',').map(p => p.trim());
        if (parts.length === 2) {
            // Convert "Lacey, Joey" -> "Joey Lacey" (Canonical "First Last")
            return `${parts[1]} ${parts[0]}`;
        }
    }
    // Assume already "First Last" or mononym
    return clean;
};


