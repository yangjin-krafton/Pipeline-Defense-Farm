/**
 * Food spawner system for multiple paths
 */
import { FOOD_STATS_BY_PATH, FOOD_SPAWN_MS, BASE_SPEED } from '../config.js';

export class FoodSpawner {
  constructor(multiPathSystem) {
    this.multiPathSystem = multiPathSystem;
    this.spawnTimer = 0;

    // Paths that can spawn food (stomach paths only)
    this.spawnablePaths = ['rice_stomach', 'dessert_stomach', 'alcohol_stomach'];
  }

  /**
   * Pick a random food profile for a specific path
   * @param {string} pathKey - Path key
   * @returns {Object|null} Random food profile
   */
  _pickFoodForPath(pathKey) {
    const foods = FOOD_STATS_BY_PATH[pathKey];
    if (!foods || foods.length === 0) {
      return null;
    }
    return foods[Math.floor(Math.random() * foods.length)];
  }

  /**
   * Pick a random spawnable path
   * @returns {string} Random path key
   */
  _pickRandomPath() {
    return this.spawnablePaths[Math.floor(Math.random() * this.spawnablePaths.length)];
  }

  /**
   * Spawn a food item on a specific path
   * @param {string} pathKey - Path key (rice_stomach, dessert_stomach, alcohol_stomach)
   * @param {number} initialOffset - Initial offset on path
   */
  spawnFood(pathKey = null, initialOffset = 0) {
    // If no path specified, pick random stomach path
    if (!pathKey) {
      pathKey = this._pickRandomPath();
    }

    const food = this._pickFoodForPath(pathKey);
    if (!food) {
      return;
    }

    // Removed: console.log - too verbose

    this.multiPathSystem.spawn(pathKey, {
      ...food,
      speed: Math.max(52, food.speed + (Math.random() - 0.5) * 8),
      size: Math.max(20, food.size + (Math.random() - 0.5) * 2),
      spin: (Math.random() - 0.5) * 1.8,
      exitThreshold: 25,
      maxHp: food.hp,
      hp: food.hp,
      baseSpeed: food.speed,
      speedScale: Number((food.speed / BASE_SPEED).toFixed(3))
    }, initialOffset);
  }

  /**
   * Update spawner (called each frame)
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.spawnTimer += dt * 1000;

    while (this.spawnTimer >= FOOD_SPAWN_MS) {
      // Spawn on random stomach path
      this.spawnFood();
      this.spawnTimer -= FOOD_SPAWN_MS;
    }
  }
}
