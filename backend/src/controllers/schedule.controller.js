const curriculumService = require('../services/curriculumService');
const { fallbackRouter } = require('../../core/fallbackRouter.ts');
const { MilestonePriorityStrategy, MinimizeGapsStrategy } = require('../../core/strategy/scheduleStrategy.ts');
const { seatAvailabilityPublisher } = require('../../core/observer.ts');

/**
 * Controller for Schedule Simulation and Fallback Routing
 */

/**
 * POST /schedule/simulate
 * Simulates registration for a section.
 * If 0 seats left: does NOT fail; invokes Strategy + Graph Solver to propose next-best alternative.
 */
const simulateSchedule = async (req, res) => {
  try {
    const {
      studentId = '2412800642',
      sectionId,
      courseCode,
      sectionNumber,
      term = 'Fall 2026',
      strategy = 'MilestonePriority',
      currentSchedule = []
    } = req.body;

    if (!sectionId && !courseCode) {
      return res.status(400).json({
        error: 'Missing required field: sectionId or courseCode must be provided in request body.'
      });
    }

    // 1. Fetch student context
    let student = await curriculumService.getStudentProfile(studentId);
    if (!student) {
      student = {
        studentId,
        completedCourses: req.body.completedCourses || [],
        completedCredits: Number(req.body.completedCredits || 0)
      };
    }

    // 2. Load Curriculum Graph & Available Sections
    const graph = await curriculumService.getCurriculumGraph();
    const availableSections = await curriculumService.getAvailableSections(term);

    // 3. Select Strategy
    let activeStrategy = new MilestonePriorityStrategy();
    if (strategy === 'MinimizeGaps' || strategy === 'MinimizeGap') {
      activeStrategy = new MinimizeGapsStrategy();
    }

    // 4. Run Fallback Router
    const result = fallbackRouter.routeSimulation(
      student,
      { sectionId, courseCode, sectionNumber, term },
      graph,
      availableSections,
      activeStrategy,
      currentSchedule
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('[ScheduleController] Error in simulateSchedule:', error);
    return res.status(500).json({
      error: 'Failed to simulate schedule',
      details: error.message
    });
  }
};

/**
 * POST /schedule/fallback
 * Explicit fallback suggestion endpoint.
 */
const getFallback = async (req, res) => {
  try {
    const {
      studentId = '2412800642',
      courseCode,
      sectionId,
      sectionNumber,
      term = 'Fall 2026',
      strategy = 'MilestonePriority',
      currentSchedule = []
    } = req.body;

    // Delegate to simulateSchedule with fallback handling
    let student = await curriculumService.getStudentProfile(studentId);
    if (!student) {
      student = {
        studentId,
        completedCourses: req.body.completedCourses || [],
        completedCredits: Number(req.body.completedCredits || 0)
      };
    }

    const graph = await curriculumService.getCurriculumGraph();
    const availableSections = await curriculumService.getAvailableSections(term);

    let activeStrategy = new MilestonePriorityStrategy();
    if (strategy === 'MinimizeGaps' || strategy === 'MinimizeGap') {
      activeStrategy = new MinimizeGapsStrategy();
    }

    const result = fallbackRouter.routeSimulation(
      student,
      { sectionId, courseCode, sectionNumber, term },
      graph,
      availableSections,
      activeStrategy,
      currentSchedule
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('[ScheduleController] Error in getFallback:', error);
    return res.status(500).json({
      error: 'Failed to compute fallback recommendation',
      details: error.message
    });
  }
};

/**
 * POST /schedule/seat-update (or PATCH /sections/:id/seats)
 * Updates seat count in DB and immediately notifies WebSocket subscribers via Observer pattern.
 */
const updateSeatCount = async (req, res) => {
  try {
    const sectionId = req.params.id || req.body.sectionId;
    const seatsAvailable = Number(req.body.seatsAvailable ?? req.body.seats_available);

    if (!sectionId || isNaN(seatsAvailable)) {
      return res.status(400).json({
        error: 'Missing required fields: sectionId and numeric seatsAvailable are required.'
      });
    }

    // Persist to database
    const updatedSection = await curriculumService.updateSectionSeats(sectionId, seatsAvailable);

    // Notify Observer Pattern publisher immediately
    const event = seatAvailabilityPublisher.updateSeats(sectionId, seatsAvailable, {
      courseCode: updatedSection?.course_code,
      sectionNumber: updatedSection?.section_number,
      capacity: updatedSection?.capacity,
      enrolledCount: updatedSection?.enrolled_count,
      term: updatedSection?.term
    });

    return res.status(200).json({
      status: 'success',
      message: `Seat count updated for section ${sectionId} to ${seatsAvailable}. Subscribers notified.`,
      event,
      section: updatedSection
    });
  } catch (error) {
    console.error('[ScheduleController] Error in updateSeatCount:', error);
    return res.status(500).json({
      error: 'Failed to update seat count',
      details: error.message
    });
  }
};

/**
 * GET /schedule/sections
 * Fetches all available sections with current live seat counts
 */
const getSections = async (req, res) => {
  try {
    const { term = 'Fall 2026', courseCode } = req.query;
    let sections = await curriculumService.getAvailableSections(term);
    if (courseCode) {
      const code = courseCode.trim().toUpperCase();
      sections = sections.filter((s) => s.course_code === code);
    }
    return res.status(200).json({
      status: 'success',
      totalSections: sections.length,
      sections
    });
  } catch (error) {
    console.error('[ScheduleController] Error in getSections:', error);
    return res.status(500).json({
      error: 'Failed to fetch sections',
      details: error.message
    });
  }
};

/**
 * POST /schedule/sync-now
 * Force an immediate run of seatSyncService
 */
const triggerSyncNow = async (req, res) => {
  try {
    const { runOnce } = await import('../services/seatSyncService.mjs');
    const result = await runOnce({ term: req.body?.term || 'Fall 2026' });
    return res.status(200).json({
      status: 'success',
      message: 'Immediate seat sync executed successfully',
      result
    });
  } catch (error) {
    console.error('[ScheduleController] Error in triggerSyncNow:', error);
    return res.status(500).json({
      error: 'Failed to execute immediate sync',
      details: error.message
    });
  }
};

module.exports = {
  simulateSchedule,
  getFallback,
  updateSeatCount,
  getSections,
  triggerSyncNow
};
