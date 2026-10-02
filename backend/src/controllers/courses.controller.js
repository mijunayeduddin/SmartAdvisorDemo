const curriculumService = require('../services/curriculumService');
const { 
  criticalPath, 
  eligibleCourses, 
  criticalPathForCourse, 
  recommendBestCourses 
} = require('../../core/graphSolver.ts');

/**
 * Controller for Course Catalog operations
 */
const getCourses = async (req, res) => {
  try {
    const { studentId, term = 'Fall 2026', department, search, selectedCourse, enrolled } = req.query;

    const graph = await curriculumService.getCurriculumGraph();

    // Query courses catalog (with automatic database or fallback handling)
    let courses = await curriculumService.getAllCourses(department);

    if (search && search.trim()) {
      const q = search.trim().toUpperCase();
      courses = courses.filter((c) => 
        c.code.toUpperCase().includes(q) || 
        c.title.toUpperCase().includes(q) ||
        (c.department && c.department.toUpperCase().includes(q))
      );
    }

    // Parse enrolled courses if provided (e.g. "CSE311,CSE332")
    const enrolledList = enrolled 
      ? enrolled.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
      : [];

    // Attach student eligibility and critical path context if studentId provided
    let studentContext = null;
    let recommendations = [];
    let selectedPathway = null;
    let globalCriticalPath = [];

    if (studentId) {
      const student = await curriculumService.getStudentProfile(studentId);
      if (student) {
        globalCriticalPath = criticalPath(graph, student.completedCourses);
        const cPathSet = new Set(globalCriticalPath);
        const eligible = eligibleCourses(graph, student.completedCourses, student.completedCredits);
        const eligibleSet = new Set(eligible);
        const completedSet = new Set(student.completedCourses);

        courses = courses.map((course) => ({
          ...course,
          isCompleted: completedSet.has(course.code),
          isEligible: eligibleSet.has(course.code),
          isCriticalPath: cPathSet.has(course.code),
          criticalPathRank: cPathSet.has(course.code) ? globalCriticalPath.indexOf(course.code) + 1 : null
        }));

        recommendations = recommendBestCourses(
          graph,
          student.completedCourses,
          enrolledList,
          student.completedCredits
        );

        if (selectedCourse && selectedCourse.trim()) {
          selectedPathway = criticalPathForCourse(
            graph,
            student.completedCourses,
            selectedCourse.trim().toUpperCase()
          );
        }

        studentContext = {
          studentId: student.studentId,
          completedCredits: student.completedCredits,
          completedCoursesCount: student.completedCourses.length,
          criticalPathLength: globalCriticalPath.length
        };
      }
    }

    return res.status(200).json({
      status: 'success',
      totalCourses: courses.length,
      studentContext,
      criticalPath: globalCriticalPath,
      recommendations,
      selectedPathway,
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
