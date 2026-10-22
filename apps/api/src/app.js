const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const sectionsRouter = require('./routes/sections');
const metaRouter = require('./routes/meta');
const healthRouter = require('./routes/health');
const curriculumRouter = require('./routes/curriculum');

const app = express();

// Trust reverse proxy (NGINX) headers
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// Basic Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '600', 10), // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test', // Skip rate limiting during test runs
  message: {
    error: 'Too many requests, please try again later.',
  },
});

app.use(limiter);

// Versioned API routes under /api
app.use('/api/sections', sectionsRouter);
app.use('/api/meta', metaRouter);
app.use('/api/health', healthRouter);
app.use('/api/curriculum', curriculumRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
