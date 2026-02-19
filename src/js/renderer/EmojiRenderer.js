/**
 * Emoji Renderer with caching for optimized performance
 */
import { EMOJI_CACHE_SIZE, VIRTUAL_W } from '../config.js';

export class EmojiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.emojiCache = new Map();
  }

  /**
   * Cache an emoji at a specific size
   * @param {string} emoji - Emoji character
   * @param {number} size - Size in pixels
   * @returns {HTMLCanvasElement} Cached emoji canvas
   */
  _cacheEmoji(emoji, size) {
    const key = `${emoji}_${size}`;
    if (this.emojiCache.has(key)) {
      return this.emojiCache.get(key);
    }

    const canvas = document.createElement('canvas');
    const s = size * 1.2; // Extra padding
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');

    ctx.font = `${size}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw shadow
    ctx.globalAlpha = 0.3;
    ctx.fillText(emoji, s/2 + 2, s/2 + 2);

    // Draw main
    ctx.globalAlpha = 1.0;
    ctx.fillText(emoji, s/2, s/2);

    this.emojiCache.set(key, canvas);
    return canvas;
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw an emoji at a position
   * @param {string} emoji - Emoji character
   * @param {number} x - X position (in virtual coordinates)
   * @param {number} y - Y position (in virtual coordinates)
   * @param {number} size - Size (in virtual coordinates)
   * @param {number} scale - Canvas scale factor
   */
  drawEmoji(emoji, x, y, size, scale) {
    const actualSize = Math.round(size * scale);
    const cached = this._cacheEmoji(emoji, EMOJI_CACHE_SIZE);
    const drawSize = actualSize * 1.2;

    const actualX = x * scale;
    const actualY = y * scale;

    this.ctx.drawImage(
      cached,
      actualX - drawSize/2,
      actualY - drawSize/2,
      drawSize,
      drawSize
    );
  }

  /**
   * Draw a tower at a position
   * @param {BaseTower} tower - Tower object
   * @param {number} scale - Canvas scale factor
   */
  drawTower(tower, scale) {
    const ctx = this.ctx;
    const x = tower.x * scale;
    const y = tower.y * scale;
    const size = tower.slotRadius * 2 * scale;

    // Draw tower emoji
    ctx.font = `${size}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tower.definition.emoji, x, y);

    // Draw efficiency indicator (colored ring)
    ctx.strokeStyle = this._getEfficiencyColor(tower.efficiencyState);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Get color for efficiency state
   * @param {string} state - Efficiency state
   * @returns {string} Color
   */
  _getEfficiencyColor(state) {
    switch(state) {
      case 'STARVED': return '#ff4444';
      case 'NORMAL': return '#44ff44';
      case 'BOOSTED': return '#ffff44';
      case 'OVERCHARGED': return '#ff44ff';
      default: return '#ffffff';
    }
  }

  /**
   * Get the canvas scale factor
   * @returns {number} Scale factor
   */
  getScale() {
    return this.canvas.width / VIRTUAL_W;
  }

  /**
   * Clear emoji cache
   */
  clearCache() {
    this.emojiCache.clear();
  }
}
