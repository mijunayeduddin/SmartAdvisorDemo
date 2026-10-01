const curriculumService = require('../services/curriculumService');
const { criticalPath, eligibleCourses } = require('../../core/graphSolver.ts');
const dbPool = require('../patterns/singleton/dbPool');

/**
 * Controller for Course Catalog operations
 */
const getCourses = async (req, res) => {
  try {
    const { studentId, term = 'Fall 2026', department } = req.query;

    const graph = await curriculumService.getCurriculumGraph();

    // Query courses catalog
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

    const coursesRes = await dbPool.query(courseQuery, params);
    let courses = coursesRes.rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      credits: Number(row.credits),
      department: row.department,
      description: row.description,
      isMilestone: Boolean(row.is_milestone),
      prerequisites: row.prerequisites || []
    }));

    // Attach student eligibility and critical path context if studentId provided
    let studentContext = null;
    if (studentId) {
      const student = await curriculumService.getStudentProfile(studentId);
      if (student) {
        const cPath = criticalPath(graph, student.completedCourses);
        const cPathSet = new Set(cPath);
        const eligible = eligibleCourses(graph, student.completedCourses, student.completedCredits);
        const eligibleSet = new Set(eligible);
        const completedSet = new Set(student.completedCourses);

        courses = courses.map((course) => ({
          ...course,
          isCompleted: completedSet.has(course.code),
          isEligible: eligibleSet.has(course.code),
          isCriticalPath: cPathSet.has(course.code),
          criticalPathRank: cPathSet.has(course.code) ? cPath.indexOf(course.code) + 1 : null
        }));

        studentContext = {
          studentId: student.studentId,
          completedCredits: student.completedCredits,
          completedCoursesCount: student.completedCourses.length,
          criticalPathLength: cPath.length
        };
      }
    }

    return res.status(200).json({
      status: 'success',
      totalCourses: courses.length,
      studentContext,
      courses
    });
  } catch (error) {
    console.error('[CoursesController] Error in getCourses:', error);
    return res.status(500).json({
      error: 'Failed to fetch courses catalog',
      details: error.message
    });
  }
};

module.exports = {
  getCourses
};
