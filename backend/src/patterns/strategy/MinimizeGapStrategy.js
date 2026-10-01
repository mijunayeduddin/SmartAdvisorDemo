const ScheduleStrategy = require('./ScheduleStrategy');

/**
 * Strategy Pattern: Minimize Campus Gaps
 * Focuses on selecting section combinations that minimize idle time between classes.
 */
class MinimizeGapStrategy extends ScheduleStrategy {
  constructor() {
    super('Minimize Campus Gaps');
  }

  /**
   * Concrete algorithm implementation placeholder (To be implemented in Day 2)
   */
  async generateSchedule(student, curriculumGraph, availableSections, constraints = {}) {
    // Scaffold: to be populated with gap optimization solver
    return {
      strategyUsed: this.name,
      studentId: student.id,
      sections: [],
      rationale: 'Optimized for minimal idle gap between on-campus lectures.'
    };
  }
}

module.exports = MinimizeGapStrategy;
