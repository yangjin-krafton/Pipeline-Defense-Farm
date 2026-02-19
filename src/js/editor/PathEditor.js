/**
 * PathEditor - Development tool for editing multiple paths
 * Features:
 * - Support multiple paths (rice/dessert/alcohol stomach, small/large intestine)
 * - Select and edit individual paths
 * - Drag to move points
 * - Click near path line to insert points in the middle
 * - Click on empty space to add new points at the end
 * - Right-click or Delete key to remove points
 * - Grid snap functionality
 */

import { VIRTUAL_W, VIRTUAL_H } from '../config.js';

export class PathEditor {
  constructor(canvas, paths, onPathsChanged) {
    this.canvas = canvas;

    // Deep copy all paths
    this.paths = {};
    for (const [key, pathData] of Object.entries(paths)) {
      this.paths[key] = {
        name: pathData.name,
        color: pathData.color,
        points: [...pathData.points.map(p => ({ ...p }))]
      };
    }

    this.onPathsChanged = onPathsChanged;

    // Selected path
    this.pathKeys = Object.keys(this.paths);
    this.selectedPathKey = this.pathKeys[0];
    this.showAllPaths = true; // Show all paths or only selected

    this.isDragging = false;
    this.selectedPointIndex = -1;
    this.hoveredPointIndex = -1;

    // Grid settings
    this.gridSize = 10;
    this.gridEnabled = true;

    // Visual settings
    this.pointRadius = 8;
    this.hoverRadius = 12;
    this.lineWidth = 2;

    // Mouse state
    this.mouseX = 0;
    this.mouseY = 0;

    // UI settings
    this.showUI = true;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));

    // Keyboard events
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  removeEventListeners() {
    this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.removeEventListener('contextmenu', this.onContextMenu.bind(this));
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
  }

  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to virtual coordinates
    const virtualX = (x / rect.width) * VIRTUAL_W;
    const virtualY = (y / rect.height) * VIRTUAL_H;

    return { x: virtualX, y: virtualY };
  }

  snapToGrid(x, y) {
    if (!this.gridEnabled) return { x, y };

    return {
      x: Math.round(x / this.gridSize) * this.gridSize,
      y: Math.round(y / this.gridSize) * this.gridSize
    };
  }

  getCurrentPath() {
    return this.paths[this.selectedPathKey];
  }

  getCurrentPoints() {
    return this.getCurrentPath().points;
  }

  findPointAt(x, y, threshold = 15) {
    const points = this.getCurrentPoints();
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - x;
      const dy = points[i].y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= threshold) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Find the closest line segment to a point and return insertion index
   * Returns { index: number, distance: number } or null if too far
   */
  findClosestLineSegment(x, y, threshold = 20) {
    const points = this.getCurrentPoints();
    if (points.length < 2) return null;

    let closestIndex = -1;
    let closestDistance = Infinity;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Calculate distance from point to line segment
      const distance = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);

      if (distance < closestDistance && distance <= threshold) {
        closestDistance = distance;
        closestIndex = i + 1; // Insert after p1 (before p2)
      }
    }

    return closestIndex !== -1 ? { index: closestIndex, distance: closestDistance } : null;
  }

  /**
   * Calculate perpendicular distance from point (x, y) to line segment (x1, y1) - (x2, y2)
   */
  pointToSegmentDistance(x, y, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Segment is a point
      return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
    }

    // Calculate projection of point onto line segment
    let t = ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clamp to segment

    // Find closest point on segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    // Return distance to closest point
    return Math.sqrt((x - closestX) * (x - closestX) + (y - closestY) * (y - closestY));
  }

  onMouseDown(e) {
    const coords = this.getCanvasCoords(e);
    const pointIndex = this.findPointAt(coords.x, coords.y);

    if (e.button === 0) { // Left click
      if (pointIndex !== -1) {
        // Start dragging existing point
        this.isDragging = true;
        this.selectedPointIndex = pointIndex;
      } else {
        // Try to insert point in the middle of a path segment
        const closestSegment = this.findClosestLineSegment(coords.x, coords.y);
        const snapped = this.snapToGrid(coords.x, coords.y);
        const points = this.getCurrentPoints();

        if (closestSegment) {
          // Insert point in the middle of the closest segment
          points.splice(closestSegment.index, 0, snapped);
          console.log(`Inserted point at index ${closestSegment.index} in ${this.getCurrentPath().name}`);
        } else {
          // Add new point at the end
          points.push(snapped);
          console.log(`Added point at the end of ${this.getCurrentPath().name}`);
        }
        this.notifyChange();
      }
    }
  }

  onMouseMove(e) {
    const coords = this.getCanvasCoords(e);
    this.mouseX = coords.x;
    this.mouseY = coords.y;

    if (this.isDragging && this.selectedPointIndex !== -1) {
      const snapped = this.snapToGrid(coords.x, coords.y);
      const points = this.getCurrentPoints();
      points[this.selectedPointIndex] = snapped;
      this.notifyChange();
    } else {
      // Update hover state
      this.hoveredPointIndex = this.findPointAt(coords.x, coords.y);
    }
  }

  onMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.selectedPointIndex = -1;
    }
  }

  onContextMenu(e) {
    e.preventDefault();
    const coords = this.getCanvasCoords(e);
    const pointIndex = this.findPointAt(coords.x, coords.y);

    if (pointIndex !== -1) {
      this.deletePoint(pointIndex);
    }
  }

  onKeyDown(e) {
    if (e.key === 'Delete' && this.hoveredPointIndex !== -1) {
      this.deletePoint(this.hoveredPointIndex);
      this.hoveredPointIndex = -1;
    } else if (e.key === 'g' || e.key === 'G') {
      // Toggle grid
      this.gridEnabled = !this.gridEnabled;
      console.log(`Grid snap: ${this.gridEnabled ? 'ON' : 'OFF'}`);
    } else if (e.key === 'e' || e.key === 'E') {
      // Export paths to clipboard
      this.exportPaths();
    } else if (e.key === 's' || e.key === 'S') {
      // Save to config.js
      e.preventDefault();
      this.saveToConfigFile();
    } else if (e.key === 'h' || e.key === 'H') {
      // Toggle UI visibility
      this.showUI = !this.showUI;
      console.log(`UI visibility: ${this.showUI ? 'ON' : 'OFF'}`);
    } else if (e.key === 'Tab') {
      // Switch to next path
      e.preventDefault();
      const currentIndex = this.pathKeys.indexOf(this.selectedPathKey);
      const nextIndex = (currentIndex + 1) % this.pathKeys.length;
      this.selectedPathKey = this.pathKeys[nextIndex];
      console.log(`Switched to: ${this.getCurrentPath().name}`);
    } else if (e.key === 'v' || e.key === 'V') {
      // Toggle show all paths
      this.showAllPaths = !this.showAllPaths;
      console.log(`Show all paths: ${this.showAllPaths ? 'ON' : 'OFF'}`);
    } else if (e.key >= '1' && e.key <= '5') {
      // Quick select path by number
      const index = parseInt(e.key) - 1;
      if (index < this.pathKeys.length) {
        this.selectedPathKey = this.pathKeys[index];
        console.log(`Selected: ${this.getCurrentPath().name}`);
      }
    }
  }

  deletePoint(index) {
    const points = this.getCurrentPoints();
    if (points.length > 2) { // Keep at least 2 points
      points.splice(index, 1);
      this.notifyChange();
    } else {
      console.warn('Cannot delete point: minimum 2 points required');
    }
  }

  notifyChange() {
    if (this.onPathsChanged) {
      this.onPathsChanged(this.paths);
    }
  }

  render(ctx) {
    // Save context state
    ctx.save();

    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    if (this.gridEnabled) {
      this.drawGrid(ctx);
    }

    // Draw path lines
    this.drawPath(ctx);

    // Draw points
    this.drawPoints(ctx);

    // Draw hover indicator
    if (this.hoveredPointIndex !== -1) {
      this.drawHoverIndicator(ctx);
    }

    // Draw UI info
    this.drawUI(ctx);

    // Restore context
    ctx.restore();
  }

  drawGrid(ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Scale to virtual coordinates
    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    // Vertical lines
    for (let x = 0; x <= VIRTUAL_W; x += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x * scaleX, 0);
      ctx.lineTo(x * scaleX, this.canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= VIRTUAL_H; y += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y * scaleY);
      ctx.lineTo(this.canvas.width, y * scaleY);
      ctx.stroke();
    }
  }

  drawPath(ctx) {
    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    // Draw all paths if enabled
    for (const [key, pathData] of Object.entries(this.paths)) {
      const points = pathData.points;
      if (points.length < 2) continue;

      const isSelected = key === this.selectedPathKey;
      const shouldDraw = this.showAllPaths || isSelected;

      if (!shouldDraw) continue;

      // Set style based on selection
      ctx.strokeStyle = pathData.color;
      ctx.lineWidth = isSelected ? 5 : 2;
      ctx.globalAlpha = isSelected ? 1.0 : 0.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * scaleX, points[i].y * scaleY);
      }

      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
  }

  drawPoints(ctx) {
    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    // Only draw points for selected path
    const points = this.getCurrentPoints();
    const pathColor = this.getCurrentPath().color;

    points.forEach((point, index) => {
      const x = point.x * scaleX;
      const y = point.y * scaleY;

      // Point background
      ctx.fillStyle = index === this.selectedPointIndex ? '#FF6B6B' : pathColor;
      ctx.beginPath();
      ctx.arc(x, y, this.pointRadius, 0, Math.PI * 2);
      ctx.fill();

      // Point border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Point number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index.toString(), x, y);
    });
  }

  drawHoverIndicator(ctx) {
    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    const points = this.getCurrentPoints();
    const point = points[this.hoveredPointIndex];
    const x = point.x * scaleX;
    const y = point.y * scaleY;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, this.hoverRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawUI(ctx) {
    if (!this.showUI) {
      // Show minimal hint when UI is hidden
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(10, 10, 180, 25);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Press H to show help', 20, 18);
      return;
    }

    const uiWidth = 340;
    const uiHeight = 220;
    const padding = 10;

    // Fixed position (top-left)
    const uiX = padding;
    const uiY = padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(uiX, uiY, uiWidth, uiHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const currentPath = this.getCurrentPath();
    const pathIndex = this.pathKeys.indexOf(this.selectedPathKey) + 1;

    const lines = [
      'MULTI-PATH EDITOR (Dev Mode)',
      `Current: [${pathIndex}] ${currentPath.name}`,
      `Points: ${this.getCurrentPoints().length}`,
      `Grid: ${this.gridEnabled ? 'ON' : 'OFF'} (G) | View: ${this.showAllPaths ? 'ALL' : 'ONE'} (V)`,
      '',
      'Left Click: Add/Drag point',
      'Right Click: Delete point',
      'Tab: Switch path',
      '1-5: Quick select path',
      'H: Toggle UI',
      'E: Export | S: Save to config.js'
    ];

    lines.forEach((line, index) => {
      // Highlight current path line
      if (index === 1) {
        ctx.fillStyle = currentPath.color;
        ctx.font = 'bold 12px monospace';
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px monospace';
      }
      ctx.fillText(line, uiX + 10, uiY + 10 + index * 15);
    });

    // Draw path list
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(uiX + 10, uiY + 180, uiWidth - 20, 30);

    ctx.font = '10px monospace';
    let xOffset = uiX + 15;
    this.pathKeys.forEach((key, index) => {
      const pathData = this.paths[key];
      const isSelected = key === this.selectedPathKey;

      ctx.fillStyle = isSelected ? pathData.color : 'rgba(255, 255, 255, 0.5)';
      ctx.font = isSelected ? 'bold 10px monospace' : '10px monospace';

      const label = `[${index + 1}]${pathData.name}`;
      ctx.fillText(label, xOffset, uiY + 193);
      xOffset += ctx.measureText(label).width + 10;
    });
  }

  exportPaths() {
    const formatted = JSON.stringify(this.paths, null, 2);
    console.log('=== PATHS ===');
    console.log(formatted);
    console.log('=============');

    // Copy to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(formatted).then(() => {
        console.log('Paths copied to clipboard!');
        this.showNotification('Paths copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    }

    return this.paths;
  }

  /**
   * Download edited paths as config.js file
   */
  downloadConfigFile() {
    const pathsFormatted = JSON.stringify(this.paths, null, 2)
      .split('\n')
      .map((line, i) => i === 0 ? line : '  ' + line)
      .join('\n');

    const configContent = `/**
 * Game configuration constants
 */
export const VIRTUAL_W = 360;
export const VIRTUAL_H = 640;
export const FOOD_SPAWN_MS = 800;
export const BASE_SPEED = 92;
export const EMOJI_CACHE_SIZE = 48;

/**
 * Multiple path system
 * Each path represents different digestive tract
 */
export const PATHS = ${pathsFormatted};

// Backward compatibility: export first path as PATH_POINTS
export const PATH_POINTS = PATHS.rice_stomach.points;

export const TOWER_SLOTS = [
  { x: 100, y: 200, radius: 30 }
];

export const FOOD_EMOJIS = ["🍔", "🍕", "🍜", "🍟", "🍝", "🍰", "🍩", "🌮", "🍱", "🍣"];
`;

    const blob = new Blob([configContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.js';
    a.click();
    URL.revokeObjectURL(url);

    console.log('Config file downloaded!');
    this.showNotification('Config file downloaded!');
  }

  /**
   * Save to config.js using File System Access API (Chrome only)
   */
  async saveToConfigFile() {
    if (!window.showSaveFilePicker) {
      console.warn('File System Access API not supported. Using download instead.');
      this.downloadConfigFile();
      return;
    }

    try {
      const pathsFormatted = JSON.stringify(this.paths, null, 2)
        .split('\n')
        .map((line, i) => i === 0 ? line : '  ' + line)
        .join('\n');

      const configContent = `/**
 * Game configuration constants
 */
export const VIRTUAL_W = 360;
export const VIRTUAL_H = 640;
export const FOOD_SPAWN_MS = 800;
export const BASE_SPEED = 92;
export const EMOJI_CACHE_SIZE = 48;

/**
 * Multiple path system
 * Each path represents different digestive tract
 */
export const PATHS = ${pathsFormatted};

// Backward compatibility: export first path as PATH_POINTS
export const PATH_POINTS = PATHS.rice_stomach.points;

export const TOWER_SLOTS = [
  { x: 100, y: 200, radius: 30 }
];

export const FOOD_EMOJIS = ["🍔", "🍕", "🍜", "🍟", "🍝", "🍰", "🍩", "🌮", "🍱", "🍣"];
`;

      const options = {
        suggestedName: 'config.js',
        types: [{
          description: 'JavaScript files',
          accept: { 'text/javascript': ['.js'] }
        }]
      };

      const handle = await window.showSaveFilePicker(options);
      const writable = await handle.createWritable();
      await writable.write(configContent);
      await writable.close();

      console.log('Config file saved!');
      this.showNotification('Config file saved successfully!');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err);
        this.showNotification('Failed to save file');
      }
    }
  }

  /**
   * Show temporary notification
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: #4ECDC4;
      padding: 20px 40px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      z-index: 20000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      border: 2px solid #4ECDC4;
      animation: fadeInOut 2s ease-in-out;
    `;
    notification.textContent = message;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        10%, 90% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 2000);
  }

  getPaths() {
    return this.paths;
  }

  getPoints() {
    // For backward compatibility
    return this.getCurrentPoints();
  }

  setGridSize(size) {
    this.gridSize = Math.max(1, size);
  }

  toggleGrid() {
    this.gridEnabled = !this.gridEnabled;
  }
}
