/**
 * Food spawner system
 */
import { FOOD_EMOJIS, FOOD_SPAWN_MS, BASE_SPEED } from '../config.js';

export class FoodSpawner {
  constructor(pathSystem) {
    this.pathSystem = pathSystem;
    this.spawnTimer = 0;
  }

  /**
   * Pick a random emoji
   * @returns {string} Random emoji
   */
  _pickEmoji() {
    return FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)];
  }

  /**
   * Spawn a food item
   * @param {number} initialOffset - Initial offset on path
   */
  spawnFood(initialOffset = 0) {
    this.pathSystem.spawn({
      emoji: this._pickEmoji(),
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
      this.spawnFood();
      this.spawnTimer -= FOOD_SPAWN_MS;
    }
  }
}
