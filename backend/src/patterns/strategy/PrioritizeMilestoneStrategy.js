const ScheduleStrategy = require('./ScheduleStrategy');
const { MilestonePriorityStrategy: CoreMilestoneStrategy } = require('../../../core/strategy/scheduleStrategy.ts');

/**
 * Strategy Pattern: Prioritize Milestone Courses
 * Focuses on unlocking prerequisite bottlenecks and critical path courses first.
 */
class PrioritizeMilestoneStrategy extends ScheduleStrategy {
  constructor() {
    super('Prioritize Milestone Courses');
    this.coreStrategy = new CoreMilestoneStrategy();
  }

  rankAlternatives(student, curriculumGraph, availableSections, rejectedCourseCode, constraints) {
    return this.coreStrategy.rankAlternatives(
      student,
      curriculumGraph,
      availableSections,
      rejectedCourseCode,
      constraints
    );
  }

  async generateSchedule(student, curriculumGraph, availableSections, constraints = {}) {
    return this.coreStrategy.generateSchedule(
      student,
      curriculumGraph,
      availableSections,
      constraints
    );
  }
}

PrioritizeMilestoneStrategy.MilestonePriorityStrategy = PrioritizeMilestoneStrategy;

module.exports = PrioritizeMilestoneStrategy;
module.exports.MilestonePriorityStrategy = PrioritizeMilestoneStrategy;
