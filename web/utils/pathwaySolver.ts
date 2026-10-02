import { Course, CoursePathway, CourseRecommendation, Section } from '../types';

/**
 * Builds incoming (prerequisites) and outgoing (dependents) adjacency maps.
 */
function buildAdjacency(courses: Course[]) {
  const prereqMap = new Map<string, string[]>();
  const dependentMap = new Map<string, string[]>();
  const courseMap = new Map<string, Course>();

  for (const c of courses) {
    const code = c.code.toUpperCase();
    courseMap.set(code, c);
    prereqMap.set(code, (c.prerequisites || []).map((p) => p.toUpperCase()));
    if (!dependentMap.has(code)) {
      dependentMap.set(code, []);
    }
  }

  for (const c of courses) {
    const code = c.code.toUpperCase();
    for (const prereq of c.prerequisites || []) {
      const pUpper = prereq.toUpperCase();
      if (!dependentMap.has(pUpper)) {
        dependentMap.set(pUpper, []);
      }
      dependentMap.get(pUpper)!.push(code);
    }
  }

  return { prereqMap, dependentMap, courseMap };
}

/**
 * Computes the prerequisite chain leading into targetCourse, the target course itself,
 * and the longest downstream chain to graduation/milestones.
 */
export function solvePathwayForCourse(
  targetCode: string,
  courses: Course[],
  completedSet: Set<string>
): CoursePathway {
  const normTarget = targetCode.trim().toUpperCase();
  const { prereqMap, dependentMap, courseMap } = buildAdjacency(courses);
  const targetNode = courseMap.get(normTarget);

  if (!targetNode) {
    return {
      upstream: [],
      target: normTarget,
      downstream: [],
      fullPath: [normTarget],
      unlocksCount: 0,
      longestDownstreamLength: 0,
      rationale: `Course ${normTarget} not found in curriculum catalog.`
    };
  }

  // 1. Upstream chain: longest prerequisite chain leading to target
  function getUpstreamChain(code: string, visited = new Set<string>()): string[] {
    const prereqs = prereqMap.get(code) || [];
    if (prereqs.length === 0) return [];
    visited.add(code);

    let bestChain: string[] = [];
    for (const p of prereqs) {
      if (visited.has(p)) continue;
      const sub = getUpstreamChain(p, new Set(visited));
      const chain = [...sub, p];
      if (chain.length > bestChain.length) {
        bestChain = chain;
      }
    }
    return bestChain;
  }

  const upstream = getUpstreamChain(normTarget);

  // 2. Downstream chain: longest uncompleted path to capstone
  function getDownstreamChain(code: string, visited = new Set<string>()): string[] {
    const deps = dependentMap.get(code) || [];
    if (deps.length === 0) return [];
    visited.add(code);

    let bestChain: string[] = [];
    for (const d of deps) {
      if (visited.has(d) || completedSet.has(d)) continue;
      const sub = getDownstreamChain(d, new Set(visited));
      const chain = [d, ...sub];
      if (chain.length > bestChain.length) {
        bestChain = chain;
      }
    }
    return bestChain;
  }

  const downstream = getDownstreamChain(normTarget);
  const fullPath = [...upstream, normTarget, ...downstream];

  // Count all unique uncompleted reachable courses
  const allReachable = new Set<string>();
  const queue = [normTarget];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const deps = dependentMap.get(curr) || [];
    for (const d of deps) {
      if (!allReachable.has(d) && !completedSet.has(d)) {
        allReachable.add(d);
        queue.push(d);
      }
    }
  }

  let rationale = '';
  if (normTarget === 'CSE311') {
    rationale = 'Primary Graduation Bottleneck (Rank #1): Directly unlocks Software Engineering (CSE327) and Capstone Sequence (CSE499A & CSE499B).';
  } else if (normTarget === 'CSE332') {
    rationale = 'Core Systems Track Milestone: Unlocks Operating Systems (CSE323) and Microprocessor Interfacing (CSE331).';
  } else if (normTarget === 'CSE373') {
    rationale = 'Algorithmic Foundation Milestone: Unlocks Concepts of Programming Languages (CSE425) and advanced CS electives.';
  } else if (normTarget === 'CSE327') {
    rationale = 'Software Engineering Milestone: Gatekeeper to Senior Design Project (CSE499A) and Capstone Defense (CSE499B).';
  } else if (normTarget === 'CSE323') {
    rationale = 'Core Operating Systems requirement: Prerequisite: CSE332.';
  } else if (normTarget === 'CSE425') {
    rationale = 'Senior Language Concepts: Requires CSE327 & CSE373.';
  } else if (normTarget === 'CSE499A') {
    rationale = 'Senior Capstone Phase I: Requires CSE327 and 100 earned credits.';
  } else if (normTarget === 'CSE499B') {
    rationale = 'Final Graduation Defense: Senior Design Capstone II.';
  } else if (downstream.length > 0) {
    const directDeps = (dependentMap.get(normTarget) || []).filter((d) => !completedSet.has(d));
    rationale = `Unlocks ${directDeps.join(', ')} and continues along a ${downstream.length + 1}-step graduation chain.`;
  } else {
    rationale = 'Satisfies general degree requirements without downstream prerequisite bottlenecks.';
  }

  return {
    upstream,
    target: normTarget,
    downstream,
    fullPath,
    unlocksCount: allReachable.size,
    longestDownstreamLength: downstream.length,
    rationale,
  };
}

/**
 * Computes ranked dynamic recommendations on "What is Best" to take right now,
 * adapting dynamically as courses are enrolled in the schedule.
 */
export function solveBestRecommendations(
  courses: Course[],
  enrolledSections: Section[],
  completedSet: Set<string>
): CourseRecommendation[] {
  const enrolledSet = new Set(enrolledSections.map((s) => s.course_code.toUpperCase()));

  const eligibleCourses = courses.filter((c) => {
    const code = c.code.toUpperCase();
    if (completedSet.has(code)) return false;
    const prereqs = c.prerequisites || [];
    return prereqs.every((p) => completedSet.has(p.toUpperCase()));
  });

  const recommendations: CourseRecommendation[] = [];

  for (const c of eligibleCourses) {
    const code = c.code.toUpperCase();
    const isEnrolled = enrolledSet.has(code);
    const pathway = solvePathwayForCourse(code, courses, completedSet);

    let score = pathway.longestDownstreamLength * 40 + pathway.unlocksCount * 15;
    if (c.isMilestone) score += 50;

    let rationale = pathway.rationale;
    if (isEnrolled) {
      rationale = `[Currently in Schedule] ${pathway.rationale}`;
    }

    recommendations.push({
      code,
      title: c.title,
      score,
      isMilestone: Boolean(c.isMilestone),
      isEnrolled,
      downstreamCount: pathway.unlocksCount,
      criticalPathLength: pathway.longestDownstreamLength,
      rationale,
      pathway: pathway.fullPath,
    });
  }

  recommendations.sort((a, b) => {
    if (a.isEnrolled !== b.isEnrolled) {
      return a.isEnrolled ? 1 : -1;
    }
    return b.score - a.score || (b.isMilestone ? 1 : 0) - (a.isMilestone ? 1 : 0);
  });

  return recommendations;
}
