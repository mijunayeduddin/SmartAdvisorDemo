const dbPool = require('../patterns/singleton/dbPool');
const graphCache = require('../patterns/singleton/graphCache');
const { buildGraph } = require('../../core/graphSolver.ts');

/**
 * Service to load and cache the Curriculum DAG and retrieve student academic context.
 */
class CurriculumService {
  /**
   * Fetch courses and prerequisites from PostgreSQL and construct CurriculumGraph
   * @param {boolean} forceRefresh
   */
  async getCurriculumGraph(forceRefresh = false) {
    if (!forceRefresh && graphCache.hasGraph()) {
      return graphCache.getGraph();
    }

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
  }

  /**
   * Retrieve a student's profile, completed courses, and credits
   * @param {string} studentId - Student identifier (e.g. '2412800642')
   */
  async getStudentProfile(studentId) {
    if (!studentId) return null;

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
  }

  /**
   * Fetch active sections for a term (defaults to Fall 2026)
   * @param {string} [term]
   */
  async getAvailableSections(term = 'Fall 2026') {
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
    return res.rows;
  }

  /**
   * Update seats for a section and return the updated section row
   * @param {string} sectionId
   * @param {number} seatsAvailable
   */
  async updateSectionSeats(sectionId, seatsAvailable) {
    const updateRes = await dbPool.query(
      `UPDATE sections 
       SET seats_available = $1,
           enrolled_count = GREATEST(0, capacity - $1)
       WHERE id::text = $2 OR course_code = $2
       RETURNING *;`,
      [Math.max(0, seatsAvailable), sectionId]
    );

    return updateRes.rows[0] || null;
  }
}

module.exports = new CurriculumService();
