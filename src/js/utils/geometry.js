/**
 * Geometry utility functions for mesh generation
 */

/**
 * Append a circle to a vertex array
 * @param {Array<number>} out - Output vertex array
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} r - Radius
 * @param {number} seg - Number of segments
 */
export function appendCircle(out, cx, cy, r, seg = 12) {
  const step = (Math.PI * 2) / seg;
  for (let i = 0; i < seg; i += 1) {
    const a0 = i * step;
    const a1 = (i + 1) * step;
    out.push(
      cx, cy,
      cx + Math.cos(a0) * r, cy + Math.sin(a0) * r,
      cx + Math.cos(a1) * r, cy + Math.sin(a1) * r
    );
  }
}

/**
 * Build a polyline mesh from a series of points
 * @param {Array<{x: number, y: number}>} points - Path points
 * @param {number} width - Line width
 * @param {number} offsetX - X offset
 * @param {number} offsetY - Y offset
 * @returns {Array<number>} Vertex array
 */
export function buildPolylineMesh(points, width, offsetX = 0, offsetY = 0) {
  const out = [];
  const half = width * 0.5;

  for (let i = 0; i < points.length - 1; i += 1) {
    const ax = points[i].x + offsetX;
    const ay = points[i].y + offsetY;
    const bx = points[i + 1].x + offsetX;
    const by = points[i + 1].y + offsetY;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) continue;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    out.push(
      ax + nx, ay + ny,
      ax - nx, ay - ny,
      bx + nx, by + ny,
      ax - nx, ay - ny,
      bx - nx, by - ny,
      bx + nx, by + ny
    );
  }

  for (let i = 0; i < points.length; i += 1) {
    appendCircle(out, points[i].x + offsetX, points[i].y + offsetY, half, 14);
  }

  return out;
}
