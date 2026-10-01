/**
 * Observer Pattern: Real-Time Seat Availability Publisher
 *
 * Implements the Subject role in the Gang of Four Observer Pattern.
 * Allows subscribers (such as WebSocket clients, notification services,
 * or background sync jobs) to register for seat updates and schedule events.
 *
 * Dispatches events in the exact format:
 *   { type: 'SEAT_UPDATE' | 'SCHEDULE_SYNC', payload, timestamp }
 */

export interface SeatUpdatePayload {
  sectionId: string;
  courseCode?: string;
  sectionNumber?: number;
  capacity?: number;
  enrolledCount?: number;
  seatsAvailable: number;
  isFull?: boolean;
  term?: string;
  room?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  facultyName?: string;
  [key: string]: any;
}

export interface ScheduleSyncPayload {
  studentId: string;
  schedule?: any;
  action?: 'ENROLLED' | 'DROPPED' | 'SWAPPED' | 'FALLBACK_TRIGGERED';
  section?: any;
  [key: string]: any;
}

export type EventType = 'SEAT_UPDATE' | 'SCHEDULE_SYNC';

export interface SeatAvailabilityEvent {
  type: EventType;
  payload: SeatUpdatePayload | ScheduleSyncPayload;
  timestamp: string;
}

export type SubscriberCallback = (event: SeatAvailabilityEvent) => void;

export interface SubscriberObject {
  update?: (event: SeatAvailabilityEvent) => void;
  send?: (data: string) => void;
  readyState?: number;
}

export type Subscriber = SubscriberCallback | SubscriberObject;

export interface SubscriptionFilter {
  sectionId?: string;
  courseCode?: string;
}

export class SeatAvailabilityPublisher {
  /** Global observers notified on all events */
  private globalSubscribers: Set<Subscriber> = new Set();

  /** Subscriptions filtered by section ID */
  private sectionSubscribers: Map<string, Set<Subscriber>> = new Map();

  /** Subscriptions filtered by course code */
  private courseSubscribers: Map<string, Set<Subscriber>> = new Map();

  /**
   * Register a subscriber (WebSocket connection or callback)
   *
   * @param subscriber - Callback, observer object, or WebSocket connection
   * @param filter - Optional filter targeting a specific section or course
   * @returns Unsubscribe function
   */
  subscribe(subscriber: Subscriber, filter?: SubscriptionFilter): () => void {
    if (!subscriber) {
      throw new Error('Subscriber cannot be null or undefined');
    }

    if (filter?.sectionId) {
      const secId = String(filter.sectionId);
      if (!this.sectionSubscribers.has(secId)) {
        this.sectionSubscribers.set(secId, new Set());
      }
      this.sectionSubscribers.get(secId)!.add(subscriber);
      return () => this.unsubscribe(subscriber, filter);
    }

    if (filter?.courseCode) {
      const code = String(filter.courseCode).toUpperCase();
      if (!this.courseSubscribers.has(code)) {
        this.courseSubscribers.set(code, new Set());
      }
      this.courseSubscribers.get(code)!.add(subscriber);
      return () => this.unsubscribe(subscriber, filter);
    }

    // Default: global subscriber
    this.globalSubscribers.add(subscriber);
    return () => this.unsubscribe(subscriber);
  }

  /**
   * Convenience: Subscribe to a specific section
   */
  subscribeToSection(sectionId: string, subscriber: Subscriber): () => void {
    return this.subscribe(subscriber, { sectionId });
  }

  /**
   * Convenience: Subscribe to all sections of a course
   */
  subscribeToCourse(courseCode: string, subscriber: Subscriber): () => void {
    return this.subscribe(subscriber, { courseCode });
  }

  /**
   * Unregister an existing subscriber
   */
  unsubscribe(subscriber: Subscriber, filter?: SubscriptionFilter): void {
    if (filter?.sectionId) {
      const secSet = this.sectionSubscribers.get(String(filter.sectionId));
      if (secSet) {
        secSet.delete(subscriber);
        if (secSet.size === 0) {
          this.sectionSubscribers.delete(String(filter.sectionId));
        }
      }
      return;
    }

    if (filter?.courseCode) {
      const codeSet = this.courseSubscribers.get(String(filter.courseCode).toUpperCase());
      if (codeSet) {
        codeSet.delete(subscriber);
        if (codeSet.size === 0) {
          this.courseSubscribers.delete(String(filter.courseCode).toUpperCase());
        }
      }
      return;
    }

    // Remove from global
    this.globalSubscribers.delete(subscriber);

    // Also remove from any section/course maps if no filter was passed
    for (const [secId, set] of this.sectionSubscribers.entries()) {
      set.delete(subscriber);
      if (set.size === 0) this.sectionSubscribers.delete(secId);
    }
    for (const [code, set] of this.courseSubscribers.entries()) {
      set.delete(subscriber);
      if (set.size === 0) this.courseSubscribers.delete(code);
    }
  }

  /**
   * Universal notify method compatible with Observer pattern contracts.
   * Dispatches seat update or schedule sync depending on payload shape.
   */
  notify(payload: any): SeatAvailabilityEvent {
    if (payload && payload.studentId && !payload.sectionId && payload.seatsAvailable === undefined) {
      return this.notifyScheduleSync(payload);
    }
    return this.notifySeatUpdate(payload);
  }

  /**
   * Notify subscribers of a seat update immediately.
   */
  notifySeatUpdate(payload: SeatUpdatePayload): SeatAvailabilityEvent {
    const isFull = payload.seatsAvailable <= 0;
    const enrichedPayload: SeatUpdatePayload = {
      ...payload,
      isFull,
      seatsAvailable: Math.max(0, Number(payload.seatsAvailable))
    };

    const event: SeatAvailabilityEvent = {
      type: 'SEAT_UPDATE',
      payload: enrichedPayload,
      timestamp: new Date().toISOString()
    };

    this.dispatch(event, payload.sectionId, payload.courseCode);
    return event;
  }

  /**
   * Notify subscribers of a student schedule synchronization event.
   */
  notifyScheduleSync(payload: ScheduleSyncPayload): SeatAvailabilityEvent {
    const event: SeatAvailabilityEvent = {
      type: 'SCHEDULE_SYNC',
      payload,
      timestamp: new Date().toISOString()
    };

    this.dispatch(event);
    return event;
  }

  /**
   * High-level shortcut to record and broadcast a seat change.
   */
  updateSeats(
    sectionId: string,
    seatsAvailable: number,
    additionalDetails: Partial<SeatUpdatePayload> = {}
  ): SeatAvailabilityEvent {
    return this.notifySeatUpdate({
      sectionId,
      seatsAvailable,
      ...additionalDetails
    });
  }

  /**
   * Dispatch an event to all eligible subscribers (deduplicated).
   */
  private dispatch(event: SeatAvailabilityEvent, sectionId?: string, courseCode?: string): void {
    const targets = new Set<Subscriber>(this.globalSubscribers);

    if (sectionId && this.sectionSubscribers.has(String(sectionId))) {
      for (const sub of this.sectionSubscribers.get(String(sectionId))!) {
        targets.add(sub);
      }
    }

    if (courseCode && this.courseSubscribers.has(String(courseCode).toUpperCase())) {
      for (const sub of this.courseSubscribers.get(String(courseCode).toUpperCase())!) {
        targets.add(sub);
      }
    }

    const jsonString = JSON.stringify(event);

    for (const subscriber of targets) {
      try {
        if (typeof subscriber === 'function') {
          subscriber(event);
        } else if (typeof subscriber.send === 'function') {
          // Direct WebSocket connection
          // WebSocket.OPEN is 1
          if (subscriber.readyState === undefined || subscriber.readyState === 1) {
            subscriber.send(jsonString);
          }
        } else if (typeof subscriber.update === 'function') {
          subscriber.update(event);
        }
      } catch (err) {
        console.error('[SeatAvailabilityPublisher] Error notifying subscriber:', err);
      }
    }
  }

  /**
   * Active subscriber counts
   */
  getSubscriberCount(): { global: number; sections: number; courses: number; totalUnique: number } {
    const unique = new Set<Subscriber>(this.globalSubscribers);
    for (const set of this.sectionSubscribers.values()) {
      for (const s of set) unique.add(s);
    }
    for (const set of this.courseSubscribers.values()) {
      for (const s of set) unique.add(s);
    }

    return {
      global: this.globalSubscribers.size,
      sections: this.sectionSubscribers.size,
      courses: this.courseSubscribers.size,
      totalUnique: unique.size
    };
  }

  /**
   * Clear all subscribers (useful for testing and reset)
   */
  clear(): void {
    this.globalSubscribers.clear();
    this.sectionSubscribers.clear();
    this.courseSubscribers.clear();
  }
}

// Singleton instance for server-wide subscription registry
export const seatAvailabilityPublisher = new SeatAvailabilityPublisher();
