const express = require('express');
const router = express.Router();
const { getMeta } = require('../services/metaService');

router.get('/', async (req, res) => {
  try {
    const meta = await getMeta();
    return res.json(meta);
  } catch (err) {
    console.error('Error fetching meta:', err);
    return res.status(500).json({ error: 'Internal server error while fetching metadata' });
  }
});

module.exports = router;
