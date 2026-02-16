/**
 * PathFollowerSystem - A reusable module for path-following animation
 *
 * Manages objects that follow a predefined path with configurable speed and properties.
 */
export class PathFollowerSystem {
  /**
   * @param {Array<{x: number, y: number}>} pathPoints - Array of path points
   */
  constructor(pathPoints) {
    this.pathPoints = pathPoints;
    this.segmentLengths = [];
    this.totalPathLength = 0;
    this.objects = [];

    this._calculatePathLengths();
  }

  /**
   * Calculate segment lengths and total path length
   * @private
   */
  _calculatePathLengths() {
    this.segmentLengths = [];
    this.totalPathLength = 0;

    for (let i = 0; i < this.pathPoints.length - 1; i += 1) {
      const a = this.pathPoints[i];
      const b = this.pathPoints[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      this.segmentLengths.push(len);
      this.totalPathLength += len;
    }
  }

  /**
   * Sample a position on the path at a given distance
   * @param {number} distance - Distance along the path
   * @returns {{x: number, y: number}} Position on the path
   */
  samplePath(distance) {
    let d = Math.max(0, Math.min(distance, this.totalPathLength));

    for (let i = 0; i < this.segmentLengths.length; i += 1) {
      const segLen = this.segmentLengths[i];
      if (d <= segLen) {
        const a = this.pathPoints[i];
        const b = this.pathPoints[i + 1];
        const t = segLen === 0 ? 0 : d / segLen;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t
        };
      }
      d -= segLen;
    }

    const last = this.pathPoints[this.pathPoints.length - 1];
    return { x: last.x, y: last.y };
  }

  /**
   * Spawn a new object on the path
   * @param {Object} properties - Object properties (speed, size, data, etc.)
   * @param {number} [initialOffset=0] - Initial offset on the path (negative starts before path)
   * @returns {Object} The spawned object
   */
  spawn(properties, initialOffset = 0) {
    const obj = {
      d: -initialOffset,
      ...properties
    };
    this.objects.push(obj);
    return obj;
  }

  /**
   * Update all objects on the path
   * @param {number} deltaTime - Time elapsed since last update (in seconds)
   * @param {Function} [onComplete] - Callback when an object completes the path
   * @returns {Array<Object>} Objects that completed the path
   */
  update(deltaTime, onComplete) {
    const completed = [];

    for (let i = this.objects.length - 1; i >= 0; i -= 1) {
      const obj = this.objects[i];
      obj.d += obj.speed * deltaTime;

      if (obj.d > this.totalPathLength + (obj.exitThreshold || 25)) {
        const removed = this.objects.splice(i, 1)[0];
        completed.push(removed);
        if (onComplete) {
          onComplete(removed);
        }
      }
    }

    return completed;
  }

  /**
   * Get all objects currently on the path
   * @returns {Array<Object>} Array of objects
   */
  getObjects() {
    return this.objects;
  }

  /**
   * Get total path length
   * @returns {number} Total path length
   */
  getPathLength() {
    return this.totalPathLength;
  }

  /**
   * Clear all objects from the path
   */
  clear() {
    this.objects = [];
  }

  /**
   * Get the path points
   * @returns {Array<{x: number, y: number}>} Path points
   */
  getPathPoints() {
    return this.pathPoints;
  }
}
