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

module.exports = {
  CourseNode,
  CurriculumGraph,
  DEFAULT_CREDIT_GATES,
  buildGraph,
  topologicalOrder,
  criticalPath,
  eligibleCourses
};
