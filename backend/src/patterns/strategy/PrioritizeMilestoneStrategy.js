const ScheduleStrategy = require('./ScheduleStrategy');

/**
 * Strategy Pattern: Prioritize Milestone Courses
 * Focuses on unlocking prerequisite bottlenecks and critical path courses first.
 */
class PrioritizeMilestoneStrategy extends ScheduleStrategy {
  constructor() {
    super('Prioritize Milestone Courses');
  }

  /**
   * Concrete algorithm implementation placeholder (To be implemented in Day 2)
   */
  async generateSchedule(student, curriculumGraph, availableSections, constraints = {}) {
    // Scaffold: to be populated with graph algorithm integration
    return {
      strategyUsed: this.name,
      studentId: student.id,
      sections: [],
      rationale: 'Prioritized gateway and milestone prerequisite courses.'
    };
  }
}

module.exports = PrioritizeMilestoneStrategy;
