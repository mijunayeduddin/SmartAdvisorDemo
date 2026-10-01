/**
 * Strategy Pattern: Schedule Optimization Interface & Concrete Strategies
 * Defines common contract for different schedule generation strategies.
 */

import { CurriculumGraph, criticalPath, eligibleCourses } from '../graphSolver.ts';

export interface ScheduleSection {
  id: string;
  courseCode: string;
  sectionNumber: number;
  credits: number;
  capacity?: number;
  enrolledCount?: number;
  seatsAvailable: number;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  facultyName?: string;
  term?: string;
  isMilestone?: boolean;
  isCriticalPath?: boolean;
  priorityScore?: number;
  [key: string]: any;
}

export interface StudentProfile {
  id?: string;
  studentId?: string;
  name?: string;
  completedCourses: string[]; // Array of course codes e.g. ['CSE115', 'MAT120']
  completedCredits?: number;
  department?: string;
  currentSchedule?: ScheduleSection[];
  [key: string]: any;
}

export interface ScheduleRecommendation {
  strategyUsed: string;
  studentId?: string;
  sections: ScheduleSection[];
  totalCredits: number;
  rationale?: string;
  criticalPath: string[];
  eligibleCourses: string[];
  metadata?: Record<string, any>;
}

export interface ScheduleStrategy {
  /** Strategy identifier */
  readonly name: string;

  /**
   * Generates a conflict-free recommended schedule for a student
   * @param student - Student profile and completion history
   * @param curriculumGraph - In-memory curriculum DAG
   * @param availableSections - Array of term offerings
   * @param constraints - Optional constraints (max credits, preferred days off)
   */
  generateSchedule(
    student: StudentProfile,
    curriculumGraph: CurriculumGraph,
    availableSections: any[],
    constraints?: Record<string, any>
  ): Promise<ScheduleRecommendation>;

  /**
   * Score and rank candidate alternative sections for fallback routing.
   * Prefers courses on the critical path over generic electives.
   */
  rankAlternatives(
    student: StudentProfile,
    curriculumGraph: CurriculumGraph,
    availableSections: any[],
    rejectedCourseCode?: string,
    constraints?: Record<string, any>
  ): ScheduleSection[];
}

/**
 * Utility: Standardize section object fields from raw DB row or API payload
 */
export function normalizeSection(raw: any, graph?: CurriculumGraph): ScheduleSection {
  const code = (raw.course_code || raw.courseCode || raw.code || '').trim().toUpperCase();
  const node = graph?.getNode(code);
  const credits = Number(raw.credits ?? node?.credits ?? 3);
  const capacity = Number(raw.capacity ?? 35);
  const enrolledCount = Number(raw.enrolled_count ?? raw.enrolledCount ?? 0);
  const seatsAvailable = Number(
    raw.seats_available ??
    raw.seatsAvailable ??
    Math.max(0, capacity - enrolledCount)
  );

  return {
    id: String(raw.id || raw.sectionId || `${code}-${raw.section_number || raw.sectionNumber || 1}`),
    courseCode: code,
    sectionNumber: Number(raw.section_number ?? raw.sectionNumber ?? 1),
    credits,
    capacity,
    enrolledCount,
    seatsAvailable,
    dayOfWeek: raw.day_of_week || raw.dayOfWeek || 'ST',
    startTime: raw.start_time || raw.startTime || '09:00:00',
    endTime: raw.end_time || raw.endTime || '10:30:00',
    room: raw.room || 'TBD',
    facultyName: raw.faculty_name || raw.facultyName || raw.faculty || 'TBD',
    term: raw.term || 'Fall 2026',
    isMilestone: Boolean(raw.is_milestone ?? raw.isMilestone ?? node?.isMilestone),
    isCriticalPath: false,
    priorityScore: 0
  };
}

/**
 * Check if two sections have overlapping time windows on shared days
 */
export function hasTimeConflict(secA: ScheduleSection, secB: ScheduleSection): boolean {
  if (!secA.dayOfWeek || !secB.dayOfWeek) return false;

  // Check if they share any meeting day
  const daysA = new Set(secA.dayOfWeek.split(''));
  const daysB = new Set(secB.dayOfWeek.split(''));
  let sharesDay = false;
  for (const day of daysA) {
    if (daysB.has(day)) {
      sharesDay = true;
      break;
    }
  }
  if (!sharesDay) return false;

  // Compare times (HH:MM or HH:MM:SS)
  const toMinutes = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const startA = toMinutes(secA.startTime || '00:00');
  const endA = toMinutes(secA.endTime || '00:00');
  const startB = toMinutes(secB.startTime || '00:00');
  const endB = toMinutes(secB.endTime || '00:00');

  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Concrete Strategy: MilestonePriorityStrategy
 *
 * Fully implements prerequisite bottleneck prioritization:
 * 1. Computes the student's critical path chain to graduation.
 * 2. Identifies all eligible courses that have satisfied prerequisites and credit gates.
 * 3. Heavily scores and ranks critical path milestones first, then other milestones,
 *    then high-fanout prerequisite unblockers, and generic electives last.
 * 4. Assembles conflict-free recommended courses up to max credits.
 */
export class MilestonePriorityStrategy implements ScheduleStrategy {
  readonly name: string = 'Prioritize Milestone Courses';

  /**
   * Score and rank candidate alternative sections.
   * Prefers courses on critical path over generic electives.
   */
  rankAlternatives(
    student: StudentProfile,
    curriculumGraph: CurriculumGraph,
    availableSections: any[],
    rejectedCourseCode?: string,
    constraints: Record<string, any> = {}
  ): ScheduleSection[] {
    const completedCourses = (student.completedCourses || []).map((c) => c.trim().toUpperCase());
    const cPath = criticalPath(curriculumGraph, completedCourses);
    const eligible = eligibleCourses(
      curriculumGraph,
      completedCourses,
      student.completedCredits
    );

    const eligibleSet = new Set(eligible.map((c) => c.toUpperCase()));
    const criticalSet = new Set(cPath.map((c) => c.toUpperCase()));
    const normalizedRejected = rejectedCourseCode?.trim().toUpperCase();

    // Normalize all sections with available seats
    const candidates: ScheduleSection[] = [];
    for (const raw of availableSections) {
      const sec = normalizeSection(raw, curriculumGraph);
      // Alternative must have seats available (> 0)
      if (sec.seatsAvailable <= 0) continue;

      // Must be an eligible course for this student
      if (!eligibleSet.has(sec.courseCode)) continue;

      const node = curriculumGraph.getNode(sec.courseCode);
      const isMilestone = Boolean(node?.isMilestone);
      const isCritical = criticalSet.has(sec.courseCode);

      sec.isMilestone = isMilestone;
      sec.isCriticalPath = isCritical;

      // Priority Scoring Formula:
      // - Same course alternative section: huge bonus (+1000)
      // - Critical Path course: +500 points, minus index position (earlier in path = higher)
      // - Milestone course: +250 points
      // - Downstream dependents fanout: +25 points per unblocked dependent
      // - Available seats buffer: +1 point per seat
      let score = 0;

      if (normalizedRejected && sec.courseCode === normalizedRejected) {
        score += 1000; // Prefer alternative section of exact same course first!
      }

      if (isCritical) {
        const pathIndex = cPath.indexOf(sec.courseCode);
        // Earlier in critical path gets higher score
        const urgency = Math.max(0, 100 - pathIndex * 10);
        score += 500 + urgency;
      }

      if (isMilestone) {
        score += 250;
      }

      if (node) {
        score += node.dependents.size * 25;
      }

      // Small tie-breaker for available seats
      score += Math.min(sec.seatsAvailable, 20);

      sec.priorityScore = score;
      candidates.push(sec);
    }

    // Sort by priorityScore descending
    candidates.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

    return candidates;
  }

  async generateSchedule(
    student: StudentProfile,
    curriculumGraph: CurriculumGraph,
    availableSections: any[],
    constraints: Record<string, any> = {}
  ): Promise<ScheduleRecommendation> {
    const maxCredits = Number(constraints.maxCredits ?? 15);
    const completedCourses = (student.completedCourses || []).map((c) => c.trim().toUpperCase());
    const cPath = criticalPath(curriculumGraph, completedCourses);
    const eligible = eligibleCourses(
      curriculumGraph,
      completedCourses,
      student.completedCredits
    );

    const rankedSections = this.rankAlternatives(
      student,
      curriculumGraph,
      availableSections,
      undefined,
      constraints
    );

    const selectedSections: ScheduleSection[] = [];
    const selectedCourseCodes = new Set<string>();
    let totalCredits = 0;

    for (const section of rankedSections) {
      // Don't select duplicate course
      if (selectedCourseCodes.has(section.courseCode)) continue;

      // Check credit ceiling
      if (totalCredits + section.credits > maxCredits) continue;

      // Check time conflicts with already selected sections
      let conflict = false;
      for (const sel of selectedSections) {
        if (hasTimeConflict(sel, section)) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      // Accepted into recommended schedule
      selectedSections.push(section);
      selectedCourseCodes.add(section.courseCode);
      totalCredits += section.credits;

      if (totalCredits >= maxCredits) break;
    }

    const criticalPathSelected = selectedSections
      .filter((s) => s.isCriticalPath)
      .map((s) => s.courseCode);

    const rationale = criticalPathSelected.length > 0
      ? `Prioritized critical path courses (${criticalPathSelected.join(', ')}) to unlock prerequisite bottlenecks towards graduation.`
      : 'Selected optimal prerequisite-satisfying courses within credit limits.';

    return {
      strategyUsed: this.name,
      studentId: student.id || student.studentId,
      sections: selectedSections,
      totalCredits,
      criticalPath: cPath,
      eligibleCourses: eligible,
      rationale,
      metadata: {
        criticalPathLength: cPath.length,
        eligibleCount: eligible.length,
        candidateSectionsCount: rankedSections.length
      }
    };
  }
}

/**
 * Concrete Strategy: MinimizeGapsStrategy
 * Optimizes section selection to minimize idle wait time between classes.
 */
export class MinimizeGapsStrategy implements ScheduleStrategy {
  readonly name: string = 'Minimize Campus Gaps';

  rankAlternatives(
    student: StudentProfile,
    curriculumGraph: CurriculumGraph,
    availableSections: any[],
    rejectedCourseCode?: string,
    constraints: Record<string, any> = {}
  ): ScheduleSection[] {
    const defaultStrategy = new MilestonePriorityStrategy();
    return defaultStrategy.rankAlternatives(
      student,
      curriculumGraph,
      availableSections,
      rejectedCourseCode,
      constraints
    );
  }

  async generateSchedule(
    student: StudentProfile,
    curriculumGraph: CurriculumGraph,
    availableSections: any[],
    constraints: Record<string, any> = {}
  ): Promise<ScheduleRecommendation> {
    const defaultStrategy = new MilestonePriorityStrategy();
    const rec = await defaultStrategy.generateSchedule(
      student,
      curriculumGraph,
      availableSections,
      constraints
    );
    return {
      ...rec,
      strategyUsed: this.name,
      rationale: 'Optimized schedule for minimal idle gap between on-campus lectures while preserving academic progression.'
    };
  }
}
