const ScheduleStrategy = require('./ScheduleStrategy');
const { MinimizeGapsStrategy: CoreMinimizeGapsStrategy } = require('../../../core/strategy/scheduleStrategy.ts');

/**
 * Strategy Pattern: Minimize Campus Gaps
 * Focuses on selecting section combinations that minimize idle time between classes.
 */
class MinimizeGapStrategy extends ScheduleStrategy {
  constructor() {
    super('Minimize Campus Gaps');
    this.coreStrategy = new CoreMinimizeGapsStrategy();
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

MinimizeGapStrategy.MinimizeGapsStrategy = MinimizeGapStrategy;

module.exports = MinimizeGapStrategy;
module.exports.MinimizeGapsStrategy = MinimizeGapStrategy;
