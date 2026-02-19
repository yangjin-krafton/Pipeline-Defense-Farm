import { NUTRITION_CONFIG, ZONE_REWARD_MULTIPLIERS } from '../data/economyDefinitions.js';

export class EconomySystem {
  constructor() {
    this.nutrition = NUTRITION_CONFIG.initialBalance;
  }

  canAfford(cost) {
    return this.nutrition >= cost;
  }

  spend(cost) {
    if (!this.canAfford(cost)) {
      return false;
    }
    this.nutrition -= cost;
    console.log(`Spent ${cost} nutrition, balance: ${this.nutrition}`);
    return true;
  }

  earnFromFood(food, pathKey) {
    const baseReward = food.reward || 10;
    const zoneMultiplier = ZONE_REWARD_MULTIPLIERS[pathKey] || 1.0;
    const finalReward = Math.round(baseReward * zoneMultiplier);

    this.nutrition += finalReward;
    console.log(`Earned ${finalReward} nutrition from ${food.emoji} in ${pathKey}`);
    return finalReward;
  }

  refund(amount) {
    this.nutrition += amount;
  }

  getBalance() {
    return this.nutrition;
  }
}
