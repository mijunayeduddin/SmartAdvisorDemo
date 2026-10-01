/**
 * Observer Pattern: Observable Subject Base Class
 * Defines attachment, detachment, and event notification mechanisms.
 */
class Subject {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.observers = new Map();
  }

  /**
   * Subscribe an observer function to an event topic
   * @param {string} event
   * @param {Function} callback
   */
  subscribe(event, callback) {
    if (!this.observers.has(event)) {
      this.observers.set(event, new Set());
    }
    this.observers.get(event).add(callback);
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe an observer function
   * @param {string} event
   * @param {Function} callback
   */
  unsubscribe(event, callback) {
    if (this.observers.has(event)) {
      this.observers.get(event).delete(callback);
    }
  }

  /**
   * Notify all registered observers for a specific event
   * @param {string} event
   * @param {*} data
   */
  notify(event, data) {
    if (this.observers.has(event)) {
      for (const callback of this.observers.get(event)) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[Observer Error] Error in listener for event "${event}":`, error);
        }
      }
    }
  }
}

module.exports = Subject;
