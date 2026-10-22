const { createClient } = require('redis');
require('dotenv').config();

let client = null;
let isConnected = false;
let isConnecting = false;
let lastAttempt = 0;
const RETRY_COOLDOWN_MS = 5000;

function getRedisClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 800,
      reconnectStrategy: (retries) => {
        if (process.env.NODE_ENV === 'test' || retries > 3) {
          return false; // Stop retrying immediately in tests or after 3 retries
        }
        return Math.min(retries * 200, 2000);
      },
    },
  });

  client.on('connect', () => {
    isConnected = true;
  });

  client.on('ready', () => {
    isConnected = true;
  });

  client.on('error', () => {
    isConnected = false;
  });

  client.on('end', () => {
    isConnected = false;
  });

  return client;
}

async function connectRedis() {
  if (isConnected || isConnecting) return isConnected;

  const now = Date.now();
  if (now - lastAttempt < RETRY_COOLDOWN_MS) {
    return false; // Respect backoff cooldown
  }
  lastAttempt = now;

  const c = getRedisClient();
  try {
    isConnecting = true;
    await Promise.race([
      c.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 600)),
    ]);
    isConnected = true;
    return true;
  } catch (err) {
    isConnected = false;
    return false;
  } finally {
    isConnecting = false;
  }
}

async function getCache(key) {
  if (!isConnected) {
    // Only attempt reconnect if cooldown expired, but do not block request
    connectRedis().catch(() => {});
    return null;
  }

  try {
    const c = getRedisClient();
    const data = await Promise.race([
      c.get(key),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis get timeout')), 400)),
    ]);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 60) {
  if (!isConnected) {
    connectRedis().catch(() => {});
    return false;
  }

  try {
    const c = getRedisClient();
    await Promise.race([
      c.set(key, JSON.stringify(value), { EX: ttlSeconds }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis set timeout')), 400)),
    ]);
    return true;
  } catch (err) {
    return false;
  }
}

async function checkRedisHealth() {
  if (!isConnected) {
    const connected = await connectRedis();
    if (!connected) return 'down';
  }

  try {
    const c = getRedisClient();
    const pong = await Promise.race([
      c.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 600)),
    ]);
    return pong === 'PONG' ? 'ok' : 'down';
  } catch (err) {
    return 'down';
  }
}

async function closeRedis() {
  if (client) {
    try {
      if (client.isOpen) {
        await client.quit();
      } else {
        await client.disconnect();
      }
    } catch (e) {
      // ignore
    }
  }
  isConnected = false;
  client = null;
}

module.exports = {
  getRedisClient,
  connectRedis,
  getCache,
  setCache,
  checkRedisHealth,
  closeRedis,
};
