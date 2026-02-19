/**
 * CameraController - Manages camera focus and panning
 */

import { VIRTUAL_W, VIRTUAL_H } from '../config.js';

export class CameraController {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.canvas = canvasContainer.querySelector('#pathCanvas');
    this.currentOffset = { x: 0, y: 0 };
    this.targetOffset = { x: 0, y: 0 };
    this.isAnimating = false;
    this.animationSpeed = 0.15; // Smoothing factor (0-1)
  }

  /**
   * Focus on a tower slot (position it in upper half center when bottom sheet is open)
   * @param {Object} slot - Tower slot with x, y coordinates (in virtual coordinates 360x640)
   */
  focusOnTowerSlot(slot) {
    if (!slot) return;

    console.log('=== Focus Debug ===');
    console.log('Tower virtual coords:', { x: slot.x, y: slot.y });

    // Game area dimensions (fixed design px)
    const gameAreaWidth = 640;
    const gameAreaHeight = 1063;

    // Canvas virtual dimensions
    const canvasVirtualWidth = VIRTUAL_W;  // 360
    const canvasVirtualHeight = VIRTUAL_H; // 640

    // Calculate canvas scale to fit in game area
    const canvasScale = Math.min(
      gameAreaWidth / canvasVirtualWidth,
      gameAreaHeight / canvasVirtualHeight
    );
    console.log('Canvas scale:', canvasScale.toFixed(3));

    // Canvas CSS dimensions
    const canvasCssWidth = Math.round(canvasVirtualWidth * canvasScale);   // 598
    const canvasCssHeight = Math.round(canvasVirtualHeight * canvasScale); // 1063
    console.log('Canvas CSS size:', { width: canvasCssWidth, height: canvasCssHeight });

    // Canvas offset within game area (centered horizontally)
    const canvasOffsetX = (gameAreaWidth - canvasCssWidth) / 2;  // 21
    const canvasOffsetY = (gameAreaHeight - canvasCssHeight) / 2; // 0
    console.log('Canvas offset:', { x: canvasOffsetX, y: canvasOffsetY });

    // Tower position on canvas (CSS px)
    const towerCanvasX = slot.x * canvasScale;
    const towerCanvasY = slot.y * canvasScale;
    console.log('Tower on canvas:', { x: towerCanvasX.toFixed(1), y: towerCanvasY.toFixed(1) });

    // Tower position in game area (CSS px)
    const towerGameAreaX = canvasOffsetX + towerCanvasX;
    const towerGameAreaY = canvasOffsetY + towerCanvasY;
    console.log('Tower in game area:', { x: towerGameAreaX.toFixed(1), y: towerGameAreaY.toFixed(1) });

    // Bottom sheet height when expanded (design px)
    const bottomSheetHeight = 600;

    // Visible area when sheet is open
    const visibleAreaHeight = gameAreaHeight - bottomSheetHeight; // 463
    console.log('Visible area height:', visibleAreaHeight);

    // Target center of visible area
    const targetCenterX = gameAreaWidth / 2;      // 320
    const targetCenterY = visibleAreaHeight / 2;  // 231.5
    console.log('Target center:', { x: targetCenterX, y: targetCenterY });

    // Required offset to move tower to target center
    const offsetX = targetCenterX - towerGameAreaX;
    const offsetY = targetCenterY - towerGameAreaY;
    console.log('Required offset:', { x: offsetX.toFixed(1), y: offsetY.toFixed(1) });
    console.log('==================');

    // Set target offset
    this.targetOffset = { x: offsetX, y: offsetY };
    this.isAnimating = true;
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
