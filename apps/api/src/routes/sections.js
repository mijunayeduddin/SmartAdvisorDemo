const express = require('express');
const router = express.Router();
const { getSections, ALLOWED_SORT_COLUMNS } = require('../services/sectionService');

const VALID_DAYS = new Set(['S', 'M', 'T', 'W', 'R', 'F', 'A']);

router.get('/', async (req, res) => {
  try {
    const {
      q,
      dept,
      day,
      openOnly,
      faculty,
      sort,
      order,
      page,
      limit,
      eligibleOnly,
      completed,
      waived,
      program,
    } = req.query;

    // Validate sort
    if (sort && !ALLOWED_SORT_COLUMNS[sort.toLowerCase()]) {
      return res.status(400).json({
        error: 'Invalid sort parameter. Allowed values: course, section, faculty, time, room, seats',
      });
    }

    // Validate order
    if (order && !['asc', 'desc'].includes(order.toLowerCase())) {
      return res.status(400).json({
        error: 'Invalid order parameter. Allowed values: asc, desc',
      });
    }

    // Validate page
    let parsedPage = 1;
    if (page !== undefined && page !== '') {
      parsedPage = Number(page);
      if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        return res.status(400).json({
          error: 'Invalid page parameter. Must be an integer greater than or equal to 1',
        });
      }
    }

    // Validate limit
    let parsedLimit = 50;
    if (limit !== undefined && limit !== '') {
      parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
        return res.status(400).json({
          error: 'Invalid limit parameter. Must be an integer between 1 and 200',
        });
      }
    }

    // Validate day
    if (day !== undefined && day.trim() !== '') {
      const upperDay = day.trim().toUpperCase();
      if (upperDay.length !== 1 || !VALID_DAYS.has(upperDay)) {
        return res.status(400).json({
          error: 'Invalid day parameter. Allowed values: S, M, T, W, R, F, A',
        });
      }
    }

    const result = await getSections({
      q,
      dept,
      day,
      openOnly,
      faculty,
      sort,
      order,
      page: parsedPage,
      limit: parsedLimit,
      eligibleOnly,
      completed,
      waived,
      program,
    });

    res.set('X-Cache', result.fromCache ? 'HIT' : 'MISS');
    return res.json({
      items: result.items,
      total: result.total,
      totalOpenSeats: result.totalOpenSeats,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    console.error('Error fetching sections:', err);
    return res.status(500).json({ error: 'Internal server error while fetching sections' });
  }
});

module.exports = router;
