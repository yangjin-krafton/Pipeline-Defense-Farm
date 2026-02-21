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

  update(dt, foodList, multiPathSystem, currentTime) {
    // 충전 로직
    if (this.isCharging && this.chargeLevel < this.maxCharge) {
      const prevChargeLevel = this.chargeLevel;
      this.chargeLevel = Math.min(this.maxCharge, this.chargeLevel + this.chargeRate * dt);

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
      super.update(dt, foodList, multiPathSystem, currentTime);
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

  attack(food, currentTime = 0) {
    // 충전이 충분하지 않으면 공격 불가
    if (this.chargeLevel < this.minChargeToFire) return;

    // 충전량에 비례한 피해 배율 계산
    const chargeMultiplier = this.chargeLevel / 100;
    const isFullCharge = this.chargeLevel >= this.maxCharge;

    // Context에 충전 정보 추가
    const originalDamage = this.damage;
    this.damage = originalDamage * chargeMultiplier;

    // 충전도에 따른 총알 비주얼 설정
    const bulletColor = this.getChargeBulletColor(this.chargeLevel);
    const bulletSize = this.getChargeBulletSize(this.chargeLevel);
    const projectileSpeed = this.definition.stats.projectileSpeed * this.auraBonuses.projectileSpeed;

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
        chargeRefund: 0
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
      this.bulletSystem.createBullet(
        this.x,
        this.y,
        food,
        context.damage,
        bulletColor,
        projectileSpeed,
        bulletSize,
        true
      );

      // 충전 발사 이펙트 (일반 공격 이펙트 대신)
      if (this.particleSystem && this.particleSystem.emitChargeCannonEffect) {
        this.particleSystem.emitChargeCannonEffect(this.x, this.y, bulletColor, this.chargeLevel);
      } else if (this.particleSystem) {
        this.particleSystem.emitTowerAttackEffect(this.x, this.y, bulletColor);
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
          const critContext = module.apply(context);

          // Apply additional damage bonus from onCrit
          if (critContext.damageBonus && critContext.damageBonus !== context.damageBonus) {
            context.damage *= (1 + (critContext.damageBonus - (context.damageBonus || 0)));
          }

          // Apply status effects from onCrit
          if (critContext.statusEffects && critContext.statusEffects.length > context.statusEffects.length) {
            const newEffects = critContext.statusEffects.slice(context.statusEffects.length);
            this._applyStatusEffects(food, newEffects);
          }

          context = critContext;
        }
      }
    }

    // 원복
    this.damage = originalDamage;

    // 충전 소모
    this.chargeLevel = 0;
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
            const hasBuff = ctx.tower.killBuffStacks > 0;
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
      prerequisites: [[1], [2]], // 1 또는 2
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
            // 장거리 판정 (사거리 70% 이상)
            const distance = Math.hypot(ctx.tower.x - ctx.food.x, ctx.tower.y - ctx.food.y);
            const effectiveRange = ctx.tower.range;
            return distance >= effectiveRange * 0.70;
          }
        })
      ],
      effect: '장거리(사거리 70%+) 명중 시 피해 +14%',
      prerequisites: [[1], [2]], // 1 또는 2
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
      prerequisites: [[1], [3]], // 1 또는 3
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
            // 디버프 대상 판정
            return ctx.food.debuffs && Object.keys(ctx.food.debuffs).length > 0;
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
      prerequisites: [[1], [3]], // 1 또는 3
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
      prerequisites: [[4], [5], [6]], // 4 또는 5 또는 6
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
      prerequisites: [[5], [6], [7]], // 5 또는 6 또는 7
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
      prerequisites: [[8]],
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
            // 완충 상태 & 타이밍 버스트 활성
            const isFullCharge = ctx.tower.chargeLevel >= ctx.tower.maxCharge;
            const hasBuff = ctx.tower.timingBurstActive === true;
            if (isFullCharge && hasBuff) {
              ctx.tower.timingBurstActive = false; // 소모
              return true;
            }
            return false;
          }
        })
      ],
      effect: '3초 내 처치 연계 시 다음 완충 샷 피해 +40%',
      prerequisites: [[9, 10]], // 9 + 10 (AND)
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
      prerequisites: [[11]],
      ncCostMultiplier: 0.25
    })
  ];
}
