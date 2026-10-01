const { Router } = require('express');
const { getCourses } = require('../controllers/courses.controller');

const router = Router();

// GET /courses or /api/courses
router.get('/', getCourses);

module.exports = router;
