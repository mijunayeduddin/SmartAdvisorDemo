const Subject = require('./EventEmitter');

/**
 * Concrete Subject / Dispatcher for Seat Availability & Schedule Sync
 * Implements Observer Pattern: notifies clients when section seat state changes.
 */
class SeatAvailabilityManager extends Subject {
  constructor() {
    super();
  }

  /**
   * Called when a student enrolls or capacity changes
   * @param {Object} section - { id, courseCode, sectionNumber, capacity, enrolledCount }
   */
  updateSeatStatus(section) {
    const isFull = section.enrolledCount >= section.capacity;
    const availableSeats = Math.max(0, section.capacity - section.enrolledCount);

    const payload = {
      sectionId: section.id,
      courseCode: section.courseCode,
      sectionNumber: section.sectionNumber,
      capacity: section.capacity,
      enrolledCount: section.enrolledCount,
      availableSeats,
      isFull,
      timestamp: new Date().toISOString()
    };

    if (isFull) {
      this.notify('section:full', payload);
    } else {
      this.notify('seat:available', payload);
    }

    // Always broadcast generic status change
    this.notify('section:updated', payload);
  }

  /**
   * Broadcast student schedule change to sync mobile & web clients
   * @param {string} studentId
   * @param {Object} scheduleData
   */
  syncStudentSchedule(studentId, scheduleData) {
    this.notify('schedule:sync', {
      studentId,
      schedule: scheduleData,
      timestamp: new Date().toISOString()
    });
  }
}

// Export singleton dispatcher for server-wide observer registry
module.exports = new SeatAvailabilityManager();
