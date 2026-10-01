const dbPool = require('../patterns/singleton/dbPool');
const graphCache = require('../patterns/singleton/graphCache');
const socketManager = require('../websocket/socketManager');

/**
 * Health Check Controller
 * Verifies server responsiveness, database connection, and system status
 */
const getHealthStatus = async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let dbLatency = null;

  try {
    const isDbAlive = await dbPool.ping();
    if (isDbAlive) {
      dbStatus = 'connected';
      dbLatency = `${Date.now() - startTime}ms`;
    }
  } catch (error) {
    dbStatus = `error: ${error.message}`;
  }

  const responsePayload = {
    status: 'ok',
    service: 'SmartAdvisor Backend Engine',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      latency: dbLatency
    },
    graphCache: graphCache.getStats(),
    websockets: {
      activeClients: socketManager.getClientCount()
    }
  };

  return res.status(200).json(responsePayload);
};

module.exports = {
  getHealthStatus
};
