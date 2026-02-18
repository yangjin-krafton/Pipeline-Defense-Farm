/**
 * PathEditor - Development tool for editing PATH_POINTS
 * Features:
 * - Drag to move points
 * - Click on empty space to add new points
 * - Right-click or Delete key to remove points
 * - Grid snap functionality
 */

import { VIRTUAL_W, VIRTUAL_H } from '../config.js';

export class PathEditor {
  constructor(canvas, points, onPathChanged) {
    this.canvas = canvas;
    this.points = [...points.map(p => ({ ...p }))]; // Deep copy
    this.onPathChanged = onPathChanged;

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

  findPointAt(x, y, threshold = 15) {
    for (let i = 0; i < this.points.length; i++) {
      const dx = this.points[i].x - x;
      const dy = this.points[i].y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= threshold) {
        return i;
      }
    }
    return -1;
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
        // Add new point
        const snapped = this.snapToGrid(coords.x, coords.y);
        this.points.push(snapped);
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
      this.points[this.selectedPointIndex] = snapped;
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
      // Export path to clipboard
      this.exportPath();
    } else if (e.key === 's' || e.key === 'S') {
      // Save to config.js
      e.preventDefault();
      this.saveToConfigFile();
    }
  }

  deletePoint(index) {
    if (this.points.length > 2) { // Keep at least 2 points
      this.points.splice(index, 1);
      this.notifyChange();
    } else {
      console.warn('Cannot delete point: minimum 2 points required');
    }
  }

  notifyChange() {
    if (this.onPathChanged) {
      this.onPathChanged(this.points);
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
    if (this.points.length < 2) return;

    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(this.points[0].x * scaleX, this.points[0].y * scaleY);

    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x * scaleX, this.points[i].y * scaleY);
    }

    ctx.stroke();
  }

  drawPoints(ctx) {
    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    this.points.forEach((point, index) => {
      const x = point.x * scaleX;
      const y = point.y * scaleY;

      // Point background
      ctx.fillStyle = index === this.selectedPointIndex ? '#FF6B6B' : '#4ECDC4';
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

    const point = this.points[this.hoveredPointIndex];
    const x = point.x * scaleX;
    const y = point.y * scaleY;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, this.hoverRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawUI(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(10, 10, 280, 120);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = [
      'PATH EDITOR (Dev Mode)',
      `Points: ${this.points.length}`,
      `Grid Snap: ${this.gridEnabled ? 'ON' : 'OFF'} (G to toggle)`,
      '',
      'Left Click: Add/Drag point',
      'Right Click: Delete point',
      'E: Copy to clipboard',
      'S: Save to config.js'
    ];

    lines.forEach((line, index) => {
      ctx.fillText(line, 20, 20 + index * 15);
    });
  }

  exportPath() {
    const formatted = JSON.stringify(this.points, null, 2);
    console.log('=== PATH_POINTS ===');
    console.log(formatted);
    console.log('==================');

    // Copy to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(formatted).then(() => {
        console.log('Path copied to clipboard!');
        this.showNotification('Path copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    }

    return this.points;
  }

  /**
   * Download edited path as config.js file
   */
  downloadConfigFile() {
    const configContent = `/**
 * Game configuration constants
 */
export const VIRTUAL_W = 360;
export const VIRTUAL_H = 640;
export const FOOD_SPAWN_MS = 800;
export const BASE_SPEED = 92;
export const EMOJI_CACHE_SIZE = 48;

export const PATH_POINTS = ${JSON.stringify(this.points, null, 2)};

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
      const configContent = `/**
 * Game configuration constants
 */
export const VIRTUAL_W = 360;
export const VIRTUAL_H = 640;
export const FOOD_SPAWN_MS = 800;
export const BASE_SPEED = 92;
export const EMOJI_CACHE_SIZE = 48;

export const PATH_POINTS = ${JSON.stringify(this.points, null, 2)};

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

  getPoints() {
    return this.points;
  }

  setGridSize(size) {
    this.gridSize = Math.max(1, size);
  }

  toggleGrid() {
    this.gridEnabled = !this.gridEnabled;
  }
}
