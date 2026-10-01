/**
 * Singleton Pattern: Curriculum Graph Cache
 * Maintains a single in-memory instance of the parsed Curriculum DAG.
 * Prevents redundant database queries and repeated DAG construction during advisory operations.
 */
class GraphCache {
  constructor() {
    if (GraphCache.instance) {
      return GraphCache.instance;
    }

    this._graph = null;
    this._lastUpdated = null;
    this._version = 0;

    GraphCache.instance = this;
  }

  /**
   * Set or refresh the cached curriculum DAG
   * @param {Object} graphInstance
   */
  setGraph(graphInstance) {
    this._graph = graphInstance;
    this._lastUpdated = new Date();
    this._version += 1;
  }

  /**
   * Get the cached DAG
   * @returns {Object|null}
   */
  getGraph() {
    return this._graph;
  }

  /**
   * Check if cache is populated
   * @returns {boolean}
   */
  hasGraph() {
    return this._graph !== null;
  }

  /**
   * Invalidate the cached graph (e.g. when course prerequisites change)
   */
  invalidate() {
    this._graph = null;
    this._lastUpdated = null;
  }

  /**
   * Metadata inspect
   */
  getStats() {
    return {
      isLoaded: this.hasGraph(),
      lastUpdated: this._lastUpdated,
      version: this._version,
    };
  }
}

// Export singleton instance
const instance = new GraphCache();

module.exports = instance;
