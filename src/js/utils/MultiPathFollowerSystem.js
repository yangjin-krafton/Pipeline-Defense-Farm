/**
 * MultiPathFollowerSystem - Manages multiple paths with food flow between them
 *
 * Handles food objects flowing through different digestive tract paths:
 * - rice_stomach, dessert_stomach, alcohol_stomach → small_intestine → large_intestine
 */

import { PathFollowerSystem } from './PathFollowerSystem.js';

export class MultiPathFollowerSystem {
  /**
   * @param {Object} paths - Object with path data {name, color, points}
   */
  constructor(paths) {
    this.paths = {};
    this.pathSystems = {};

    // Create PathFollowerSystem for each path
    for (const [key, pathData] of Object.entries(paths)) {
      this.paths[key] = pathData;
      this.pathSystems[key] = new PathFollowerSystem(pathData.points);
    }

    // Define path flow: which path leads to which
    this.pathFlow = {
      rice_stomach: 'small_intestine',
      dessert_stomach: 'small_intestine',
      alcohol_stomach: 'small_intestine',
      small_intestine: 'large_intestine',
      large_intestine: null // End of journey
    };
  }

  /**
   * Find the closest distance on target path to a given point
   * @param {string} targetPathKey - Target path key
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Distance along the target path
   */
  findClosestDistanceOnPath(targetPathKey, x, y) {
    const pathSystem = this.pathSystems[targetPathKey];
    if (!pathSystem) return 0;

    const points = pathSystem.getPathPoints();
    let closestDistance = 0;
    let minDistanceToPath = Infinity;

    let accumulatedDistance = 0;

    // Check each segment
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Calculate distance from (x,y) to this segment
      const segmentDistance = this._pointToSegmentDistance(x, y, p1, p2);

      if (segmentDistance < minDistanceToPath) {
        minDistanceToPath = segmentDistance;

        // Calculate the closest point on this segment
        const t = this._getClosestPointOnSegment(x, y, p1, p2);
        const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        closestDistance = accumulatedDistance + t * segmentLength;
      }

      accumulatedDistance += Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }

    return closestDistance;
  }

  /**
   * Calculate perpendicular distance from point to line segment
   * @private
   */
  _pointToSegmentDistance(x, y, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      return Math.hypot(x - p1.x, y - p1.y);
    }

    let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;

    return Math.hypot(x - closestX, y - closestY);
  }

  /**
   * Get parameter t (0-1) of closest point on segment to (x, y)
   * @private
   */
  _getClosestPointOnSegment(x, y, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) return 0;

    let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lengthSquared;
    return Math.max(0, Math.min(1, t));
  }

  /**
   * Spawn a new object on a specific path
   * @param {string} pathKey - Path key (rice_stomach, dessert_stomach, etc.)
   * @param {Object} properties - Object properties
   * @param {number} [initialOffset=0] - Initial offset
   * @returns {Object} The spawned object with path tracking
   */
  spawn(pathKey, properties, initialOffset = 0) {
    const pathSystem = this.pathSystems[pathKey];
    if (!pathSystem) {
      console.warn(`Path "${pathKey}" not found`);
      return null;
    }

    // Add path tracking to properties before spawning
    const enhancedProperties = {
      ...properties,
      currentPath: pathKey,
      totalDistance: 0
    };

    const obj = pathSystem.spawn(enhancedProperties, initialOffset);
    // Removed: console.log - too verbose
    return obj;
  }

  /**
   * Update all objects across all paths
   * @param {number} deltaTime - Time elapsed
   * @param {Function} [onComplete] - Callback when object completes entire journey
   */
  update(deltaTime, onComplete) {
    const finalCompleted = [];

    // Update each path system
    for (const [pathKey, pathSystem] of Object.entries(this.pathSystems)) {
      const completed = pathSystem.update(deltaTime);

      // Handle completed objects
      for (const obj of completed) {
        obj.totalDistance += pathSystem.getPathLength();

        // Get next path in flow
        const nextPath = this.pathFlow[pathKey];

        if (nextPath && this.pathSystems[nextPath]) {
          // Get the last point of current path
          const currentPoints = pathSystem.getPathPoints();
          const lastPoint = currentPoints[currentPoints.length - 1];

          // Find closest distance on next path to the last point of current path
          const startDistance = this.findClosestDistanceOnPath(nextPath, lastPoint.x, lastPoint.y);

          // Move to next path
          obj.currentPath = nextPath;
          obj.d = startDistance; // Start at the connection point

          // Spawn on next path (reuse same object)
          this.pathSystems[nextPath].objects.push(obj);

          // Removed: console.log - too verbose
        } else {
          // Journey complete
          finalCompleted.push(obj);

          if (onComplete) {
            onComplete(obj);
          }

          // Removed: console.log - too verbose
        }
      }
    }

    return finalCompleted;
  }

  /**
   * Get all objects across all paths
   * @returns {Array<Object>} All objects
   */
  getObjects() {
    const allObjects = [];
    for (const pathSystem of Object.values(this.pathSystems)) {
      allObjects.push(...pathSystem.getObjects());
    }
    return allObjects;
  }

  /**
   * Get objects on a specific path
   * @param {string} pathKey - Path key
   * @returns {Array<Object>} Objects on that path
   */
  getObjectsOnPath(pathKey) {
    const pathSystem = this.pathSystems[pathKey];
    return pathSystem ? pathSystem.getObjects() : [];
  }

  /**
   * Sample position on a specific path
   * @param {string} pathKey - Path key
   * @param {number} distance - Distance along path
   * @returns {{x: number, y: number}} Position
   */
  samplePath(pathKey, distance) {
    const pathSystem = this.pathSystems[pathKey];
    return pathSystem ? pathSystem.samplePath(distance) : { x: 0, y: 0 };
  }

  /**
   * Get path system for a specific path
   * @param {string} pathKey - Path key
   * @returns {PathFollowerSystem} Path system
   */
  getPathSystem(pathKey) {
    return this.pathSystems[pathKey];
  }

  /**
   * Clear all objects from all paths
   */
  clear() {
    for (const pathSystem of Object.values(this.pathSystems)) {
      pathSystem.clear();
    }
  }

  /**
   * Get path data
   * @param {string} pathKey - Path key
   * @returns {Object} Path data with name, color, points
   */
  getPathData(pathKey) {
    return this.paths[pathKey];
  }

  /**
   * Get all path keys
   * @returns {Array<string>} Path keys
   */
  getPathKeys() {
    return Object.keys(this.paths);
  }
}
