/**
 * Flow system for animated dots along the path
 */
import { appendCircle } from '../utils/geometry.js';

export class FlowSystem {
  constructor(pathSystem) {
    this.pathSystem = pathSystem;
    this.flowMesh = this._createFlowDotMesh(2.1, 8);
  }

  /**
   * Create flow dot mesh along the entire path
   * @param {number} radius - Dot radius
   * @param {number} segments - Circle segments
   * @returns {Array<number>} Vertex array
   */
  _createFlowDotMesh(radius, segments) {
    const vertices = [];
    const spacing = 18;

    for (let d = 0; d < this.pathSystem.getPathLength(); d += spacing) {
      const p = this.pathSystem.samplePath(d);
      appendCircle(vertices, p.x, p.y, radius, segments);
    }

    return vertices;
  }

  /**
   * Get the flow mesh vertices
   * @returns {Array<number>} Vertex array
   */
  getMesh() {
    return this.flowMesh;
  }
}
