import { BaseTower } from '../core/BaseTower.js';

export class AcidTower extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);
    this.armorReduction = definition.stats.armorReduction || 0;
  }

  attack(food) {
    // Apply armor reduction before damage
    if (this.armorReduction > 0) {
      food.armor = Math.max(0, food.armor - this.armorReduction);
    }
    super.attack(food);
  }
}
