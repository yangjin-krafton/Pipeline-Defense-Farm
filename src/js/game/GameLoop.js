/**
 * Main game loop
 */
import { FOOD_SPAWN_MS, BASE_SPEED, PATHS, PATH_RENDER_SETTINGS } from '../config.js';
import { FoodSpawner } from './FoodSpawner.js';
import { hexToRgba } from '../utils/geometry.js';
import { TowerManager } from '../digestion/systems/TowerManager.js';
import { SupplySystem } from '../digestion/systems/SupplySystem.js';
import { EconomySystem } from '../digestion/systems/EconomySystem.js';
import { TroubleSystem } from '../digestion/systems/TroubleSystem.js';

export class GameLoop {
  constructor(multiPathSystem, webglRenderer, emojiRenderer, staticMeshes, flowSystem, audioSystem) {
    this.multiPathSystem = multiPathSystem;
    this.webglRenderer = webglRenderer;
    this.emojiRenderer = emojiRenderer;
    this.staticMeshes = staticMeshes;
    this.flowSystem = flowSystem;
    this.audioSystem = audioSystem;
    this.foodSpawner = new FoodSpawner(multiPathSystem);

    this.time = 0;
    this.score = 0;
    this.lastTime = 0;
    this.scoreDirty = true;

    // FPS tracking
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTime = 0;

    this.isRunning = false;

    // NEW: Initialize digestion systems
    this.towerManager = new TowerManager();
    this.supplySystem = new SupplySystem();
    this.economySystem = new EconomySystem();
    this.troubleSystem = new TroubleSystem();

    this.currentTime = 0; // Track game time
  }

  /**
   * Update game state
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.time += dt;
    this.currentTime += dt; // NEW: Track absolute time

    // Spawn food
    this.foodSpawner.update(dt);

    // NEW: Update digestion systems BEFORE path movement
    const foodList = this.multiPathSystem.getObjects();
    this.towerManager.update(dt, foodList, this.multiPathSystem, this.currentTime);
    this.supplySystem.update(dt);
    this.troubleSystem.update(dt, foodList, this.multiPathSystem);

    // Update multi-path system
    this.multiPathSystem.update(dt, (completed) => {
      // NEW: Earn nutrition based on zone
      const reward = this.economySystem.earnFromFood(completed, completed.currentPath);
      this.score += reward;
      this.scoreDirty = true;
    });

    // NEW: Handle food deaths (HP <= 0)
    this._processFoodDeaths();

    // Update FPS
    this.frameCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1.0) {
      this.fps = Math.round(this.frameCount / this.fpsTime);
      this.frameCount = 0;
      this.fpsTime = 0;
      // FPS display removed from UI
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

    // Draw each path with its own color (using settings from config.js)
    const settings = PATH_RENDER_SETTINGS;

    for (const pathKey of settings.renderOrder) {
      const pathMesh = this.staticMeshes.paths[pathKey];
      if (!pathMesh) continue;

      const baseColor = hexToRgba(pathMesh.color, 1.0);

      // Shadow layer
      const shadowColor = [
        baseColor[0] * settings.shadowBrightness,
        baseColor[1] * settings.shadowBrightness,
        baseColor[2] * settings.shadowBrightness,
        settings.shadowAlpha
      ];
      gl.drawMesh(pathMesh.shadow, shadowColor);

      // Main track layer
      const mainColor = [
        baseColor[0] * settings.mainBrightness,
        baseColor[1] * settings.mainBrightness,
        baseColor[2] * settings.mainBrightness,
        settings.mainAlpha
      ];
      gl.drawMesh(pathMesh.main, mainColor);

      // Edge layer
      const edgeColor = [
        baseColor[0] * settings.edgeBrightness,
        baseColor[1] * settings.edgeBrightness,
        baseColor[2] * settings.edgeBrightness,
        settings.edgeAlpha
      ];
      gl.drawMesh(pathMesh.edge, edgeColor);
    }

    // Draw tower slots
    gl.drawMesh(this.staticMeshes.towerSlotOuter, [0.0, 0.85, 1.0, 0.4]); // Cyan
    gl.drawMesh(this.staticMeshes.towerSlotInner, [1.0, 0.89, 0.80, 0.95]); // Background color (creates ring effect)

    // Draw flow animation (disabled for now to see paths clearly)
    // gl.drawTriangles(this.flowSystem.getMesh(), [1.0, 0.96, 0.83, 0.86]);
  }

  /**
   * Process food deaths (HP <= 0)
   */
  _processFoodDeaths() {
    const foodList = this.multiPathSystem.getObjects();

    // Collect dead food
    const deadFood = [];
    for (const pathSystem of Object.values(this.multiPathSystem.pathSystems)) {
      for (let i = pathSystem.objects.length - 1; i >= 0; i--) {
        const food = pathSystem.objects[i];
        if (food.hp <= 0) {
          const removed = pathSystem.objects.splice(i, 1)[0];
          deadFood.push(removed);
        }
      }
    }

    // Reward player
    for (const food of deadFood) {
      const reward = this.economySystem.earnFromFood(food, food.currentPath);
      this.score += reward;
      this.scoreDirty = true;
      console.log(`Food ${food.emoji} digested in ${food.currentPath}`);
    }
  }

  /**
   * Draw the emoji layer (Canvas 2D)
   */
  drawEmojis() {
    const renderer = this.emojiRenderer;
    renderer.clear();

    const scale = renderer.getScale();
    const foods = this.multiPathSystem.getObjects();

    // Removed: console.log - too verbose

    for (let i = 0; i < foods.length; i += 1) {
      const f = foods[i];
      // Sample path based on current path
      const p = this.multiPathSystem.samplePath(f.currentPath, f.d);
      const pulse = 1 + Math.sin((this.time * 8) + f.d * 0.08 + f.spin) * 0.08;

      const size = f.size * pulse;
      renderer.drawEmoji(f.emoji, p.x, p.y, size, scale);
    }

    // NEW: Draw towers
    const towers = this.towerManager.getAllTowers();
    for (const tower of towers) {
      renderer.drawTower(tower, scale);
    }

    // Badge removed from UI, score tracking still active
    if (this.scoreDirty) {
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

    // Spawn initial foods on different paths
    const spawnablePaths = ['rice_stomach', 'dessert_stomach', 'alcohol_stomach'];
    for (let i = 0; i < 5; i += 1) {
      const pathKey = spawnablePaths[i % spawnablePaths.length];
      this.foodSpawner.spawnFood(pathKey, i * 56);
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
   * Pause the game loop
   */
  pause() {
    this.isRunning = false;
  }

  /**
   * Resume the game loop
   */
  resume() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = 0; // Reset time to avoid large dt
      requestAnimationFrame((t) => this.frame(t));
    }
  }

  /* Badge and FPS display methods removed - UI elements no longer exist
   * Score and FPS are still tracked internally for debugging via:
   * - gameLoop.getScore()
   * - gameLoop.getFPS()
   */

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

  /**
   * Get tower manager
   * @returns {TowerManager} Tower manager
   */
  getTowerManager() {
    return this.towerManager;
  }

  /**
   * Get supply system
   * @returns {SupplySystem} Supply system
   */
  getSupplySystem() {
    return this.supplySystem;
  }

  /**
   * Get economy system
   * @returns {EconomySystem} Economy system
   */
  getEconomySystem() {
    return this.economySystem;
  }

  /**
   * Get trouble system
   * @returns {TroubleSystem} Trouble system
   */
  getTroubleSystem() {
    return this.troubleSystem;
  }
}
