/**
 * CameraController - Manages camera focus and panning
 */

import { VIRTUAL_W, VIRTUAL_H } from '../config.js';

export class CameraController {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.currentOffset = { x: 0, y: 0 };
    this.targetOffset = { x: 0, y: 0 };
    this.isAnimating = false;
    this.animationSpeed = 0.15; // Smoothing factor (0-1)
  }

  /**
   * Focus on a tower slot (position it in upper half center when bottom sheet is open)
   * @param {Object} slot - Tower slot with x, y coordinates (in virtual coordinates)
   */
  focusOnTowerSlot(slot) {
    if (!slot) return;

    // Get current container dimensions (640x1063 fixed)
    const rect = this.container.getBoundingClientRect();
    const gameAreaWidth = rect.width;  // 640
    const gameAreaHeight = rect.height; // 1063

    // Calculate scale and canvas dimensions (same as fitCanvas in main.js)
    const scale = Math.min(gameAreaWidth / VIRTUAL_W, gameAreaHeight / VIRTUAL_H);
    const cssW = Math.round(VIRTUAL_W * scale);
    const cssH = Math.round(VIRTUAL_H * scale);

    // Calculate canvas offset within container
    const canvasOffsetX = (gameAreaWidth - cssW) / 2;
    const canvasOffsetY = (gameAreaHeight - cssH) / 2;

    // Bottom sheet height when expanded
    const bottomSheetHeight = 600;

    // When bottom sheet is open, visible game area is:
    // gameAreaHeight - bottomSheetHeight = 1063 - 600 = 463px
    const visibleAreaHeight = gameAreaHeight - bottomSheetHeight;

    // Center of visible area (upper half)
    const upperHalfCenterY = visibleAreaHeight / 2;

    // Calculate where the tower is within the canvas (in CSS pixels)
    const towerCanvasX = slot.x * scale;
    const towerCanvasY = slot.y * scale;

    // Calculate tower's absolute position on screen (including canvas offset)
    const towerScreenX = canvasOffsetX + towerCanvasX;
    const towerScreenY = canvasOffsetY + towerCanvasY;

    // Calculate how much we need to offset the entire container
    // to center the tower at (gameAreaWidth/2, upperHalfCenterY)
    const targetCenterX = gameAreaWidth / 2;
    const targetX = targetCenterX - towerScreenX;
    const targetY = upperHalfCenterY - towerScreenY;

    // Set target offset
    this.targetOffset = { x: targetX, y: targetY };
    this.isAnimating = true;

    console.log(`Focus: tower virtual (${slot.x}, ${slot.y}), scale=${scale.toFixed(2)}, visible area=${visibleAreaHeight}px, center Y=${upperHalfCenterY.toFixed(1)}px, tower screen=(${towerScreenX.toFixed(1)}, ${towerScreenY.toFixed(1)}), offset=(${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);
  }

  /**
   * Reset camera to default position
   */
  reset() {
    this.targetOffset = { x: 0, y: 0 };
    this.isAnimating = true;
  }

  /**
   * Update camera animation (call every frame)
   */
  update() {
    if (!this.isAnimating) return;

    // Smooth interpolation towards target
    const dx = this.targetOffset.x - this.currentOffset.x;
    const dy = this.targetOffset.y - this.currentOffset.y;

    // Check if we're close enough to target
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      this.currentOffset = { ...this.targetOffset };
      this.isAnimating = false;
    } else {
      this.currentOffset.x += dx * this.animationSpeed;
      this.currentOffset.y += dy * this.animationSpeed;
    }

    // Apply transform to container
    this.applyTransform();
  }

  /**
   * Apply current offset as CSS transform
   */
  applyTransform() {
    const transform = `translate(${this.currentOffset.x}px, ${this.currentOffset.y}px)`;
    this.container.style.transform = transform;
    this.container.style.transition = 'none'; // Disable CSS transition, use JS animation
  }

  /**
   * Check if camera is animating
   */
  isActive() {
    return this.isAnimating;
  }
}
