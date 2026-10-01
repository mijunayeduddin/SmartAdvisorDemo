const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'smartadvisor',
    password: process.env.DB_PASSWORD || 'advisor_secret_pass',
    database: process.env.DB_NAME || 'smartadvisor_db',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  },
  ws: {
    path: process.env.WS_PATH || '/ws',
  }
};

module.exports = config;
