const path = require('path');
const fs = require('fs');
const dbPool = require('../patterns/singleton/dbPool');
const graphCache = require('../patterns/singleton/graphCache');
const { buildGraph } = require('../../core/graphSolver.ts');

const STATIC_COURSES = [
  { code: 'ENG102', title: 'Introduction to Composition', credits: 3.0, department: 'CSE', description: 'Basic English composition and academic writing', is_milestone: false, prerequisites: [] },
  { code: 'MAT116', title: 'Pre-calculus', credits: 0.0, department: 'CSE', description: 'Foundation algebra and trigonometry (non-credit requirement)', is_milestone: false, prerequisites: [] },
  { code: 'CEE110', title: 'Basic Environmental Studies', credits: 1.0, department: 'CSE', description: 'Introduction to environmental systems and sustainability', is_milestone: false, prerequisites: [] },
  { code: 'CSE115', title: 'Programming Language I', credits: 4.0, department: 'CSE', description: 'Structured programming concepts in C/C++', is_milestone: true, prerequisites: [] },
  { code: 'ENG103', title: 'Intermediate Composition', credits: 3.0, department: 'CSE', description: 'Intermediate critical reading and argumentation', is_milestone: false, prerequisites: ['ENG102'] },
  { code: 'MAT120', title: 'Calculus and Analytical Geometry I', credits: 3.0, department: 'CSE', description: 'Differential and integral calculus fundamentals', is_milestone: true, prerequisites: ['MAT116'] },
  { code: 'MAT125', title: 'Introduction to Linear Algebra', credits: 3.0, department: 'CSE', description: 'Matrices, vector spaces, and linear transformations', is_milestone: false, prerequisites: ['MAT116'] },
  { code: 'CSE173', title: 'Discrete Mathematics', credits: 3.0, department: 'CSE', description: 'Sets, logic, combinatorics, relations, and graph theory', is_milestone: true, prerequisites: ['CSE115'] },
  { code: 'ENG111', title: 'Public Speaking', credits: 3.0, department: 'CSE', description: 'Oral communication and presentation techniques', is_milestone: false, prerequisites: ['ENG103'] },
  { code: 'MAT130', title: 'Calculus and Analytical Geometry II', credits: 3.0, department: 'CSE', description: 'Advanced integration techniques and multivariate series', is_milestone: true, prerequisites: ['MAT120'] },
  { code: 'PHY107', title: 'General Physics I', credits: 4.0, department: 'CSE', description: 'Mechanics, waves, and thermodynamics with laboratory', is_milestone: false, prerequisites: ['MAT120'] },
  { code: 'CSE215', title: 'Programming Language II', credits: 4.0, department: 'CSE', description: 'Object-oriented programming concepts using Java', is_milestone: true, prerequisites: ['CSE115'] },
  { code: 'PHI104', title: 'Introduction to Philosophy', credits: 3.0, department: 'CSE', description: 'Ethics, epistemology, and critical thinking', is_milestone: false, prerequisites: ['ENG103'] },
  { code: 'MAT250', title: 'Calculus and Analytical Geometry III', credits: 3.0, department: 'CSE', description: 'Multivariable calculus, partial derivatives, multiple integrals', is_milestone: true, prerequisites: ['MAT130'] },
  { code: 'PHY108', title: 'General Physics II', credits: 4.0, department: 'CSE', description: 'Electricity, magnetism, and optics with laboratory', is_milestone: false, prerequisites: ['PHY107'] },
  { code: 'CSE225', title: 'Data Structures and Algorithms', credits: 3.0, department: 'CSE', description: 'Lists, stacks, queues, trees, sorting, and algorithmic complexity', is_milestone: true, prerequisites: ['CSE215', 'CSE173'] },
  { code: 'ENG115', title: 'Advanced English Composition', credits: 3.0, department: 'CSE', description: 'Technical and professional research writing', is_milestone: false, prerequisites: ['ENG103'] },
  { code: 'MAT350', title: 'Engineering Mathematics', credits: 3.0, department: 'CSE', description: 'Differential equations and transform methods', is_milestone: false, prerequisites: ['MAT250'] },
  { code: 'EEE141', title: 'Electric Circuits', credits: 4.0, department: 'CSE', description: 'DC/AC circuit analysis and electronic components with laboratory', is_milestone: false, prerequisites: ['PHY108'] },
  { code: 'CSE231', title: 'Digital Logic Design', credits: 3.0, department: 'CSE', description: 'Boolean algebra, combinational and sequential circuit design', is_milestone: false, prerequisites: ['CSE173'] },
  { code: 'HIS101', title: 'Bangladesh History and Culture', credits: 3.0, department: 'CSE', description: 'Heritage, liberation war, and socio-political history of Bangladesh', is_milestone: false, prerequisites: [] },
  { code: 'MAT361', title: 'Probability and Statistics', credits: 3.0, department: 'CSE', description: 'Probability distributions, hypothesis testing, and regression', is_milestone: false, prerequisites: ['MAT250'] },
  { code: 'CSE299', title: 'Junior Design Project', credits: 1.0, department: 'CSE', description: 'Collaborative engineering design project (note: requires 60 credits completed)', is_milestone: false, prerequisites: ['CSE215'] },
  { code: 'HIS102', title: 'Introduction to World Civilizations', credits: 3.0, department: 'CSE', description: 'Historical developments of global civilizations', is_milestone: false, prerequisites: [] },
  { code: 'CHE101', title: 'General Chemistry', credits: 4.0, department: 'CSE', description: 'Chemical bonding, stoichiometry, and thermochemistry with laboratory', is_milestone: false, prerequisites: [] },
  { code: 'EEE111', title: 'Analog Electronics', credits: 4.0, department: 'CSE', description: 'Diodes, transistors, amplifiers, and frequency response with laboratory', is_milestone: false, prerequisites: ['EEE141'] },
  { code: 'CSE332', title: 'Computer Organization and Architecture', credits: 3.0, department: 'CSE', description: 'CPU architecture, instruction sets, pipelining, and memory hierarchy', is_milestone: false, prerequisites: ['CSE231'] },
  { code: 'CSE311', title: 'Database Management Systems', credits: 3.0, department: 'CSE', description: 'Relational data model, SQL, normalization, transactions, and indexing', is_milestone: true, prerequisites: ['CSE225'] },
  { code: 'CSE323', title: 'Operating Systems Concepts', credits: 3.0, department: 'CSE', description: 'Process management, synchronization, memory virtualization, file systems', is_milestone: false, prerequisites: ['CSE332'] },
  { code: 'CSE373', title: 'Design and Analysis of Algorithms', credits: 3.0, department: 'CSE', description: 'Divide-and-conquer, greedy, dynamic programming, NP-completeness', is_milestone: false, prerequisites: ['CSE225'] },
  { code: 'BIO103', title: 'Biology I', credits: 4.0, department: 'CSE', description: 'Cellular biology, genetics, and biotechnology with laboratory', is_milestone: false, prerequisites: [] },
  { code: 'CSE327', title: 'Software Engineering', credits: 3.0, department: 'CSE', description: 'Software lifecycle, design patterns, testing, and agile methodologies', is_milestone: true, prerequisites: ['CSE311'] },
  { code: 'CSE331', title: 'Microprocessor Interfacing and Embedded Systems', credits: 3.0, department: 'CSE', description: 'Microcontrollers, assembly language, interrupt handlers, I/O interfacing', is_milestone: false, prerequisites: ['CSE332'] },
  { code: 'CSE425', title: 'Concepts of Programming Languages', credits: 3.0, department: 'CSE', description: 'Language paradigms, syntax, type systems, functional and logic programming', is_milestone: true, prerequisites: ['CSE311', 'CSE373'] },
  { code: 'EEE452', title: 'Engineering Economics', credits: 3.0, department: 'CSE', description: 'Cost analysis, project evaluation, time value of money, decision making', is_milestone: false, prerequisites: ['MAT130'] },
  { code: 'CSE499A', title: 'Senior Design Project I', credits: 1.5, department: 'CSE', description: 'Capstone research and engineering project phase I (note: requires 100 credits completed)', is_milestone: true, prerequisites: ['CSE327'] },
  { code: 'CSE499B', title: 'Senior Design Project II', credits: 1.5, department: 'CSE', description: 'Capstone final implementation, defense, and report', is_milestone: true, prerequisites: ['CSE499A'] }
];

let inMemorySections = null;

function loadFallbackSections() {
  if (inMemorySections) return inMemorySections;
  const fixturePath = path.resolve(__dirname, '../../scripts/fixtures/offered_courses_snapshot.json');
  let raw = [];
  try {
    raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  } catch (e) {
    console.warn('[CurriculumService] Could not read offered_courses_snapshot.json:', e);
  }

  const courseTitleMap = Object.fromEntries(STATIC_COURSES.map(c => [c.code, c.title]));
  const milestoneMap = Object.fromEntries(STATIC_COURSES.map(c => [c.code, c.is_milestone]));

  inMemorySections = raw.map((row, idx) => ({
    id: `sec-${row.courseCode}-${row.sectionNumber}`,
    course_id: `crs-${row.courseCode}`,
    course_code: row.courseCode,
    section_number: Number(row.sectionNumber),
    capacity: 35,
    enrolled_count: Math.max(0, 35 - Number(row.seatsAvailable)),
    seats_available: Number(row.seatsAvailable),
    room: row.room,
    day_of_week: row.days,
    start_time: row.startTime,
    end_time: row.endTime,
    faculty_name: row.faculty,
    term: 'Fall 2026',
    course_title: courseTitleMap[row.courseCode] || row.courseCode,
    course_credits: 3,
    is_milestone: Boolean(milestoneMap[row.courseCode]),
  }));
  return inMemorySections;
}

/**
 * Service to load and cache the Curriculum DAG and retrieve student academic context.
 */
class CurriculumService {
  /**
   * Fetch courses and prerequisites and construct CurriculumGraph
   * @param {boolean} forceRefresh
   */
  async getCurriculumGraph(forceRefresh = false) {
    if (!forceRefresh && graphCache.hasGraph()) {
      return graphCache.getGraph();
    }

    try {
      const query = `
        SELECT 
          c.id,
          c.code,
          c.title,
          c.credits,
          c.department,
          c.description,
          c.is_milestone,
          COALESCE(
            json_agg(p.code) FILTER (WHERE p.code IS NOT NULL),
            '[]'
          ) AS prerequisites
        FROM courses c
        LEFT JOIN prerequisites pr ON pr.course_id = c.id
        LEFT JOIN courses p ON p.id = pr.prereq_course_id
        GROUP BY c.id, c.code, c.title, c.credits, c.department, c.description, c.is_milestone
        ORDER BY c.code;
      `;

      const res = await dbPool.query(query);
      const courseInputs = res.rows.map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        credits: Number(row.credits),
        isMilestone: Boolean(row.is_milestone),
        prerequisites: row.prerequisites || []
      }));

      const graph = buildGraph(courseInputs);
      graphCache.setGraph(graph);
      return graph;
    } catch (err) {
      // Fallback to static catalog DAG
      const courseInputs = STATIC_COURSES.map((c) => ({
        id: `crs-${c.code}`,
        code: c.code,
        title: c.title,
        credits: c.credits,
        isMilestone: c.is_milestone,
        prerequisites: c.prerequisites
      }));
      const graph = buildGraph(courseInputs);
      graphCache.setGraph(graph);
      return graph;
    }
  }

  /**
   * Get all courses catalog with optional department filter
   */
  async getAllCourses(department) {
    try {
      let courseQuery = `
        SELECT 
          c.id,
          c.code,
          c.title,
          c.credits,
          c.department,
          c.description,
          c.is_milestone,
          COALESCE(
            json_agg(p.code) FILTER (WHERE p.code IS NOT NULL),
            '[]'
          ) AS prerequisites
        FROM courses c
        LEFT JOIN prerequisites pr ON pr.course_id = c.id
        LEFT JOIN courses p ON p.id = pr.prereq_course_id
      `;

      const params = [];
      if (department) {
        params.push(department);
        courseQuery += ` WHERE c.department = $1`;
      }

      courseQuery += `
        GROUP BY c.id, c.code, c.title, c.credits, c.department, c.description, c.is_milestone
        ORDER BY c.code;
      `;

      const res = await dbPool.query(courseQuery, params);
      return res.rows.map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        credits: Number(row.credits),
        department: row.department,
        description: row.description,
        isMilestone: Boolean(row.is_milestone),
        prerequisites: row.prerequisites || []
      }));
    } catch (e) {
      let list = STATIC_COURSES;
      if (department) {
        list = list.filter((c) => c.department === department);
      }
      return list.map((c) => ({
        id: `crs-${c.code}`,
        code: c.code,
        title: c.title,
        credits: c.credits,
        department: c.department,
        description: c.description,
        isMilestone: c.is_milestone,
        prerequisites: c.prerequisites
      }));
    }
  }

  /**
   * Retrieve a student's profile, completed courses, and credits
   * @param {string} studentId - Student identifier (e.g. '2412800642')
   */
  async getStudentProfile(studentId) {
    if (!studentId) return null;

    try {
      // 1. Fetch student info
      const studentRes = await dbPool.query(
        `SELECT id, student_id, name, email, department, completed_credits 
         FROM students 
         WHERE student_id = $1 OR id::text = $1 
         LIMIT 1;`,
        [studentId]
      );

      if (studentRes.rows.length === 0) {
        return null;
      }

      const studentRow = studentRes.rows[0];

      // 2. Fetch completed course codes
      const enrollmentsRes = await dbPool.query(
        `SELECT c.code 
         FROM enrollments e
         JOIN sections s ON s.id = e.section_id
         JOIN courses c ON c.id = s.course_id
         WHERE e.student_id = $1 AND e.status = 'completed';`,
        [studentRow.id]
      );

      const completedCourses = enrollmentsRes.rows.map((r) => r.code);

      return {
        id: studentRow.id,
        studentId: studentRow.student_id,
        name: studentRow.name,
        email: studentRow.email,
        department: studentRow.department,
        completedCredits: Number(studentRow.completed_credits || 0),
        completedCourses
      };
    } catch (err) {
      // Fallback demo student
      return {
        id: '2412800642',
        studentId: '2412800642',
        name: 'Tariqul Islam',
        email: 'tariqul.islam@northsouth.edu',
        department: 'CSE',
        completedCredits: 70,
        completedCourses: [
          'ENG102', 'MAT116', 'CEE110', 'CSE115', 'ENG103', 'MAT120', 'MAT125', 'CSE173',
          'ENG111', 'MAT130', 'PHY107', 'CSE215', 'PHI104', 'MAT250', 'PHY108', 'CSE225',
          'ENG115', 'MAT350', 'EEE141', 'CSE231', 'HIS101', 'MAT361', 'CSE299', 'HIS102'
        ]
      };
    }
  }

  /**
   * Fetch active sections for a term (defaults to Fall 2026)
   * @param {string} [term]
   */
  async getAvailableSections(term = 'Fall 2026') {
    try {
      const query = `
        SELECT 
          s.id,
          s.course_id,
          s.course_code,
          s.section_number,
          s.capacity,
          s.enrolled_count,
          s.seats_available,
          s.room,
          s.day_of_week,
          s.start_time,
          s.end_time,
          s.faculty_name,
          s.term,
          c.title AS course_title,
          c.credits AS course_credits,
          c.is_milestone
        FROM sections s
        JOIN courses c ON c.id = s.course_id
        WHERE s.term = $1
        ORDER BY s.course_code, s.section_number;
      `;

      const res = await dbPool.query(query, [term]);
      if (res.rows && res.rows.length > 0) {
        return res.rows;
      }
      return loadFallbackSections();
    } catch (err) {
      return loadFallbackSections();
    }
  }

  /**
   * Update seats for a section and return the updated section row
   * @param {string} sectionId
   * @param {number} seatsAvailable
   */
  async updateSectionSeats(sectionId, seatsAvailable) {
    let updated = null;
    try {
      const updateRes = await dbPool.query(
        `UPDATE sections 
         SET seats_available = $1,
             enrolled_count = GREATEST(0, capacity - $1)
         WHERE id::text = $2 OR course_code = $2
         RETURNING *;`,
        [Math.max(0, seatsAvailable), sectionId]
      );
      updated = updateRes.rows[0] || null;
    } catch (e) {
      // Fallback in-memory update
    }

    if (inMemorySections) {
      const sec = inMemorySections.find(s => s.id === sectionId || s.course_code === sectionId);
      if (sec) {
        sec.seats_available = Math.max(0, seatsAvailable);
        sec.enrolled_count = Math.max(0, sec.capacity - sec.seats_available);
        if (!updated) updated = sec;
      }
    }
    return updated;
  }
}

module.exports = new CurriculumService();
