import { BaseTower } from '../core/BaseTower.js';
import { UpgradeNode } from '../core/UpgradeNode.js';
import {
  ProjectileModule,
  DamageModule,
  TagBonusModule
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
    const distToTarget = Number.isFinite(context?.cannonDistToTarget) ? context.cannonDistToTarget : 0;

    bullet.arcScaleProfile = this.getBulletArcScaleProfile(chargeLevel, distToTarget, isSecondary);
    bullet.colorProfile = this.getBulletColorProfile(chargeLevel, isSecondary);

    // lockedTargetPos: 주탄만 고정 착탄 적용 (2차탄은 일반 추적 유지)
    if (!isSecondary &&
        Number.isFinite(context?.lockedTargetPos?.x) && Number.isFinite(context?.lockedTargetPos?.y)) {
      bullet.lockedTargetPos = {
        x: context.lockedTargetPos.x,
        y: context.lockedTargetPos.y
      };
    }

    const flightDuration = isSecondary ? 1.5 : (context?.cannonArcFlightDuration ?? 1.5);
    bullet.arcUseDistanceProgress = false;
    bullet.arcFlightDuration = flightDuration;
    bullet.minAirborneTime = flightDuration;
    bullet.forceImpactOnLanding = !isSecondary; // 주탄만 강제 착탄
    bullet.renderLast = !isSecondary; // 주탄은 파티클 위에 렌더링
  }

  getBulletArcScaleProfile(chargeLevel, distToTarget = 200, isSecondary = false) {
    const chargePct = Math.max(0, Math.min(1, chargeLevel / (this.maxCharge || 100)));

    // 거리 비례 인수 (250px 기준 1.0, 최소 0.3, 최대 2.4)
    const REF_DIST = 250;
    const distFactor = Math.max(0.3, Math.min(2.4, distToTarget / REF_DIST));

    if (isSecondary) {
      return {
        startScale: 0.72,
        peakScale: 1.18 + chargePct * 0.16,
        endScale: 0.70,
        liftPixels: (4 + chargePct * 3) * Math.min(1.4, distFactor)
      };
    }

    // 주탄: 거리가 멀수록 더 높이, 더 크게 부풀어 올랐다가 착지
    return {
      startScale: 0.72,
      peakScale: 1.45 + chargePct * 0.30 + distFactor * 0.08,
      endScale: 0.68,
      liftPixels: Math.min(72, (18 + chargePct * 14) * distFactor)
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
    const sampledTargetPos = this.getTargetWorldPosition(food);
    const lockedTargetPos = sampledTargetPos || (
      (typeof food?.x === 'number' && typeof food?.y === 'number')
        ? { x: food.x, y: food.y }
        : null
    );

    // 거리 기반 캐논 포물선 파라미터 계산
    // 비행 시간(arcFlightDuration)은 거리에 비례하여 산출하고,
    // 총알 속도는 그 시간 내에 lockedTargetPos에 정확히 도달하도록 역산함.
    let cannonArcFlightDuration = 1.5;
    let cannonBulletSpeed = projectileSpeed;
    let cannonDistToTarget = 0;

    if (lockedTargetPos) {
      const adx = lockedTargetPos.x - fireTransform.x;
      const ady = lockedTargetPos.y - fireTransform.y;
      cannonDistToTarget = Math.sqrt(adx * adx + ady * ady);
      if (cannonDistToTarget > 0) {
        // 250px 기준 1.2초. 짧은 거리: 최소 0.6초, 먼 거리: 최대 2.6초
        const REF_DIST = 250;
        cannonArcFlightDuration = Math.max(0.6, Math.min(2.6,
          1.2 * (cannonDistToTarget / REF_DIST)
        ));
        // arcFlightDuration 내에 lockedTargetPos에 정확히 도달하는 속도
        cannonBulletSpeed = cannonDistToTarget / cannonArcFlightDuration;
      }
    }

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
        lockedTargetPos,
        cannonArcFlightDuration,
        cannonDistToTarget,
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
      // 속도는 lockedTargetPos까지 arcFlightDuration 내에 도달하도록 역산된 값 사용
      const bullet = this.bulletSystem.createBullet(
        fireTransform.x,
        fireTransform.y,
        food,
        context.damage,
        bulletColor,
        cannonBulletSpeed,
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
 * 2026-02-22 재설계: 3x4 고정 구조 (A=공격력형 / B=사거리형 / C=공격속도형)
 * - A 라인 (1→4→7→10): 공격력 집중, 트레이드오프 사거리 -
 * - B 라인 (2→5→8→11): 사거리 집중, 트레이드오프 공격속도 -
 * - C 라인 (3→6→9→12): 공격속도 집중, 트레이드오프 공격력 -
 *
 * 각인 중복 메커니즘:
 * - DamageModule.damageMultiplier: 곱연산 중첩 (1.05 × 1.05 × ...)
 * - DamageModule.attackSpeedMultiplier: 곱연산 중첩 (1.05 × 1.05 × ...)
 * - DamageModule.critChanceBonus: 가산 중첩 (+4%p × n)
 * - DamageModule.critMultiplierBonus: 가산 중첩 (+0.06 × n)
 * - ProjectileModule.rangeMultiplier: 곱연산 중첩 (1.05 × 1.05 × ...)
 * - TagBonusModule (protein/fat/dairy/spicy/soda/fermented): 곱연산 중첩
 * - 각인 중복 비용 곡선: x1.0 → x1.5 → x2.2 → x3.2 → x4.5 → x6.2 → x8.5
 */
export function createEnzymeChargeCannonUpgradeNodes() {
  return [
    // ── A 라인: 공격력 (트레이드오프: 사거리 ↓) ──────────────

    // 1. 고압 압축탄 (분기 A) - DM
    // 각인 중복 시: 공격력 곱연산(×1.05^n)
    new UpgradeNode({
      id: 'enzymecharge_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '고압 압축탄',
      modules: [
        new DamageModule({
          damageMultiplier: 1.05  // 공격력 +5% [각인 중복: 곱연산]
        })
      ],
      effect: '공격력 +5%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 4. 압축 강화 I (중간 A) - DM+TB
    // 각인 중복 시: 공격력 곱연산(×1.06^n), protein 피해 곱연산(×1.14^n)
    new UpgradeNode({
      id: 'enzymecharge_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '압축 강화 I',
      modules: [
        new DamageModule({
          damageMultiplier: 1.06  // 공격력 +6% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ protein: 1.14 })  // protein 대상 추가 피해 +14% [각인 중복: 곱연산]
      ],
      effect: '공격력 +6%, protein 대상 추가 피해 +14%',
      prerequisites: [[1]],
      ncCostMultiplier: 0.10
    }),

    // 7. 압축 강화 II (중간 A) - DM+TB
    // 각인 중복 시: 공격력 곱연산(×1.07^n), fat 피해 곱연산(×1.16^n)
    new UpgradeNode({
      id: 'enzymecharge_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '압축 강화 II',
      modules: [
        new DamageModule({
          damageMultiplier: 1.07  // 공격력 +7% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ fat: 1.16 })  // fat 대상 추가 피해 +16% [각인 중복: 곱연산]
      ],
      effect: '공격력 +7%, fat 대상 추가 피해 +16%',
      prerequisites: [[4]],
      ncCostMultiplier: 0.13
    }),

    // 10. 압축 필살 (끝 A) - DM+PM+TR
    // 각인 중복 시: 공격력 곱연산(×1.10^n), 치명타 확률 가산(+4%p×n), 치명타 피해 가산(+0.06×n)
    new UpgradeNode({
      id: 'enzymecharge_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '압축 필살',
      modules: [
        new DamageModule({
          damageMultiplier: 1.10,    // 공격력 +10% [각인 중복: 곱연산]
          critChanceBonus: 0.04,     // 치명타 확률 +4%p [각인 중복: 가산]
          critMultiplierBonus: 0.06  // 치명타 피해 +6% [각인 중복: 가산]
        })
      ],
      effect: '공격력 +10%, 치명타 확률 +4%, 치명타 피해 +6%',
      prerequisites: [[7]],
      ncCostMultiplier: 0.18
    }),

    // ── B 라인: 사거리 (트레이드오프: 공격속도 ↓) ────────────

    // 2. 장거리 포커스 (분기 B) - PM
    // 각인 중복 시: 사거리 곱연산(×1.05^n)
    new UpgradeNode({
      id: 'enzymecharge_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '장거리 포커스',
      modules: [
        new ProjectileModule({
          rangeMultiplier: 1.05  // 사거리 +5% [각인 중복: 곱연산]
        })
      ],
      effect: '사거리 +5%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 5. 거리 강화 I (중간 B) - PM+TB
    // 각인 중복 시: 사거리 곱연산(×1.06^n), dairy 피해 곱연산(×1.12^n)
    new UpgradeNode({
      id: 'enzymecharge_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '거리 강화 I',
      modules: [
        new ProjectileModule({
          rangeMultiplier: 1.06  // 사거리 +6% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ dairy: 1.12 })  // dairy 대상 추가 피해 +12% [각인 중복: 곱연산]
      ],
      effect: '사거리 +6%, dairy 대상 추가 피해 +12%',
      prerequisites: [[2]],
      ncCostMultiplier: 0.10
    }),

    // 8. 거리 강화 II (중간 B) - PM+TB
    // 각인 중복 시: 사거리 곱연산(×1.07^n), spicy 피해 곱연산(×1.13^n)
    new UpgradeNode({
      id: 'enzymecharge_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '거리 강화 II',
      modules: [
        new ProjectileModule({
          rangeMultiplier: 1.07  // 사거리 +7% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ spicy: 1.13 })  // spicy 대상 추가 피해 +13% [각인 중복: 곱연산]
      ],
      effect: '사거리 +7%, spicy 대상 추가 피해 +13%',
      prerequisites: [[5]],
      ncCostMultiplier: 0.13
    }),

    // 11. 장거리 필살 (끝 B) - PM+DM+SF
    // 각인 중복 시: 사거리 곱연산(×1.10^n), 치명타 피해 가산(+0.10×n)
    new UpgradeNode({
      id: 'enzymecharge_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '장거리 필살',
      modules: [
        new ProjectileModule({
          rangeMultiplier: 1.10       // 사거리 +10% [각인 중복: 곱연산]
        }),
        new DamageModule({
          critMultiplierBonus: 0.10   // 치명타 피해 +10% [각인 중복: 가산]
        })
      ],
      effect: '사거리 +10%, 치명타 피해 +10%',
      prerequisites: [[8]],
      ncCostMultiplier: 0.20
    }),

    // ── C 라인: 공격속도 (트레이드오프: 공격력 ↓) ────────────

    // 3. 과급 연사 코어 (분기 C) - DM
    // 각인 중복 시: 공격속도 곱연산(×1.05^n)
    new UpgradeNode({
      id: 'enzymecharge_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '과급 연사 코어',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.05  // 공격속도 +5% [각인 중복: 곱연산]
        })
      ],
      effect: '공격속도 +5%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 6. 연사 강화 I (중간 C) - DM+TB
    // 각인 중복 시: 공격속도 곱연산(×1.06^n), soda 피해 곱연산(×1.10^n)
    new UpgradeNode({
      id: 'enzymecharge_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '연사 강화 I',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.06  // 공격속도 +6% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ soda: 1.10 })  // soda 대상 추가 피해 +10% [각인 중복: 곱연산]
      ],
      effect: '공격속도 +6%, soda 대상 추가 피해 +10%',
      prerequisites: [[3]],
      ncCostMultiplier: 0.10
    }),

    // 9. 연사 강화 II (중간 C) - DM+TR+TB
    // 각인 중복 시: 공격속도 곱연산(×1.07^n), fermented 피해 곱연산(×1.15^n)
    new UpgradeNode({
      id: 'enzymecharge_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '연사 강화 II',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.07  // 공격속도 +7% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ fermented: 1.15 })  // fermented 대상 추가 피해 +15% [각인 중복: 곱연산]
      ],
      effect: '공격속도 +7%, fermented 대상 추가 피해 +15%',
      prerequisites: [[6]],
      ncCostMultiplier: 0.13
    }),

    // 12. 연사 필살 (끝 C) - DM+SF+TR
    // 각인 중복 시: 공격속도 곱연산(×1.10^n), 치명타 확률 가산(+10%p×n)
    new UpgradeNode({
      id: 'enzymecharge_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '연사 필살',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.10,  // 공격속도 +10% [각인 중복: 곱연산]
          critChanceBonus: 0.10         // 치명타 확률 +10%p [각인 중복: 가산]
        })
      ],
      effect: '공격속도 +10%, 치명타 확률 +10%',
      prerequisites: [[9]],
      ncCostMultiplier: 0.22
    })
  ];
}
