const { WebSocketServer, WebSocket } = require('ws');
const seatObserver = require('../patterns/observer/SeatAvailabilityObserver');
const config = require('../config/env');

/**
 * Manages WebSocket connections for Web and Mobile clients.
 * Subscribes to the SeatAvailabilityObserver (Observer Pattern) to push live updates.
 */
class SocketManager {
  constructor() {
    this.wss = null;
    /** @type {Set<WebSocket>} */
    this.clients = new Set();
  }

  /**
   * Attach WebSocket server to existing HTTP server
   * @param {import('http').Server} httpServer
   */
  initialize(httpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: config.ws.path
    });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      console.log(`[WebSocket] Client connected. Total active clients: ${this.clients.size}`);

      // Send initial connection acknowledgement
      this.sendToClient(ws, {
        event: 'connected',
        message: 'Connected to SmartAdvisor real-time sync engine',
        timestamp: new Date().toISOString()
      });

      ws.on('message', (message) => {
        try {
          const parsed = JSON.parse(message.toString());
          this.handleClientMessage(ws, parsed);
        } catch (err) {
          console.error('[WebSocket] Invalid JSON message from client:', err.message);
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WebSocket] Client disconnected. Total active clients: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Client error:', err.message);
      });
    });

    // Wire up Observer Pattern event subscriptions
    this.bindObserverEvents();
  }

  /**
   * Listen to SeatAvailabilityObserver events and broadcast to clients
   */
  bindObserverEvents() {
    // Notify clients when a section reaches capacity
    seatObserver.subscribe('section:full', (data) => {
      this.broadcast('section:full', data);
    });

    // Notify clients when a seat becomes available
    seatObserver.subscribe('seat:available', (data) => {
      this.broadcast('seat:available', data);
    });

    // Notify clients when student schedule updates (cross-device sync)
    seatObserver.subscribe('schedule:sync', (data) => {
      this.broadcast('schedule:sync', data);
    });
  }

  /**
   * Handle incoming messages from web or mobile clients
   */
  handleClientMessage(ws, data) {
    if (data.type === 'ping') {
      this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
    }
  }

  /**
   * Send JSON message to a single client
   */
  sendToClient(ws, payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {string} event
   * @param {*} data
   */
  broadcast(event, data) {
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /**
   * Get active connection count
   */
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = new SocketManager();
