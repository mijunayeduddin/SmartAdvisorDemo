const ScheduleStrategy = require('./ScheduleStrategy');
const PrioritizeMilestoneStrategy = require('./PrioritizeMilestoneStrategy');
const MinimizeGapStrategy = require('./MinimizeGapStrategy');

module.exports = {
  ScheduleStrategy,
  PrioritizeMilestoneStrategy,
  MilestonePriorityStrategy: PrioritizeMilestoneStrategy,
  MinimizeGapStrategy,
  MinimizeGapsStrategy: MinimizeGapStrategy
};
