'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const DAY_OPTIONS = [
  { value: '', label: 'All Days' },
  { value: 'S', label: 'Sunday (S)' },
  { value: 'M', label: 'Monday (M)' },
  { value: 'T', label: 'Tuesday (T)' },
  { value: 'W', label: 'Wednesday (W)' },
  { value: 'R', label: 'Thursday (R)' },
  { value: 'F', label: 'Friday (F)' },
  { value: 'A', label: 'Saturday (A)' },
];

const COLUMNS = [
  { key: 'course', label: 'Course', sortable: true },
  { key: 'section', label: 'Section', sortable: true },
  { key: 'faculty', label: 'Faculty', sortable: true },
  { key: 'time', label: 'Time', sortable: true },
  { key: 'room', label: 'Room', sortable: true },
  { key: 'seats', label: 'Seats', sortable: true },
];

const CSE_GROUP_ORDER = [
  'General Education',
  'Math & Science',
  'Engineering Foundation',
  'CSE Core',
  'CSE Electives',
];

const BBA_GROUP_ORDER = [
  'General Education',
  'School Core',
  'BBA Core',
  'Major Core',
  'Major Elective',
  'Internship',
];

const MIC_GROUP_ORDER = [
  'General Education',
  'School Core',
  'Major Core',
  'Major Elective',
];

const BBA_MAJORS = [
  { id: 'all', label: 'All majors' },
  { id: 'FIN', label: 'FIN – Finance' },
  { id: 'ACT', label: 'ACT – Accounting' },
  { id: 'MKT', label: 'MKT – Marketing' },
  { id: 'HRM', label: 'HRM – Human Resources' },
  { id: 'MGT', label: 'MGT – Management' },
  { id: 'MIS', label: 'MIS – Information Systems' },
  { id: 'INB', label: 'INB – International Business' },
  { id: 'SCM', label: 'SCM – Supply Chain Management' },
  { id: 'ECO', label: 'ECO – Economics' },
];

const CSE_TRACK_OPTIONS = [
  { id: 'all', label: 'All elective tracks' },
  { id: 'Software Engineering', label: 'Software Engineering Track (6 courses)' },
  { id: 'AI / ML / Data Science', label: 'AI / ML / Data Science Track (6 courses)' },
  { id: 'Systems & Hardware', label: 'Systems & Hardware Track (6 courses)' },
  { id: 'Networking & Web', label: 'Networking & Web Track (4 courses)' },
  { id: 'Algorithms & Theory', label: 'Algorithms & Theory Track (3 courses)' },
  { id: 'Bioinformatics', label: 'Bioinformatics Track (4 courses)' },
  { id: 'Special Topics', label: 'Special Topics (6 courses)' },
];

const CSE_SEMESTER_MAP = {
  ENG102: 1, MAT116: 1, EEE154: 1, CEE110: 1, CSE115: 1, CSE115L: 1,
  ENG103: 2, MAT120: 2, MAT125: 2, CSE173: 2,
  ENG111: 3, MAT130: 3, PHY107: 3, PHY107L: 3, CSE215: 3, CSE215L: 3,
  PHI104: 4, PHI101: 4, MAT250: 4, PHY108: 4, PHY108L: 4, CSE225: 4, CSE225L: 4,
  BEN205: 5, MAT350: 5, EEE141: 5, EEE141L: 5, CSE231: 5, CSE231L: 5,
  HIS102: 6, LBA101: 6, LBA102: 6, MAT361: 6, CSE299: 6,
  HIS103: 7, CHE101: 7, CHE101L: 7, EEE111: 7, EEE111L: 7, CSE332: 7,
  POL101: 8, POL104: 8, CSE311: 8, CSE311L: 8, CSE323: 8, CSE373: 8,
  ECO101: 9, ECO104: 9, BIO103: 9, BIO103L: 9, CSE327: 9, CSE331: 9, CSE331L: 9,
  SOC101: 10, ANT101: 10, ENV203: 10, GEO205: 10, CSE425: 10, CSE325: 10, EEE452: 10,
  CSE499A: 11,
  CSE499B: 12,
};

const CSE_ELECTIVE_TRACKS = {
  CSE401: 'Software Engineering',
  CSE411: 'Software Engineering',
  CSE424: 'Software Engineering',
  CSE427: 'Software Engineering',
  CSE428: 'Software Engineering',
  CSE429: 'Software Engineering',
  CSE417: 'Algorithms & Theory',
  CSE473: 'Algorithms & Theory',
  CSE465: 'Algorithms & Theory',
  CSE418: 'Systems & Hardware',
  CSE426: 'Systems & Hardware',
  CSE433: 'Systems & Hardware',
  CSE435: 'Systems & Hardware',
  CSE413: 'Systems & Hardware',
  CSE414: 'Systems & Hardware',
  CSE438: 'Networking & Web',
  CSE482: 'Networking & Web',
  CSE485: 'Networking & Web',
  CSE486: 'Networking & Web',
  CSE419: 'AI / ML / Data Science',
  CSE422: 'AI / ML / Data Science',
  CSE440: 'AI / ML / Data Science',
  CSE445: 'AI / ML / Data Science',
  CSE467: 'AI / ML / Data Science',
  CSE468: 'AI / ML / Data Science',
  CSE446: 'Bioinformatics',
  CSE447: 'Bioinformatics',
  CSE448: 'Bioinformatics',
  CSE449: 'Bioinformatics',
  CSE491: 'Special Topics',
  CSE492: 'Special Topics',
  CSE493: 'Special Topics',
  CSE494: 'Special Topics',
  CSE495: 'Special Topics',
  CSE496: 'Special Topics',
};

export default function CourseFinderPage() {
  // Navigation tabs: 'sections' | 'curriculum'
  const [activeTab, setActiveTab] = useState('sections');

  // Search & Filter State for Sections Tab
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [sortField, setSortField] = useState('course');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalOpenSeats, setTotalOpenSeats] = useState(0);
  const [meta, setMeta] = useState({ departments: [], totalSections: 0, totalCourses: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Curriculum State
  const [selectedProgram, setSelectedProgram] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cf_program');
        if (saved && (saved === 'CSE' || saved === 'BBA' || saved === 'MIC')) return saved;
      } catch (e) {
        console.warn('Failed to read cf_program from localStorage', e);
      }
    }
    return 'CSE';
  });

  const [curriculumData, setCurriculumData] = useState(null);
  const [curriculumLoading, setCurriculumLoading] = useState(true);
  const [curriculumError, setCurriculumError] = useState(null);
  const [curriculumFilter, setCurriculumFilter] = useState('all'); // 'all' | 'completed' | 'available' | 'locked'
  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedCseTrack, setSelectedCseTrack] = useState('all');
  const [showClearModal, setShowClearModal] = useState(false);

  // Independent saved progress per program with old key migration
  const [completedCSE, setCompletedCSE] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        // Migrate old 'cf_done' to 'cf_done_CSE' once
        const oldDone = localStorage.getItem('cf_done');
        const cseSaved = localStorage.getItem('cf_done_CSE');
        if (!cseSaved && oldDone) {
          localStorage.setItem('cf_done_CSE', oldDone);
          const parsed = JSON.parse(oldDone);
          if (Array.isArray(parsed)) return parsed;
        } else if (cseSaved) {
          const parsed = JSON.parse(cseSaved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Failed to read cf_done_CSE from localStorage', e);
      }
    }
    return [];
  });

  const [completedBBA, setCompletedBBA] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cf_done_BBA');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Failed to read cf_done_BBA from localStorage', e);
      }
    }
    return [];
  });

  const [completedMIC, setCompletedMIC] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cf_done_MIC');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Failed to read cf_done_MIC from localStorage', e);
      }
    }
    return [];
  });

  const [waivedBBA, setWaivedBBA] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cf_waived_BBA');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Failed to read cf_waived_BBA from localStorage', e);
      }
    }
    return [];
  });

  const [waivedCSE, setWaivedCSE] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cf_waived_CSE');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Failed to read cf_waived_CSE from localStorage', e);
      }
    }
    return [];
  });

  const [waivedMIC, setWaivedMIC] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cf_waived_MIC');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.warn('Failed to read cf_waived_MIC from localStorage', e);
      }
    }
    return [];
  });

  // Active completed & waived lists for currently selected program
  const activeCompleted = selectedProgram === 'BBA' ? completedBBA : (selectedProgram === 'MIC' ? completedMIC : completedCSE);
  const activeWaived = selectedProgram === 'BBA' ? waivedBBA : (selectedProgram === 'MIC' ? waivedMIC : waivedCSE);

  // Server-computed status data
  const [statusResult, setStatusResult] = useState(null);

  // Available curriculum programs from API
  const [programsList, setProgramsList] = useState([]);

  // Fetch programs once on mount
  useEffect(() => {
    async function fetchPrograms() {
      try {
        const res = await fetch(`${API_BASE}/curriculum/programs`);
        if (res.ok) {
          const data = await res.json();
          setProgramsList(data);
        }
      } catch (err) {
        console.warn('Failed to fetch programs:', err);
      }
    }
    fetchPrograms();
  }, []);

  // Debounced search input handler (300 ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch metadata once on mount
  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch(`${API_BASE}/meta`);
        if (res.ok) {
          const data = await res.json();
          setMeta(data);
        }
      } catch (err) {
        console.warn('Failed to fetch metadata:', err);
      }
    }
    fetchMeta();
  }, []);

  // Fetch curriculum when program changes
  useEffect(() => {
    async function fetchCurriculum() {
      setCurriculumLoading(true);
      setCurriculumError(null);
      try {
        const res = await fetch(`${API_BASE}/curriculum?program=${selectedProgram}`);
        if (!res.ok) {
          throw new Error(`Failed to load curriculum (status ${res.status})`);
        }
        const data = await res.json();
        setCurriculumData(data);
      } catch (err) {
        setCurriculumError(err.message || 'Error loading curriculum data');
      } finally {
        setCurriculumLoading(false);
      }
    }
    fetchCurriculum();
  }, [selectedProgram]);

  // Persist program selection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cf_program', selectedProgram);
      } catch (e) {
        console.warn('Failed to save cf_program to localStorage', e);
      }
    }
  }, [selectedProgram]);

  // Persist completed & waived lists to localStorage per program
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cf_done_CSE', JSON.stringify(completedCSE));
      } catch (e) {
        console.warn('Failed to save cf_done_CSE', e);
      }
    }
  }, [completedCSE]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cf_done_BBA', JSON.stringify(completedBBA));
      } catch (e) {
        console.warn('Failed to save cf_done_BBA', e);
      }
    }
  }, [completedBBA]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cf_waived_BBA', JSON.stringify(waivedBBA));
      } catch (e) {
        console.warn('Failed to save cf_waived_BBA', e);
      }
    }
  }, [waivedBBA]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cf_waived_CSE', JSON.stringify(waivedCSE));
      } catch (e) {
        console.warn('Failed to save cf_waived_CSE', e);
      }
    }
  }, [waivedCSE]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cf_done_MIC', JSON.stringify(completedMIC));
      } catch (e) {
        console.warn('Failed to save cf_done_MIC', e);
      }
    }
  }, [completedMIC]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('cf_waived_MIC', JSON.stringify(waivedMIC));
      } catch (e) {
        console.warn('Failed to save cf_waived_MIC', e);
      }
    }
  }, [waivedMIC]);

  // Debounced status calculation from API (150 ms)
  const debounceTimerRef = useRef(null);
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/curriculum/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program: selectedProgram,
            completed: activeCompleted,
            waived: activeWaived,
            major: selectedProgram === 'BBA' && selectedMajor !== 'all' ? selectedMajor : null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setStatusResult(data);
        }
      } catch (err) {
        console.warn('Failed to sync curriculum status with API:', err);
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedProgram, activeCompleted, activeWaived, selectedMajor]);

  // Instant local optimistic status calculation for seamless, 0ms feedback
  const optimisticStatus = useMemo(() => {
    if (!curriculumData || !curriculumData.courses) {
      return statusResult || null;
    }

    const completedSet = new Set(activeCompleted.map((c) => c.toUpperCase()));
    const waivedSet = new Set(activeWaived.map((c) => c.toUpperCase()));
    const courses = curriculumData.courses;

    let completedCredits = 0;
    const doneMap = new Set();
    const waivedMap = new Set();

    for (const c of courses) {
      const isDone =
        completedSet.has(c.code.toUpperCase()) ||
        (c.aliases || []).some((a) => completedSet.has(a.toUpperCase()));
      if (isDone) {
        doneMap.add(c.code);
        completedCredits += c.credits;
      } else {
        const isWaived =
          waivedSet.has(c.code.toUpperCase()) ||
          (c.aliases || []).some((a) => waivedSet.has(a.toUpperCase()));
        if (isWaived) {
          waivedMap.add(c.code);
        }
      }
    }
    completedCredits = Math.round(completedCredits * 10) / 10;

    const courseMap = {};
    for (const c of courses) {
      const isDone = doneMap.has(c.code);
      if (isDone) {
        courseMap[c.code] = {
          code: c.code,
          status: 'done',
          missing: null,
          creditsNeeded: 0,
        };
        continue;
      }

      const isWaived = waivedMap.has(c.code);
      if (isWaived) {
        courseMap[c.code] = {
          code: c.code,
          status: 'waived',
          missing: null,
          creditsNeeded: 0,
        };
        continue;
      }

      if (c.special === 'ALL_COURSEWORK') {
        courseMap[c.code] = {
          code: c.code,
          status: 'maybe',
          missing: 'Requires completion of all coursework. Confirm with your advisor.',
          creditsNeeded: 0,
        };
        continue;
      }

      const unsatisfied = [];
      for (const group of c.prereqGroups || []) {
        const sat = group.some((alt) => {
          const clean = alt.toUpperCase();
          return doneMap.has(clean) || completedSet.has(clean) || waivedMap.has(clean) || waivedSet.has(clean);
        });
        if (!sat) {
          unsatisfied.push(group);
        }
      }

      const creditsNeeded = Math.max(0, (c.min_credits || 0) - completedCredits);
      let status = 'locked';
      if (unsatisfied.length === 0 && creditsNeeded === 0) {
        status = 'available';
      } else if (c.has_waiver_option || c.has_alternative) {
        status = 'maybe';
      } else {
        status = 'locked';
      }

      let missing = null;
      if (status !== 'available' && status !== 'done' && status !== 'waived') {
        const parts = [];
        for (const g of unsatisfied) {
          parts.push(g.map((code) => code.replace(/([A-Z]{3})(\d+.*)/, '$1 $2')).join(' or '));
        }
        if (creditsNeeded > 0) {
          if (parts.length > 0) {
            parts.push(`need ${creditsNeeded} more credit(s)`);
          } else {
            parts.push(`Need ${creditsNeeded} more credit(s) (${c.min_credits} credits required)`);
          }
        }
        missing = parts.join(', ');
      }

      courseMap[c.code] = {
        code: c.code,
        status,
        missing,
        creditsNeeded,
      };
    }

    // Compute major progress for BBA
    let majorProgress = statusResult?.majorProgress || null;
    if (selectedProgram === 'BBA' && selectedMajor !== 'all') {
      let coreDone = 0;
      let coreTotal = 0;
      let electiveDone = 0;
      let electiveTotal = 0;

      for (const c of courses) {
        for (const m of c.majors || []) {
          if (m.major === selectedMajor) {
            const isFinished = doneMap.has(c.code) || waivedMap.has(c.code);
            if (m.kind === 'core') {
              coreTotal++;
              if (isFinished) coreDone++;
            } else if (m.kind === 'elective') {
              electiveTotal++;
              if (isFinished) electiveDone++;
            }
          }
        }
      }
      majorProgress = {
        core: { done: coreDone, total: coreTotal },
        elective: { done: electiveDone, total: electiveTotal },
      };
    }

    const currentProgMeta = programsList.find((p) => p.id === selectedProgram);
    const requiredCredits =
      curriculumData.requiredCredits ||
      currentProgMeta?.requiredCredits ||
      statusResult?.requiredCredits ||
      0;
    const catalogCredits = curriculumData.catalogCredits || curriculumData.totalCredits || 0;
    const remainingCredits = Math.max(0, Math.round((requiredCredits - completedCredits) * 10) / 10);

    return {
      courseMap,
      completedCredits,
      requiredCredits,
      catalogCredits,
      remainingCredits,
      totalCredits: catalogCredits,
      completedCourses: doneMap.size,
      waivedCourses: waivedMap.size,
      totalCourses: courses.length,
      majorProgress,
    };
  }, [curriculumData, activeCompleted, activeWaived, selectedProgram, selectedMajor, statusResult, programsList]);

  // Fetch sections for the Sections tab
  const fetchSections = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (selectedDept) params.set('dept', selectedDept);
    if (selectedDay) params.set('day', selectedDay);
    if (openOnly) params.set('openOnly', 'true');
    if (eligibleOnly) {
      params.set('eligibleOnly', 'true');
      params.set('program', selectedProgram);
      if (activeCompleted.length > 0) {
        params.set('completed', activeCompleted.join(','));
      }
      if (activeWaived.length > 0) {
        params.set('waived', activeWaived.join(','));
      }
    }
    params.set('sort', sortField);
    params.set('order', sortOrder);
    params.set('page', String(page));
    params.set('limit', String(limit));

    try {
      const res = await fetch(`${API_BASE}/sections?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalOpenSeats(data.totalOpenSeats || 0);
    } catch (err) {
      setError(err.message || 'Failed to load course sections.');
      setItems([]);
      setTotal(0);
      setTotalOpenSeats(0);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    selectedDept,
    selectedDay,
    openOnly,
    eligibleOnly,
    activeCompleted,
    activeWaived,
    selectedProgram,
    sortField,
    sortOrder,
    page,
    limit,
  ]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleReset = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedDept('');
    setSelectedDay('');
    setOpenOnly(false);
    setEligibleOnly(false);
    setSortField('course');
    setSortOrder('asc');
    setPage(1);
  };

  const handleCourseClick = (courseCode) => {
    setSearchTerm(courseCode);
    setDebouncedSearch(courseCode);
    setSelectedDept('');
    setPage(1);
  };

  const handleViewSections = (searchCode) => {
    setActiveTab('sections');
    setSearchTerm(searchCode);
    setDebouncedSearch(searchCode);
    setSelectedDept('');
    setSelectedDay('');
    setPage(1);
  };

  // Switch program
  const handleProgramChange = (prog) => {
    if (prog !== selectedProgram) {
      setSelectedProgram(prog);
      setSelectedMajor('all');
    }
  };

  // Toggle course completion
  const handleToggleCourse = (courseCode, aliases = []) => {
    const primaryClean = courseCode.toUpperCase();
    const aliasSet = new Set((aliases || []).map((a) => a.toUpperCase()));

    const updater = (prev) => {
      const hasCourse = prev.some((c) => {
        const clean = c.toUpperCase();
        return clean === primaryClean || aliasSet.has(clean);
      });
      if (hasCourse) {
        return prev.filter((c) => {
          const clean = c.toUpperCase();
          return clean !== primaryClean && !aliasSet.has(clean);
        });
      } else {
        return [...prev, courseCode];
      }
    };

    if (selectedProgram === 'BBA') {
      setCompletedBBA(updater);
      // Un-waive if completed
      setWaivedBBA((prev) => prev.filter((c) => c.toUpperCase() !== primaryClean && !aliasSet.has(c.toUpperCase())));
    } else if (selectedProgram === 'MIC') {
      setCompletedMIC(updater);
      setWaivedMIC((prev) => prev.filter((c) => c.toUpperCase() !== primaryClean && !aliasSet.has(c.toUpperCase())));
    } else {
      setCompletedCSE(updater);
      setWaivedCSE((prev) => prev.filter((c) => c.toUpperCase() !== primaryClean && !aliasSet.has(c.toUpperCase())));
    }
  };

  // Toggle course waived
  const handleToggleWaived = (courseCode, aliases = []) => {
    const primaryClean = courseCode.toUpperCase();
    const aliasSet = new Set((aliases || []).map((a) => a.toUpperCase()));

    const updater = (prev) => {
      const hasCourse = prev.some((c) => {
        const clean = c.toUpperCase();
        return clean === primaryClean || aliasSet.has(clean);
      });
      if (hasCourse) {
        return prev.filter((c) => {
          const clean = c.toUpperCase();
          return clean !== primaryClean && !aliasSet.has(clean);
        });
      } else {
        return [...prev, courseCode];
      }
    };

    if (selectedProgram === 'BBA') {
      setWaivedBBA(updater);
      // Un-complete if waived
      setCompletedBBA((prev) => prev.filter((c) => c.toUpperCase() !== primaryClean && !aliasSet.has(c.toUpperCase())));
    } else if (selectedProgram === 'MIC') {
      setWaivedMIC(updater);
      setCompletedMIC((prev) => prev.filter((c) => c.toUpperCase() !== primaryClean && !aliasSet.has(c.toUpperCase())));
    } else {
      setWaivedCSE(updater);
      setCompletedCSE((prev) => prev.filter((c) => c.toUpperCase() !== primaryClean && !aliasSet.has(c.toUpperCase())));
    }
  };

  // Toggle all courses in a curriculum group
  const handleToggleGroup = (groupCourses) => {
    if (!groupCourses || groupCourses.length === 0) return;

    const groupCodes = new Set();
    groupCourses.forEach((c) => {
      groupCodes.add(c.code.toUpperCase());
      (c.aliases || []).forEach((a) => groupCodes.add(a.toUpperCase()));
    });

    const allGroupCoursesDone = groupCourses.every((c) => {
      const isDone =
        activeCompleted.some((comp) => comp.toUpperCase() === c.code.toUpperCase()) ||
        (c.aliases || []).some((a) => activeCompleted.some((comp) => comp.toUpperCase() === a.toUpperCase()));
      return isDone;
    });

    const setCompletedActive = selectedProgram === 'BBA' ? setCompletedBBA : (selectedProgram === 'MIC' ? setCompletedMIC : setCompletedCSE);

    if (allGroupCoursesDone) {
      setCompletedActive((prev) => prev.filter((c) => !groupCodes.has(c.toUpperCase())));
    } else {
      setCompletedActive((prev) => {
        const updated = [...prev];
        groupCourses.forEach((c) => {
          const alreadyIn = updated.some(
            (comp) =>
              comp.toUpperCase() === c.code.toUpperCase() ||
              (c.aliases || []).some((a) => comp.toUpperCase() === a.toUpperCase())
          );
          if (!alreadyIn) {
            updated.push(c.code);
          }
        });
        return updated;
      });
    }
  };

  // Clear all progress for active program
  const handleConfirmClearAll = () => {
    if (selectedProgram === 'BBA') {
      setCompletedBBA([]);
      setWaivedBBA([]);
      try {
        localStorage.removeItem('cf_done_BBA');
        localStorage.removeItem('cf_waived_BBA');
      } catch (e) {}
    } else if (selectedProgram === 'MIC') {
      setCompletedMIC([]);
      setWaivedMIC([]);
      try {
        localStorage.removeItem('cf_done_MIC');
        localStorage.removeItem('cf_waived_MIC');
      } catch (e) {}
    } else {
      setCompletedCSE([]);
      setWaivedCSE([]);
      try {
        localStorage.removeItem('cf_done_CSE');
        localStorage.removeItem('cf_waived_CSE');
      } catch (e) {}
    }
    setShowClearModal(false);
  };

  // Text highlighting
  const highlightWords = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    return debouncedSearch
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(Boolean);
  }, [debouncedSearch]);

  const renderHighlighted = (text) => {
    if (!text || highlightWords.length === 0) return text;
    const str = String(text);
    const regex = new RegExp(`(${highlightWords.join('|')})`, 'gi');
    const parts = str.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItemIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItemIndex = Math.min(total, page * limit);

  // Summary Metrics
  const summaryCredits = optimisticStatus?.completedCredits ?? 0;
  const currentProgMeta = programsList.find((p) => p.id === selectedProgram);
  const requiredCredits =
    optimisticStatus?.requiredCredits ||
    curriculumData?.requiredCredits ||
    currentProgMeta?.requiredCredits ||
    0;
  const remainingCredits =
    optimisticStatus?.remainingCredits ??
    Math.max(0, Math.round((requiredCredits - summaryCredits) * 10) / 10);
  const extraCredits = Math.max(0, Math.round((summaryCredits - requiredCredits) * 10) / 10);

  const summaryCourses = optimisticStatus?.completedCourses ?? 0;
  const summaryWaived = optimisticStatus?.waivedCourses ?? 0;
  const totalCurriculumCourses = optimisticStatus?.totalCourses ?? (curriculumData?.totalCourses || 0);

  const creditsPercent = requiredCredits > 0
    ? Math.min(100, Math.round((summaryCredits / requiredCredits) * 100))
    : 0;
  const coursesPercent = totalCurriculumCourses > 0
    ? Math.min(100, Math.round((summaryCourses / totalCurriculumCourses) * 100))
    : 0;

  const currentGroupOrder = selectedProgram === 'BBA' ? BBA_GROUP_ORDER : (selectedProgram === 'MIC' ? MIC_GROUP_ORDER : CSE_GROUP_ORDER);

  return (
    <main className="app-container">
      {/* Brand & Page Header */}
      <header className="app-header">
        <div className="brand-badge">
          <span>NSU • SmartAdvisor</span>
          <span>•</span>
          <span>Phase 3</span>
        </div>
        <h1 className="brand-title">
          SmartAdvisor <span className="brand-gradient">Course Finder</span>
        </h1>
        <p className="brand-subtitle">
          Complete course directory & degree curriculum progress tracker for North South University.
          Supports <strong>CSE</strong>, <strong>BBA</strong>, and <strong>MIC (Microbiology)</strong> programs with live prerequisite and eligibility tracking.
        </p>
      </header>

      {/* Navigation Tab Bar */}
      <nav className="app-tabs-nav" role="tablist" aria-label="Main navigation">
        <button
          type="button"
          role="tab"
          id="tab-btn-sections"
          aria-selected={activeTab === 'sections'}
          aria-controls="panel-sections"
          className={`tab-nav-btn ${activeTab === 'sections' ? 'active' : ''}`}
          onClick={() => setActiveTab('sections')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Find sections</span>
          {total > 0 && <span className="tab-nav-badge">{total}</span>}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-btn-curriculum"
          aria-selected={activeTab === 'curriculum'}
          aria-controls="panel-curriculum"
          className={`tab-nav-btn ${activeTab === 'curriculum' ? 'active' : ''}`}
          onClick={() => setActiveTab('curriculum')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>My curriculum ({selectedProgram})</span>
          <span className="tab-nav-badge">
            {summaryCredits}/{requiredCredits} cr
          </span>
        </button>
      </nav>

      {/* =================================================================== */}
      {/* TAB 1: FIND SECTIONS                                               */}
      {/* =================================================================== */}
      {activeTab === 'sections' && (
        <div id="panel-sections" role="tabpanel" aria-labelledby="tab-btn-sections">
          {/* Search and Filter Panel */}
          <section className="controls-card" aria-label="Course search and filters">
            <div className="search-wrapper">
              <svg
                className="search-icon"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="course-search-input"
                type="search"
                className="search-input"
                placeholder="Search courses (e.g. ACT201, BUS172, ARM, Monday, NAC603)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search courses by keyword, faculty, or day"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search text"
                  title="Clear search"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter Controls Row */}
            <div className="filters-row">
              <div className="filter-group">
                <label htmlFor="dept-select" className="filter-label">
                  Department
                </label>
                <select
                  id="dept-select"
                  className="filter-select"
                  value={selectedDept}
                  onChange={(e) => {
                    setSelectedDept(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by department"
                >
                  <option value="">All Departments</option>
                  {meta.departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="day-select" className="filter-label">
                  Meeting Day
                </label>
                <select
                  id="day-select"
                  className="filter-select"
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by meeting day"
                >
                  {DAY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="checkbox-toggle-label" htmlFor="open-only-checkbox">
                <input
                  id="open-only-checkbox"
                  type="checkbox"
                  className="checkbox-input"
                  checked={openOnly}
                  onChange={(e) => {
                    setOpenOnly(e.target.checked);
                    setPage(1);
                  }}
                />
                <span>Open seats only</span>
              </label>

              {/* Eligible Only Filter */}
              <label className="eligible-toggle-wrapper" htmlFor="eligible-only-checkbox">
                <input
                  id="eligible-only-checkbox"
                  type="checkbox"
                  className="checkbox-input"
                  checked={eligibleOnly}
                  onChange={(e) => {
                    setEligibleOnly(e.target.checked);
                    setPage(1);
                  }}
                />
                <span>Courses I can take now ({selectedProgram})</span>
              </label>

              <button
                type="button"
                className="reset-btn"
                onClick={handleReset}
                aria-label="Reset all search filters"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Reset</span>
              </button>
            </div>
          </section>

          {/* Results Summary Bar */}
          <div className="results-summary-bar">
            <div className="summary-left">
              <span className="summary-total-count">
                {loading ? 'Searching sections...' : `${total.toLocaleString()} sections found`}
              </span>
              {!loading && totalOpenSeats > 0 && (
                <span className="summary-open-seats">
                  • {totalOpenSeats.toLocaleString()} open seats available
                </span>
              )}
              {eligibleOnly && (
                <span className="tab-nav-badge" style={{ marginLeft: '0.5rem' }}>
                  Eligible only ({selectedProgram}: {activeCompleted.length} done{activeWaived.length > 0 ? `, ${activeWaived.length} waived` : ''})
                </span>
              )}
            </div>

            <div className="summary-right">
              <label htmlFor="limit-select" className="page-size-label">
                Rows:
              </label>
              <select
                id="limit-select"
                className="page-size-select"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Number of sections per page"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-banner" role="alert">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Table Container */}
          <div className="table-card">
            <div className="table-responsive-wrapper">
              <table className="sections-table" aria-label="Course Sections">
                <thead>
                  <tr>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={col.sortable ? 'sortable-header' : ''}
                        onClick={() => col.sortable && handleSort(col.key)}
                        aria-sort={
                          sortField === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                      >
                        <div className="th-content">
                          <span>{col.label}</span>
                          {col.sortable && (
                            <span className="sort-icon-wrapper">
                              {sortField === col.key ? (
                                sortOrder === 'asc' ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                  </svg>
                                )
                              ) : (
                                <svg className="sort-neutral" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="loading-state-cell">
                        <div className="loading-spinner" aria-hidden="true" />
                        <span>Loading course sections...</span>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="empty-state-cell">
                        <div className="empty-state-content">
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <h3>No sections match your criteria</h3>
                          <p>Try searching another keyword, clearing your day/open-seat filters, or adjusting your eligibility.</p>
                          <button type="button" className="btn-secondary" onClick={handleReset}>
                            Reset all filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((sec) => (
                      <tr key={sec.id} className="section-row">
                        <td className="cell-course">
                          <button
                            type="button"
                            className="course-link-btn"
                            onClick={() => handleCourseClick(sec.course)}
                            title={`Search for all ${sec.course} sections`}
                          >
                            {renderHighlighted(sec.course)}
                          </button>
                        </td>
                        <td className="cell-section">
                          <span className="section-badge">Sec {sec.section}</span>
                        </td>
                        <td className="cell-faculty">
                          {renderHighlighted(sec.faculty)}
                        </td>
                        <td className="cell-time">
                          <span className="time-raw-text">{renderHighlighted(sec.time_raw || 'TBA')}</span>
                        </td>
                        <td className="cell-room">
                          <span className="room-text">{renderHighlighted(sec.room)}</span>
                        </td>
                        <td className="cell-seats">
                          <span
                            className={`seats-badge ${sec.seats > 0 ? 'seat-open' : 'seat-closed'}`}
                            title={sec.seats > 0 ? `${sec.seats} open seats` : 'No seats remaining'}
                          >
                            <span className="seat-dot" />
                            {sec.seats} {sec.seats === 1 ? 'seat' : 'seats'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!loading && total > 0 && (
              <div className="pagination-container">
                <span className="pagination-info">
                  Showing {startItemIndex.toLocaleString()} to {endItemIndex.toLocaleString()} of{' '}
                  {total.toLocaleString()} sections
                </span>

                <div className="pagination-btn-group">
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                    aria-label="First page"
                  >
                    « First
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    aria-label="Previous page"
                  >
                    ‹ Prev
                  </button>

                  <span className="page-indicator">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Next page"
                  >
                    Next ›
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                    aria-label="Last page"
                  >
                    Last »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: MY CURRICULUM PROGRESS TRACKER                              */}
      {/* =================================================================== */}
      {activeTab === 'curriculum' && (
        <div id="panel-curriculum" role="tabpanel" aria-labelledby="tab-btn-curriculum">
          {/* Program Selector Card */}
          <section className="program-selector-card" aria-label="Curriculum Program Selection">
            <div className="program-selector-left">
              <span className="program-selector-label">Curriculum:</span>
              <div className="program-pills-group" role="radiogroup" aria-label="Choose academic program">
                <button
                  type="button"
                  id="program-btn-cse"
                  role="radio"
                  aria-checked={selectedProgram === 'CSE'}
                  className={`program-pill-btn ${selectedProgram === 'CSE' ? 'active' : ''}`}
                  onClick={() => handleProgramChange('CSE')}
                >
                  <span>CSE</span>
                  <span className="program-pill-badge">
                    {programsList.find((p) => p.id === 'CSE')?.courses || 88} courses
                  </span>
                </button>
                <button
                  type="button"
                  id="program-btn-bba"
                  role="radio"
                  aria-checked={selectedProgram === 'BBA'}
                  className={`program-pill-btn ${selectedProgram === 'BBA' ? 'active' : ''}`}
                  onClick={() => handleProgramChange('BBA')}
                >
                  <span>BBA</span>
                  <span className="program-pill-badge">
                    {programsList.find((p) => p.id === 'BBA')?.courses || 124} courses
                  </span>
                </button>
                <button
                  type="button"
                  id="program-btn-mic"
                  role="radio"
                  aria-checked={selectedProgram === 'MIC'}
                  className={`program-pill-btn ${selectedProgram === 'MIC' ? 'active' : ''}`}
                  onClick={() => handleProgramChange('MIC')}
                >
                  <span>MIC</span>
                  <span className="program-pill-badge">
                    {programsList.find((p) => p.id === 'MIC')?.courses || 50} courses
                  </span>
                </button>
              </div>
            </div>

            {/* BBA Major Dropdown */}
            {selectedProgram === 'BBA' && (
              <div className="bba-major-controls">
                <label htmlFor="bba-major-select" className="filter-label-inline">
                  My major:
                </label>
                <select
                  id="bba-major-select"
                  className="major-select"
                  value={selectedMajor}
                  onChange={(e) => setSelectedMajor(e.target.value)}
                  aria-label="Filter courses by BBA major"
                >
                  {BBA_MAJORS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CSE Elective Track Dropdown */}
            {selectedProgram === 'CSE' && (
              <div className="cse-track-controls">
                <label htmlFor="cse-track-select" className="filter-label-inline">
                  Elective track:
                </label>
                <select
                  id="cse-track-select"
                  className="major-select"
                  value={selectedCseTrack}
                  onChange={(e) => setSelectedCseTrack(e.target.value)}
                  aria-label="Filter CSE electives by official track"
                >
                  {CSE_TRACK_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {/* Progress Summary Card */}
          <section className="curriculum-summary-card" aria-label="Curriculum Progress Summary">
            <div className="summary-progress-grid">
              {/* Credits Progress Box */}
              <div className="progress-metric-box">
                <div className="progress-metric-header">
                  <span className="progress-metric-title">Credits completed</span>
                  <div className="progress-metric-values">
                    <span>{summaryCredits}</span>
                    <small> / {requiredCredits} cr</small>
                  </div>
                </div>
                <div
                  className="progress-track-outer"
                  role="progressbar"
                  aria-valuenow={summaryCredits}
                  aria-valuemin={0}
                  aria-valuemax={requiredCredits}
                  aria-label="Degree Credits Progress"
                >
                  <div
                    className="progress-track-fill fill-credits"
                    style={{ width: `${creditsPercent}%` }}
                  />
                </div>
                <div className="progress-metric-subtext">
                  <span>{creditsPercent}% of degree completed</span>
                  {summaryCredits >= requiredCredits ? (
                    <span style={{ color: 'var(--seat-open-text, #10b981)', fontWeight: 600 }}>
                      Credit requirement met{extraCredits > 0 ? ` (+${extraCredits} extra cr)` : ''}
                    </span>
                  ) : (
                    <span>{remainingCredits} cr remaining</span>
                  )}
                </div>
              </div>

              {/* Courses Progress Box */}
              <div className="progress-metric-box">
                <div className="progress-metric-header">
                  <span className="progress-metric-title">Courses completed</span>
                  <div className="progress-metric-values">
                    <span>{summaryCourses}</span>
                    {summaryWaived > 0 && <small> (+{summaryWaived} waived)</small>}
                    <small> / {totalCurriculumCourses} courses</small>
                  </div>
                </div>
                <div
                  className="progress-track-outer"
                  role="progressbar"
                  aria-valuenow={summaryCourses}
                  aria-valuemin={0}
                  aria-valuemax={totalCurriculumCourses}
                  aria-label="Curriculum Courses Progress"
                >
                  <div
                    className="progress-track-fill fill-courses"
                    style={{ width: `${coursesPercent}%` }}
                  />
                </div>
                <div className="progress-metric-subtext">
                  <span>{coursesPercent}% of listed courses</span>
                  <span>{Math.max(0, totalCurriculumCourses - summaryCourses)} courses not taken yet</span>
                </div>
              </div>
            </div>

            {/* Major Progress Card (BBA Only) */}
            {selectedProgram === 'BBA' && selectedMajor !== 'all' && optimisticStatus?.majorProgress && (
              <div className="major-progress-card" style={{ marginTop: '1rem', width: '100%', justifyContent: 'space-between' }}>
                <div className="major-progress-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                  <span>Major progress ({selectedMajor}):</span>
                </div>
                <div className="major-progress-stats">
                  <span className="major-stat-pill">
                    Core: <strong>{optimisticStatus.majorProgress.core.done}</strong> / {optimisticStatus.majorProgress.core.total}
                  </span>
                  <span className="major-stat-pill">
                    Electives: <strong>{optimisticStatus.majorProgress.elective.done}</strong> / {optimisticStatus.majorProgress.elective.total}
                  </span>
                </div>
              </div>
            )}

            {/* Curriculum Toolbar: Filter dropdown + Clear all */}
            <div className="curriculum-toolbar">
              <div className="toolbar-filters">
                <label htmlFor="curriculum-filter-select" className="filter-label-inline">
                  Filter courses:
                </label>
                <select
                  id="curriculum-filter-select"
                  className="filter-select"
                  value={curriculumFilter}
                  onChange={(e) => setCurriculumFilter(e.target.value)}
                  aria-label="Filter curriculum courses by eligibility"
                >
                  <option value="all">All Courses</option>
                  <option value="completed">Completed ({summaryCourses})</option>
                  <option value="available">Available now</option>
                  <option value="locked">Locked</option>
                </select>
              </div>

              <button
                type="button"
                className="clear-all-trigger-btn"
                onClick={() => setShowClearModal(true)}
                disabled={activeCompleted.length === 0 && activeWaived.length === 0}
                aria-label={`Clear all completed and waived ${selectedProgram} courses`}
                title="Reset all completed courses"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Clear {selectedProgram} progress</span>
              </button>
            </div>
          </section>

          {/* Error Banner */}
          {curriculumError && (
            <div className="error-banner" role="alert">
              <span>{curriculumError}</span>
            </div>
          )}

          {/* Loading State */}
          {curriculumLoading && (
            <div className="table-card" style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 1rem auto' }} />
              <p style={{ color: 'var(--text-muted)' }}>Loading {selectedProgram} curriculum and requirements...</p>
            </div>
          )}

          {/* Course Groups */}
          {!curriculumLoading && curriculumData && (
            <div className="curriculum-groups-wrap">
              {currentGroupOrder.map((grpName) => {
                let groupCourses = (curriculumData.groups && curriculumData.groups[grpName]) || [];

                // Filter by major if a BBA major is picked
                if (selectedProgram === 'BBA' && selectedMajor !== 'all') {
                  if (grpName === 'Major Core') {
                    groupCourses = groupCourses.filter((c) =>
                      (c.majors || []).some((m) => m.major === selectedMajor && m.kind === 'core')
                    );
                  } else if (grpName === 'Major Elective') {
                    groupCourses = groupCourses.filter((c) =>
                      (c.majors || []).some((m) => m.major === selectedMajor && m.kind === 'elective')
                    );
                  }
                }

                // Filter by elective track if a CSE elective track is picked
                if (selectedProgram === 'CSE' && selectedCseTrack !== 'all' && grpName === 'CSE Electives') {
                  groupCourses = groupCourses.filter((c) => CSE_ELECTIVE_TRACKS[c.code] === selectedCseTrack);
                }

                if (groupCourses.length === 0) return null;

                // Calculate group progress
                let groupCompletedCount = 0;
                groupCourses.forEach((c) => {
                  const statusObj = optimisticStatus?.courseMap?.[c.code];
                  if (statusObj && (statusObj.status === 'done' || statusObj.status === 'waived')) {
                    groupCompletedCount++;
                  }
                });

                const allGroupDone = groupCompletedCount === groupCourses.length;

                // Filter courses within this group by status dropdown
                const filteredCourses = groupCourses.filter((c) => {
                  if (curriculumFilter === 'all') return true;
                  const statusObj = optimisticStatus?.courseMap?.[c.code];
                  const status = statusObj?.status || 'locked';

                  if (curriculumFilter === 'completed') return status === 'done' || status === 'waived';
                  if (curriculumFilter === 'available') return status === 'available';
                  if (curriculumFilter === 'locked') return status === 'locked' || status === 'maybe';
                  return true;
                });

                if (curriculumFilter !== 'all' && filteredCourses.length === 0) {
                  return null;
                }

                // For BBA General Education: group electives by pool
                const isBbaGenEd = selectedProgram === 'BBA' && grpName === 'General Education';
                const standardCourses = isBbaGenEd ? filteredCourses.filter((c) => !c.elective_pool) : filteredCourses;
                const poolCourses = isBbaGenEd ? filteredCourses.filter((c) => !!c.elective_pool) : [];

                const pools = isBbaGenEd
                  ? ['History', 'Political Science', 'Social Science', 'Science']
                  : [];

                return (
                  <section key={grpName} className="curriculum-group-section" aria-labelledby={`group-title-${grpName.replace(/\s+/g, '-')}`}>
                    {/* Group Header */}
                    <div className="curriculum-group-header">
                      <div className="group-title-left">
                        <h2 className="group-title-text" id={`group-title-${grpName.replace(/\s+/g, '-')}`}>
                          {grpName}
                        </h2>
                        <span className={`group-completion-pill ${allGroupDone ? 'all-done' : ''}`}>
                          {groupCompletedCount} / {groupCourses.length} done
                        </span>
                      </div>

                      <div className="group-actions-right">
                        <button
                          type="button"
                          className="mark-group-toggle-btn"
                          onClick={() => handleToggleGroup(groupCourses)}
                          aria-label={`${allGroupDone ? 'Unmark' : 'Mark'} all ${grpName} courses as completed`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {allGroupDone ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            )}
                          </svg>
                          <span>{allGroupDone ? 'Unmark all' : 'Mark all'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Standard Course Cards Grid */}
                    {standardCourses.length > 0 && (
                      <div className="courses-card-grid">
                        {standardCourses.map((c) => renderCourseCard(c))}
                      </div>
                    )}

                    {/* BBA GenEd Elective Pools Sub-grouping */}
                    {isBbaGenEd && poolCourses.length > 0 && (
                      <div className="elective-pools-wrapper" style={{ marginTop: '1.25rem' }}>
                        <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          <strong>Elective Pools</strong> – Choose from: History | Political Science | Social Science | Science
                        </div>

                        {pools.map((poolName) => {
                          const poolItems = poolCourses.filter((c) => c.elective_pool === poolName);
                          if (poolItems.length === 0) return null;

                          let poolDoneCount = 0;
                          poolItems.forEach((c) => {
                            const statusObj = optimisticStatus?.courseMap?.[c.code];
                            if (statusObj && (statusObj.status === 'done' || statusObj.status === 'waived')) {
                              poolDoneCount++;
                            }
                          });

                          return (
                            <div key={poolName} className="elective-pool-box">
                              <div className="elective-pool-header">
                                <div className="elective-pool-title">
                                  <span>{poolName} Electives</span>
                                  <span className="elective-pool-choose-label">(Pick from this pool)</span>
                                </div>
                                <span className={`elective-pool-count ${poolDoneCount > 0 ? 'has-completed' : ''}`}>
                                  {poolDoneCount} / {poolItems.length} completed
                                </span>
                              </div>

                              <div className="courses-card-grid">
                                {poolItems.map((c) => renderCourseCard(c))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clear All Confirmation Modal Dialog */}
      {showClearModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-clear-title">
          <div className="modal-dialog-card">
            <div className="modal-title-row">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 id="modal-clear-title">Clear all {selectedProgram} progress?</h3>
            </div>
            <p className="modal-message">
              Are you sure you want to reset your {selectedProgram} curriculum progress? This will uncheck all completed and waived
              courses for {selectedProgram} on this device.
            </p>
            <div className="modal-actions-row">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setShowClearModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-danger-btn"
                onClick={handleConfirmClearAll}
              >
                Clear all {selectedProgram}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Footer */}
      <footer className="app-footer">
        <p>SmartAdvisor • Multi-Program Course Finder & Degree Tracker (CSE, BBA & MIC)</p>
        <p>North South University • CSE 327 Software Engineering</p>
      </footer>
    </main>
  );

  // Helper to render an individual course card
  function renderCourseCard(c) {
    const statusObj = optimisticStatus?.courseMap?.[c.code];
    const status = statusObj?.status || 'locked';
    const isDone = status === 'done';
    const isWaived = status === 'waived';
    const missingText = statusObj?.missing;

    return (
      <div
        key={c.code}
        className={`course-tracker-card ${isDone ? 'is-done' : ''} ${isWaived ? 'is-waived' : ''}`}
        id={`course-card-${c.code}`}
      >
        {/* Card Top Row: Code, Aliases, Badges */}
        <div className="card-top-row">
          <div className="card-code-area">
            <span className="course-code-text">{c.code}</span>
            {c.aliases && c.aliases.length > 0 && (
              <span className="course-alias-text" title={`Also known as ${c.aliases.join(', ')}`}>
                (or {c.aliases.join(', ')})
              </span>
            )}
          </div>

          <div className="card-badges-area">
            {/* CSE Official UGC Semester Sequence Badge */}
            {selectedProgram === 'CSE' && (CSE_SEMESTER_MAP[c.code] || (c.aliases && c.aliases.some((a) => CSE_SEMESTER_MAP[a]))) && (
              <span
                className="semester-sequence-badge"
                title={`Recommended Semester in UGC curriculum: Semester ${CSE_SEMESTER_MAP[c.code] || CSE_SEMESTER_MAP[c.aliases?.find((a) => CSE_SEMESTER_MAP[a])]}`}
              >
                Sem {CSE_SEMESTER_MAP[c.code] || CSE_SEMESTER_MAP[c.aliases?.find((a) => CSE_SEMESTER_MAP[a])]}
              </span>
            )}

            {/* CSE Elective Track Tag */}
            {selectedProgram === 'CSE' && CSE_ELECTIVE_TRACKS[c.code] && (
              <span className="cse-track-badge" title={`CSE Elective Track: ${CSE_ELECTIVE_TRACKS[c.code]}`}>
                {CSE_ELECTIVE_TRACKS[c.code]}
              </span>
            )}

            <span className="credits-badge-tag">{c.credits} cr</span>

            {/* Status Badge */}
            {status === 'done' && (
              <span className="status-badge status-done">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Completed
              </span>
            )}
            {status === 'waived' && (
              <span className="status-badge status-waived">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Waived
              </span>
            )}
            {status === 'available' && (
              <span className="status-badge status-available">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Available
              </span>
            )}
            {status === 'maybe' && (
              <span className="status-badge status-maybe">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Needs approval
              </span>
            )}
            {status === 'locked' && (
              <span className="status-badge status-locked">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </span>
            )}
          </div>
        </div>

        {/* Course Title */}
        <h3 className="course-name-text">{c.name}</h3>

        {/* Note tag (e.g. for ENG115 "For 143-162") */}
        {c.note && (
          <div className="course-note-box">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{c.note}</span>
          </div>
        )}

        {/* Majors tags for dual/multi major courses (e.g. HRM370, MKT382) */}
        {c.majors && c.majors.length > 0 && (
          <div className="major-tags-list">
            {c.majors.map((m, idx) => (
              <span key={idx} className={`major-tag ${m.kind === 'core' ? 'is-core' : 'is-elective'}`}>
                {m.major} {m.kind === 'core' ? 'Core' : 'Elective'}
              </span>
            ))}
          </div>
        )}

        {/* Co-requisite Hint (e.g. for BIO103L) */}
        {c.coreq_codes && c.coreq_codes.length > 0 && (
          <div className="coreq-hint-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Take together with {c.coreq_codes.map((code) => code.replace(/([A-Z]{3})(\d+.*)/, '$1 $2')).join(', ')}</span>
          </div>
        )}

        {/* Actions Row: Completed checkbox + Waived toggle */}
        <div className="course-card-actions">
          <label className="course-completion-toggle" htmlFor={`course-chk-${c.code}`}>
            <input
              id={`course-chk-${c.code}`}
              type="checkbox"
              className="course-checkbox-input"
              checked={isDone}
              onChange={() => handleToggleCourse(c.code, c.aliases)}
              aria-label={`Mark ${c.code} (${c.name}) as completed`}
            />
            <span>{isDone ? 'Completed' : 'Mark completed'}</span>
          </label>

          {c.waivable && (
            <label className="waived-toggle-wrapper" htmlFor={`course-waived-${c.code}`}>
              <input
                id={`course-waived-${c.code}`}
                type="checkbox"
                className="waived-checkbox"
                checked={isWaived}
                onChange={() => handleToggleWaived(c.code, c.aliases)}
                aria-label={`Waive ${c.code} (${c.name})`}
              />
              <span>Waived</span>
            </label>
          )}
        </div>

        {/* Missing Prerequisites Box */}
        {(status === 'locked' || status === 'maybe') && missingText && (
          <div className={`card-missing-box ${status === 'locked' ? 'is-locked' : ''}`}>
            <svg className="card-missing-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              <strong>Requirements:</strong> {missingText}
            </span>
          </div>
        )}

        {/* Unknown Prerequisites ("Also listed") */}
        {c.unknown_prereqs && c.unknown_prereqs.length > 0 && (
          <div className="card-unknowns-box">
            Also listed in catalog: {c.unknown_prereqs.join(', ')}
          </div>
        )}

        {/* Footer: Sections Availability & View Button */}
        <div className="card-footer-row">
          <span className={`sections-stat-text ${c.openSectionCount > 0 ? 'has-open' : ''}`}>
            {c.sectionCount > 0
              ? `${c.sectionCount} ${c.sectionCount === 1 ? 'section' : 'sections'}, ${c.openSectionCount} with open seats`
              : 'No sections in the current data'}
          </span>

          <button
            type="button"
            className="view-sections-action-btn"
            onClick={() => handleViewSections(c.searchCode || c.code)}
            title={`Search sections for ${c.searchCode || c.code}`}
          >
            <span>View sections</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
}
