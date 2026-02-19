import { EfficiencyState, EFFICIENCY_MULTIPLIERS } from './EfficiencyState.js';
import { TargetingPolicy } from './TargetingPolicy.js';

export class BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    this.id = `tower_${Date.now()}_${Math.random()}`;
    this.type = definition.id;
    this.x = slotData.x;
    this.y = slotData.y;
    this.slotRadius = slotData.radius;

    // Stats from definition
    this.damage = definition.stats.damage;
    this.attackSpeed = definition.stats.attackSpeed;
    this.range = definition.stats.range;
    this.tagBonuses = definition.tagBonuses || {};
    this.definition = definition;

    // State
    this.currentTarget = null;
    this.attackCooldown = 0;
    this.efficiencyState = EfficiencyState.NORMAL;
    this.efficiencyEndTime = 0;

    // Nutrition tracking
    this.nutrition = 100; // Start at full
    this.maxNutrition = 100;
    this.lastSupplyTime = 0;
    this.supplyCount = 0;

    // Targeting
    this.targetingPolicy = TargetingPolicy.FIRST;

    // Systems (injected)
    this.bulletSystem = bulletSystem;
    this.particleSystem = particleSystem;
  }

  update(dt, foodList, multiPathSystem, currentTime) {
    // Update efficiency state
    this._updateEfficiencyState(currentTime);

    // Cooldown
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    // Acquire target
    if (!this.currentTarget || this.currentTarget.hp <= 0) {
      this.currentTarget = this.targetingPolicy(this, foodList, multiPathSystem);
    }

    // Validate target still in range
    if (this.currentTarget) {
      const pos = multiPathSystem.samplePath(
        this.currentTarget.currentPath,
        this.currentTarget.d
      );

      if (pos) {
        const dx = pos.x - this.x;
        const dy = pos.y - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > this.range * this.range) {
          this.currentTarget = null;
        }
      } else {
        this.currentTarget = null;
      }
    }

    // Attack if ready
    if (this.currentTarget && this.attackCooldown <= 0) {
      this.attack(this.currentTarget);
      this.attackCooldown = 1 / this.attackSpeed;
    }
  }

  attack(food) {
    const efficiency = EFFICIENCY_MULTIPLIERS[this.efficiencyState];
    let damage = this.damage * efficiency;

    // Tag bonuses
    if (food.tags) {
      for (const tag of food.tags) {
        if (this.tagBonuses[tag]) {
          damage *= this.tagBonuses[tag];
          break; // Only apply first matching tag bonus
        }
      }
    }

    // Apply armor reduction (simple: subtract armor as damage reduction %)
    const armorMitigation = Math.max(0, 1 - (food.armor * 0.01));
    damage *= armorMitigation;

    // Fire bullet instead of instant damage
    if (this.bulletSystem) {
      const bulletColor = this.getTowerBulletColor();
      this.bulletSystem.createBullet(
        this.x,
        this.y,
        food,
        damage,
        bulletColor,
        300, // speed
        5,   // size
        true // homing
      );

      // Emit attack particle effect
      if (this.particleSystem) {
        this.particleSystem.emitTowerAttackEffect(this.x, this.y, bulletColor);
      }
    } else {
      // Fallback: instant damage (backwards compatibility)
      food.hp -= damage;
    }
  }

  /**
   * Get bullet color based on tower type
   * @returns {number[]} RGBA color
   */
  getTowerBulletColor() {
    switch (this.type) {
      case 'enzyme':
        return [0.2, 1.0, 0.2, 1.0]; // Green
      case 'acid':
        return [1.0, 0.5, 0.0, 1.0]; // Orange
      case 'bile':
        return [1.0, 1.0, 0.2, 1.0]; // Yellow
      default:
        return [1.0, 1.0, 1.0, 1.0]; // White
    }
  }

  receiveSupply(amount, currentTime) {
    this.nutrition = Math.min(this.maxNutrition, this.nutrition + amount);
    this.lastSupplyTime = currentTime;
    this.supplyCount++;

    // Determine efficiency state
    if (this.nutrition >= 75) {
      this.efficiencyState = EfficiencyState.OVERCHARGED;
      this.efficiencyEndTime = currentTime + 6; // 6 seconds
    } else {
      this.efficiencyState = EfficiencyState.BOOSTED;
      this.efficiencyEndTime = currentTime + 20; // 20 seconds
    }
  }

  _updateEfficiencyState(currentTime) {
    // Check if boost expired
    if (this.efficiencyEndTime > 0 && currentTime >= this.efficiencyEndTime) {
      this.efficiencyState = EfficiencyState.NORMAL;
      this.efficiencyEndTime = 0;
    }

    // Natural nutrition decay
    // (Future: implement nutrition decay over time)
  }

  getEfficiencyMultiplier() {
    return EFFICIENCY_MULTIPLIERS[this.efficiencyState];
  }
}
