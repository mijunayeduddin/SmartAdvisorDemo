export interface Course {
  id: string;
  code: string;
  title: string;
  credits: number;
  department: string;
  description?: string;
  isMilestone: boolean;
  prerequisites: string[];
  isCompleted?: boolean;
  isEligible?: boolean;
  isCriticalPath?: boolean;
  criticalPathRank?: number | null;
}

export interface Section {
  id: string;
  course_id?: string;
  course_code: string;
  section_number: number;
  capacity: number;
  enrolled_count: number;
  seats_available: number;
  room?: string;
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
  raw_time?: string;
  faculty_name?: string;
  term?: string;
  course_title?: string;
  course_credits?: string | number;
  is_milestone?: boolean;
}

export interface StudentContext {
  studentId: string;
  name?: string;
  completedCredits: number;
  completedCoursesCount: number;
  criticalPathLength: number;
}

export interface FallbackAlternative {
  sectionId: string;
  courseCode: string;
  sectionNumber: number;
  title?: string;
  credits: number;
  seatsAvailable: number;
  capacity?: number;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  facultyName?: string;
  isCriticalPath: boolean;
  isMilestone: boolean;
  priorityScore?: number;
  rationale: string;
}

export interface FallbackRouteResponse {
  status: 'ACCEPTED' | 'FALLBACK_PROPOSED' | 'NO_ALTERNATIVE';
  requested: {
    sectionId?: string;
    courseCode: string;
    sectionNumber?: number;
    seatsAvailable: number;
    capacity?: number;
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
    facultyName?: string;
    reason?: string;
  };
  alternative: FallbackAlternative | null;
  criticalPath: string[];
  eligibleCourses: string[];
  strategyUsed: string;
  message: string;
  timestamp: string;
}

export type StrategyMode = 'MilestonePriority' | 'MinimizeGaps';

export type PathwayMode = 'selected' | 'best' | 'curriculum';

export interface CoursePathway {
  upstream: string[];
  target: string;
  downstream: string[];
  fullPath: string[];
  unlocksCount: number;
  longestDownstreamLength: number;
  rationale: string;
}

export interface CourseRecommendation {
  code: string;
  title: string;
  score: number;
  isMilestone: boolean;
  isEnrolled: boolean;
  downstreamCount: number;
  criticalPathLength: number;
  rationale: string;
  pathway: string[];
}
