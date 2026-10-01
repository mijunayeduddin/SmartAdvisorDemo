/**
 * JSDoc definitions for shared core domain models.
 * Used for IDE autocompletion and runtime consistency across backend and future web/mobile clients.
 */

/**
 * @typedef {Object} Course
 * @property {string} id - UUID
 * @property {string} code - Course code e.g. "CSE 327"
 * @property {string} title - Course name
 * @property {number} credits - Credit units
 * @property {boolean} isMilestone - True if course is a critical gateway course
 */

/**
 * @typedef {Object} Section
 * @property {string} id - UUID
 * @property {string} courseId - Foreign key to Course
 * @property {number} sectionNumber - Section number e.g. 1
 * @property {number} capacity - Max seats
 * @property {number} enrolledCount - Current enrolled seats
 * @property {string} dayOfWeek - e.g. "ST", "MW"
 * @property {string} startTime - e.g. "08:30:00"
 * @property {string} endTime - e.g. "10:00:00"
 * @property {string} [room]
 * @property {string} [facultyName]
 */

/**
 * @typedef {Object} Student
 * @property {string} id - UUID
 * @property {string} studentId - Student roll/ID e.g. "2021-1-60-001"
 * @property {string} name
 * @property {string} email
 * @property {number} completedCredits
 */

module.exports = {};
