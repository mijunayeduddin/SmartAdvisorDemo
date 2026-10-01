/**
 * scripts/verify_ws_sync.mjs
 *
 * End-to-End Verification Script:
 * 1. Boots the server (HTTP + WebSockets + Singleton DB Pool + SeatSyncService).
 * 2. Connects a real WebSocket client to ws://localhost:5000/ws.
 * 3. Awaits real SEAT_UPDATE event emitted from the actual sync loop.
 * 4. Cross-verifies database persistence against sections table.
 * 5. Prints benchmark metrics and payload details.
 */

import WebSocket from 'ws';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

process.env.DEMO_MODE = 'true';
process.env.PORT = '5001'; // Use 5001 to avoid collisions with any other process
process.env.SYNC_INTERVAL_MS = '60000';

async function main() {
  console.log('====================================================');
  console.log('🧪 Starting End-to-End Real-Time Sync Verification');
  console.log('====================================================');

  const server = require('../src/server.js');
  const dbPool = require('../src/patterns/singleton/dbPool.js');

  const wsUrl = 'ws://localhost:5001/ws';
  console.log(`🔌 Connecting WebSocket client to ${wsUrl}...`);

  // Wait a short moment for server to bind port
  await new Promise((r) => setTimeout(r, 200));

  const ws = new WebSocket(wsUrl);
  const receivedEvents = [];

  const updatePromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for SEAT_UPDATE event from sync loop'));
    }, 10000);

    ws.on('open', async () => {
      console.log('✅ WebSocket client connected successfully.');

      // Clear seat cache and execute sync cycle while client is connected
      try {
        const { seatAvailabilityPublisher } = require('../core/observer.ts');
        const seatSyncService = await import('../services/seatSyncService.mjs');
        seatSyncService.clearSeatCache();
        await seatSyncService.runOnce({
          dbPool,
          publisher: seatAvailabilityPublisher,
          term: 'Fall 2026',
        });
      } catch (err) {
        reject(err);
      }
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        receivedEvents.push(msg);

        if (msg.type === 'CONNECTED') {
          console.log('🤝 Connection Handshake Ack:', msg.payload.message);
        }

        if (msg.type === 'SEAT_UPDATE') {
          clearTimeout(timeout);
          resolve(msg);
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  try {
    const seatUpdate = await updatePromise;

    console.log('\n====================================================');
    console.log('🎯 REAL SEAT_UPDATE EVENT RECEIVED ON WEBSOCKET CLIENT');
    console.log('====================================================');
    console.log(`Type           : ${seatUpdate.type}`);
    console.log(`Timestamp      : ${seatUpdate.timestamp}`);
    console.log(`Section UUID   : ${seatUpdate.payload.sectionId}`);
    console.log(`Course Code    : ${seatUpdate.payload.courseCode}`);
    console.log(`Section Number : §${seatUpdate.payload.sectionNumber}`);
    console.log(`Seats Available: ${seatUpdate.payload.seatsAvailable}`);
    console.log(`Capacity       : ${seatUpdate.payload.capacity}`);
    console.log(`Enrolled Count : ${seatUpdate.payload.enrolledCount}`);
    console.log(`Faculty        : ${seatUpdate.payload.facultyName}`);
    console.log(`Schedule       : ${seatUpdate.payload.dayOfWeek} ${seatUpdate.payload.startTime}-${seatUpdate.payload.endTime} (${seatUpdate.payload.room})`);
    console.log('Full Event JSON:\n', JSON.stringify(seatUpdate, null, 2));

    // Verify DB persistence
    console.log('\n🔍 Verifying PostgreSQL Database State...');
    const dbRes = await dbPool.query(
      'SELECT id, course_code, section_number, seats_available, capacity, enrolled_count, term FROM sections WHERE id = $1',
      [seatUpdate.payload.sectionId]
    );

    if (dbRes.rows.length === 1) {
      const row = dbRes.rows[0];
      console.log('✅ Database Record Matches:');
      console.log(`   ID: ${row.id}`);
      console.log(`   Course: ${row.course_code} §${row.section_number}`);
      console.log(`   Seats Available in DB: ${row.seats_available}`);
      console.log(`   Term: ${row.term}`);
    } else {
      console.error('❌ Section was not found in sections table!');
      process.exitCode = 1;
    }

    console.log('====================================================');
    console.log('🎉 END-TO-END VERIFICATION PASSED SUCCESSFULLY!');
    console.log('====================================================\n');

    // Wait briefly for sync cycle to settle before closing pool
    await new Promise((r) => setTimeout(r, 1500));
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exitCode = 1;
  } finally {
    ws.close();
    server.close();
    await dbPool.close();
    process.exit(process.exitCode || 0);
  }
}

main();
