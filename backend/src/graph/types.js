/**
 * Pure Domain Entities for Curriculum DAG
 * STRICT RULE: Zero dependencies on Express, HTTP, pg, or database drivers.
 * High Cohesion, Low Coupling architecture.
 */

class CourseNode {
  /**
   * @param {Object} params
   * @param {string} params.id
   * @param {string} params.code
   * @param {string} params.title
   * @param {number} params.credits
   * @param {boolean} [params.isMilestone=false]
   */
  constructor({ id, code, title, credits, isMilestone = false }) {
    this.id = id;
    this.code = code;
    this.title = title;
    this.credits = Number(credits);
    this.isMilestone = Boolean(isMilestone);

    /** @type {Set<string>} Course IDs that this course requires (incoming edges) */
    this.prerequisites = new Set();

    /** @type {Set<string>} Course IDs that depend on this course (outgoing edges) */
    this.dependents = new Set();
  }
}

class CurriculumGraph {
  constructor() {
    /** @type {Map<string, CourseNode>} Keyed by course ID */
    this.nodes = new Map();
    /** @type {Map<string, string>} Code-to-ID lookup index */
    this.codeToId = new Map();
  }

  /**
   * Add a course node to the DAG
   * @param {CourseNode} node
   */
  addNode(node) {
    this.nodes.set(node.id, node);
    this.codeToId.set(node.code, node.id);
  }

  /**
   * Add a directed prerequisite dependency edge
   * @param {string} courseId - The course that has a prerequisite
   * @param {string} prereqCourseId - The prerequisite course that must be completed first
   */
  addEdge(courseId, prereqCourseId) {
    const course = this.nodes.get(courseId);
    const prereq = this.nodes.get(prereqCourseId);

    if (!course || !prereq) {
      throw new Error(`Cannot add edge: node not found (${courseId} -> ${prereqCourseId})`);
    }

    course.prerequisites.add(prereqCourseId);
    prereq.dependents.add(courseId);
  }

  /**
   * Look up node by ID
   * @param {string} id
   * @returns {CourseNode|undefined}
   */
  getNode(id) {
    return this.nodes.get(id);
  }

  /**
   * Look up node by course code
   * @param {string} code
   * @returns {CourseNode|undefined}
   */
  getNodeByCode(code) {
    const id = this.codeToId.get(code);
    return id ? this.nodes.get(id) : undefined;
  }
}

module.exports = {
  CourseNode,
  CurriculumGraph
};
