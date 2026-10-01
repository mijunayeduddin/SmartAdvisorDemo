const { Router } = require('express');
const { getHealthStatus } = require('../controllers/health.controller');

const router = Router();

// GET /api/health
router.get('/', getHealthStatus);

module.exports = router;
