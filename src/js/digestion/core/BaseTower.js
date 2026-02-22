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

    // Growth system (????깆옣)
    this.xp = 0;                    // ?꾩옱 XP
    this.level = 1;                 // ?꾩옱 ?덈꺼
    this.star = 1;                  // ?깃툒 (1~12)
    this.upgradePoints = 1;         // ?낃렇?덉씠???ъ씤??(?덈꺼怨??숈씪, ?덈꺼?낅쭏??+1)

    // Star bonuses (?밴툒 ?ㅽ꺈 ?꾩쟻)
    this.starBonuses = {
      damageMultiplier: 1.0,
      attackSpeedMultiplier: 1.0,
      rangeMultiplier: 1.0,
      statusSuccessRate: 0.0
    };

    // Imprints (媛곸씤, ?ν썑 ImprintSystem?먯꽌 愿由?
    this.imprints = [];

    // Imprint count per node (?몃뱶蹂?媛곸씤 ?잛닔 異붿쟻)
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

    // ===== ?몃━嫄?蹂대꼫???꾩쟻 ?곸슜 =====
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
      // 愿??泥댁씤 ?몃━嫄?onHit/onKill)瑜?泥섎━?섍린 ?꾪빐 ????덊띁?곗뒪 二쇱엯
      if (bullet) {
        bullet.tower = this;
        bullet.rotation = fireTransform.fireAngle;
        this.configureBulletVisuals(bullet, context, false);
        this.emitBulletSpawnEffect(bullet, context, false);
      }

      // 異붽? ?寃?(?몃뱶 10 ??secondaryDamage)
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
   * 愿??泥댁씤?먯꽌 異붽? ?寃??곸쨷/泥섏튂 ???몃━嫄?紐⑤뱢??諛쒕룞?⑸땲??
   * BaseTower.attack()怨??щ━ ?쇳빐 ?ш퀎?곗? ?섏? ?딄퀬, onHit/onKill ?ъ씠???댄럺?몃쭔 泥섎━?⑸땲??
   *
   * applyDamage媛 ?대? ?몄텧???곹깭?먯꽌 ?ㅽ뻾?섎?濡?
   *  - food.hp <= 0 ??泥섏튂 ?먯젙 (forceOnKillResult濡?TriggerModule???꾨떖)
   *  - food.hp - context.damage 怨듭떇? ?대? 媛먯냼??hp ?뚮Ц???ㅽ뙋 媛?????ㅻ쾭?쇱씠???꾩슂
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

    // onHit 癒쇱? (?ㅽ깮 ?뚮퉬), onKill ?섏쨷 (?ㅼ쓬 ?룹쓣 ?꾪븳 ?ㅽ깮 ?곷┰)
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
      case 'acidRail':
        return [0.22, 1.0, 0.32, 1.0]; // Red-Orange (?꾩궛 ?덉씪)
      case 'enzymeCharge':
        return [0.2, 1.0, 0.8, 1.0]; // Cyan (?⑥냼 異뺤쟾)
      case 'pierceBolt':
        return [0.8, 0.2, 1.0, 1.0]; // Purple (愿??蹂쇳듃)
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
      statusSuccessRate: this.starBonuses.statusSuccessRate
    };
  }
}
