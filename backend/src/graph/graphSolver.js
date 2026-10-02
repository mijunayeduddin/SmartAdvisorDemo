/**
 * Graph Solver Engine (Pure Domain Module)
 * Architecture Rule: Strict separation of concerns.
 * Zero external dependencies on Express, HTTP, pg, or file system.
 */

class CourseNode {
  /**
   * @param {Object} params
   * @param {string} [params.id]
   * @param {string} params.code
   * @param {string} [params.title]
   * @param {number} [params.credits]
   * @param {boolean} [params.isMilestone]
   */
  constructor({ id, code, title, credits, isMilestone = false }) {
    this.code = (code || '').trim();
    this.id = id || this.code;
    this.title = title || this.code;
    this.credits = Number(credits ?? 3);
    this.isMilestone = Boolean(isMilestone);
    /** @type {Set<string>} Course codes that must be completed before this course */
    this.prerequisites = new Set();
    /** @type {Set<string>} Course codes that require this course */
    this.dependents = new Set();
  }
}

class CurriculumGraph {
  constructor() {
    /** @type {Map<string, CourseNode>} */
    this.nodes = new Map();
    /** @type {Map<string, string>} */
    this.idToCode = new Map();
  }

  addNode(node) {
    this.nodes.set(node.code, node);
    if (node.id) {
      this.idToCode.set(node.id, node.code);
    }
  }

  getNode(codeOrId) {
    if (this.nodes.has(codeOrId)) {
      return this.nodes.get(codeOrId);
    }
    const resolvedCode = this.idToCode.get(codeOrId);
    return resolvedCode ? this.nodes.get(resolvedCode) : undefined;
  }

  hasNode(codeOrId) {
    return this.nodes.has(codeOrId) || this.idToCode.has(codeOrId);
  }

  addEdge(courseCodeOrId, prereqCodeOrId) {
    const course = this.getNode(courseCodeOrId);
    const prereq = this.getNode(prereqCodeOrId);

    if (!course || !prereq) {
      throw new Error(`Cannot add prerequisite edge: node not found (${courseCodeOrId} -> ${prereqCodeOrId})`);
    }

    course.prerequisites.add(prereq.code);
    prereq.dependents.add(course.code);
  }

  getAllCodes() {
    return Array.from(this.nodes.keys());
  }

  get size() {
    return this.nodes.size;
  }
}

const DEFAULT_CREDIT_GATES = {
  'CSE299': 60,
  'CSE499A': 100
};

/**
 * Build curriculum graph from course definitions and detect cycles.
 * Throws an Error if the graph contains a cycle.
 * @param {Array<Object>} courses
 * @returns {CurriculumGraph}
 */
function buildGraph(courses) {
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
 * @param {CurriculumGraph} graph
 */
function detectCycles(graph) {
  const inDegree = new Map();

  for (const [code, node] of graph.nodes.entries()) {
    inDegree.set(code, node.prerequisites.size);
  }

  const queue = [];
  for (const [code, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(code);
    }
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const currentCode = queue.shift();
    visitedCount++;

    const currentNode = graph.nodes.get(currentCode);
    for (const dependentCode of currentNode.dependents) {
      const remaining = (inDegree.get(dependentCode) ?? 0) - 1;
      inDegree.set(dependentCode, remaining);
      if (remaining === 0) {
        queue.push(dependentCode);
      }
    }
  }

  if (visitedCount < graph.nodes.size) {
    const cycleNodes = [];
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
 * @param {CurriculumGraph} graph
 * @returns {string[]}
 */
function topologicalOrder(graph) {
  const inDegree = new Map();

  for (const [code, node] of graph.nodes.entries()) {
    inDegree.set(code, node.prerequisites.size);
  }

  const queue = [];
  for (const [code, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(code);
    }
  }
  queue.sort();

  const result = [];

  while (queue.length > 0) {
    const currentCode = queue.shift();
    result.push(currentCode);

    const currentNode = graph.nodes.get(currentCode);
    const nextBatch = [];

    for (const dependentCode of currentNode.dependents) {
      const remaining = (inDegree.get(dependentCode) ?? 0) - 1;
      inDegree.set(dependentCode, remaining);
      if (remaining === 0) {
        nextBatch.push(dependentCode);
      }
    }

    nextBatch.sort();
    queue.push(...nextBatch);
  }

  if (result.length < graph.nodes.size) {
    throw new Error('Curriculum graph contains a cycle; cannot determine topological order');
  }

  return result;
}

/**
 * Compute the longest remaining chain of prerequisite-heavy courses from current position to graduation.
 * @param {CurriculumGraph} graph
 * @param {string[]} completedCourses
 * @returns {string[]}
 */
function criticalPath(graph, completedCourses = []) {
  const completedSet = new Set((completedCourses || []).map((c) => c.trim()));

  const remainingCodes = new Set();
  for (const code of graph.nodes.keys()) {
    if (!completedSet.has(code)) {
      remainingCodes.add(code);
    }
  }

  if (remainingCodes.size === 0) {
    return [];
  }

  const topo = topologicalOrder(graph);

  const dist = new Map();
  const milestoneCount = new Map();
  const parent = new Map();

  for (const code of topo) {
    if (!remainingCodes.has(code)) continue;

    const node = graph.nodes.get(code);
    let maxDist = 1;
    let maxMilestones = node.isMilestone ? 1 : 0;
    let bestParent = null;

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

  let bestEndpoint = null;
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

  const path = [];
  let curr = bestEndpoint;
  while (curr !== null) {
    path.push(curr);
    curr = parent.get(curr) ?? null;
  }

  path.reverse();
  return path;
}

/**
 * Return courses whose prerequisites are satisfied, respecting special credit-threshold gates.
 * @param {CurriculumGraph} graph
 * @param {string[]} completedCourses
 * @param {number} [creditsEarned]
 * @param {Record<string, number>} [creditGates]
 * @returns {string[]}
 */
function eligibleCourses(
  graph,
  completedCourses = [],
  creditsEarned,
  creditGates = DEFAULT_CREDIT_GATES
) {
  const completedSet = new Set((completedCourses || []).map((c) => c.trim()));

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

  const eligible = [];

  for (const [code, node] of graph.nodes.entries()) {
    if (completedSet.has(code)) {
      continue;
    }

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

    const requiredCredits = creditGates[code];
    if (requiredCredits !== undefined && totalCredits < requiredCredits) {
      continue;
    }

    eligible.push(code);
  }

  eligible.sort();
  return eligible;
}

/**
 * Compute the critical pathway passing through a target course
 */
function criticalPathForCourse(graph, completedCourses = [], targetCode = '') {
  const normTarget = (targetCode || '').trim();
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

  const completedSet = new Set(completedCourses.map((c) => (c || '').trim()));

  function getUpstreamChain(code, visited = new Set()) {
    const node = graph.getNode(code);
    if (!node || node.prerequisites.size === 0) return [];
    visited.add(code);

    let bestChain = [];
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

  function getDownstreamChain(code, visited = new Set()) {
    const node = graph.getNode(code);
    if (!node || node.dependents.size === 0) return [];
    visited.add(code);

    let bestChain = [];
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

  const allReachable = new Set();
  const q = [normTarget];
  while (q.length > 0) {
    const curr = q.shift();
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

/**
 * Dynamically ranks what is best to take next
 */
function recommendBestCourses(graph, completedCourses = [], enrolledCourses = [], creditsEarned) {
  const eligible = eligibleCourses(graph, completedCourses, creditsEarned);
  const enrolledSet = new Set(enrolledCourses.map((c) => (c || '').trim().toUpperCase()));

  const recs = [];

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

module.exports = {
  CourseNode,
  CurriculumGraph,
  DEFAULT_CREDIT_GATES,
  buildGraph,
  topologicalOrder,
  criticalPath,
  eligibleCourses,
  criticalPathForCourse,
  recommendBestCourses
};

