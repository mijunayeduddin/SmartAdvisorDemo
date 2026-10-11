export type Role = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Course {
  code: string;
  title: string;
  credits: number;
  prerequisites: string[];
}

export type Day = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu';

/** start/end are minutes from midnight, e.g. 9:30 am = 570 */
export interface TimeSlot {
  day: Day;
  start: number;
  end: number;
}

export interface Section {
  id: string;
  courseCode: string;
  label: string;
  facultyId: string;
  facultyName: string;
  seats: number;
  capacity: number;
  slots: TimeSlot[];
}

export type RequestStatus = 'approved' | 'pending' | 'rejected';

export interface SeatRequest {
  id: string;
  studentId: string;
  studentName: string;
  sectionId: string;
  courseCode: string;
  status: RequestStatus;
  reason?: string;
  createdAt: number;
  decidedAt?: number;
}

/** Events pushed over the (mock) WebSocket. Same shape the real server should send. */
export type SeatEvent =
  | { type: 'seat'; sectionId: string; seats: number; capacity: number }
  | { type: 'request'; request: SeatRequest }
  | { type: 'shortage'; courseCode: string; waiting: number }
  | { type: 'shortage-cleared'; courseCode: string };

export interface HealthSnapshot {
  rps: number;
  p95Ms: number;
  errorRatePct: number;
  dbPoolPct: number;
  services: { api: 'up' | 'down'; redis: 'up' | 'down'; postgres: 'up' | 'down' };
  at: number;
}

export type ApiErrorCode =
  | 'AUTH_FAILED'
  | 'PREREQ_MISSING'
  | 'SECTION_FULL'
  | 'DUPLICATE'
  | 'FORBIDDEN'
  | 'INVALID'
  | 'NOT_FOUND';

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: Record<string, unknown>;
  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}
