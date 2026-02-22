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

    // 성장 시스템 (레벨업)
    this.xp = 0;                    // 현재 XP
    this.level = 1;                 // 현재 레벨
    this.star = 1;                  // 성급 (1~12)
    this.upgradePoints = 1;         // 업그레이드 포인트 (레벨과 동일, 레벨업마다 +1)

    // 성급 보너스 (기본 스탯 가중치)
    this.starBonuses = {
      damageMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      rangeMultiplier: 1.0,
      critChance: 0.0,
      critMultBonus: 0.0
    };

    // 각인 (추후 ImprintSystem에서 관리)
    this.imprints = [];

    // 노드별 각인 횟수 추적
    // Map<nodeNumber, count>
    this.imprintCounts = new Map();

    // Targeting
    this.targetingPolicy = TargetingPolicy.FIRST;
    this.visualRotation = 0;
    this._multiPathSystem = null;

    // Systems (injected)
    this.bulletSystem = bulletSystem;
    this.particleSystem = particleSystem;

    // Upgrade system
    this.upgradeTree = definition.upgradeTree ? new UpgradeTree(definition.upgradeTree, this) : null;

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
    this._multiPathSystem = multiPathSystem;

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

      // Track last target for consecutive hit modules
      this.lastTarget = this.currentTarget.id;

      // Calculate effective attack speed with module bonuses
      let attackSpeedMultiplier = 1.0;
      if (this.upgradeTree) {
        const modules = this.upgradeTree.getAllActiveModules();
        for (const module of modules) {
          if (module.attackSpeedMultiplier && module.attackSpeedMultiplier !== 1.0) {
            attackSpeedMultiplier *= module.attackSpeedMultiplier;
          }
        }
      }

      const effectiveAttackSpeed = this.attackSpeed * this.auraBonuses.attackSpeed * attackSpeedMultiplier;
      this.attackCooldown = 1 / effectiveAttackSpeed;
    }
  }

  attack(food, currentTime = 0) {
    const fireTransform = this.getFireTransform(food);

    // Calculate effective damage with star bonuses
    const effectiveDamage = this.damage * this.starBonuses.damageMultiplier * this.auraBonuses.damage;

    // Create attack context
    let context = {
      tower: this,
      food: food,
      damage: effectiveDamage,
      currentTime: currentTime,
      isCritical: false,
      critChance: this.starBonuses.critChance || 0,
      critMultiplierBonus: this.starBonuses.critMultBonus || 0,
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

    // ===== 트리거 보너스 누적 적용 =====
    // Apply accumulated damage bonuses from TriggerModules
    if (context.damageBonus) {
      context.damage *= (1 + context.damageBonus);
    }

    // Apply critical hit calculation
    let finalCritChance = (context.critChance || 0) + (context.critChanceBonus || 0);

    if (finalCritChance > 0 && Math.random() < finalCritChance) {
      // Base crit multiplier: 2.0
      let critMultiplier = 2.0;

      // Add any crit multiplier bonuses from modules
      if (context.critMultiplierBonus) {
        critMultiplier += context.critMultiplierBonus;
      }

      // Apply critical damage
      context.damage *= critMultiplier;
      context.isCritical = true;
    }

    // Apply armor reduction
    const armorMitigation = Math.max(0, 1 - ((food.armor || 0) * 0.01));
    context.damage *= armorMitigation;

    // Apply status effects to food
    if (context.statusEffects && context.statusEffects.length > 0) {
      this._applyStatusEffects(food, context.statusEffects);
    }

    // Handle onCrit triggers (if critical hit occurred)
    if (context.isCritical && this.upgradeTree) {
      const onCritModules = this.upgradeTree.getAllActiveModules().filter(
        m => m.triggerType === 'onCrit'
      );

      for (const module of onCritModules) {
        // Save pre-crit values
        const preCritDamage = context.damage;
        const preCritStatusEffectCount = context.statusEffects ? context.statusEffects.length : 0;

        // Apply onCrit module
        context = module.apply(context);

        // Apply additional damage from onCrit (if increased)
        const postCritDamage = context.damage;
        if (postCritDamage !== preCritDamage) {
          // Damage already updated by module, no need to recalculate
        }

        // Apply new status effects from onCrit
        if (context.statusEffects && context.statusEffects.length > preCritStatusEffectCount) {
          const newEffects = context.statusEffects.slice(preCritStatusEffectCount);
          this._applyStatusEffects(food, newEffects);
        }
      }
    }

    // Check if kill
    const willKill = food.hp - context.damage <= 0;

    // Fire bullet or instant damage
    if (this.bulletSystem) {
      const bulletColor = this.getTowerBulletColor();
      const projectileSpeed = this.getProjectileSpeed(context);
      const pierceOptions = (context.projectile?.pierceCount > 0) ? {
        pierceCount: context.projectile.pierceCount,
        pierceDamageFalloff: context.projectile.pierceDamageFalloff,
        pierceDistanceBonus: context.projectile.pierceDistanceBonus,
        curveCompensation: context.projectile.curveCompensation,
      } : null;

      const bullet = this.bulletSystem.createBullet(
        fireTransform.x,
        fireTransform.y,
        food,
        context.damage,
        bulletColor,
        projectileSpeed * this.auraBonuses.projectileSpeed,
        5,
        true,
        pierceOptions
      );
      // 관통 체인의 트리거(onHit/onKill)를 처리하기 위해 타워 참조를 주입
      if (bullet) {
        bullet.tower = this;
        bullet.rotation = fireTransform.fireAngle;
        this.configureBulletVisuals(bullet, context, false);
        this.emitBulletSpawnEffect(bullet, context, false);
      }

      // 추가 타격 (노드 10의 secondaryDamage)
      if (context.secondaryDamage > 0) {
        const secondaryBullet = this.bulletSystem.createBullet(
          fireTransform.x,
          fireTransform.y,
          food,
          context.damage * context.secondaryDamage,
          bulletColor,
          projectileSpeed * this.auraBonuses.projectileSpeed,
          4,
          true
        );
        if (secondaryBullet) {
          secondaryBullet.tower = this;
          secondaryBullet.rotation = fireTransform.fireAngle;
          this.configureBulletVisuals(secondaryBullet, context, true);
          this.emitBulletSpawnEffect(secondaryBullet, context, true);
        }
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
   * 관통 체인에서 추가 타격이 발생했을 때 onHit/onKill 트리거 모듈을 발동합니다.
   * BaseTower.attack()과 분리된 흐름으로, 즉시 피해를 다시 계산하지 않고
   * 트리거성 부가효과만 처리합니다.
   *
   * applyDamage가 이미 호출된 상태에서 실행되므로:
   *  - food.hp <= 0 이면 처치로 판단해 forceOnKillResult로 전달
   *  - 남은 hp 기준으로 재판정하지 않아 중복 처리 위험을 줄임
   */
  firePierceHit(food, damage, currentTime = 0) {
    if (!this.upgradeTree) return;

    const wasKill = food.hp <= 0;

    let context = {
      tower: this,
      food,
      damage,
      currentTime,
      statusEffects: [],
      forceOnKillResult: wasKill
    };

    const modules = this.upgradeTree.getAllActiveModules();

    // onHit 먼저 적용(즉시 효과), 이후 onKill 적용(다음 처리용 효과 누적)
    for (const module of modules) {
      if (module.triggerType === 'onHit') {
        context = module.apply(context);
      }
    }
    for (const module of modules) {
      if (module.triggerType === 'onKill') {
        context = module.apply(context);
      }
    }

    if (context.statusEffects?.length > 0) {
      this._applyStatusEffects(food, context.statusEffects);
    }
  }

  /**
   * Get bullet color based on tower type
   * @returns {number[]} RGBA color
   */
  getTowerBulletColor() {
    switch (this.type) {
      case 'enzymeCharge':
        return [0.2, 1.0, 0.8, 1.0]; // Cyan (효소 충전)
      case 'pierceBolt':
        return [0.8, 0.2, 1.0, 1.0]; // Purple (관통 볼트)
      default:
        return [1.0, 1.0, 1.0, 1.0]; // White
    }
  }

  /**
   * Configure per-bullet visual style and impact hook.
   * Override in tower classes for custom projectile rendering/effects.
   * @param {Bullet} bullet
   * @param {Object} context
   * @param {boolean} isSecondary
   */
  configureBulletVisuals(bullet, context, isSecondary = false) {
    const style = this.getBulletRenderStyle(context, isSecondary);
    bullet.renderStyle = {
      stretch: style?.stretch ?? 1.0,
      thickness: style?.thickness ?? 1.0,
      glow: style?.glow ?? 0.3
    };

    bullet.customHitEffect = (particleSystem, target) => {
      this.emitBulletHitEffect(bullet, target, particleSystem, context, isSecondary);
    };
  }

  /**
   * Per-tower projectile render style.
   * @param {Object} context
   * @param {boolean} isSecondary
   * @returns {{stretch:number, thickness:number, glow:number}}
   */
  getBulletRenderStyle(context, isSecondary = false) {
    return { stretch: 1.0, thickness: 1.0, glow: 0.3 };
  }

  /**
   * Spawn effect when bullet is fired.
   * @param {Bullet} bullet
   * @param {Object} context
   * @param {boolean} isSecondary
   */
  emitBulletSpawnEffect(bullet, context, isSecondary = false) {
    if (!this.particleSystem) return;
    this.particleSystem.emitTowerAttackEffect(bullet.x, bullet.y, bullet.color);
  }

  /**
   * Hit effect when bullet applies damage.
   * @param {Bullet} bullet
   * @param {Object} target
   * @param {ParticleSystem} particleSystem
   * @param {Object} context
   * @param {boolean} isSecondary
   */
  emitBulletHitEffect(bullet, target, particleSystem, context, isSecondary = false) {
    if (!particleSystem || !particleSystem.emitHitEffect) return;
    particleSystem.emitHitEffect(bullet.x, bullet.y, bullet.color, bullet.damage);
  }

  /**
   * Get projectile speed for this attack context.
   * Override in tower classes for per-tower speed tuning.
   * @param {Object} context
   * @returns {number}
   */
  getProjectileSpeed(context) {
    return context.projectile?.speed || this.definition?.stats?.projectileSpeed || 300;
  }

  /**
   * Local muzzle angle for the tower emoji at rotation 0.
   * Override per tower because each emoji has a different muzzle direction.
   * @returns {number}
   */
  getTowerMuzzleLocalAngle() {
    return 0;
  }

  /**
   * Muzzle distance from tower center in virtual coordinates.
   * Override if an emoji needs a different muzzle offset.
   * @returns {number}
   */
  getTowerMuzzleDistance() {
    return Math.max(6, this.slotRadius * 0.72);
  }

  /**
   * Resolve target world position.
   * @param {Object} food
   * @param {Object} multiPathSystem
   * @returns {{x:number,y:number}|null}
   */
  getTargetWorldPosition(food, multiPathSystem = this._multiPathSystem) {
    if (!food || !multiPathSystem) return null;
    if (typeof food.currentPath === 'undefined' || typeof food.d !== 'number') return null;
    return multiPathSystem.samplePath(food.currentPath, food.d);
  }

  /**
   * Compute bullet fire origin and current tower visual rotation.
   * @param {Object} food
   * @param {Object} multiPathSystem
   * @returns {{x:number,y:number,towerRotation:number,fireAngle:number}}
   */
  getFireTransform(food, multiPathSystem = this._multiPathSystem) {
    const muzzleLocalAngle = this.getTowerMuzzleLocalAngle();
    let towerRotation = this.visualRotation || 0;
    let fireAngle = towerRotation + muzzleLocalAngle;

    const targetPos = this.getTargetWorldPosition(food, multiPathSystem);
    if (targetPos) {
      const aimAngle = Math.atan2(targetPos.y - this.y, targetPos.x - this.x);
      towerRotation = aimAngle - muzzleLocalAngle;
      fireAngle = aimAngle;
      this.visualRotation = towerRotation;
    }

    const muzzleDistance = this.getTowerMuzzleDistance();
    return {
      x: this.x + Math.cos(fireAngle) * muzzleDistance,
      y: this.y + Math.sin(fireAngle) * muzzleDistance,
      towerRotation,
      fireAngle
    };
  }

  /**
   * Get effective stats with star bonuses applied
   */
  getEffectiveStats() {
    return {
      damage: this.damage * this.starBonuses.damageMultiplier,
      attackSpeed: this.attackSpeed * this.starBonuses.attackSpeedMultiplier,
      range: this.range * this.starBonuses.rangeMultiplier,
      critChance: this.starBonuses.critChance || 0
    };
  }
}
