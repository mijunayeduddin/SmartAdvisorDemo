const { Router } = require('express');
const {
  simulateSchedule,
  getFallback,
  updateSeatCount,
  getSections,
  triggerSyncNow
} = require('../controllers/schedule.controller');

const router = Router();

// GET /schedule/sections or /schedule
router.get('/sections', getSections);
router.get('/', getSections);

// POST /schedule/simulate
router.post('/simulate', simulateSchedule);

// POST /schedule/fallback
router.post('/fallback', getFallback);

// POST /schedule/seat-update or PATCH /schedule/sections/:id/seats
router.post('/seat-update', updateSeatCount);
router.patch('/sections/:id/seats', updateSeatCount);

// POST /schedule/sync-now
router.post('/sync-now', triggerSyncNow);

module.exports = router;
