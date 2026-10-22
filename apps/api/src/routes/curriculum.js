const express = require('express');
const router = express.Router();
const {
  getPrograms,
  getCurriculum,
  calculateStatus,
  validateCompletedAndWaivedList,
} = require('../services/curriculumService');

/**
 * GET /api/curriculum/programs
 * Returns available curriculum programs: [{ id: "CSE", courses: 88 }, { id: "BBA", courses: 124 }]
 */
router.get('/programs', async (req, res) => {
  try {
    const programs = await getPrograms();
    return res.json(programs);
  } catch (err) {
    console.error('Error fetching curriculum programs:', err);
    return res.status(500).json({ error: 'Internal server error while fetching curriculum programs' });
  }
});

/**
 * GET /api/curriculum
 * Query params: program=CSE|BBA (default CSE)
 * Returns courses grouped by grp with prerequisite groups, credits, and section stats.
 * Cached in Redis for 10 minutes.
 */
router.get('/', async (req, res) => {
  try {
    const program = req.query.program || 'CSE';
    const data = await getCurriculum(program);
    res.set('X-Cache', data.fromCache ? 'HIT' : 'MISS');
    return res.json(data);
  } catch (err) {
    console.error('Error fetching curriculum:', err);
    return res.status(500).json({ error: 'Internal server error while fetching curriculum' });
  }
});

/**
 * POST /api/curriculum/status
 * Body: { program: "CSE" | "BBA", completed: [...], waived: [...], major: "FIN" }
 * Validates course codes and array lengths (max 200).
 * Returns status, missing prerequisites, creditsNeeded, summary totals, and optional majorProgress.
 */
router.post('/status', async (req, res) => {
  try {
    const { program = 'CSE', completed, waived, major = null } = req.body || {};

    if (completed === undefined || completed === null) {
      return res.status(400).json({
        error: 'Request body must include a "completed" array.',
      });
    }

    if (!Array.isArray(completed)) {
      return res.status(400).json({
        error: 'The completed field must be an array of course codes.',
      });
    }

    if (waived !== undefined && waived !== null && !Array.isArray(waived)) {
      return res.status(400).json({
        error: 'The waived field must be an array of course codes.',
      });
    }

    const validation = await validateCompletedAndWaivedList(completed, waived || [], program);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    const statusResult = await calculateStatus({
      program,
      completed: validation.normalizedCompleted,
      waived: validation.normalizedWaived,
      major,
    });

    return res.json(statusResult);
  } catch (err) {
    console.error('Error calculating curriculum status:', err);
    return res.status(500).json({ error: 'Internal server error while calculating status' });
  }
});

module.exports = router;
