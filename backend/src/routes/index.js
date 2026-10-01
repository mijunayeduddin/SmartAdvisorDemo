const { Router } = require('express');
const healthRoutes = require('./health.routes');

const apiRouter = Router();

// Mount sub-routes
apiRouter.use('/health', healthRoutes);

// Root API welcome endpoint
apiRouter.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SmartAdvisor API',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

module.exports = apiRouter;
