import { BaseTower } from '../core/BaseTower.js';
import { UpgradeNode } from '../core/UpgradeNode.js';
import {
  ProjectileModule,
  DamageModule,
  TagBonusModule,
  TriggerModule,
  TriggerEffects,
  ResourceModule,
  SafetyModule
} from '../core/modules/index.js';

/**
 * 효소 축전 캐논 (Enzyme Charge Cannon)
 * 단일 화력 타워 - 타이밍 기반 단일 고점
 */
export class EnzymeChargeCannon extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);

    // 충전 시스템
    this.chargeLevel = 0; // 0~100
    this.maxCharge = 100;
    this.chargeRate = 25; // 초당 충전량
    this.minChargeToFire = 100; // 기본: 완충 필요
    this.lastChargeTime = Date.now();
    this.isCharging = true;
  }

  // 🔋 emoji 기준: 기본 자세에서 방출 방향을 상단(-90deg)으로 가정.
  getTowerMuzzleLocalAngle() {
    return -Math.PI / 2;
  }

  update(dt, foodList, multiPathSystem, currentTime) {
    // ===== 모듈 스탯 통합 계산 (한 번만 순회) =====
    let chargeRateMultiplier = 1.0;
    let moduleRangeMultiplier = 1.0;
    let attackSpeedMultiplier = 1.0;
    let effectiveMinChargeToFire = this.maxCharge; // 기본: 완충 필요
    let incompleteFirPenaltyReduction = 0;

    if (this.upgradeTree) {
      const modules = this.upgradeTree.getAllActiveModules();
      for (const module of modules) {
        if (module.chargeRateBonus > 0) chargeRateMultiplier += module.chargeRateBonus;
        if (module.rangeMultiplier && module.rangeMultiplier !== 1.0) moduleRangeMultiplier *= module.rangeMultiplier;
        if (module.attackSpeedMultiplier && module.attackSpeedMultiplier !== 1.0) attackSpeedMultiplier *= module.attackSpeedMultiplier;
        if (module.minChargeToFire > 0) {
          effectiveMinChargeToFire = Math.min(effectiveMinChargeToFire, module.minChargeToFire * this.maxCharge);
        }
        if (module.incompleteFirPenaltyReduction > 0) incompleteFirPenaltyReduction += module.incompleteFirPenaltyReduction;
      }
    }
    this.minChargeToFire = effectiveMinChargeToFire;
    this._incompleteFirPenaltyReduction = incompleteFirPenaltyReduction;
    this._moduleRangeMultiplier = moduleRangeMultiplier;
    this._attackSpeedMultiplier = attackSpeedMultiplier;
    this._multiPathSystem = multiPathSystem; // 노드 5 장거리 판정에서 사용

    // 충전 로직
    if (this.isCharging && this.chargeLevel < this.maxCharge) {
      const prevChargeLevel = this.chargeLevel;
      this.chargeLevel = Math.min(this.maxCharge, this.chargeLevel + this.chargeRate * chargeRateMultiplier * dt);

      // 충전 중 파티클 효과 (일정 간격으로)
      if (this.particleSystem && this.particleSystem.emitChargingPulse) {
        this.particleSystem.emitChargingPulse(
          this.x,
          this.y,
          this.getChargeBulletColor(this.chargeLevel),
          this.chargeLevel
        );
      }

      // 완충 도달 시 특별 효과
      if (prevChargeLevel < this.maxCharge && this.chargeLevel >= this.maxCharge) {
        this.onFullChargeReached();
      }
    }

    // 공격 가능 상태 체크
    if (this.chargeLevel >= this.minChargeToFire) {
      // BaseTower의 update 로직을 직접 구현 (공격속도 계산 포함)
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);

      // Acquire target
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

      // Validate target still in range
      if (this.currentTarget) {
        const effectiveRange = this.range * this.auraBonuses.range * moduleRangeMultiplier;
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

      // Attack if ready
      if (this.currentTarget && this.attackCooldown <= 0) {
        this.attack(this.currentTarget, currentTime);

        // Track last target for consecutive hit modules
        this.lastTarget = this.currentTarget.id;

        const effectiveAttackSpeed = this.attackSpeed * this.auraBonuses.attackSpeed * attackSpeedMultiplier;
        this.attackCooldown = 1 / effectiveAttackSpeed;
      }
    } else {
      // 충전 중이면 타겟만 유지
      if (!this.currentTarget || this.currentTarget.hp <= 0) {
        this.currentTarget = this.targetingPolicy(this, foodList, multiPathSystem);
      }
    }
  }

  /**
   * 완충 도달 시 호출되는 메서드
   */
  onFullChargeReached() {
    // 완충 도달 효과 (한 번만 재생)
    if (this.particleSystem && this.particleSystem.emitChargeCannonEffect) {
      const fullChargeColor = [0.6, 1.0, 0.95, 1.0]; // 밝은 청록색
      this.particleSystem.emit(
        this.x,
        this.y,
        12,
        fullChargeColor,
        80,
        0.4,
        {
          spread: Math.PI * 2,
          gravity: 20,
          sizeMin: 3,
          sizeMax: 6,
          colorVariation: 0.1
        }
      );
    }
  }

  /**
   * Heavy cannon shell style.
   * Charged shots become thicker, brighter, and slightly more elongated.
   */
  getBulletRenderStyle(context, isSecondary = false) {
    const maxCharge = context?.maxCharge || this.maxCharge || 100;
    const chargeLevel = Number.isFinite(context?.chargeLevel) ? context.chargeLevel : this.chargeLevel;
    const chargePct = Math.max(0, Math.min(1, chargeLevel / maxCharge));

    if (isSecondary) {
      return {
        stretch: 1.45 + chargePct * 0.45,
        thickness: 0.90 + chargePct * 0.18,
        glow: 0.34 + chargePct * 0.22
      };
    }

    return {
      stretch: 1.25 + chargePct * 0.70,
      thickness: 1.10 + chargePct * 0.30,
      glow: 0.42 + chargePct * 0.35
    };
  }

  /**
   * Cannon muzzle effect: forward blast + back pressure smoke.
   */
  emitBulletSpawnEffect(bullet, context, isSecondary = false) {
    if (!this.particleSystem) return;

    const forward = Number.isFinite(bullet.rotation) ? bullet.rotation : 0;
    const maxCharge = context?.maxCharge || this.maxCharge || 100;
    const chargeLevel = Number.isFinite(context?.chargeLevel) ? context.chargeLevel : this.chargeLevel;
    const chargePct = Math.max(0, Math.min(1, chargeLevel / maxCharge));
    const isFullCharge = chargePct >= 0.999;

    const coreColor = bullet.color || [0.2, 0.2, 0.2, 1.0];
    const flashColor = [
      Math.min(1, coreColor[0] + 0.45),
      Math.min(1, coreColor[1] + 0.25),
      Math.min(1, coreColor[2] + 0.2),
      0.95
    ];
    const smokeColor = [
      coreColor[0] * 0.45 + 0.20,
      coreColor[1] * 0.50 + 0.20,
      coreColor[2] * 0.50 + 0.20,
      0.72
    ];

    this.particleSystem.emit(
      bullet.x,
      bullet.y,
      isSecondary ? 5 : Math.floor(6 + chargePct * 6),
      flashColor,
      150 + chargePct * 180,
      0.20 + chargePct * 0.10,
      {
        spread: Math.PI / 2.8,
        direction: forward,
        gravity: 60,
        sizeMin: isSecondary ? 7 : 9,
        sizeMax: isSecondary ? 11 + chargePct * 2 : 14 + chargePct * 5,
        colorVariation: 0.16
      }
    );

    this.particleSystem.emit(
      bullet.x,
      bullet.y,
      isSecondary ? 7 : Math.floor(8 + chargePct * 8),
      smokeColor,
      70 + chargePct * 70,
      0.28 + chargePct * 0.14,
      {
        spread: Math.PI / 2.2,
        direction: forward + Math.PI,
        gravity: 85,
        sizeMin: isSecondary ? 8 : 10,
        sizeMax: isSecondary ? 13 + chargePct * 2 : 17 + chargePct * 4,
        colorVariation: 0.12
      }
    );

    if (!isSecondary && this.particleSystem.emitChargeCannonEffect) {
      this.particleSystem.emitChargeCannonEffect(this.x, this.y, coreColor, chargeLevel);
    }

    if (isFullCharge && !isSecondary) {
      const overflash = [1.0, 1.0, 0.92, 0.9];
      this.particleSystem.emit(
        bullet.x,
        bullet.y,
        10,
        overflash,
        240,
        0.18,
        {
          spread: Math.PI / 3,
          direction: forward,
          gravity: 20,
          sizeMin: 5,
          sizeMax: 9,
          colorVariation: 0.08
        }
      );
    }
  }

  /**
   * Cannon impact effect: explosive burst with directional debris.
   */
  emitBulletHitEffect(bullet, target, particleSystem, context, isSecondary = false) {
    if (!particleSystem) return;

    const forward = Number.isFinite(bullet.rotation)
      ? bullet.rotation
      : Math.atan2(bullet.lastDirY || 0, bullet.lastDirX || 1);

    const maxCharge = context?.maxCharge || this.maxCharge || 100;
    const chargeLevel = Number.isFinite(context?.chargeLevel) ? context.chargeLevel : this.chargeLevel;
    const chargePct = Math.max(0, Math.min(1, chargeLevel / maxCharge));

    const coreColor = bullet.color || [0.2, 1.0, 0.8, 1.0];
    const burstColor = [
      Math.min(1, coreColor[0] + 0.35),
      Math.min(1, coreColor[1] + 0.25),
      Math.min(1, coreColor[2] + 0.2),
      0.95
    ];
    const debrisColor = [
      coreColor[0] * 0.80 + 0.08,
      coreColor[1] * 0.80 + 0.08,
      coreColor[2] * 0.80 + 0.08,
      0.86
    ];

    particleSystem.emit(
      bullet.x,
      bullet.y,
      isSecondary ? 6 : Math.floor(7 + chargePct * 8),
      burstColor,
      180 + chargePct * 170,
      0.30 + chargePct * 0.14,
      {
        spread: Math.PI * 1.1,
        direction: forward,
        gravity: 250,
        sizeMin: isSecondary ? 9 : 12,
        sizeMax: isSecondary ? 14 + chargePct * 2 : 18 + chargePct * 4,
        colorVariation: 0.18
      }
    );

    particleSystem.emit(
      bullet.x,
      bullet.y,
      isSecondary ? 8 : Math.floor(10 + chargePct * 10),
      debrisColor,
      130 + chargePct * 130,
      0.34 + chargePct * 0.10,
      {
        spread: Math.PI * 1.7,
        direction: forward + 0.08,
        gravity: 300,
        sizeMin: isSecondary ? 7 : 9,
        sizeMax: isSecondary ? 12 + chargePct * 2 : 15 + chargePct * 3,
        colorVariation: 0.2
      }
    );

    particleSystem.emitHitEffect(bullet.x, bullet.y, bullet.color, bullet.damage);
  }

  /**
   * Configure renderer-only projectile animation profile.
   * - arcScaleProfile: small -> big -> small
   * - colorProfile: start -> apex -> landing tint
   */
  configureBulletVisuals(bullet, context, isSecondary = false) {
    super.configureBulletVisuals(bullet, context, isSecondary);

    const chargeLevel = Number.isFinite(context?.chargeLevel) ? context.chargeLevel : this.chargeLevel;
    bullet.arcScaleProfile = this.getBulletArcScaleProfile(chargeLevel, isSecondary);
    bullet.colorProfile = this.getBulletColorProfile(chargeLevel, isSecondary);
    bullet.arcUseDistanceProgress = true;
  }

  getArcFlightDuration(context, speedMultiplier = 1.0) {
    const fireTransform = context?.fireTransform;
    const food = context?.food;
    const targetPos = fireTransform && food ? this.getTargetWorldPosition(food) : null;
    const baseSpeed = Number.isFinite(context?.projectileSpeed) ? context.projectileSpeed : this.definition?.stats?.projectileSpeed;
    const effectiveSpeed = Math.max(1, (baseSpeed || 300) * speedMultiplier);

    if (targetPos && fireTransform) {
      const dx = targetPos.x - fireTransform.x;
      const dy = targetPos.y - fireTransform.y;
      const distance = Math.hypot(dx, dy);
      return Math.max(0.16, Math.min(0.55, distance / effectiveSpeed));
    }

    return 0.32;
  }

  getBulletArcScaleProfile(chargeLevel, isSecondary = false) {
    const chargePct = Math.max(0, Math.min(1, chargeLevel / (this.maxCharge || 100)));

    if (isSecondary) {
      return {
        startScale: 0.72,
        peakScale: 1.18 + chargePct * 0.16,
        endScale: 0.70,
        liftPixels: 4 + chargePct * 3
      };
    }

    return {
      startScale: 0.76,
      peakScale: 1.36 + chargePct * 0.24,
      endScale: 0.74,
      liftPixels: 6 + chargePct * 4
    };
  }

  getBulletColorProfile(chargeLevel, isSecondary = false) {
    const base = isSecondary
      ? this.getSecondaryBulletColor(chargeLevel)
      : this.getChargeBulletColor(chargeLevel);
    const bright = [
      Math.min(1, base[0] + 0.18),
      Math.min(1, base[1] + 0.16),
      Math.min(1, base[2] + 0.14),
      Math.min(1, base[3] + 0.02)
    ];
    const land = [
      Math.max(0, base[0] * 0.92),
      Math.max(0, base[1] * 0.90),
      Math.max(0, base[2] * 0.88),
      Math.max(0.45, base[3] * 0.90)
    ];

    return {
      start: base,
      peak: bright,
      end: land
    };
  }

  attack(food, currentTime = 0) {
    // 충전이 충분하지 않으면 공격 불가
    if (this.chargeLevel < this.minChargeToFire) return;

    // 충전량에 비례한 피해 배율 계산
    // 미완충 페널티 감소 적용 (노드 6: 고속 재축전 루프)
    const isFullCharge = this.chargeLevel >= this.maxCharge;
    let chargeMultiplier = this.chargeLevel / 100;
    if (!isFullCharge && this._incompleteFirPenaltyReduction > 0) {
      const penalty = 1 - chargeMultiplier;
      chargeMultiplier = chargeMultiplier + penalty * this._incompleteFirPenaltyReduction;
    }

    // Context에 충전 정보 추가
    const originalDamage = this.damage;
    this.damage = originalDamage * chargeMultiplier;

    // 충전도에 따른 총알 비주얼 설정
    const bulletColor = this.getChargeBulletColor(this.chargeLevel);
    const bulletSize = this.getChargeBulletSize(this.chargeLevel);
    const projectileSpeed = this.definition.stats.projectileSpeed * this.auraBonuses.projectileSpeed;

    const fireTransform = this.getFireTransform(food);

    // 총알 생성 (BaseTower의 기본 로직 대신 직접 생성)
    if (this.bulletSystem) {
      // Create attack context (BaseTower와 동일한 방식)
      let context = {
        tower: this,
        food: food,
        damage: this.damage * this.starBonuses.damageMultiplier * this.auraBonuses.damage,
        currentTime: currentTime,
        isCritical: false,
        critChance: 0,
        statusEffects: [],
        onKillEffects: [],
        projectile: null,
        gainNutrition: 0,
        gainEnergy: 0,
        chargeRefund: 0,
        chargeLevel: this.chargeLevel,
        maxCharge: this.maxCharge,
        fireTransform,
        projectileSpeed,
        // 이전 공격에서 설정된 버프 스냅샷 (same-attack 소모 방지)
        // 노드 3: onKill 버프가 이번 공격 전에 존재했는지 여부
        killBuffStacksPreAttack: (this.killBuffStacks || 0),
        // 노드 11: 타이밍 버스트 버프가 이번 공격 전에 활성이었는지 여부
        timingBurstActivePreAttack: (this.timingBurstActive === true)
      };

      // Apply base tag bonuses
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

      // 총알 생성 (충전도에 따른 크기/색상)
      const bullet = this.bulletSystem.createBullet(
        fireTransform.x,
        fireTransform.y,
        food,
        context.damage,
        bulletColor,
        projectileSpeed,
        bulletSize,
        true
      );
      if (bullet) {
        bullet.tower = this;
        bullet.rotation = fireTransform.fireAngle;
        this.configureBulletVisuals(bullet, context, false);
        this.emitBulletSpawnEffect(bullet, context, false);
      }

      // 2차 타격 적용 (노드 10: 완충 임계 붕괴 - 완충 샷이 체력 60%+ 대상에 추가 피해)
      // homing=true: 적은 x/y가 없고 currentPath+d로만 위치를 가지므로
      //             비유도(homing=false)는 생성자에서 dirX/dirY=NaN이 되어 동작 불가
      if (context.secondaryDamage && context.secondaryDamage > 0) {
        const secondaryBullet = this.bulletSystem.createBullet(
          fireTransform.x,
          fireTransform.y,
          food,
          context.secondaryDamage,
          this.getSecondaryBulletColor(this.chargeLevel),
          projectileSpeed * 1.3,
          bulletSize * 0.6,
          true  // homing=true: samplePath 기반 추적
        );
        if (secondaryBullet) {
          secondaryBullet.tower = this;
          secondaryBullet.rotation = fireTransform.fireAngle;
          this.configureBulletVisuals(secondaryBullet, context, true);
          this.emitBulletSpawnEffect(secondaryBullet, context, true);
        }
      }

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
    }

    // 원복
    this.damage = originalDamage;

    // 충전 소모
    this.chargeLevel = 0;
    // 충전 환급 적용 (노드 7: 폭발 반응 촉매 - 처치 시 다음 샷 충전 +10%)
    if (this.chargeRefundBonus > 0) {
      this.chargeLevel = Math.min(this.maxCharge, this.maxCharge * this.chargeRefundBonus / 100);
      this.chargeRefundBonus = 0;
    }
    this.isCharging = true;
  }

  /**
   * 충전도에 따른 총알 색상 반환
   * @param {number} chargeLevel - 현재 충전 레벨 (0~100)
   * @returns {number[]} RGBA 색상
   */
  getChargeBulletColor(chargeLevel) {
    const chargePct = chargeLevel / 100; // 0~1

    if (chargePct >= 1.0) {
      // 완충: 밝은 청록색 + 노란빛
      return [0.4, 1.0, 0.9, 1.0];
    } else if (chargePct >= 0.7) {
      // 고충전: 청록색
      return [0.2, 0.95, 0.85, 1.0];
    } else if (chargePct >= 0.5) {
      // 중간 충전: 약간 어두운 청록색
      return [0.15, 0.8, 0.7, 1.0];
    } else {
      // 저충전: 어두운 청록색
      return [0.1, 0.6, 0.55, 0.9];
    }
  }

  getSecondaryBulletColor(chargeLevel) {
    const chargePct = Math.max(0, Math.min(1, chargeLevel / (this.maxCharge || 100)));
    return [
      0.45 + 0.20 * chargePct,
      0.95 + 0.05 * chargePct,
      0.40 + 0.18 * chargePct,
      0.70 + 0.15 * chargePct
    ];
  }

  /**
   * 충전도에 따른 총알 크기 반환
   * @param {number} chargeLevel - 현재 충전 레벨 (0~100)
   * @returns {number} 총알 크기 (픽셀)
   */
  getChargeBulletSize(chargeLevel) {
    const chargePct = chargeLevel / 100; // 0~1
    const baseSize = 5;
    const maxBonusSize = 7; // 완충 시 +7 (총 12픽셀)

    return baseSize + (maxBonusSize * chargePct);
  }

  /**
   * Apply status effects to food (BaseTower 메서드 복사)
   */
  _applyStatusEffects(food, effects) {
    if (!food.statusEffects) food.statusEffects = [];

    for (const effect of effects) {
      food.statusEffects.push({
        type: effect.type,
        value: effect.value,
        duration: effect.duration,
        appliedTime: Date.now()
      });
    }
  }
}

/**
 * 효소 축전 캐논 업그레이드 노드 생성
 * 2026-02-22 재설계: 완충폭딜/유연운영/연계폭발
 *
 * 각인 중복 메커니즘:
 * - DamageModule.damageMultiplier: 곱연산 중첩 (1.12 × 1.12 × 1.12)
 * - DamageModule.critDamageBonus: 가산 중첩 (+0.20 + 0.20 + 0.20)
 * - DamageModule.critChanceBonus: 가산 중첩 (+0.12 + 0.12 + 0.12)
 * - ProjectileModule.rangeMultiplier: 곱연산 중첩 (1.10 × 1.10 × 1.10)
 * - ProjectileModule.chargeRateBonus: 가산 중첩 (+0.08 + 0.08 + 0.08)
 * - TriggerModule.damageBonus: 가산 중첩 (+16% + 16% + 16%)
 * - SafetyModule.overheatingReduction: 가산 중첩 (0.20 + 0.20 + 0.20)
 */
export function createEnzymeChargeCannonUpgradeNodes() {
  return [
    // 1. 완충 압축 코어 (DM)
    // 각인 중복 시: 기본 피해 곱연산(×1.12^n), 치명타 배율 가산(+0.20×n)
    new UpgradeNode({
      id: 'enzymecharge_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '완충 압축 코어',
      modules: [
        new DamageModule({
          damageMultiplier: 1.12,  // 완충 피해 +12% [각인 중복: 곱연산]
          critDamageBonus: 0.20    // 치명타 배율 +0.20 [각인 중복: 가산]
        })
      ],
      effect: '완충 피해 +12%, 치명타 배율 +0.20',
      prerequisites: [],
      ncCostMultiplier: 0.10
    }),

    // 2. 유동 조준 포커스 (PM+TM)
    // 각인 중복 시: 사거리 곱연산(×1.10^n), 충전 속도 가산(+8%×n)
    new UpgradeNode({
      id: 'enzymecharge_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '유동 조준 포커스',
      modules: [
        new ProjectileModule({
          rangeMultiplier: 1.10,     // 사거리 +10% [각인 중복: 곱연산]
          chargeRateBonus: 0.08      // 충전 시간 -8% (충전 속도 증가) [각인 중복: 가산]
        })
      ],
      effect: '사거리 +10%, 충전 시간 -8%',
      prerequisites: [],
      ncCostMultiplier: 0.10
    }),

    // 3. 연쇄 기폭 축전지 (TR+DM)
    // 각인 중복 시: 처치 후 버프 피해 곱연산(×1.16^n)
    new UpgradeNode({
      id: 'enzymecharge_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '연쇄 기폭 축전지',
      modules: [
        new TriggerModule({
          triggerType: 'onKill',
          triggerEffect: (ctx) => {
            // 처치 후 다음 1샷 피해 +16% 버프 활성화
            if (!ctx.tower.killBuffStacks) ctx.tower.killBuffStacks = 0;
            ctx.tower.killBuffStacks = 1;
            return {};
          }
        }),
        new DamageModule({
          damageMultiplier: 1.16,  // 처치 버프 활성 시 피해 +16% [각인 중복: 곱연산]
          conditionalCheck: (ctx) => {
            // 이전 공격에서 설정된 버프 스냅샷으로 판정 (same-attack 즉시 소모 방지)
            const hasBuff = ctx.killBuffStacksPreAttack > 0;
            if (hasBuff) {
              ctx.tower.killBuffStacks = 0; // 소모
            }
            return hasBuff;
          }
        })
      ],
      effect: '처치 후 다음 1샷 피해 +16%',
      prerequisites: [],
      ncCostMultiplier: 0.10
    }),

    // 4. 임계 과충전 (DM+TR)
    // 각인 중복 시: 완충 시 피해 곱연산(×1.18^n)
    new UpgradeNode({
      id: 'enzymecharge_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '임계 과충전',
      modules: [
        new DamageModule({
          damageMultiplier: 1.18,  // 완충 상태 추가 피해 +18% [각인 중복: 곱연산]
          conditionalCheck: (ctx) => {
            // 완충 상태 적중 시
            return ctx.tower.chargeLevel >= ctx.tower.maxCharge;
          }
        })
      ],
      effect: '완충 상태 적중 시 추가 피해 +18%',
      prerequisites: [[1]],
      ncCostMultiplier: 0.12
    }),

    // 5. 점막 장거리 보정 (PM+DM)
    // 각인 중복 시: 장거리 피해 곱연산(×1.14^n)
    new UpgradeNode({
      id: 'enzymecharge_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '점막 장거리 보정',
      modules: [
        new ProjectileModule({
          longRangeBonus: 0.14,      // 장거리 피해 보너스 [각인 중복: 가산]
          longRangeThreshold: 0.70   // 사거리 70% 이상
        }),
        new DamageModule({
          damageMultiplier: 1.14,    // 장거리 피해 +14% [각인 중복: 곱연산]
          conditionalCheck: (ctx) => {
            // 장거리 판정 (사거리 70% 이상) - 타겟의 실제 경로 위치 기반
            let distance;
            const tower = ctx.tower;
            if (tower._multiPathSystem && ctx.food.currentPath !== undefined && ctx.food.d !== undefined) {
              const pos = tower._multiPathSystem.samplePath(ctx.food.currentPath, ctx.food.d);
              if (pos) {
                distance = Math.hypot(tower.x - pos.x, tower.y - pos.y);
              }
            }
            if (distance === undefined) {
              // fallback: food에 직접 유효한 좌표가 있을 때만 사용
              // undefined를 0으로 대체하면 원점 기준으로 오판정하므로 수치 타입만 허용
              if (typeof ctx.food.x === 'number' && typeof ctx.food.y === 'number') {
                distance = Math.hypot(tower.x - ctx.food.x, tower.y - ctx.food.y);
              } else {
                return false; // 위치 정보 없음 - 장거리 판정 불가
              }
            }
            const effectiveRange = tower.range * (tower._moduleRangeMultiplier || 1.0);
            return distance >= effectiveRange * 0.70;
          }
        })
      ],
      effect: '장거리(사거리 70%+) 명중 시 피해 +14%',
      prerequisites: [[2]],
      ncCostMultiplier: 0.12
    }),

    // 6. 고속 재축전 루프 (PM+SF)
    // 각인 중복 시: 충전 속도 가산(+12%×n), 페널티 감소 가산(+10%p×n)
    new UpgradeNode({
      id: 'enzymecharge_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '고속 재축전 루프',
      modules: [
        new ProjectileModule({
          chargeRateBonus: 0.12      // 충전 시간 -12% [각인 중복: 가산]
        }),
        new SafetyModule({
          minChargeToFire: 0.50,     // 50% 이상 발사 가능
          incompleteFirPenaltyReduction: 0.10  // 미완충 페널티 -10%p [각인 중복: 가산]
        })
      ],
      effect: '충전 시간 -12%, 미완충 발사 피해 페널티 -10%p',
      prerequisites: [[3]],
      ncCostMultiplier: 0.12
    }),

    // 7. 폭발 반응 촉매 (TB+TR+DM)
    // 각인 중복 시: 디버프 대상 피해 곱연산(×1.12^n), 충전 환급 가산(+10%×n)
    new UpgradeNode({
      id: 'enzymecharge_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '폭발 반응 촉매',
      modules: [
        new DamageModule({
          damageMultiplier: 1.12,    // 디버프 대상 피해 +12% [각인 중복: 곱연산]
          conditionalCheck: (ctx) => {
            // 디버프 대상 판정 (statusEffects 스키마 사용)
            return ctx.food.statusEffects && ctx.food.statusEffects.length > 0;
          }
        }),
        new TriggerModule({
          triggerType: 'onKill',
          triggerEffect: (ctx) => {
            // 처치 시 다음 샷 충전 +10% [각인 중복: 가산]
            if (!ctx.tower.chargeRefundBonus) ctx.tower.chargeRefundBonus = 0;
            ctx.tower.chargeRefundBonus += 10;
            return {};
          }
        })
      ],
      effect: '디버프 대상 명중 시 추가 피해 +12%, 처치 시 다음 샷 충전 +10%',
      prerequisites: [[4]],
      ncCostMultiplier: 0.13
    }),

    // 8. 단일 저격 안정화 (TM+DM)
    // 각인 중복 시: 연속 적중 피해 곱연산(×1.20^n)
    new UpgradeNode({
      id: 'enzymecharge_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '단일 저격 안정화',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerEffect: (ctx) => {
            // 단일 타겟 연속 적중 카운트
            if (!ctx.tower.sameTargetHitCount) ctx.tower.sameTargetHitCount = {};
            const foodId = ctx.food.id;
            ctx.tower.sameTargetHitCount[foodId] = (ctx.tower.sameTargetHitCount[foodId] || 0) + 1;
            return {};
          }
        }),
        new DamageModule({
          damageMultiplier: 1.20,    // 연속 적중 3회 시 피해 +20% [각인 중복: 곱연산]
          conditionalCheck: (ctx) => {
            // 연속 적중 3회 이상
            const foodId = ctx.food.id;
            return ctx.tower.sameTargetHitCount && ctx.tower.sameTargetHitCount[foodId] >= 3;
          }
        })
      ],
      effect: '단일 타겟 연속 적중 3회 시 피해 +20%',
      prerequisites: [[5]],
      ncCostMultiplier: 0.15
    }),

    // 9. 과열 완화 방열판 (SF+PM+DM)
    // 각인 중복 시: 과열 감소 가산(+20%×n), 완충 피해 곱연산(×1.08^n)
    new UpgradeNode({
      id: 'enzymecharge_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '과열 완화 방열판',
      modules: [
        new SafetyModule({
          overheatingReduction: 0.20  // 과열 페널티 -20% [각인 중복: 가산]
        }),
        new DamageModule({
          damageMultiplier: 1.08,     // 완충 피해 +8% [각인 중복: 곱연산]
          conditionalCheck: (ctx) => {
            // 완충 상태 판정
            return ctx.tower.chargeLevel >= ctx.tower.maxCharge;
          }
        })
      ],
      effect: '과열 페널티 -20%, 완충 피해 +8%',
      prerequisites: [[6]],
      ncCostMultiplier: 0.15
    }),

    // 10. 완충 임계 붕괴 (TR+DM+PM)
    // 각인 중복 시: 2차 타격 피해 가산(+35%×n)
    new UpgradeNode({
      id: 'enzymecharge_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '완충 임계 붕괴',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            // 완충 샷 & 체력 60%+ 대상
            const isFullCharge = ctx.tower.chargeLevel >= ctx.tower.maxCharge;
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return isFullCharge && hpPercent >= 0.60;
          },
          triggerEffect: (ctx) => {
            // 2차 타격 35% [각인 중복: 가산]
            return { secondaryDamage: ctx.damage * 0.35 };
          }
        })
      ],
      effect: '완충 샷이 체력 60%+ 대상에 2차 타격 35% 발생',
      prerequisites: [[7]],
      ncCostMultiplier: 0.18
    }),

    // 11. 타이밍 폭발 프로토콜 (TR+DM)
    // 각인 중복 시: 타이밍 버스트 피해 곱연산(×1.40^n)
    new UpgradeNode({
      id: 'enzymecharge_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '타이밍 폭발 프로토콜',
      modules: [
        new TriggerModule({
          triggerType: 'onKill',
          triggerEffect: (ctx) => {
            // 3초 내 처치 판정
            const now = Date.now();
            if (!ctx.tower.lastKillTime) ctx.tower.lastKillTime = 0;
            const timeSinceLastKill = (now - ctx.tower.lastKillTime) / 1000;

            if (timeSinceLastKill <= 3.0) {
              // 연계 성공: 다음 완충 샷 피해 +40%
              ctx.tower.timingBurstActive = true;
            }
            ctx.tower.lastKillTime = now;
            return {};
          }
        }),
        new DamageModule({
          damageMultiplier: 1.40,    // 타이밍 버스트 피해 +40% [각인 중복: 곱연산]
          conditionalCheck: (ctx) => {
            // 이전 공격에서 설정된 버프 스냅샷으로 판정 (same-attack 즉시 소모 방지)
            const isFullCharge = ctx.tower.chargeLevel >= ctx.tower.maxCharge;
            const hasBuff = ctx.timingBurstActivePreAttack === true;
            if (isFullCharge && hasBuff) {
              ctx.tower.timingBurstActive = false; // 소모
              return true;
            }
            return false;
          }
        })
      ],
      effect: '3초 내 처치 연계 시 다음 완충 샷 피해 +40%',
      prerequisites: [[8]],
      ncCostMultiplier: 0.22
    }),

    // 12. 초고압 캐논 오버드라이브 (DM+PM+TR)
    // 각인 중복 시: 사거리 곱연산(×1.12^n), 충전 속도 가산(+10%×n), 치명타 확률 가산(+12%p×n)
    new UpgradeNode({
      id: 'enzymecharge_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '초고압 캐논 오버드라이브',
      modules: [
        new ProjectileModule({
          rangeMultiplier: 1.12,     // 사거리 +12% [각인 중복: 곱연산]
          chargeRateBonus: 0.10      // 충전 시간 -10% [각인 중복: 가산]
        }),
        new DamageModule({
          critChanceBonus: 0.12,     // 완충 샷 치명타 확률 +12%p [각인 중복: 가산]
          conditionalCheck: (ctx) => {
            // 완충 샷
            return ctx.tower.chargeLevel >= ctx.tower.maxCharge;
          }
        })
      ],
      effect: '사거리 +12%, 충전 시간 -10%, 완충 샷 치명타 확률 +12%p',
      prerequisites: [[9]],
      ncCostMultiplier: 0.25
    })
  ];
}
