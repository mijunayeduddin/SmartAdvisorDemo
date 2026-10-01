const curriculumService = require('../services/curriculumService');
const { criticalPath, eligibleCourses } = require('../../core/graphSolver.ts');

/**
 * Controller for Course Catalog operations
 */
const getCourses = async (req, res) => {
  try {
    const { studentId, term = 'Fall 2026', department } = req.query;

    const graph = await curriculumService.getCurriculumGraph();

    // Query courses catalog (with automatic database or fallback handling)
    let courses = await curriculumService.getAllCourses(department);

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
