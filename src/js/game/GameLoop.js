/**
 * Main game loop
 */
import { FOOD_SPAWN_MS, BASE_SPEED, PATHS, PATH_RENDER_SETTINGS } from '../config.js';
import { FoodSpawner } from './FoodSpawner.js';
import { hexToRgba } from '../utils/geometry.js';
import { TowerManager } from '../digestion/systems/TowerManager.js';
import { EconomySystem } from '../digestion/systems/EconomySystem.js';
import { BulletSystem } from '../digestion/systems/BulletSystem.js';
import { ParticleSystem } from '../digestion/systems/ParticleSystem.js';
import { TimeTrackingSystem } from '../digestion/systems/TimeTrackingSystem.js';
import { TowerGrowthSystem } from '../digestion/systems/TowerGrowthSystem.js';
import { SpeedBoostSystem } from '../digestion/systems/SpeedBoostSystem.js';
import { BulletRenderer } from '../renderer/BulletRenderer.js';
import { HPBarRenderer } from '../renderer/HPBarRenderer.js';
import { ParticleRenderer } from '../renderer/ParticleRenderer.js';
import { StatusEffectRenderer } from '../renderer/StatusEffectRenderer.js';

export class GameLoop {
  constructor(multiPathSystem, webglRenderer, emojiRenderer, staticMeshes, flowSystem, audioSystem, uiSfxSystem = null) {
    this.multiPathSystem = multiPathSystem;
    this.webglRenderer = webglRenderer;
    this.emojiRenderer = emojiRenderer;
    this.staticMeshes = staticMeshes;
    this.flowSystem = flowSystem;
    this.audioSystem = audioSystem;
    this.uiSfxSystem = uiSfxSystem;
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

    // Game speed control
    this.timeScale = 1.0; // 1x = normal, 2x = fast, 0.5x = slow
    this.targetTimeScale = 1.0; // Target time scale for smooth transitions
    this.timeScaleTransitionSpeed = 5.0; // How fast to transition between speeds

    // Initialize digestion systems
    this.towerManager = new TowerManager();
    this.economySystem = new EconomySystem();

    // Initialize new growth systems
    this.timeTrackingSystem = new TimeTrackingSystem();
    this.towerGrowthSystem = new TowerGrowthSystem(this.economySystem);

    // NEW: Initialize bullet and particle systems
    this.bulletSystem = new BulletSystem();
    this.particleSystem = new ParticleSystem();

    // NEW: Initialize speed boost system
    this.speedBoostSystem = new SpeedBoostSystem();

    // Connect systems
    this.bulletSystem.setParticleSystem(this.particleSystem);
    this.bulletSystem.setUISfxSystem(this.uiSfxSystem);
    this.towerManager.setBulletSystem(this.bulletSystem);
    this.towerManager.setParticleSystem(this.particleSystem);

    console.log('GameLoop: Systems connected to TowerManager', {
      bulletSystem: this.bulletSystem,
      particleSystem: this.particleSystem
    });

    // NEW: Initialize WebGL2 renderers
    const gl = webglRenderer.gl;
    this.bulletRenderer = new BulletRenderer(gl, 500, [360, 640]);
    this.hpBarRenderer = new HPBarRenderer(gl, 200, [360, 640]);
    this.particleRenderer = new ParticleRenderer(gl, 2000, [360, 640]);
    this.statusEffectRenderer = new StatusEffectRenderer(emojiRenderer.ctx);

    this.currentTime = 0; // Track game time

    // Enemy-metrics difficulty sync (10s window)
    this.enemyMetricWindowSec = 10.0;
    this.enemyMetricWindowTimer = 0;
    this.enemyAliveIntegral = 0; // sum(aliveCount * dt) over current window
    this.enemyKilledInWindow = 0;
    this.enemyLeakedInWindow = 0;
    this.enemyMetricStageIndex = 0;
    this.enemyAliveEMA = null;
    this.difficultyRampValue = 0;      // slow monotonic ramp [0..5]
    this.difficultyRampPer10Sec = 1.0; // 1 stage per 10s

    // Combat SFX state
    this.combatWasActive = false;
    this.lastWaveStartSfxTime = -999;
    this.lastWaveClearSfxTime = -999;
    this.lastKillSfxTime = -999;
    this.lastBigKillSfxTime = -999;
  }

  /**
   * Update game state
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Update speed boost system with REAL dt (before timeScale application)
    this.speedBoostSystem.update(dt, this);

    // Smoothly transition timeScale
    if (this.timeScale !== this.targetTimeScale) {
      const diff = this.targetTimeScale - this.timeScale;
      const step = Math.sign(diff) * this.timeScaleTransitionSpeed * dt;
      if (Math.abs(diff) < Math.abs(step)) {
        this.timeScale = this.targetTimeScale;
      } else {
        this.timeScale += step;
      }
    }

    // Apply time scale to delta time
    const scaledDt = dt * this.timeScale;

    this.time += scaledDt;
    this.currentTime += scaledDt;

    // Spawn food
    const foodsBeforeSpawn = new Set(this.multiPathSystem.getObjects());
    this.foodSpawner.update(scaledDt);
    const foodsAfterSpawn = this.multiPathSystem.getObjects();
    for (const food of foodsAfterSpawn) {
      if (!foodsBeforeSpawn.has(food) && typeof food.spawnedAt !== 'number') {
        food.spawnedAt = this.currentTime;
      }
    }

    // Update digestion systems BEFORE path movement
    const foodList = this.multiPathSystem.getObjects();

    // Update new systems
    this.timeTrackingSystem.update(scaledDt, this.economySystem);
    this.towerGrowthSystem.update(scaledDt, this.towerManager.getAllTowers(), this.currentTime * 1000); // currentTime in ms
    this.economySystem.update(scaledDt);  // Time-based SC income

    // Update existing systems
    this.towerManager.update(scaledDt, foodList, this.multiPathSystem, this.currentTime);

    // NEW: Update bullet system (foodList 전달 → 관통 연속 처리에 사용)
    this.bulletSystem.update(scaledDt, this.multiPathSystem, foodList);

    // NEW: Update particle system
    this.particleSystem.update(scaledDt);

    // Update multi-path system (completed = leaked)
    this.multiPathSystem.update(scaledDt, (completed) => {
      const timeToKill = typeof completed.spawnedAt === 'number'
        ? Math.max(0, this.currentTime - completed.spawnedAt)
        : undefined;
      this.enemyLeakedInWindow += 1;
      this.foodSpawner.reportCombatResult({
        leaked: true,
        timeToKill
      });
    });

    // Handle food deaths (HP <= 0)
    this._processFoodDeaths();

    // Collect enemy metrics and update base difficulty every 10s.
    const aliveCount = this.multiPathSystem.getObjects().length;
    this.enemyAliveIntegral += aliveCount * scaledDt;
    this.enemyMetricWindowTimer += scaledDt;
    if (this.enemyMetricWindowTimer >= this.enemyMetricWindowSec) {
      const elapsed = Math.max(0.001, this.enemyMetricWindowTimer);
      const avgAlive = this.enemyAliveIntegral / elapsed;
      this.difficultyRampValue = Math.min(
        5,
        this.difficultyRampValue + (this.difficultyRampPer10Sec * (elapsed / 10))
      );
      const rampStage = Math.floor(this.difficultyRampValue);

      if (this.enemyAliveEMA == null) {
        this.enemyAliveEMA = avgAlive;
      } else if (avgAlive < this.enemyAliveEMA) {
        // When board pressure is decreasing, react faster so difficulty can ramp up sooner.
        this.enemyAliveEMA = (this.enemyAliveEMA * 0.45) + (avgAlive * 0.55);
      } else {
        // When pressure is increasing, react slightly slower to avoid oscillation.
        this.enemyAliveEMA = (this.enemyAliveEMA * 0.75) + (avgAlive * 0.25);
      }
      const { targetStageIndex, stepCap } = this._calculateEnemyMetricStageDecision(
        this.enemyAliveEMA,
        this.enemyKilledInWindow,
        this.enemyLeakedInWindow
      );
      const combinedTarget = Math.max(rampStage, targetStageIndex);
      const prevStage = this.enemyMetricStageIndex;
      this.enemyMetricStageIndex = this._stepStageIndex(this.enemyMetricStageIndex, combinedTarget, stepCap);
      this.foodSpawner.setBaseStageIndex(this.enemyMetricStageIndex);
      if (this.enemyMetricStageIndex > prevStage) {
        this._playBattleSfx('wave_start', 0.58, 2.8, 'lastWaveStartSfxTime');
      }
      this._resetEnemyMetricWindow();
    }

    this._updateCombatWaveSfx();

    // Update FPS
    this.frameCount++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1.0) {
      this.fps = Math.round(this.frameCount / this.fpsTime);
      this.frameCount = 0;
      this.fpsTime = 0;
    }
  }

  _calculateEnemyMetricStageDecision(avgAlive, killed, leaked) {
    const stage = this.enemyMetricStageIndex;
    const targetAliveByStage = [8, 10, 13, 16, 20, 24];
    const targetKillsByStage = [4, 5, 7, 9, 11, 13]; // expected kills per 10s
    const leakToleranceByStage = [0, 0, 1, 1, 2, 2];

    const targetAlive = targetAliveByStage[stage] ?? 10;
    const targetKills = targetKillsByStage[stage] ?? 6;
    const leakTolerance = leakToleranceByStage[stage] ?? 1;

    const aliveControl = (targetAlive - avgAlive) / Math.max(1, targetAlive); // + good, - bad
    const killControl = (killed - targetKills) / Math.max(1, targetKills);    // + good, - bad
    const leakOver = Math.max(0, leaked - leakTolerance);
    const leakPenalty = leakOver / Math.max(1, leakTolerance + 1);

    const performance = (aliveControl * 0.9) + (killControl * 0.75) - (leakPenalty * 1.3);

    let delta = 0;
    let stepCap = 1;

    // Emergency brake when leaks spike in a single 10s window.
    if (leaked >= 6) {
      delta = -3;
      stepCap = 2;
    } else if (leaked >= 3 && killed <= leaked) {
      delta = -2;
      stepCap = 2;
    } else if (performance >= 0.45) delta = 1;
    else if (performance <= -0.55) delta = -1;

    return {
      targetStageIndex: Math.max(0, Math.min(5, stage + delta)),
      stepCap
    };
  }

  _resetEnemyMetricWindow() {
    this.enemyMetricWindowTimer = 0;
    this.enemyAliveIntegral = 0;
    this.enemyKilledInWindow = 0;
    this.enemyLeakedInWindow = 0;
  }

  _stepStageIndex(current, target, maxStep = 1) {
    const safeCurrent = Math.max(0, Math.min(5, Math.round(current)));
    const safeTarget = Math.max(0, Math.min(5, Math.round(target)));
    const step = Math.max(1, Math.min(2, Math.round(maxStep)));

    if (safeTarget > safeCurrent) return Math.min(5, safeCurrent + step);
    if (safeTarget < safeCurrent) return Math.max(0, safeCurrent - step);
    return safeCurrent;
  }

  _playBattleSfx(eventName, volume = 1, cooldownSec = 0, timerKey = '') {
    if (!this.uiSfxSystem) return;
    if (timerKey) {
      const lastTime = this[timerKey] ?? -999;
      if (this.currentTime - lastTime < cooldownSec) return;
      this[timerKey] = this.currentTime;
    }
    this.uiSfxSystem.play(eventName, { volume });
  }

  _updateCombatWaveSfx() {
    const aliveCount = this.multiPathSystem.getObjects().length;
    const combatActive = aliveCount > 0;

    if (combatActive && !this.combatWasActive) {
      this._playBattleSfx('wave_start', 0.72, 2.4, 'lastWaveStartSfxTime');
    } else if (!combatActive && this.combatWasActive) {
      this._playBattleSfx('wave_clear', 0.76, 1.6, 'lastWaveClearSfxTime');
    }

    this.combatWasActive = combatActive;
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
  }

  /**
   * NEW: Draw HP bars (WebGL2 Instanced Rendering)
   */
  drawHPBars() {
    const foods = this.multiPathSystem.getObjects();
    if (foods.length > 0) {
      this.hpBarRenderer.update(foods, this.multiPathSystem);
    }
  }

  /**
   * NEW: Draw bullets (WebGL2 Instanced Rendering)
   */
  drawBullets() {
    const bullets = this.bulletSystem.getBullets();
    if (bullets.length > 0) {
      this.bulletRenderer.update(bullets);
    }
  }

  /**
   * NEW: Draw particles (WebGL2 Instanced Rendering)
   */
  drawParticles() {
    const particles = this.particleSystem.getParticles();
    if (particles.length > 0) {
      this.particleRenderer.update(particles);
    }
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

    // Reward player and emit death effects
    for (const food of deadFood) {
      const timeToKill = typeof food.spawnedAt === 'number'
        ? Math.max(0, this.currentTime - food.spawnedAt)
        : undefined;
      this.foodSpawner.reportCombatResult({
        killed: true,
        timeToKill
      });
      this.enemyKilledInWindow += 1;

      const reward = this.economySystem.earnFromFood(food, food.currentPath);
      this.score += reward;
      this.scoreDirty = true;
      console.log(`Food ${food.emoji} digested in ${food.currentPath}`);

      const isEliteKill = (food.strengthTier === 'elite') || (food.threat >= 17);
      if (isEliteKill) {
        this._playBattleSfx('explosion_big', 0.62, 0.12, 'lastBigKillSfxTime');
      } else {
        this._playBattleSfx('explosion_small', 0.5, 0.05, 'lastKillSfxTime');
      }

      // NEW: Emit death particle effect
      const pos = this.multiPathSystem.samplePath(food.currentPath, food.d);
      if (pos) {
        // Color based on food tags
        let color = [1.0, 1.0, 0.2, 1.0]; // Default yellow
        if (food.tags?.includes('carb')) {
          color = [1.0, 1.0, 0.2, 1.0]; // Yellow
        } else if (food.tags?.includes('protein')) {
          color = [1.0, 0.2, 0.2, 1.0]; // Red
        } else if (food.tags?.includes('fat')) {
          color = [1.0, 0.5, 0.0, 1.0]; // Orange
        }

        this.particleSystem.emitDeathEffect(pos.x, pos.y, color);
      }
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

    // Draw food emojis
    for (let i = 0; i < foods.length; i += 1) {
      const f = foods[i];
      // Sample path based on current path
      const p = this.multiPathSystem.samplePath(f.currentPath, f.d);
      const pulse = 1 + Math.sin((this.time * 8) + f.d * 0.08 + f.spin) * 0.08;

      const size = f.size * pulse;
      renderer.drawEmoji(f.emoji, p.x, p.y, size, scale);
    }

    // Draw HP bars + status icons above enemies on the same canvas layer.
    if (foods.length > 0) {
      this.statusEffectRenderer.render(foods, this.multiPathSystem, this.currentTime);
    }

    // Draw towers
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

    // Rendering order (back to front):
    // 1. WebGL: Background, paths, tower slots
    this.drawPath();

    // 2. WebGL: Bullets
    this.drawBullets();

    // 3. WebGL: Particles (rendered last in WebGL so hit/shot effects stay on top)
    this.drawParticles();

    // 4. Canvas 2D: Food emojis + HP bars + status icons + Tower emojis
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
    this._playBattleSfx('wave_start', 0.68, 0.4, 'lastWaveStartSfxTime');

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
   * Get economy system
   * @returns {EconomySystem} Economy system
   */
  getEconomySystem() {
    return this.economySystem;
  }

  /**
   * Get time tracking system
   * @returns {TimeTrackingSystem} Time tracking system
   */
  getTimeTrackingSystem() {
    return this.timeTrackingSystem;
  }

  /**
   * Get tower growth system
   * @returns {TowerGrowthSystem} Tower growth system
   */
  getTowerGrowthSystem() {
    return this.towerGrowthSystem;
  }

  /**
   * Get bullet system
   * @returns {BulletSystem} Bullet system
   */
  getBulletSystem() {
    return this.bulletSystem;
  }

  /**
   * Get particle system
   * @returns {ParticleSystem} Particle system
   */
  getParticleSystem() {
    return this.particleSystem;
  }

  /**
   * Get speed boost system
   * @returns {SpeedBoostSystem} Speed boost system
   */
  getSpeedBoostSystem() {
    return this.speedBoostSystem;
  }

  /**
   * Set game speed (time scale)
   * @param {number} scale - Time scale (1.0 = normal, 2.0 = 2x speed, 0.5 = slow motion)
   * @param {boolean} instant - If true, change instantly without transition
   */
  setTimeScale(scale, instant = false) {
    this.targetTimeScale = Math.max(0.1, Math.min(3.0, scale)); // Clamp between 0.1x and 3x
    if (instant) {
      this.timeScale = this.targetTimeScale;
    }
  }

  /**
   * Get current time scale
   * @returns {number} Current time scale
   */
  getTimeScale() {
    return this.timeScale;
  }

  /**
   * Get target time scale
   * @returns {number} Target time scale
   */
  getTargetTimeScale() {
    return this.targetTimeScale;
  }

  /**
   * Load game state from save data
   * @param {Object} saveData - Saved game state
   * @param {Object} offlineRewards - Offline rewards to apply
   */
  loadGameState(saveData, offlineRewards) {
    try {
      console.log('[GameLoop] Loading game state...');

      // 1. 경제 상태 복원
      if (saveData.economy) {
        this.economySystem.setState(saveData.economy);
        console.log('[GameLoop] Economy restored:', saveData.economy);
      }

      // 2. 오프라인 보상 적용
      if (offlineRewards) {
        if (offlineRewards.ncGained > 0) {
          this.economySystem.earnNC(offlineRewards.ncGained);
        }
        console.log('[GameLoop] Offline rewards applied:', offlineRewards);
      }

      // 3. 타워 복원
      if (saveData.towers && saveData.towers.length > 0) {
        for (const towerData of saveData.towers) {
          this.towerManager.loadTowerFromSave(
            towerData,
            this.economySystem,
            this.towerGrowthSystem,
            offlineRewards?.xpGained || 0
          );
        }
        console.log(`[GameLoop] ${saveData.towers.length} towers restored`);
      }

      // 4. 시간 추적 복원
      if (saveData.timeTracking) {
        this.timeTrackingSystem.loadFromSave(saveData.timeTracking);
        console.log('[GameLoop] Time tracking restored');
      }

      console.log('[GameLoop] Game state loaded successfully');
      return true;
    } catch (error) {
      console.error('[GameLoop] Failed to load game state:', error);
      return false;
    }
  }
}
