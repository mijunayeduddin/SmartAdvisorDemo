const { Router } = require('express');
const healthRoutes = require('./health.routes');
const coursesRoutes = require('./courses.routes');
const scheduleRoutes = require('./schedule.routes');

const apiRouter = Router();

// Mount sub-routes
apiRouter.use('/health', healthRoutes);
apiRouter.use('/courses', coursesRoutes);
apiRouter.use('/schedule', scheduleRoutes);

// Root API welcome endpoint
apiRouter.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SmartAdvisor API',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: [
      'GET /api/health',
      'GET /api/courses',
      'POST /api/schedule/simulate',
      'POST /api/schedule/fallback'
    ]
  });
});

module.exports = apiRouter;
