/**
 * Food spawner system for multiple paths
 */
import { FOOD_BY_PATH, FOOD_SPAWN_MS, BASE_SPEED } from '../config.js';

export class FoodSpawner {
  constructor(multiPathSystem) {
    this.multiPathSystem = multiPathSystem;
    this.spawnTimer = 0;

    // Paths that can spawn food (stomach paths only)
    this.spawnablePaths = ['rice_stomach', 'dessert_stomach', 'alcohol_stomach'];
  }

  /**
   * Pick a random emoji for a specific path
   * @param {string} pathKey - Path key
   * @returns {string} Random emoji
   */
  _pickEmojiForPath(pathKey) {
    const emojis = FOOD_BY_PATH[pathKey];
    if (!emojis || emojis.length === 0) {
      return '🍔'; // Fallback
    }
    return emojis[Math.floor(Math.random() * emojis.length)];
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

    const emoji = this._pickEmojiForPath(pathKey);
    console.log(`FoodSpawner: Spawning ${emoji} on ${pathKey}`);

    this.multiPathSystem.spawn(pathKey, {
      emoji: emoji,
      speed: BASE_SPEED + Math.random() * 26,
      size: 28 + Math.random() * 8,
      spin: (Math.random() - 0.5) * 1.8,
      exitThreshold: 25
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
