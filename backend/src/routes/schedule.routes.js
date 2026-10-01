const { Router } = require('express');
const {
  simulateSchedule,
  getFallback,
  updateSeatCount,
  getSections,
  triggerSyncNow,
  getEnrolledSchedule,
  updateEnrolledSchedule,
  dropEnrolledSection,
  broadcastFallbackProposal
} = require('../controllers/schedule.controller');

const router = Router();

// GET /schedule/sections or /schedule
router.get('/sections', getSections);
router.get('/', getSections);

// Enrolled Schedule state for real-time synchronization across Web & Mobile
router.get('/enrolled', getEnrolledSchedule);
router.post('/enrolled', updateEnrolledSchedule);
router.delete('/enrolled/:id', dropEnrolledSection);
router.post('/drop', dropEnrolledSection);
router.post('/fallback-alert', broadcastFallbackProposal);

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
