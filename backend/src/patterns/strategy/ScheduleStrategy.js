/**
 * Strategy Pattern: Schedule Generation Interface
 * Defines common contract for different schedule optimization algorithms.
 */
class ScheduleStrategy {
  /**
   * @param {string} name - Strategy identifier
   */
  constructor(name) {
    if (new.target === ScheduleStrategy) {
      throw new TypeError('Cannot construct ScheduleStrategy instances directly');
    }
    this.name = name;
  }

  /**
   * Generates a conflict-free schedule recommendation for a student
   * @param {Object} student - Student record including completed courses
   * @param {Object} curriculumGraph - In-memory DAG representation
   * @param {Array<Object>} availableSections - List of offered sections for the term
   * @param {Object} [constraints] - User preferences (max credits, day off, etc.)
   * @returns {Promise<Object>} Recommended schedule proposal
   */
  async generateSchedule(student, curriculumGraph, availableSections, constraints = {}) {
    throw new Error('generateSchedule() must be implemented by concrete subclass');
  }
}

module.exports = ScheduleStrategy;
