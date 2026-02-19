/**
 * TowerSlotEditor - Development tool for editing TOWER_SLOTS
 * Features:
 * - Drag to move tower slots
 * - Click on empty space to add new slots
 * - Right-click or Delete key to remove slots
 * - Grid snap functionality
 * - Visual radius adjustment with mouse wheel
 */

import { VIRTUAL_W, VIRTUAL_H } from '../config.js';

export class TowerSlotEditor {
  constructor(canvas, slots, onSlotsChanged) {
    this.canvas = canvas;
    this.slots = [...slots.map(s => ({ ...s }))]; // Deep copy
    this.onSlotsChanged = onSlotsChanged;

    this.isDragging = false;
    this.selectedSlotIndex = -1;
    this.hoveredSlotIndex = -1;

    // Grid settings
    this.gridSize = 10;
    this.gridEnabled = true;

    // Visual settings
    this.slotRadius = 30; // Default radius for new slots
    this.minRadius = 20;
    this.maxRadius = 60;

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
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));

    // Keyboard events
    document.addEventListener('keydown', this.onKeyDown.bind(this));
  }

  removeEventListeners() {
    this.canvas.removeEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.removeEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.removeEventListener('contextmenu', this.onContextMenu.bind(this));
    this.canvas.removeEventListener('wheel', this.onWheel.bind(this));
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

  findSlotAt(x, y) {
    for (let i = 0; i < this.slots.length; i++) {
      const dx = this.slots[i].x - x;
      const dy = this.slots[i].y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= this.slots[i].radius) {
        return i;
      }
    }
    return -1;
  }

  onMouseDown(e) {
    const coords = this.getCanvasCoords(e);
    const slotIndex = this.findSlotAt(coords.x, coords.y);

    if (e.button === 0) { // Left click
      if (slotIndex !== -1) {
        // Start dragging existing slot
        this.isDragging = true;
        this.selectedSlotIndex = slotIndex;
      } else {
        // Add new slot
        const snapped = this.snapToGrid(coords.x, coords.y);
        this.slots.push({
          x: snapped.x,
          y: snapped.y,
          radius: this.slotRadius
        });
        console.log('Added tower slot at', snapped);
        this.notifyChange();
      }
    }
  }

  onMouseMove(e) {
    const coords = this.getCanvasCoords(e);
    this.mouseX = coords.x;
    this.mouseY = coords.y;

    if (this.isDragging && this.selectedSlotIndex !== -1) {
      const snapped = this.snapToGrid(coords.x, coords.y);
      this.slots[this.selectedSlotIndex].x = snapped.x;
      this.slots[this.selectedSlotIndex].y = snapped.y;
      this.notifyChange();
    } else {
      // Update hover state
      this.hoveredSlotIndex = this.findSlotAt(coords.x, coords.y);
    }
  }

  onMouseUp(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.selectedSlotIndex = -1;
    }
  }

  onContextMenu(e) {
    e.preventDefault();
    const coords = this.getCanvasCoords(e);
    const slotIndex = this.findSlotAt(coords.x, coords.y);

    if (slotIndex !== -1) {
      this.deleteSlot(slotIndex);
    }
  }

  onWheel(e) {
    e.preventDefault();

    if (this.hoveredSlotIndex !== -1) {
      // Adjust radius of hovered slot
      const delta = e.deltaY > 0 ? -2 : 2;
      const slot = this.slots[this.hoveredSlotIndex];
      slot.radius = Math.max(this.minRadius, Math.min(this.maxRadius, slot.radius + delta));
      console.log(`Slot ${this.hoveredSlotIndex} radius: ${slot.radius}`);
      this.notifyChange();
    }
  }

  onKeyDown(e) {
    if (e.key === 'Delete' && this.hoveredSlotIndex !== -1) {
      this.deleteSlot(this.hoveredSlotIndex);
      this.hoveredSlotIndex = -1;
    } else if (e.key === 'g' || e.key === 'G') {
      // Toggle grid
      this.gridEnabled = !this.gridEnabled;
      console.log(`Grid snap: ${this.gridEnabled ? 'ON' : 'OFF'}`);
    } else if (e.key === 'e' || e.key === 'E') {
      // Export slots to clipboard
      this.exportSlots();
    } else if (e.key === 's' || e.key === 'S') {
      // Save to config.js
      e.preventDefault();
      this.saveToConfigFile();
    } else if (e.key === '+' || e.key === '=') {
      // Increase default radius
      this.slotRadius = Math.min(this.maxRadius, this.slotRadius + 2);
      console.log(`Default radius: ${this.slotRadius}`);
    } else if (e.key === '-' || e.key === '_') {
      // Decrease default radius
      this.slotRadius = Math.max(this.minRadius, this.slotRadius - 2);
      console.log(`Default radius: ${this.slotRadius}`);
    } else if (e.key === 'h' || e.key === 'H') {
      // Toggle UI visibility
      this.showUI = !this.showUI;
      console.log(`UI visibility: ${this.showUI ? 'ON' : 'OFF'}`);
    }
  }

  deleteSlot(index) {
    this.slots.splice(index, 1);
    console.log('Deleted slot', index);
    this.notifyChange();
  }

  notifyChange() {
    if (this.onSlotsChanged) {
      this.onSlotsChanged(this.slots);
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

    // Draw slots
    this.drawSlots(ctx);

    // Draw hover indicator
    if (this.hoveredSlotIndex !== -1) {
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

  drawSlots(ctx) {
    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    this.slots.forEach((slot, index) => {
      const x = slot.x * scaleX;
      const y = slot.y * scaleY;
      const r = slot.radius * scaleX; // Assume square aspect ratio

      // Outer circle (slot area)
      ctx.fillStyle = index === this.selectedSlotIndex
        ? 'rgba(255, 107, 107, 0.3)'
        : 'rgba(78, 205, 196, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = index === this.selectedSlotIndex ? '#FF6B6B' : '#4ECDC4';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Center point
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Slot number and info
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(index.toString(), x, y - 10);

      ctx.font = '10px monospace';
      ctx.fillText(`r:${slot.radius}`, x, y + 10);
    });
  }

  drawHoverIndicator(ctx) {
    const scaleX = this.canvas.width / VIRTUAL_W;
    const scaleY = this.canvas.height / VIRTUAL_H;

    const slot = this.slots[this.hoveredSlotIndex];
    const x = slot.x * scaleX;
    const y = slot.y * scaleY;
    const r = slot.radius * scaleX;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
    const uiHeight = 160;
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

    const lines = [
      'TOWER SLOT EDITOR (Dev Mode)',
      `Slots: ${this.slots.length}`,
      `Default Radius: ${this.slotRadius} (+/- to adjust)`,
      `Grid Snap: ${this.gridEnabled ? 'ON' : 'OFF'} (G to toggle)`,
      '',
      'Left Click: Add/Drag slot',
      'Mouse Wheel: Adjust radius (hover)',
      'Right Click: Delete slot',
      'H: Toggle UI help',
      'E: Copy to clipboard',
      'S: Save to config.js'
    ];

    lines.forEach((line, index) => {
      ctx.fillText(line, uiX + 10, uiY + 10 + index * 15);
    });
  }

  exportSlots() {
    const formatted = JSON.stringify(this.slots, null, 2);
    console.log('=== TOWER_SLOTS ===');
    console.log(formatted);
    console.log('===================');

    // Copy to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(formatted).then(() => {
        console.log('Slots copied to clipboard!');
        this.showNotification('Tower slots copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    }

    return this.slots;
  }

  /**
   * Download edited slots as config.js file
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

export const PATH_POINTS = [
  // ... (PATH_POINTS would be preserved here)
];

export const TOWER_SLOTS = ${JSON.stringify(this.slots, null, 2)};

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

export const PATH_POINTS = [
  // ... (PATH_POINTS would be preserved here)
];

export const TOWER_SLOTS = ${JSON.stringify(this.slots, null, 2)};

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

  getSlots() {
    return this.slots;
  }

  setGridSize(size) {
    this.gridSize = Math.max(1, size);
  }

  toggleGrid() {
    this.gridEnabled = !this.gridEnabled;
  }
}
