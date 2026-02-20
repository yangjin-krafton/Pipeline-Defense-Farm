import { TargetingPolicy } from './TargetingPolicy.js';
import { UpgradeTree } from './UpgradeNode.js';

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

    // Growth system (타워 성장)
    this.xp = 0;                    // 현재 XP
    this.level = 1;                 // 현재 레벨
    this.star = 1;                  // 성급 (1~12)
    this.upgradePoints = 5;         // 업그레이드 포인트 (초기 5, 레벨업마다 +1)

    // Star bonuses (승급 스탯 누적)
    this.starBonuses = {
      damageMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      rangeMultiplier: 1.0,
      statusSuccessRate: 0.0
    };

    // Imprints (각인, 향후 ImprintSystem에서 관리)
    this.imprints = [];

    // Targeting
    this.targetingPolicy = TargetingPolicy.FIRST;

    // Systems (injected)
    this.bulletSystem = bulletSystem;
    this.particleSystem = particleSystem;

    // Upgrade system
    this.upgradeTree = definition.upgradeTree ? new UpgradeTree(definition.upgradeTree) : null;

    // Module tracking
    this.lastTarget = null;
    this.consecutiveHits = 0;

    // Aura bonuses from other towers
    this.auraBonuses = {
      range: 1,
      attackSpeed: 1,
      damage: 1,
      projectileSpeed: 1
    };
  }

  update(dt, foodList, multiPathSystem, currentTime) {
    // Cooldown
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    // Acquire target using TargetingModule if available
    if (!this.currentTarget || this.currentTarget.hp <= 0) {
      if (this.upgradeTree) {
        const targetingModules = this.upgradeTree.getActiveModulesByType('TargetingModule');
        if (targetingModules.length > 0) {
          this.currentTarget = targetingModules[0].selectTarget({
            tower: this,
            foodList,
            multiPathSystem
          });
        } else {
          this.currentTarget = this.targetingPolicy(this, foodList, multiPathSystem);
        }
      } else {
        this.currentTarget = this.targetingPolicy(this, foodList, multiPathSystem);
      }
    }

    // Validate target still in range (apply aura bonuses)
    if (this.currentTarget) {
      const effectiveRange = this.range * this.auraBonuses.range;
      const pos = multiPathSystem.samplePath(
        this.currentTarget.currentPath,
        this.currentTarget.d
      );

      if (pos) {
        const dx = pos.x - this.x;
        const dy = pos.y - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > effectiveRange * effectiveRange) {
          this.currentTarget = null;
        }
      } else {
        this.currentTarget = null;
      }
    }

    // Attack if ready (apply aura bonuses)
    if (this.currentTarget && this.attackCooldown <= 0) {
      this.attack(this.currentTarget, currentTime);
      const effectiveAttackSpeed = this.attackSpeed * this.auraBonuses.attackSpeed;
      this.attackCooldown = 1 / effectiveAttackSpeed;
    }
  }

  attack(food, currentTime = 0) {
    // Calculate effective damage with star bonuses
    const effectiveDamage = this.damage * this.starBonuses.damageMultiplier * this.auraBonuses.damage;

    // Create attack context
    let context = {
      tower: this,
      food: food,
      damage: effectiveDamage,
      currentTime: currentTime,
      isCritical: false,
      critChance: 0,
      statusEffects: [],
      onKillEffects: [],
      projectile: null,
      gainNutrition: 0,
      gainEnergy: 0,
      chargeRefund: 0
    };

    // Apply base tag bonuses (legacy support)
    if (food.tags) {
      for (const tag of food.tags) {
        if (this.tagBonuses[tag]) {
          context.damage *= this.tagBonuses[tag];
          break;
        }
      }
    }

    // Apply all active modules
    if (this.upgradeTree) {
      const modules = this.upgradeTree.getAllActiveModules();
      for (const module of modules) {
        context = module.apply(context);
      }
    }

    // Apply armor reduction
    const armorMitigation = Math.max(0, 1 - (food.armor * 0.01));
    context.damage *= armorMitigation;

    // Apply status effects to food
    if (context.statusEffects && context.statusEffects.length > 0) {
      this._applyStatusEffects(food, context.statusEffects);
    }

    // Check if kill
    const willKill = food.hp - context.damage <= 0;

    // Fire bullet or instant damage
    if (this.bulletSystem) {
      const bulletColor = this.getTowerBulletColor();
      const projectileSpeed = context.projectile?.speed || 300;

      this.bulletSystem.createBullet(
        this.x,
        this.y,
        food,
        context.damage,
        bulletColor,
        projectileSpeed * this.auraBonuses.projectileSpeed,
        5,
        true
      );

      if (this.particleSystem) {
        this.particleSystem.emitTowerAttackEffect(this.x, this.y, bulletColor);
      }
    } else {
      food.hp -= context.damage;
    }

    // Handle resource gains on kill
    if (willKill) {
      if (context.gainNutrition > 0) {
        this.nutrition = Math.min(this.maxNutrition, this.nutrition + context.gainNutrition);
      }
      // TODO: Handle energy gains when economy system is ready

      // Handle on-kill effects
      if (context.onKillEffects && context.onKillEffects.length > 0) {
        this._applyOnKillEffects(food, context.onKillEffects);
      }
    }
  }

  /**
   * Apply status effects to food
   */
  _applyStatusEffects(food, effects) {
    if (!food.statusEffects) food.statusEffects = [];

    for (const effect of effects) {
      // Simple implementation: just store effects
      // Actual status effect processing should be in enemy/food update logic
      food.statusEffects.push({
        type: effect.type,
        value: effect.value,
        duration: effect.duration,
        appliedTime: Date.now()
      });
    }
  }

  /**
   * Apply on-kill effects
   */
  _applyOnKillEffects(food, effects) {
    // TODO: Implement explosion, chain effects, etc.
    // This requires access to nearby enemies and particle system
  }

  /**
   * Get bullet color based on tower type
   * @returns {number[]} RGBA color
   */
  getTowerBulletColor() {
    switch (this.type) {
      case 'acidRail':
        return [1.0, 0.3, 0.0, 1.0]; // Red-Orange (위산 레일)
      case 'enzymeCharge':
        return [0.2, 1.0, 0.8, 1.0]; // Cyan (효소 축전)
      case 'pierceBolt':
        return [0.8, 0.2, 1.0, 1.0]; // Purple (관통 볼트)
      default:
        return [1.0, 1.0, 1.0, 1.0]; // White
    }
  }

  /**
   * Get effective stats with star bonuses applied
   */
  getEffectiveStats() {
    return {
      damage: this.damage * this.starBonuses.damageMultiplier,
      attackSpeed: this.attackSpeed * this.starBonuses.attackSpeedMultiplier,
      range: this.range * this.starBonuses.rangeMultiplier,
      statusSuccessRate: this.starBonuses.statusSuccessRate
    };
  }
}
