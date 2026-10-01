/**
 * Fallback Router Engine (backend/core/fallbackRouter.ts)
 *
 * Implements intelligent schedule fallback routing when a desired section has 0 seats left.
 * Instead of returning a plain error or rejection, it coordinates:
 *   1. Active ScheduleStrategy (Strategy Pattern)
 *   2. Graph Solver's eligibleCourses() and criticalPath()
 *
 * Proposes the next-best alternative section/course that keeps the student's
 * critical path intact, and returns both the rejected choice and the suggested
 * alternative in one unified response.
 */

import { CurriculumGraph, criticalPath, eligibleCourses } from './graphSolver.ts';
import {
  MilestonePriorityStrategy,
  normalizeSection,
  hasTimeConflict,
  type ScheduleStrategy,
  type ScheduleSection,
  type StudentProfile
} from './strategy/scheduleStrategy.ts';

export interface RequestedSectionInput {
  sectionId?: string;
  courseCode?: string;
  sectionNumber?: number;
  term?: string;
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
  alternative: {
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
  } | null;
  criticalPath: string[];
  eligibleCourses: string[];
  strategyUsed: string;
  message: string;
  timestamp: string;
}

export class FallbackRouter {
  private defaultStrategy: ScheduleStrategy;

  constructor(defaultStrategy?: ScheduleStrategy) {
    this.defaultStrategy = defaultStrategy || new MilestonePriorityStrategy();
  }

  /**
   * Route a section simulation or registration attempt.
   * If section has available seats: returns ACCEPTED.
   * If section has 0 seats: invokes active Strategy + Graph Solver to propose next-best alternative.
   *
   * @param student - Student profile with completedCourses and completedCredits
   * @param requested - Target section (by sectionId or courseCode + sectionNumber)
   * @param curriculumGraph - Current curriculum DAG
   * @param availableSections - Array of active sections offered in the term
   * @param activeStrategy - Optional custom strategy (defaults to MilestonePriorityStrategy)
   * @param currentSchedule - Optional list of sections student is currently registered for in term
   */
  routeSimulation(
    student: StudentProfile,
    requested: RequestedSectionInput,
    curriculumGraph: CurriculumGraph,
    availableSections: any[],
    activeStrategy?: ScheduleStrategy,
    currentSchedule: any[] = []
  ): FallbackRouteResponse {
    const strategy = activeStrategy || this.defaultStrategy;
    const completedCourses = (student.completedCourses || []).map((c) => c.trim().toUpperCase());
    const cPath = criticalPath(curriculumGraph, completedCourses);
    const eligible = eligibleCourses(curriculumGraph, completedCourses, student.completedCredits);

    // 1. Locate the requested section among available sections
    let requestedSec: ScheduleSection | null = null;
    const normalizedReqCode = requested.courseCode?.trim().toUpperCase();
    const normalizedReqSecNum = requested.sectionNumber !== undefined ? Number(requested.sectionNumber) : undefined;
    const normalizedReqSecId = requested.sectionId ? String(requested.sectionId) : undefined;

    for (const raw of availableSections) {
      const sec = normalizeSection(raw, curriculumGraph);
      if (normalizedReqSecId && sec.id === normalizedReqSecId) {
        requestedSec = sec;
        break;
      }
      if (
        normalizedReqCode &&
        sec.courseCode === normalizedReqCode &&
        (normalizedReqSecNum === undefined || sec.sectionNumber === normalizedReqSecNum)
      ) {
        requestedSec = sec;
        break;
      }
    }

    const timestamp = new Date().toISOString();

    // If requested section was not found in catalog, construct fallback info from input
    const reqCourseCode = requestedSec?.courseCode || normalizedReqCode || 'UNKNOWN';
    const reqSectionNumber = requestedSec?.sectionNumber ?? normalizedReqSecNum ?? 1;
    const seatsAvailable = requestedSec ? requestedSec.seatsAvailable : 0;

    // 2. Case A: Section has seats available (> 0) -> ACCEPTED
    if (requestedSec && requestedSec.seatsAvailable > 0) {
      return {
        status: 'ACCEPTED',
        requested: {
          sectionId: requestedSec.id,
          courseCode: requestedSec.courseCode,
          sectionNumber: requestedSec.sectionNumber,
          seatsAvailable: requestedSec.seatsAvailable,
          capacity: requestedSec.capacity,
          dayOfWeek: requestedSec.dayOfWeek,
          startTime: requestedSec.startTime,
          endTime: requestedSec.endTime,
          facultyName: requestedSec.facultyName
        },
        alternative: null,
        criticalPath: cPath,
        eligibleCourses: eligible,
        strategyUsed: strategy.name,
        message: `Section ${requestedSec.courseCode} §${requestedSec.sectionNumber} is available with ${requestedSec.seatsAvailable} seat(s).`,
        timestamp
      };
    }

    // 3. Case B: Section has 0 seats left -> Propose Next-Best Alternative!
    // Normalize existing student schedule to detect time conflicts
    const normalizedCurrentSchedule: ScheduleSection[] = (currentSchedule || []).map((s) =>
      normalizeSection(s, curriculumGraph)
    );

    // Rank all candidate alternatives using active Strategy
    const rankedCandidates = strategy.rankAlternatives(
      student,
      curriculumGraph,
      availableSections,
      reqCourseCode
    );

    // Filter candidates to ensure no time conflicts with student's current schedule
    // and exclude the exact full section that was rejected
    const conflictFreeCandidates = rankedCandidates.filter((cand) => {
      // Must not be the rejected section
      if (requestedSec && cand.id === requestedSec.id) return false;
      if (cand.courseCode === reqCourseCode && cand.sectionNumber === reqSectionNumber) return false;
      if (cand.seatsAvailable <= 0) return false;

      // Check time conflicts with existing enrolled schedule
      for (const enrolled of normalizedCurrentSchedule) {
        if (hasTimeConflict(enrolled, cand)) {
          return false;
        }
      }
      return true;
    });

    const requestedInfo = {
      sectionId: requestedSec?.id || normalizedReqSecId,
      courseCode: reqCourseCode,
      sectionNumber: reqSectionNumber,
      seatsAvailable: 0,
      capacity: requestedSec?.capacity ?? 35,
      dayOfWeek: requestedSec?.dayOfWeek,
      startTime: requestedSec?.startTime,
      endTime: requestedSec?.endTime,
      facultyName: requestedSec?.facultyName,
      reason: `Section ${reqCourseCode} §${reqSectionNumber} has 0 seats left (capacity full).`
    };

    if (conflictFreeCandidates.length === 0) {
      return {
        status: 'NO_ALTERNATIVE',
        requested: requestedInfo,
        alternative: null,
        criticalPath: cPath,
        eligibleCourses: eligible,
        strategyUsed: strategy.name,
        message: `Section ${reqCourseCode} §${reqSectionNumber} is full, and no conflict-free alternative sections are currently open.`,
        timestamp
      };
    }

    // Select the best alternative
    const bestAlt = conflictFreeCandidates[0];
    const altNode = curriculumGraph.getNode(bestAlt.courseCode);

    let rationale: string;
    if (bestAlt.courseCode === reqCourseCode) {
      rationale = `Alternative Section §${bestAlt.sectionNumber} of ${bestAlt.courseCode} has ${bestAlt.seatsAvailable} seat(s) open, perfectly preserving your desired course registration without schedule conflict.`;
    } else if (bestAlt.isCriticalPath) {
      const stepIdx = cPath.indexOf(bestAlt.courseCode) + 1;
      rationale = `${bestAlt.courseCode} §${bestAlt.sectionNumber} is on your Critical Path (Step ${stepIdx} of ${cPath.length}). Taking this unlocks upcoming prerequisites and keeps graduation timeline intact.`;
    } else if (bestAlt.isMilestone) {
      rationale = `${bestAlt.courseCode} §${bestAlt.sectionNumber} is a core Department Milestone course with open seats, advancing degree requirements.`;
    } else {
      rationale = `${bestAlt.courseCode} §${bestAlt.sectionNumber} is an eligible elective course that fits your schedule with open seats.`;
    }

    return {
      status: 'FALLBACK_PROPOSED',
      requested: requestedInfo,
      alternative: {
        sectionId: bestAlt.id,
        courseCode: bestAlt.courseCode,
        sectionNumber: bestAlt.sectionNumber,
        title: altNode?.title || bestAlt.courseCode,
        credits: bestAlt.credits,
        seatsAvailable: bestAlt.seatsAvailable,
        capacity: bestAlt.capacity,
        dayOfWeek: bestAlt.dayOfWeek,
        startTime: bestAlt.startTime,
        endTime: bestAlt.endTime,
        room: bestAlt.room,
        facultyName: bestAlt.facultyName,
        isCriticalPath: Boolean(bestAlt.isCriticalPath),
        isMilestone: Boolean(bestAlt.isMilestone),
        priorityScore: bestAlt.priorityScore,
        rationale
      },
      criticalPath: cPath,
      eligibleCourses: eligible,
      strategyUsed: strategy.name,
      message: `Requested section is full (0 seats). Proposed ${bestAlt.courseCode} §${bestAlt.sectionNumber} as next-best alternative to keep critical path intact.`,
      timestamp
    };
  }
}

// Singleton fallback router instance
export const fallbackRouter = new FallbackRouter();
