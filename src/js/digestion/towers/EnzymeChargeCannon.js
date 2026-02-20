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
      this.chargeLevel = Math.min(this.maxCharge, this.chargeLevel + this.chargeRate * dt);
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

  attack(food, currentTime = 0) {
    // 충전이 충분하지 않으면 공격 불가
    if (this.chargeLevel < this.minChargeToFire) return;

    // 충전량에 비례한 피해 배율 계산
    const chargeMultiplier = this.chargeLevel / 100;

    // Context에 충전 정보 추가
    const originalAttack = super.attack.bind(this);

    // 임시로 damage에 충전 배율 적용
    const originalDamage = this.damage;
    this.damage = originalDamage * chargeMultiplier;

    originalAttack(food, currentTime);

    // 원복
    this.damage = originalDamage;

    // 충전 소모
    this.chargeLevel = 0;
    this.isCharging = true;
  }
}

/**
 * 효소 축전 캐논 업그레이드 노드 생성
 */
export function createEnzymeChargeCannonUpgradeNodes() {
  return [
    // 1. 전해질 프리차지 (PM)
    new UpgradeNode({
      id: 'enzymecharge_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '전해질 프리차지',
      modules: [
        new ProjectileModule({
          speed: 350 // 기본 300에서 증가
        })
      ],
      effect: '기본 충전 시간 -12% (충전 속도 증가)',
      prerequisites: []
    }),

    // 2. 펩신 압축 셀 (DM)
    new UpgradeNode({
      id: 'enzymecharge_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '펩신 압축 셀',
      modules: [
        new DamageModule({
          damageMultiplier: 1.25
        })
      ],
      effect: '완충 타격 피해 +25%',
      prerequisites: [1]
    }),

    // 3. 미완충 발사 밸브 (PM+SF)
    new UpgradeNode({
      id: 'enzymecharge_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '미완충 발사 밸브',
      modules: [
        new SafetyModule({
          minDamageGuarantee: 0.75
        })
      ],
      effect: '60% 이상 충전 발사 가능(피해 75%)',
      prerequisites: [1]
    }),

    // 4. 당류 급속 분해 (TB+DM)
    new UpgradeNode({
      id: 'enzymecharge_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '당류 급속 분해',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            carb: 1.3,
            sugar: 1.3
          },
          tagEffects: {
            carb: {
              type: 'additionalDamage',
              value: 20
            },
            sugar: {
              type: 'additionalDamage',
              value: 20
            }
          }
        })
      ],
      effect: '탄수화물 명중 시 추가 고정 피해',
      prerequisites: [2]
    }),

    // 5. 위산-효소 동조 (TB+DM)
    new UpgradeNode({
      id: 'enzymecharge_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '위산-효소 동조',
      modules: [
        new DamageModule({
          damageMultiplier: 1.22
        })
      ],
      effect: '산성 디버프 대상 피해 +22%',
      prerequisites: [2]
    }),

    // 6. 과열 환기판 (SF)
    new UpgradeNode({
      id: 'enzymecharge_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '과열 환기판',
      modules: [
        new SafetyModule({
          overheatingReduction: 0.35
        })
      ],
      effect: '발사 후 과열 페널티 -35%',
      prerequisites: [3]
    }),

    // 7. 발효 폭주 억제 (TB+SM)
    new UpgradeNode({
      id: 'enzymecharge_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '발효 폭주 억제',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            spicy: 1.2,
            fermented: 1.2
          }
        })
      ],
      effect: '매운/발효 적 스킬 사용 지연 1초',
      prerequisites: [3]
    }),

    // 8. 소장 연계 분출 (TR+RM)
    new UpgradeNode({
      id: 'enzymecharge_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '소장 연계 분출',
      modules: [
        new TriggerModule({
          triggerType: 'onKill',
          triggerEffect: (ctx) => {
            return { chargeRefund: 0.2 };
          }
        })
      ],
      effect: '처치 시 다음 샷 충전 20% 환급',
      prerequisites: [4, 6]
    }),

    // 9. 점막 보호 피복 (SF+TR)
    new UpgradeNode({
      id: 'enzymecharge_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '점막 보호 피복',
      modules: [
        new SafetyModule({
          auraAcidReduction: 1
        })
      ],
      effect: '완충 발사 시 주변 타워 과산 누적 -1',
      prerequisites: [5, 7]
    }),

    // 10. 이중 방전 회로 (TR+DM+PM)
    new UpgradeNode({
      id: 'enzymecharge_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '이중 방전 회로',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent >= 0.5;
          },
          triggerEffect: (ctx) => {
            // 2차 타격 40%
            return { damage: ctx.damage * 1.4 };
          }
        })
      ],
      effect: '체력 50% 이상 적 명중 시 2차 타격 40%',
      prerequisites: [8]
    }),

    // 11. 소화 임계 폭딜 (TR+DM)
    new UpgradeNode({
      id: 'enzymecharge_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '소화 임계 폭딜',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerEffect: (ctx) => {
            // 동일 적 히트 카운트 (간단 구현)
            if (!ctx.tower.hitCounts) ctx.tower.hitCounts = {};
            const foodId = ctx.food.id;
            ctx.tower.hitCounts[foodId] = (ctx.tower.hitCounts[foodId] || 0) + 1;

            if (ctx.tower.hitCounts[foodId] >= 4) {
              ctx.tower.hitCounts[foodId] = 0;
              return { damage: ctx.damage * 1.8 };
            }
            return {};
          }
        })
      ],
      effect: '동일 적 3회 명중 후 4회째 피해 +80%',
      prerequisites: [9, 10]
    }),

    // 12. 영양 회수 콘덴서 (RM+TR)
    new UpgradeNode({
      id: 'enzymecharge_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '영양 회수 콘덴서',
      modules: [
        new ResourceModule({
          nutritionOnEliteKill: 1,
          energyOnEliteKill: 1
        })
      ],
      effect: '엘리트 처치 시 에너지 +1, 영양 +1',
      prerequisites: [11]
    })
  ];
}
