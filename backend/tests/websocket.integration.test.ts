import http from 'http';
import WebSocket from 'ws';
import app from '../src/app';
import socketManager from '../src/websocket/socketManager';
import { seatAvailabilityPublisher } from '../core/observer';

describe('Real-Time WebSocket Sync Integration Test (Web + Mobile)', () => {
  let server: http.Server;
  let port: number;
  let wsUrl: string;

  beforeAll((done) => {
    server = http.createServer(app);
    socketManager.initialize(server);
    server.listen(0, () => {
      const addr = server.address() as any;
      port = addr.port;
      wsUrl = `ws://localhost:${port}/ws`;
      console.log(`[Test Server] Running on http://localhost:${port} and ${wsUrl}`);
      done();
    });
  });

  afterAll(async () => {
    socketManager.close();
    seatAvailabilityPublisher.clear();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const dbPool = require('../src/patterns/singleton/dbPool');
    await dbPool.close();
  });

  const waitForOpen = (ws: any): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) return resolve();
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
  };

  const closeSocket = (ws: any): Promise<void> => {
    return new Promise((resolve) => {
      if (!ws || ws.readyState === WebSocket.CLOSED) return resolve();
      ws.once('close', () => resolve());
      ws.close();
    });
  };

  const waitForMessage = (ws: any, predicate: (msg: any) => boolean, timeoutMs = 2000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off('message', onMessage);
        reject(new Error(`Timed out waiting for message after ${timeoutMs}ms`));
      }, timeoutMs);

      const onMessage = (raw: any) => {
        try {
          const parsed = JSON.parse(raw.toString());
          if (predicate(parsed)) {
            clearTimeout(timer);
            ws.off('message', onMessage);
            resolve(parsed);
          }
        } catch (e) {
          // ignore non-json
        }
      };

      ws.on('message', onMessage);
    });
  };

  test('two WebSocket connections (Web + Mobile): seat change triggered from one is received by the other in <200ms', async () => {
    // 1. Open Web client connection
    const webClient: any = new WebSocket(wsUrl);
    // 2. Open Mobile client connection
    const mobileClient: any = new WebSocket(wsUrl);

    await Promise.all([waitForOpen(webClient), waitForOpen(mobileClient)]);

    // 3. Set up listener on mobileClient to measure latency
    const testSectionId = 'sec-int-test-115';
    const updatedSeatCount = 19;

    let startTime = 0;
    const receivePromise = new Promise<{ message: any; latencyMs: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Mobile client did not receive SEAT_UPDATE within 2000ms'));
      }, 2000);

      mobileClient.on('message', (raw: any) => {
        const receivedTime = performance.now();
        try {
          const parsed = JSON.parse(raw.toString());
          if (
            parsed.type === 'SEAT_UPDATE' &&
            parsed.payload?.sectionId === testSectionId
          ) {
            clearTimeout(timeout);
            const latencyMs = receivedTime - startTime;
            resolve({ message: parsed, latencyMs });
          }
        } catch (e) {
          // Ignore
        }
      });
    });

    // 4. Trigger seat change from webClient
    startTime = performance.now();
    webClient.send(
      JSON.stringify({
        type: 'SEAT_UPDATE',
        payload: {
          sectionId: testSectionId,
          courseCode: 'CSE115',
          sectionNumber: 1,
          seatsAvailable: updatedSeatCount,
          capacity: 35
        }
      })
    );

    // 5. Await reception on mobileClient
    const { message, latencyMs } = await receivePromise;

    console.log(`\n======================================================`);
    console.log(`⚡ [WebSocket Integration Benchmark]`);
    console.log(`📤 Triggered From  : Web Client (simulated)`);
    console.log(`📥 Received At     : Mobile Client (simulated)`);
    console.log(`⏱️ Latency Measured : ${latencyMs.toFixed(2)} ms`);
    console.log(`🎯 Threshold Target : < 200.00 ms`);
    console.log(`📦 Message Payload  :`, JSON.stringify(message, null, 2));
    console.log(`======================================================\n`);

    // 6. Assertions
    expect(message.type).toBe('SEAT_UPDATE');
    expect(message.payload.sectionId).toBe(testSectionId);
    expect(message.payload.seatsAvailable).toBe(updatedSeatCount);
    expect(message.payload.courseCode).toBe('CSE115');
    expect(latencyMs).toBeLessThan(200);

    // Clean up connections cleanly
    await Promise.all([closeSocket(webClient), closeSocket(mobileClient)]);
  });

  test('cross-device schedule sync: web client enrolls, mobile client syncs state in <200ms', async () => {
    const webClient: any = new WebSocket(wsUrl);
    const mobileClient: any = new WebSocket(wsUrl);

    await Promise.all([waitForOpen(webClient), waitForOpen(mobileClient)]);

    let startTime = 0;
    const receivePromise = new Promise<{ message: any; latencyMs: number }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Mobile client did not receive SCHEDULE_SYNC within 2000ms'));
      }, 2000);

      mobileClient.on('message', (raw: any) => {
        const receivedTime = performance.now();
        try {
          const parsed = JSON.parse(raw.toString());
          if (
            parsed.type === 'SCHEDULE_SYNC' &&
            parsed.payload?.studentId === '2412800642'
          ) {
            clearTimeout(timeout);
            const latencyMs = receivedTime - startTime;
            resolve({ message: parsed, latencyMs });
          }
        } catch (e) {
          // Ignore
        }
      });
    });

    startTime = performance.now();
    webClient.send(
      JSON.stringify({
        type: 'SCHEDULE_SYNC',
        payload: {
          studentId: '2412800642',
          action: 'FALLBACK_TRIGGERED',
          section: {
            courseCode: 'CSE115',
            sectionNumber: 1,
            seatsAvailable: 5
          }
        }
      })
    );

    const { message, latencyMs } = await receivePromise;

    console.log(`⚡ [Cross-Device Schedule Sync Latency]: ${latencyMs.toFixed(2)} ms (< 200ms target)`);
    expect(message.type).toBe('SCHEDULE_SYNC');
    expect(message.payload.studentId).toBe('2412800642');
    expect(message.payload.action).toBe('FALLBACK_TRIGGERED');
    expect(latencyMs).toBeLessThan(200);

    await Promise.all([closeSocket(webClient), closeSocket(mobileClient)]);
  });
});
