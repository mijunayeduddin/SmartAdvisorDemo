const fs = require('fs');
const path = require('path');

// Canonical title dictionary for common NSU courses
const COURSE_TITLE_DICTIONARY = {
  // CSE
  'CSE115': 'Programming Language I',
  'CSE115L': 'Programming Language I Lab',
  'CSE173': 'Discrete Mathematics',
  'CSE215': 'Programming Language II',
  'CSE215L': 'Programming Language II Lab',
  'CSE225': 'Data Structures and Algorithms',
  'CSE225L': 'Data Structures and Algorithms Lab',
  'CSE231': 'Digital Logic Design',
  'CSE231L': 'Digital Logic Design Lab',
  'CSE273': 'Introduction to Theory of Computation',
  'CSE299': 'Junior Design Project',
  'CSE311': 'Database Management Systems',
  'CSE311L': 'Database Management Systems Lab',
  'CSE323': 'Operating Systems Concepts',
  'CSE325': 'Computer Networks',
  'CSE327': 'Software Engineering',
  'CSE331': 'Microprocessor Interfacing and Embedded Systems',
  'CSE331L': 'Microprocessor Interfacing Lab',
  'CSE332': 'Computer Organization and Architecture',
  'CSE332L': 'Computer Organization and Architecture Lab',
  'CSE338': 'Compiler Construction',
  'CSE338L': 'Compiler Construction Lab',
  'CSE373': 'Design and Analysis of Algorithms',
  'CSE411': 'Advanced Database Systems',
  'CSE413': 'Artificial Intelligence',
  'CSE413L': 'Artificial Intelligence Lab',
  'CSE425': 'Concepts of Programming Languages',
  'CSE434': 'Cloud Computing & Distributed Systems',
  'CSE435': 'Computer Graphics',
  'CSE435L': 'Computer Graphics Lab',
  'CSE438': 'Network Security',
  'CSE438L': 'Network Security Lab',
  'CSE440': 'Human Computer Interaction',
  'CSE445': 'Machine Learning',
  'CSE465': 'Deep Learning & Neural Networks',
  'CSE468': 'Cybersecurity Operations',
  'CSE491': 'Special Topics in Computer Science',
  'CSE495A': 'Software Project Management',
  'CSE495B': 'Software Architecture and Design',
  'CSE498R': 'Undergraduate Directed Research',
  'CSE499A': 'Senior Design Project I',
  'CSE499B': 'Senior Design Project II',

  // Mathematics
  'MAT116': 'Pre-calculus',
  'MAT120': 'Calculus and Analytical Geometry I',
  'MAT125': 'Introduction to Linear Algebra',
  'MAT130': 'Calculus and Analytical Geometry II',
  'MAT250': 'Calculus and Analytical Geometry III',
  'MAT350': 'Engineering Mathematics',
  'MAT361': 'Probability and Statistics',
  'MAT480': 'Differential Equations',
  'MAT483': 'Numerical Analysis',
  'MAT485': 'Operations Research',

  // Electrical & Electronic Engineering
  'EEE111': 'Analog Electronics',
  'EEE111L': 'Analog Electronics Lab',
  'EEE141': 'Electric Circuits',
  'EEE141L': 'Electric Circuits Lab',
  'EEE154': 'Engineering Drawing & CAD',
  'EEE211': 'Signals and Systems',
  'EEE211L': 'Signals and Systems Lab',
  'EEE221': 'Electromagnetic Fields and Waves',
  'EEE221L': 'Electromagnetics Lab',
  'EEE241': 'Digital Electronics',
  'EEE241L': 'Digital Electronics Lab',
  'EEE299': 'Junior Design Project (EEE)',
  'EEE311': 'Electronic Devices and Circuits',
  'EEE311L': 'Electronic Devices Lab',
  'EEE312': 'Power Electronics',
  'EEE312L': 'Power Electronics Lab',
  'EEE321': 'Control Systems',
  'EEE321L': 'Control Systems Lab',
  'EEE331': 'Communication Systems',
  'EEE331L': 'Communication Systems Lab',
  'EEE332': 'VLSI Design',
  'EEE332L': 'VLSI Design Lab',
  'EEE342': 'Power Systems I',
  'EEE342L': 'Power Systems Lab',
  'EEE361': 'Electrical Machines',
  'EEE362': 'Digital Signal Processing',
  'EEE362L': 'Digital Signal Processing Lab',
  'EEE363': 'Biomedical Instrumentation',
  'EEE363L': 'Biomedical Instrumentation Lab',
  'EEE452': 'Engineering Economics',

  // English & Humanities
  'ENG102': 'Introduction to Composition',
  'ENG103': 'Intermediate Composition',
  'ENG105': 'Advanced Critical Reading and Writing',
  'ENG111': 'Public Speaking',
  'ENG115': 'Advanced English Composition',
  'ENG210': 'Introduction to Linguistics',
  'ENG216': 'Survey of English Literature',
  'ENG220': 'World Literature',
  'ENG230': 'Introduction to Literary Theory',
  'ENG260': 'Business and Technical Communication',
  'BEN205': 'Bengali Language and Literature',
  'HIS101': 'Bangladesh History and Culture',
  'HIS102': 'Introduction to World Civilizations',
  'HIS103': 'Emergence of Bangladesh',
  'PHI101': 'Introduction to Logic',
  'PHI104': 'Introduction to Philosophy',
  'PHI401': 'Business Ethics',

  // Sciences
  'PHY107': 'General Physics I',
  'PHY107L': 'General Physics I Lab',
  'PHY108': 'General Physics II',
  'PHY108L': 'General Physics II Lab',
  'CHE101': 'General Chemistry',
  'CHE101L': 'General Chemistry Lab',
  'CHE201': 'Organic Chemistry I',
  'CHE202': 'Organic Chemistry II',
  'CHE202L': 'Organic Chemistry II Lab',
  'CHE203': 'Physical Chemistry',
  'CHE203L': 'Physical Chemistry Lab',
  'BIO103': 'Biology I',
  'BIO103L': 'Biology I Lab',
  'BIO201': 'General Biology II',
  'BIO201L': 'General Biology II Lab',
  'BIO202': 'Genetics & Evolution',
  'BIO202L': 'Genetics Lab',
  'ENV107': 'Introduction to Environmental Science',
  'ENV107L': 'Environmental Science Lab',
  'CEE110': 'Basic Environmental Studies',

  // Business & Economics
  'ACT201': 'Introduction to Financial Accounting',
  'ACT202': 'Introduction to Managerial Accounting',
  'ACT310': 'Intermediate Accounting I',
  'ACT320': 'Cost Accounting',
  'ACT360': 'Auditing and Assurance Services',
  'ACT370': 'Accounting Information Systems',
  'ACT380': 'Taxation Law & Practice',
  'ACT410': 'Advanced Financial Accounting',
  'ACT430': 'Corporate Financial Reporting',
  'BUS112': 'Introduction to Business',
  'BUS135': 'Business Mathematics',
  'BUS172': 'Introduction to Statistics',
  'BUS173': 'Applied Business Statistics',
  'BUS251': 'Business Law & Ethics',
  'FIN254': 'Principles of Managerial Finance',
  'FIN410': 'Financial Markets and Institutions',
  'FIN433': 'Corporate Finance',
  'FIN435': 'Investment Analysis & Portfolio Management',
  'FIN440': 'International Financial Management',
  'FIN444': 'Commercial Banking and Risk',
  'FIN455': 'Derivatives and Financial Engineering',
  'FIN464': 'Real Estate Finance & Valuation',
  'FIN480': 'Financial Modeling & Valuation',
  'MGT212': 'Principles of Management',
  'MGT314': 'Organizational Behavior',
  'MGT321': 'Human Resource Planning',
  'MGT330': 'Operations Management',
  'MGT351': 'Human Resource Management',
  'MGT360': 'Leadership & Change Management',
  'MGT368': 'Entrepreneurship and Innovation',
  'MGT410': 'Strategic Management',
  'MGT489': 'Strategic Management Capstone',
  'MGT490': 'International Business Strategy',
  'MKT202': 'Principles of Marketing',
  'MKT330': 'Consumer Behavior',
  'MKT337': 'Promotional Management & Advertising',
  'MKT344': 'Marketing Management',
  'MKT382': 'Digital & Social Media Marketing',
  'MKT412': 'Services Marketing',
  'MKT460': 'Strategic Brand Management',
  'MKT465': 'Marketing Research',
  'MKT470': 'International Marketing',
  'MIS107': 'Computer Information Systems',
  'MIS207': 'E-Business & Internet Marketing',
  'MIS210': 'Database for Business Applications',
  'MIS310': 'Enterprise Resource Planning (ERP)',
  'MIS320': 'Business Intelligence and Analytics',
  'MIS410': 'IT Project Management',
  'ECO101': 'Introduction to Microeconomics',
  'ECO104': 'Introduction to Macroeconomics',
  'ECO135': 'Quantitative Methods for Economics',
  'ECO172': 'Introduction to Econometrics',
  'ECO173': 'Applied Econometrics',
  'ECO201': 'Intermediate Microeconomics',
  'ECO204': 'Intermediate Macroeconomics',
  'ECO245': 'Money and Banking',
  'ECO301': 'Advanced Microeconomic Theory',
  'ECO304': 'Advanced Macroeconomic Theory',
  'ECO372': 'Econometric Analysis',

  // Social Sciences & Health
  'POL101': 'Introduction to Political Science',
  'POL104': 'Government and Politics of Bangladesh',
  'POL202': 'Comparative Political Systems',
  'SOC101': 'Introduction to Sociology',
  'SOC103': 'Social Problems and Policy',
  'SOC201': 'Sociological Theory',
  'PSY101': 'Introduction to Psychology',
  'PSY101L': 'Psychology Laboratory',
  'PBH101': 'Introduction to Public Health',
  'PBH101L': 'Public Health Practicum Lab',
  'PBH105': 'Epidemiology Fundamentals',
  'PBH123': 'Global Health and Sustainability'
};

const DEPARTMENT_NAMES = {
  'ACT': 'Accounting',
  'ANT': 'Anthropology',
  'ARC': 'Architecture',
  'BBT': 'Biotechnology',
  'BEN': 'Bengali',
  'BIO': 'Biology',
  'BSC': 'Basic Science',
  'BUS': 'Business Administration',
  'CE': 'Civil Engineering',
  'CEE': 'Civil & Environmental Engineering',
  'CHE': 'Chemistry',
  'CHN': 'Chinese Language',
  'CSE': 'Computer Science & Engineering',
  'DEV': 'Development Studies',
  'ECO': 'Economics',
  'EEE': 'Electrical & Electronic Engineering',
  'EMB': 'Executive MBA',
  'EMPG': 'Executive Masters in Policy',
  'EMPH': 'Executive Masters in Public Health',
  'ENG': 'English & Modern Languages',
  'ENV': 'Environmental Science',
  'ETE': 'Electronics & Telecom Engineering',
  'ETH': 'Ethics',
  'FIN': 'Finance',
  'GEO': 'Geography',
  'HAS': 'Health Administration',
  'HIS': 'History & Philosophy',
  'HRM': 'Human Resource Management',
  'INB': 'International Business',
  'LAW': 'Law',
  'LBA': 'Liberal Arts',
  'MAT': 'Mathematics & Statistics',
  'MCJ': 'Media & Journalism',
  'MGT': 'Management',
  'MIC': 'Microbiology',
  'MIS': 'Management Information Systems',
  'MKT': 'Marketing',
  'PAD': 'Public Administration',
  'PBH': 'Public Health',
  'PHI': 'Philosophy',
  'PHY': 'Physics',
  'POL': 'Political Science',
  'PPG': 'Public Policy',
  'PSY': 'Psychology',
  'SCM': 'Supply Chain Management',
  'SOC': 'Sociology',
  'TNM': 'Television & New Media',
  'WMS': 'Women & Gender Studies'
};

function normaliseTime(raw) {
  if (!raw) return null;
  raw = raw.trim();
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}:00`;
  }
  return null;
}

function parseScheduleString(str) {
  if (!str || str.trim().toUpperCase() === 'TBA') {
    return { days: 'TBA', startTime: null, endTime: null };
  }
  const match = str.trim().match(/^([A-Za-z]+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
  if (match) {
    return {
      days: match[1].toUpperCase(),
      startTime: normaliseTime(match[2]),
      endTime: normaliseTime(match[3])
    };
  }
  return { days: str.trim(), startTime: null, endTime: null };
}

function inferDepartment(code) {
  const match = code.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : 'GEN';
}

function inferCredits(code) {
  if (code.endsWith('L') || code.includes('LAB')) return 1.0;
  if (code.includes('499') || code.includes('498')) return 1.5;
  if (code === 'MAT116') return 0.0;
  if (['PHY107', 'PHY108', 'CHE101', 'BIO103', 'BIO201', 'BIO202', 'CSE115', 'CSE215', 'EEE141', 'EEE111'].includes(code)) {
    return 4.0;
  }
  return 3.0;
}

function inferTitle(code) {
  if (COURSE_TITLE_DICTIONARY[code]) {
    return COURSE_TITLE_DICTIONARY[code];
  }
  const dept = inferDepartment(code);
  const deptName = DEPARTMENT_NAMES[dept] || dept;
  const numPart = code.replace(/^[A-Za-z]+/, '');
  return `${deptName} ${numPart}`;
}

// In-memory cache for parsed data
let cachedParsedData = null;

function loadAndParseResponseData() {
  if (cachedParsedData) return cachedParsedData;

  const dataPath = path.resolve(__dirname, '../../data/response.json');
  let rawSections = [];
  try {
    const content = fs.readFileSync(dataPath, 'utf8');
    rawSections = JSON.parse(content);
  } catch (err) {
    console.warn('[CourseDataParser] Could not load response.json from data/, trying fallback fixture:', err.message);
    try {
      const fallbackPath = path.resolve(__dirname, '../../scripts/fixtures/response.json');
      rawSections = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    } catch (e) {
      console.error('[CourseDataParser] Failed to load response.json from fallback:', e.message);
      rawSections = [];
    }
  }

  const courseCodesSet = new Set();
  const parsedSections = [];

  for (let i = 0; i < rawSections.length; i++) {
    const raw = rawSections[i];
    const rawCourse = (raw.Course || '').trim().toUpperCase();
    if (!rawCourse) continue;

    // Handle cross-listed codes like BBT608/BBT609: use primary code
    const primaryCode = rawCourse.split('/')[0].trim();
    courseCodesSet.add(primaryCode);

    const sectionNum = parseInt(raw.Section, 10) || 1;
    const seatsAvailable = parseInt(raw.Seats, 10) >= 0 ? parseInt(raw.Seats, 10) : 0;
    const capacity = 35;
    const enrolledCount = Math.max(0, capacity - seatsAvailable);

    const sched = parseScheduleString(raw.Time);
    const faculty = (raw.Faculty || 'TBA').trim();
    const room = (raw.Room || 'TBA').trim();
    const term = (raw.Semester && raw.Semester.trim()) || 'Fall 2026';

    const sectionId = `sec-${primaryCode}-${sectionNum}`;

    parsedSections.push({
      id: sectionId,
      course_id: `crs-${primaryCode}`,
      course_code: primaryCode,
      section_number: sectionNum,
      capacity,
      enrolled_count: enrolledCount,
      seats_available: seatsAvailable,
      room,
      day_of_week: sched.days,
      start_time: sched.startTime || '08:00:00',
      end_time: sched.endTime || '09:30:00',
      raw_time: raw.Time || 'TBA',
      faculty_name: faculty,
      term,
      course_title: inferTitle(primaryCode),
      course_credits: inferCredits(primaryCode),
      is_milestone: ['CSE115', 'MAT120', 'CSE173', 'MAT130', 'CSE215', 'MAT250', 'CSE225', 'CSE311', 'CSE327', 'CSE425', 'CSE499A', 'CSE499B'].includes(primaryCode)
    });
  }

  // Construct Course catalog objects
  const parsedCourses = Array.from(courseCodesSet).sort().map(code => {
    const dept = inferDepartment(code);
    return {
      id: `crs-${code}`,
      code,
      title: inferTitle(code),
      credits: inferCredits(code),
      department: dept,
      description: `${inferTitle(code)} offered by Department of ${DEPARTMENT_NAMES[dept] || dept}`,
      isMilestone: ['CSE115', 'MAT120', 'CSE173', 'MAT130', 'CSE215', 'MAT250', 'CSE225', 'CSE311', 'CSE327', 'CSE425', 'CSE499A', 'CSE499B'].includes(code),
      prerequisites: []
    };
  });

  cachedParsedData = {
    courses: parsedCourses,
    sections: parsedSections,
    coursesMap: new Map(parsedCourses.map(c => [c.code, c])),
    sectionsByCourseMap: new Map()
  };

  for (const sec of parsedSections) {
    if (!cachedParsedData.sectionsByCourseMap.has(sec.course_code)) {
      cachedParsedData.sectionsByCourseMap.set(sec.course_code, []);
    }
    cachedParsedData.sectionsByCourseMap.get(sec.course_code).push(sec);
  }

  return cachedParsedData;
}

module.exports = {
  loadAndParseResponseData,
  inferDepartment,
  inferCredits,
  inferTitle,
  parseScheduleString,
  DEPARTMENT_NAMES,
  COURSE_TITLE_DICTIONARY
};
