import type { SeatEvent } from './types';

type Handler = (event: SeatEvent) => void;

/**
 * Mock of the WebSocket channel (deck slide 12: DB commit -> Redis Pub/Sub -> WebSocket push).
 * Delivery is delayed 40-160 ms to imitate the <= 500 ms sync target.
 *
 * When the backend is ready, replace the body of this file with a real client:
 *   const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);
 *   ws.onmessage = (m) => handlers.forEach((h) => h(JSON.parse(m.data)));
 * Keep the `socket.subscribe` / `socket.emit` surface identical and nothing else changes.
 */
class MockSocket {
  private handlers = new Set<Handler>();

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  emit(event: SeatEvent) {
    const delay = 40 + Math.random() * 120;
    setTimeout(() => this.handlers.forEach((h) => h(event)), delay);
  }
}

export const socket = new MockSocket();
