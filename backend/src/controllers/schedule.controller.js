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

/**
 * In-memory student active draft schedules (Observer Pattern store for cross-device sync)
 */
const activeSchedules = new Map();

/**
 * Helper to get or initialize student's active schedule
 */
const getStudentScheduleState = async (studentId = '2412800642') => {
  if (!activeSchedules.has(studentId)) {
    const allSections = await curriculumService.getAvailableSections('Fall 2026');
    // Pre-populate with realistic draft schedule (CSE311 §1 and CSE332 §1)
    const initial = allSections.filter((s) => 
      (s.course_code === 'CSE311' && s.section_number === 1) ||
      (s.course_code === 'CSE332' && s.section_number === 1)
    );
    activeSchedules.set(studentId, initial.length > 0 ? initial : []);
  }
  return activeSchedules.get(studentId);
};

/**
 * GET /schedule/enrolled
 * Retrieve current registered sections
 */
const getEnrolledSchedule = async (req, res) => {
  try {
    const studentId = req.query.studentId || '2412800642';
    const schedule = await getStudentScheduleState(studentId);
    return res.status(200).json({
      status: 'success',
      studentId,
      schedule
    });
  } catch (err) {
    console.error('[ScheduleController] Error in getEnrolledSchedule:', err);
    return res.status(500).json({ error: 'Failed to get enrolled schedule' });
  }
};

/**
 * POST /schedule/enrolled
 * Replace or append to current enrolled schedule and broadcast via Observer pattern
 */
const updateEnrolledSchedule = async (req, res) => {
  try {
    const { studentId = '2412800642', schedule, action = 'UPDATED', section, sectionId } = req.body;
    let nextSchedule = schedule;
    if (!nextSchedule) {
      const current = await getStudentScheduleState(studentId);
      if (section) {
        nextSchedule = [...current.filter(s => s.course_code !== section.course_code), section];
      } else {
        nextSchedule = current;
      }
    }
    activeSchedules.set(studentId, nextSchedule);

    // Broadcast to all WebSocket clients (Web & Mobile)
    seatAvailabilityPublisher.notifyScheduleSync({
      studentId,
      action,
      sectionId,
      section,
      schedule: nextSchedule
    });

    return res.status(200).json({
      status: 'success',
      studentId,
      schedule: nextSchedule
    });
  } catch (err) {
    console.error('[ScheduleController] Error in updateEnrolledSchedule:', err);
    return res.status(500).json({ error: 'Failed to update enrolled schedule' });
  }
};

/**
 * DELETE /schedule/enrolled/:id or POST /schedule/drop
 * Drop an enrolled section and immediately notify all connected observers
 */
const dropEnrolledSection = async (req, res) => {
  try {
    const studentId = req.body?.studentId || req.query?.studentId || '2412800642';
    const targetId = req.params?.id || req.body?.sectionId;
    const current = await getStudentScheduleState(studentId);

    const updated = current.filter(
      (s) => s.id !== targetId && `${s.course_code}-${s.section_number}` !== targetId && s.course_code !== targetId
    );
    activeSchedules.set(studentId, updated);

    // Dispatch real-time SCHEDULE_SYNC event through WebSocket Observer
    seatAvailabilityPublisher.notifyScheduleSync({
      studentId,
      action: 'DROPPED',
      sectionId: targetId,
      schedule: updated
    });

    return res.status(200).json({
      status: 'success',
      action: 'DROPPED',
      sectionId: targetId,
      schedule: updated
    });
  } catch (err) {
    console.error('[ScheduleController] Error in dropEnrolledSection:', err);
    return res.status(500).json({ error: 'Failed to drop section' });
  }
};

/**
 * POST /schedule/fallback-alert
 * Explicitly broadcast a fallback proposal to all active clients
 */
const broadcastFallbackProposal = async (req, res) => {
  try {
    const proposal = req.body.fallbackProposal || req.body;
    const socketManager = require('../websocket/socketManager');
    socketManager.broadcast('FALLBACK_PROPOSED', proposal);
    return res.status(200).json({ status: 'success', proposal });
  } catch (err) {
    console.error('[ScheduleController] Error broadcasting fallback proposal:', err);
    return res.status(500).json({ error: 'Failed to broadcast fallback' });
  }
};

module.exports = {
  simulateSchedule,
  getFallback,
  updateSeatCount,
  getSections,
  triggerSyncNow,
  getEnrolledSchedule,
  updateEnrolledSchedule,
  dropEnrolledSection,
  broadcastFallbackProposal,
  activeSchedules
};
