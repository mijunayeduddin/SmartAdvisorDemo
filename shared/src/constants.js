/**
 * Shared Application Constants
 */

// WebSocket Event Types (Observer Pattern)
const WS_EVENTS = {
  CONNECT: 'ws:connect',
  DISCONNECT: 'ws:disconnect',
  SUBSCRIBE_COURSE: 'subscribe:course',
  UNSUBSCRIBE_COURSE: 'unsubscribe:course',
  SECTION_FULL: 'section:full',
  SEAT_AVAILABLE: 'seat:available',
  SCHEDULE_UPDATED: 'schedule:updated',
  STUDENT_SYNC: 'student:sync'
};

// Schedule Generation Strategy Names (Strategy Pattern)
const SCHEDULE_STRATEGIES = {
  PRIORITIZE_MILESTONE: 'PRIORITIZE_MILESTONE',
  MINIMIZE_GAP: 'MINIMIZE_GAP'
};

// Enrollment Status Values
const ENROLLMENT_STATUS = {
  ENROLLED: 'enrolled',
  WAITLISTED: 'waitlisted',
  COMPLETED: 'completed',
  DROPPED: 'dropped'
};

module.exports = {
  WS_EVENTS,
  SCHEDULE_STRATEGIES,
  ENROLLMENT_STATUS
};
