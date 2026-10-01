const { WebSocketServer, WebSocket } = require('ws');
const { seatAvailabilityPublisher } = require('../../core/observer.ts');
const seatObserver = require('../patterns/observer/SeatAvailabilityObserver');
const config = require('../config/env');

/**
 * WebSocket Manager for Web and Mobile clients.
 * Integrates with SeatAvailabilityPublisher (Observer Pattern)
 * to broadcast real-time { type: 'SEAT_UPDATE' | 'SCHEDULE_SYNC', payload } events.
 */
class SocketManager {
  constructor() {
    this.wss = null;
    /** @type {Set<WebSocket>} */
    this.clients = new Set();
    this.serverUnsubscribers = [];
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
      ws._unsubscribers = [];

      console.log(`[WebSocket] Client connected. Total active clients: ${this.clients.size}`);

      // Parse query params for initial subscriptions (e.g. /ws?sections=sec1,sec2&courses=CSE115)
      try {
        const url = new URL(req.url, 'http://localhost');
        const sectionsParam = url.searchParams.get('sections');
        const coursesParam = url.searchParams.get('courses');

        if (sectionsParam) {
          const sectionIds = sectionsParam.split(',').map((s) => s.trim()).filter(Boolean);
          for (const sId of sectionIds) {
            this.subscribeClientToSection(ws, sId);
          }
        }

        if (coursesParam) {
          const courses = coursesParam.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
          for (const code of courses) {
            this.subscribeClientToCourse(ws, code);
          }
        }
      } catch (err) {
        // Ignored if query parsing fails
      }

      // Also register client as a direct subscriber on the publisher
      const unsub = seatAvailabilityPublisher.subscribe(ws);
      ws._unsubscribers.push(unsub);

      // Send initial connection acknowledgement
      this.sendToClient(ws, {
        type: 'CONNECTED',
        payload: {
          message: 'Connected to SmartAdvisor real-time sync engine',
          activeClients: this.clients.size
        },
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
        this.cleanupClient(ws);
        if (this.wss) {
          console.log(`[WebSocket] Client disconnected. Total active clients: ${this.clients.size}`);
        }
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Client error:', err.message);
        this.cleanupClient(ws);
      });
    });

    // Wire up Observer Pattern bridge
    this.bindObserverEvents();
  }

  /**
   * Subscribe a WebSocket client to a specific section
   */
  subscribeClientToSection(ws, sectionId) {
    const unsub = seatAvailabilityPublisher.subscribe(ws, { sectionId });
    if (ws._unsubscribers) ws._unsubscribers.push(unsub);
  }

  /**
   * Subscribe a WebSocket client to a specific course
   */
  subscribeClientToCourse(ws, courseCode) {
    const unsub = seatAvailabilityPublisher.subscribe(ws, { courseCode });
    if (ws._unsubscribers) ws._unsubscribers.push(unsub);
  }

  /**
   * Clean up client subscriptions when disconnected
   */
  cleanupClient(ws) {
    this.clients.delete(ws);
    seatAvailabilityPublisher.unsubscribe(ws);
    if (ws._unsubscribers) {
      for (const unsub of ws._unsubscribers) {
        try { unsub(); } catch (e) {}
      }
      ws._unsubscribers = [];
    }
  }

  /**
   * Bridge legacy SeatAvailabilityObserver events to the publisher
   */
  bindObserverEvents() {
    seatObserver.subscribe('section:updated', (data) => {
      seatAvailabilityPublisher.notifySeatUpdate(data);
    });

    seatObserver.subscribe('schedule:sync', (data) => {
      seatAvailabilityPublisher.notifyScheduleSync(data);
    });
  }

  /**
   * Handle incoming messages from web or mobile clients
   */
  handleClientMessage(ws, data) {
    // 1. Ping / Pong
    if (data.type === 'ping') {
      this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
      return;
    }

    // 2. Client subscription request: { action: 'subscribe', sections: [...], courses: [...] }
    if (data.action === 'subscribe') {
      if (Array.isArray(data.sections)) {
        for (const sId of data.sections) {
          this.subscribeClientToSection(ws, sId);
        }
      }
      if (Array.isArray(data.courses)) {
        for (const code of data.courses) {
          this.subscribeClientToCourse(ws, code);
        }
      }
      this.sendToClient(ws, {
        type: 'SUBSCRIBED',
        payload: {
          sections: data.sections || [],
          courses: data.courses || []
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 3. Client triggering a seat change: { type: 'SEAT_UPDATE', payload: { sectionId, seatsAvailable, ... } }
    if (data.type === 'SEAT_UPDATE' || data.type === 'UPDATE_SEAT') {
      const payload = data.payload || {};
      seatAvailabilityPublisher.notifySeatUpdate(payload);
      return;
    }

    // 4. Client triggering schedule sync: { type: 'SCHEDULE_SYNC', payload: { studentId, ... } }
    if (data.type === 'SCHEDULE_SYNC') {
      const payload = data.payload || {};
      try {
        const scheduleCtrl = require('../controllers/schedule.controller');
        if (payload.schedule && payload.studentId && scheduleCtrl.activeSchedules) {
          scheduleCtrl.activeSchedules.set(payload.studentId, payload.schedule);
        }
      } catch (e) {}
      seatAvailabilityPublisher.notifyScheduleSync(payload);
      return;
    }

    // 5. Client broadcasting fallback proposal
    if (data.type === 'FALLBACK_PROPOSED') {
      const payload = data.payload || {};
      this.broadcast('FALLBACK_PROPOSED', payload);
      return;
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
   * @param {'SEAT_UPDATE' | 'SCHEDULE_SYNC' | string} type
   * @param {*} payload
   */
  broadcast(type, payload) {
    const message = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  /**
   * Get active connection count
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Close all clients and cleanup
   */
  close() {
    for (const client of this.clients) {
      try { client.terminate(); } catch (e) {}
    }
    this.clients.clear();
    if (this.wss) {
      try { this.wss.close(); } catch (e) {}
      this.wss = null;
    }
  }
}

module.exports = new SocketManager();
