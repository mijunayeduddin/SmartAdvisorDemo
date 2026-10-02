/**
 * Graph Solver Engine (Pure Domain Module)
 * Architecture Rule: Strict separation of concerns.
 * Zero external dependencies on Express, HTTP, pg, or file system.
 */

export interface CourseInput {
  id?: string;
  code: string;
  title?: string;
  credits?: number;
  isMilestone?: boolean;
  prerequisites?: string[]; // Array of prerequisite course codes or IDs
}

export class CourseNode {
  id: string;
  code: string;
  title: string;
  credits: number;
  isMilestone: boolean;
  /** Set of course codes that must be completed before this course (incoming prerequisite edges) */
  prerequisites: Set<string>;
  /** Set of course codes that require this course (outgoing dependent edges) */
  dependents: Set<string>;

  constructor(params: CourseInput) {
    this.code = params.code.trim();
    this.id = params.id || this.code;
    this.title = params.title || this.code;
    this.credits = Number(params.credits ?? 3);
    this.isMilestone = Boolean(params.isMilestone);
    this.prerequisites = new Set<string>();
    this.dependents = new Set<string>();
  }
}

export class CurriculumGraph {
  /** Map of course code -> CourseNode */
  nodes: Map<string, CourseNode>;
  /** Map of course ID -> course code */
  idToCode: Map<string, string>;

  constructor() {
    this.nodes = new Map();
    this.idToCode = new Map();
  }

  addNode(node: CourseNode): void {
    this.nodes.set(node.code, node);
    if (node.id) {
      this.idToCode.set(node.id, node.code);
    }
  }

  getNode(codeOrId: string): CourseNode | undefined {
    if (this.nodes.has(codeOrId)) {
      return this.nodes.get(codeOrId);
    }
    const resolvedCode = this.idToCode.get(codeOrId);
    return resolvedCode ? this.nodes.get(resolvedCode) : undefined;
  }

  hasNode(codeOrId: string): boolean {
    return this.nodes.has(codeOrId) || this.idToCode.has(codeOrId);
  }

  addEdge(courseCodeOrId: string, prereqCodeOrId: string): void {
    const course = this.getNode(courseCodeOrId);
    const prereq = this.getNode(prereqCodeOrId);

    if (!course || !prereq) {
      throw new Error(`Cannot add prerequisite edge: node not found (${courseCodeOrId} -> ${prereqCodeOrId})`);
    }

    course.prerequisites.add(prereq.code);
    prereq.dependents.add(course.code);
  }

  getAllCodes(): string[] {
    return Array.from(this.nodes.keys());
  }

  get size(): number {
    return this.nodes.size;
  }
}

/**
 * Special credit-threshold gates (non-edge prerequisite requirements)
 */
export const DEFAULT_CREDIT_GATES: Record<string, number> = {
  'CSE299': 60,
  'CSE499A': 100
};

/**
 * Build curriculum graph from course definitions and detect cycles.
 * Throws an Error if the graph contains a cycle.
 */
export function buildGraph(courses: CourseInput[]): CurriculumGraph {
  const graph = new CurriculumGraph();

  // 1. Create all nodes
  for (const course of courses) {
    if (!course.code) {
      throw new Error('Course definition must include a valid code');
    }
    graph.addNode(new CourseNode(course));
  }

  // 2. Add prerequisite edges
  for (const course of courses) {
    if (course.prerequisites && Array.isArray(course.prerequisites)) {
      for (const prereq of course.prerequisites) {
        if (!prereq) continue;
        const prereqNode = graph.getNode(prereq);
        if (prereqNode) {
          graph.addEdge(course.code, prereqNode.code);
        } else {
          // If prerequisite is not defined as a separate course, create stub or throw
          const stub = new CourseNode({ code: prereq, title: prereq, credits: 0 });
          graph.addNode(stub);
          graph.addEdge(course.code, stub.code);
        }
      }
    }
  }

  // 3. Cycle Detection using Kahn's algorithm
  detectCycles(graph);

  return graph;
}

/**
 * Detects if the graph has a cycle. Throws an Error if a cycle is found.
 */
function detectCycles(graph: CurriculumGraph): void {
  const inDegree = new Map<string, number>();

  for (const [code, node] of graph.nodes.entries()) {
    inDegree.set(code, node.prerequisites.size);
  }

  const queue: string[] = [];
  for (const [code, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(code);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const currentCode = queue.shift()!;
    visitedCount++;

    const currentNode = graph.nodes.get(currentCode)!;
    for (const dependentCode of currentNode.dependents) {
      const remaining = (inDegree.get(dependentCode) ?? 0) - 1;
      inDegree.set(dependentCode, remaining);
      if (remaining === 0) {
        queue.push(dependentCode);
      }
    }
  }

  if (visitedCount < graph.nodes.size) {
    const cycleNodes: string[] = [];
    for (const [code, deg] of inDegree.entries()) {
      if (deg > 0) {
        cycleNodes.push(code);
      }
    }
    throw new Error(`Curriculum graph contains a cycle involving courses: [${cycleNodes.join(', ')}]`);
  }
}

/**
 * Compute standard Kahn's topological sort order.
 * Returns course codes in an order where all prerequisites appear before dependent courses.
 */
export function topologicalOrder(graph: CurriculumGraph): string[] {
  const inDegree = new Map<string, number>();

  for (const [code, node] of graph.nodes.entries()) {
    inDegree.set(code, node.prerequisites.size);
  }

  // Use a priority-stable queue (sorted alphabetically for deterministic output)
  const queue: string[] = [];
  for (const [code, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(code);
    }
  }
  queue.sort();

  const result: string[] = [];

  while (queue.length > 0) {
    const currentCode = queue.shift()!;
    result.push(currentCode);

    const currentNode = graph.nodes.get(currentCode)!;
    const nextBatch: string[] = [];

    for (const dependentCode of currentNode.dependents) {
      const remaining = (inDegree.get(dependentCode) ?? 0) - 1;
      inDegree.set(dependentCode, remaining);
      if (remaining === 0) {
        nextBatch.push(dependentCode);
      }
    }

    // Sort next batch alphabetically for deterministic ordering
    nextBatch.sort();
    queue.push(...nextBatch);
  }

  if (result.length < graph.nodes.size) {
    throw new Error('Curriculum graph contains a cycle; cannot determine topological order');
  }

  return result;
}

/**
 * Compute the longest remaining chain of prerequisite-heavy courses from the student's
 * current position to graduation (Critical Path).
 *
 * @param graph - Curriculum DAG
 * @param completedCourses - Array of course codes already completed by the student
 * @returns Array of course codes representing the critical chain (from earliest needed to capstone)
 */
export function criticalPath(graph: CurriculumGraph, completedCourses: string[]): string[] {
  const completedSet = new Set(completedCourses.map((c) => c.trim()));

  // Active uncompleted courses
  const remainingCodes = new Set<string>();
  for (const code of graph.nodes.keys()) {
    if (!completedSet.has(code)) {
      remainingCodes.add(code);
    }
  }

  if (remainingCodes.size === 0) {
    return [];
  }

  // Get topological order of all nodes
  const topo = topologicalOrder(graph);

  // Dynamic programming for longest path in remaining subgraph:
  // dist[u] = length of longest path ending at u
  // milestoneCount[u] = number of milestone courses on longest path ending at u
  // parent[u] = previous node on the longest path
  const dist = new Map<string, number>();
  const milestoneCount = new Map<string, number>();
  const parent = new Map<string, string | null>();

  for (const code of topo) {
    if (!remainingCodes.has(code)) continue;

    const node = graph.nodes.get(code)!;
    let maxDist = 1;
    let maxMilestones = node.isMilestone ? 1 : 0;
    let bestParent: string | null = null;

    // Check all prerequisites of code that are also remaining
    for (const prereqCode of node.prerequisites) {
      if (remainingCodes.has(prereqCode)) {
        const candidateDist = (dist.get(prereqCode) ?? 1) + 1;
        const candidateMilestones = (milestoneCount.get(prereqCode) ?? 0) + (node.isMilestone ? 1 : 0);

        if (
          candidateDist > maxDist ||
          (candidateDist === maxDist && candidateMilestones > maxMilestones)
        ) {
          maxDist = candidateDist;
          maxMilestones = candidateMilestones;
          bestParent = prereqCode;
        }
      }
    }

    dist.set(code, maxDist);
    milestoneCount.set(code, maxMilestones);
    parent.set(code, bestParent);
  }

  // Find the endpoint with the maximum distance (tie-break with milestone count)
  let bestEndpoint: string | null = null;
  let overallMaxDist = 0;
  let overallMaxMilestones = 0;

  for (const code of remainingCodes) {
    const d = dist.get(code) ?? 0;
    const m = milestoneCount.get(code) ?? 0;

    if (
      d > overallMaxDist ||
      (d === overallMaxDist && m > overallMaxMilestones)
    ) {
      overallMaxDist = d;
      overallMaxMilestones = m;
      bestEndpoint = code;
    }
  }

  if (!bestEndpoint) {
    return [];
  }

  // Reconstruct path from source to endpoint
  const path: string[] = [];
  let curr: string | null = bestEndpoint;
  while (curr !== null) {
    path.push(curr);
    curr = parent.get(curr) ?? null;
  }

  path.reverse();
  return path;
}

/**
 * Return courses whose prerequisites are satisfied, respecting special credit-threshold gates.
 *
 * @param graph - Curriculum DAG
 * @param completedCourses - Array of course codes already completed
 * @param creditsEarned - Total credit hours completed by student
 * @param creditGates - Map of course code -> required credits (defaults to CSE299: 60, CSE499A: 100)
 */
export function eligibleCourses(
  graph: CurriculumGraph,
  completedCourses: string[],
  creditsEarned?: number,
  creditGates: Record<string, number> = DEFAULT_CREDIT_GATES
): string[] {
  const completedSet = new Set(completedCourses.map((c) => c.trim()));

  // If creditsEarned is not explicitly passed, compute from completed courses in graph
  let totalCredits = creditsEarned;
  if (totalCredits === undefined) {
    totalCredits = 0;
    for (const code of completedSet) {
      const node = graph.getNode(code);
      if (node) {
        totalCredits += node.credits;
      }
    }
  }

  const eligible: string[] = [];

  for (const [code, node] of graph.nodes.entries()) {
    // 1. Must not already be completed
    if (completedSet.has(code)) {
      continue;
    }

    // 2. All prerequisite courses must be completed
    let prereqsSatisfied = true;
    for (const prereqCode of node.prerequisites) {
      if (!completedSet.has(prereqCode)) {
        prereqsSatisfied = false;
        break;
      }
    }
    if (!prereqsSatisfied) {
      continue;
    }

    // 3. Check credit-threshold gate (e.g. CSE299 requires 60, CSE499A requires 100)
    const requiredCredits = creditGates[code];
    if (requiredCredits !== undefined && totalCredits < requiredCredits) {
      continue;
    }

    eligible.push(code);
  }

  eligible.sort();
  return eligible;
}

export interface CoursePathwayResult {
  upstream: string[];
  target: string;
  downstream: string[];
  fullPath: string[];
  unlocksCount: number;
  longestDownstreamLength: number;
  rationale: string;
}

/**
 * Compute the critical pathway passing through a target course,
 * showing its prerequisite chain (upstream) and the longest downstream chain to graduation.
 */
export function criticalPathForCourse(
  graph: CurriculumGraph,
  completedCourses: string[],
  targetCode: string
): CoursePathwayResult {
  const normTarget = targetCode.trim();
  const targetNode = graph.getNode(normTarget);
  if (!targetNode) {
    return {
      upstream: [],
      target: normTarget,
      downstream: [],
      fullPath: [normTarget],
      unlocksCount: 0,
      longestDownstreamLength: 0,
      rationale: `Course ${normTarget} not found in curriculum graph.`
    };
  }

  const completedSet = new Set(completedCourses.map((c) => c.trim()));

  // 1. Upstream: trace prerequisite chain leading into target
  function getUpstreamChain(code: string, visited = new Set<string>()): string[] {
    const node = graph.getNode(code);
    if (!node || node.prerequisites.size === 0) return [];
    visited.add(code);

    let bestChain: string[] = [];
    for (const prereq of node.prerequisites) {
      if (visited.has(prereq)) continue;
      const sub = getUpstreamChain(prereq, new Set(visited));
      const chain = [...sub, prereq];
      if (chain.length > bestChain.length) {
        bestChain = chain;
      }
    }
    return bestChain;
  }

  const upstream = getUpstreamChain(normTarget);

  // 2. Downstream: trace longest chain of remaining courses unlocked by target
  function getDownstreamChain(code: string, visited = new Set<string>()): string[] {
    const node = graph.getNode(code);
    if (!node || node.dependents.size === 0) return [];
    visited.add(code);

    let bestChain: string[] = [];
    for (const dep of node.dependents) {
      if (visited.has(dep) || completedSet.has(dep)) continue;
      const sub = getDownstreamChain(dep, new Set(visited));
      const chain = [dep, ...sub];
      if (chain.length > bestChain.length) {
        bestChain = chain;
      }
    }
    return bestChain;
  }

  const downstream = getDownstreamChain(normTarget);
  const fullPath = [...upstream, normTarget, ...downstream];

  // Count all unique downstream uncompleted courses reachable from target
  const allReachable = new Set<string>();
  const q = [normTarget];
  while (q.length > 0) {
    const curr = q.shift()!;
    const node = graph.getNode(curr);
    if (!node) continue;
    for (const dep of node.dependents) {
      if (!allReachable.has(dep) && !completedSet.has(dep)) {
        allReachable.add(dep);
        q.push(dep);
      }
    }
  }

  let rationale = '';
  if (normTarget === 'CSE311') {
    rationale = 'Primary Graduation Bottleneck (Rank #1): Directly unlocks Software Engineering (CSE327) and Capstone Sequence (CSE499A & CSE499B).';
  } else if (normTarget === 'CSE332') {
    rationale = 'Core Systems Track Milestone: Unlocks Operating Systems (CSE323) and Microprocessor Interfacing (CSE331).';
  } else if (normTarget === 'CSE373') {
    rationale = 'Algorithmic Foundation Milestone: Unlocks Concepts of Programming Languages (CSE425) and advanced computer science electives.';
  } else if (normTarget === 'CSE327') {
    rationale = 'Software Engineering Milestone: Immediate gatekeeper to Senior Design Project (CSE499A) and Capstone Defense (CSE499B).';
  } else if (downstream.length > 0) {
    const nextUnlocks = Array.from(targetNode.dependents).filter(d => !completedSet.has(d));
    rationale = `Taking ${normTarget} unlocks ${nextUnlocks.join(', ')} and leads along a ${downstream.length + 1}-step chain to graduation.`;
  } else {
    rationale = `${normTarget} satisfies required curriculum credits towards degree completion.`;
  }

  return {
    upstream,
    target: normTarget,
    downstream,
    fullPath,
    unlocksCount: allReachable.size,
    longestDownstreamLength: downstream.length,
    rationale
  };
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

/**
 * Evaluates all eligible courses and dynamically ranks what is BEST to take right now,
 * considering milestone weights, unlocking power, and active term schedule enrollments.
 */
export function recommendBestCourses(
  graph: CurriculumGraph,
  completedCourses: string[],
  enrolledCourses: string[] = [],
  creditsEarned?: number
): CourseRecommendation[] {
  const eligible = eligibleCourses(graph, completedCourses, creditsEarned);
  const enrolledSet = new Set(enrolledCourses.map((c) => c.trim().toUpperCase()));

  const recs: CourseRecommendation[] = [];

  for (const code of eligible) {
    const node = graph.getNode(code);
    if (!node) continue;

    const pathData = criticalPathForCourse(graph, completedCourses, code);
    const isEnrolled = enrolledSet.has(code.toUpperCase());

    let score = (pathData.longestDownstreamLength * 40) + (pathData.unlocksCount * 15);
    if (node.isMilestone) score += 50;

    recs.push({
      code,
      title: node.title,
      score,
      isMilestone: node.isMilestone,
      isEnrolled,
      downstreamCount: pathData.unlocksCount,
      criticalPathLength: pathData.longestDownstreamLength,
      rationale: pathData.rationale,
      pathway: pathData.fullPath
    });
  }

  recs.sort((a, b) => b.score - a.score || (b.isMilestone ? 1 : 0) - (a.isMilestone ? 1 : 0));
  return recs;
}

