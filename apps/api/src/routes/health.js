const express = require('express');
const router = express.Router();
const { getHealth } = require('../services/healthService');

router.get('/', async (req, res) => {
  try {
    const health = await getHealth();
    const httpStatus = health.postgres === 'ok' ? 200 : 503;
    return res.status(httpStatus).json(health);
  } catch (err) {
    return res.status(500).json({
      status: 'down',
      api: 'ok',
      postgres: 'down',
      redis: 'down',
      error: err.message,
    });
  }
});

module.exports = router;
