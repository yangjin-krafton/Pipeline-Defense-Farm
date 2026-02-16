/**
 * Main game loop
 */
import { FOOD_SPAWN_MS, BASE_SPEED } from '../config.js';
import { FoodSpawner } from './FoodSpawner.js';

export class GameLoop {
  constructor(pathSystem, webglRenderer, emojiRenderer, staticMeshes, flowSystem, audioSystem) {
    this.pathSystem = pathSystem;
    this.webglRenderer = webglRenderer;
    this.emojiRenderer = emojiRenderer;
    this.staticMeshes = staticMeshes;
    this.flowSystem = flowSystem;
    this.audioSystem = audioSystem;
    this.foodSpawner = new FoodSpawner(pathSystem);

    this.time = 0;
    this.score = 0;
    this.lastTime = 0;
    this.scoreDirty = true;

    // FPS tracking
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTime = 0;

    this.isRunning = false;
  }

  /**
   * Update game state
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.time += dt;

    // Spawn food
    this.foodSpawner.update(dt);

    // Update path system
    this.pathSystem.update(dt, (completed) => {
      this.score += 10;
      this.scoreDirty = true;
    });

    // Update FPS
    this.frameCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1.0) {
      this.fps = Math.round(this.frameCount / this.fpsTime);
      this.frameCount = 0;
      this.fpsTime = 0;
      this._updateFPSDisplay();
    }
  }

  /**
   * Draw the path layer (WebGL)
   */
  drawPath() {
    const gl = this.webglRenderer;
    gl.clear([1.0, 0.89, 0.80, 1.0]);

    // Draw background decorations
    gl.drawMesh(this.staticMeshes.bgWarm, [1.0, 0.72, 0.66, 0.24]);
    gl.drawMesh(this.staticMeshes.bgCool, [1.0, 1.0, 1.0, 0.18]);

    // Draw track
    gl.drawMesh(this.staticMeshes.trackShadow, [0.25, 0.09, 0.14, 0.25]);
    gl.drawMesh(this.staticMeshes.trackMain, [0.96, 0.66, 0.74, 0.95]);
    gl.drawMesh(this.staticMeshes.trackEdge, [0.42, 0.18, 0.27, 0.9]);

    // Draw flow animation
    gl.drawTriangles(this.flowSystem.getMesh(), [1.0, 0.96, 0.83, 0.86]);
  }

  /**
   * Draw the emoji layer (Canvas 2D)
   */
  drawEmojis() {
    const renderer = this.emojiRenderer;
    renderer.clear();

    const scale = renderer.getScale();
    const foods = this.pathSystem.getObjects();

    for (let i = 0; i < foods.length; i += 1) {
      const f = foods[i];
      const p = this.pathSystem.samplePath(f.d);
      const pulse = 1 + Math.sin((this.time * 8) + f.d * 0.08 + f.spin) * 0.08;

      const size = f.size * pulse;
      renderer.drawEmoji(f.emoji, p.x, p.y, size, scale);
    }

    if (this.scoreDirty) {
      this._updateScoreDisplay();
      this.scoreDirty = false;
    }
  }

  /**
   * Main frame function
   * @param {number} now - Current timestamp
   */
  frame(now) {
    if (!this.isRunning) return;

    if (!this.lastTime) this.lastTime = now;
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    this.update(dt);
    this.drawPath();
    this.drawEmojis();

    requestAnimationFrame((t) => this.frame(t));
  }

  /**
   * Start the game loop
   */
  start() {
    this.isRunning = true;

    // Spawn initial foods
    for (let i = 0; i < 5; i += 1) {
      this.foodSpawner.spawnFood(i * 56);
    }

    requestAnimationFrame((t) => this.frame(t));
  }

  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
  }

  /**
   * Update score display
   * @private
   */
  _updateScoreDisplay() {
    const badge = document.querySelector(".badge");
    if (badge) {
      badge.textContent = `Digestive Run • SCORE ${String(this.score).padStart(4, "0")}`;
    }
  }

  /**
   * Update FPS display
   * @private
   */
  _updateFPSDisplay() {
    const fpsDisplay = document.querySelector(".fps");
    if (fpsDisplay) {
      fpsDisplay.textContent = `FPS: ${this.fps}`;
    }
  }

  /**
   * Get current score
   * @returns {number} Current score
   */
  getScore() {
    return this.score;
  }

  /**
   * Get current FPS
   * @returns {number} Current FPS
   */
  getFPS() {
    return this.fps;
  }
}
