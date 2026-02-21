import { BaseTower } from '../core/BaseTower.js';
import { UpgradeNode } from '../core/UpgradeNode.js';
import {
  TargetingModule,
  DamageModule,
  ProjectileModule,
  TagBonusModule,
  StatusModule,
  TriggerModule,
  TriggerEffects,
  ResourceModule,
  SafetyModule
} from '../core/modules/index.js';

/**
 * 위산 레일 주입기 (Acid Rail Injector)
 * 단일 화력 타워 - 보스/엘리트 1체 삭제 특화
 */
export class AcidRailTower extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);
  }
}

/**
 * 위산 레일 주입기 업그레이드 노드 생성
 * 재설계 방향: 암살/약점분해/임계마무리 3축 고정
 * 역할 고정: 단일 고위협 마무리 전담 (표식 송신 + 취약/감전 수신)
 *
 * 2026-02-22 개정: 모든 노드를 수치 증폭 형태로 설계 (각인 중복 안전성)
 *
 * 각인 중복 메커니즘:
 * - DamageModule.damageMultiplier: 곱연산 중첩 (1.08 × 1.08 × 1.08)
 * - TriggerModule.damageBonus: 가산 중첩 (+12% + 12% + 12%)
 * - TriggerModule.critChanceBonus: 가산 중첩 (+10%p + 10%p + 10%p)
 * - DamageModule.critMultiplierBonus: 가산 중첩 (+0.6 + 0.6 + 0.6)
 * - DamageModule.attackSpeedMultiplier: 곱연산 중첩 (1.05 × 1.05 × 1.05)
 */
export function createAcidRailUpgradeNodes() {
  return [
    // 1. 풀피 집중 조준 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.08^n), 풀피 보너스 가산(+12%×n)
    new UpgradeNode({
      id: 'acidrail_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '풀피 집중 조준',
      modules: [
        new DamageModule({
          damageMultiplier: 1.08  // 기본 피해 +8% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            // HP 95% 이상인 적 (거의 풀피)
            const hpPercent = ctx.food.hp / (ctx.food.maxHp || ctx.food.hp);
            return hpPercent >= 0.95;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.12 };  // 풀피 적에게 추가 피해 +12% [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +8%, HP 95%+ 적 추가 피해 +12%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 2. 연속 집중 공격 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.06^n), 연속 보너스 가산(+12%×n)
    new UpgradeNode({
      id: 'acidrail_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '연속 집중 공격',
      modules: [
        new DamageModule({
          damageMultiplier: 1.06  // 기본 피해 +6% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            // 같은 대상을 연속 공격 중인지 체크
            return ctx.tower.lastTarget === ctx.food;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.12 };  // 같은 적 연속 공격 시 추가 피해 +12% [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +6%, 같은 적 연속 공격 시 피해 +12%',
      prerequisites: [],
      ncCostMultiplier: 0.09
    }),

    // 3. 임계 조준 프로토콜 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.06^n), 치명타 확률 가산(+12%p×n)
    new UpgradeNode({
      id: 'acidrail_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '임계 조준 프로토콜',
      modules: [
        new DamageModule({
          damageMultiplier: 1.06  // 기본 피해 +6% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent <= 0.35;
          },
          triggerEffect: (ctx) => {
            return { critChanceBonus: 0.12 };  // 체력 35% 이하 치명타 +12%p [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +6%, 체력 35% 이하 대상 치명타 확률 +12%p',
      prerequisites: [],
      ncCostMultiplier: 0.10
    }),

    // 4. 취약 수신 증폭 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.05^n), 취약 보너스 가산(+12%×n)
    new UpgradeNode({
      id: 'acidrail_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '취약 수신 증폭',
      modules: [
        new DamageModule({
          damageMultiplier: 1.05  // 기본 피해 +5% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            return ctx.food.statusEffects?.some(e => e.type === 'expose');
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.12 };  // 취약 대상 추가 피해 +12% [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +5%, 취약 대상 추가 피해 +12%',
      prerequisites: [[1], [2]], // 1 또는 2
      ncCostMultiplier: 0.12
    }),

    // 5. 감전 수신 도약 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.05^n), 치명타 확률 가산(+10%p×n)
    new UpgradeNode({
      id: 'acidrail_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '감전 수신 도약',
      modules: [
        new DamageModule({
          damageMultiplier: 1.05  // 기본 피해 +5% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            return ctx.food.statusEffects?.some(e => e.type === 'shock');
          },
          triggerEffect: (ctx) => {
            return { critChanceBonus: 0.10 };  // 감전 대상 치명타 +10%p [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +5%, 감전 대상 치명타 확률 +10%p',
      prerequisites: [[1], [2]], // 1 또는 2
      ncCostMultiplier: 0.12
    }),

    // 6. 중장갑 관통 사격 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.10^n), 중장갑 보너스 가산(+15%×n)
    new UpgradeNode({
      id: 'acidrail_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '중장갑 관통 사격',
      modules: [
        new DamageModule({
          damageMultiplier: 1.10  // 기본 피해 +10% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            // armor 10 이상인 적 (중장갑)
            return (ctx.food.armor || 0) >= 10;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.15 };  // 중장갑 대상 추가 피해 +15% [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +10%, 방어력 10+ 적 추가 피해 +15%',
      prerequisites: [[1], [3]], // 1 또는 3
      ncCostMultiplier: 0.13
    }),

    // 7. 저체력 마무리 각인 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.07^n), 저체력 보너스 가산(+18%×n)
    new UpgradeNode({
      id: 'acidrail_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '저체력 마무리 각인',
      modules: [
        new DamageModule({
          damageMultiplier: 1.07  // 기본 피해 +7% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent <= 0.25;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.18 };  // 체력 25% 이하 대상 추가 피해 +18% [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +7%, 체력 25% 이하 대상 추가 피해 +18%',
      prerequisites: [[1], [3]], // 1 또는 3
      ncCostMultiplier: 0.14
    }),

    // 8. 안정 화력 증폭 (DM)
    // 각인 중복 시: 기본 피해 곱연산(×1.12^n), 공격속도 곱연산(×1.05^n)
    new UpgradeNode({
      id: 'acidrail_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '안정 화력 증폭',
      modules: [
        new DamageModule({
          damageMultiplier: 1.12,  // 기본 피해 +12% [각인 중복: 곱연산]
          attackSpeedMultiplier: 1.05  // 공격속도 +5% [각인 중복: 곱연산]
        })
      ],
      effect: '기본 피해 +12%, 공격속도 +5%',
      prerequisites: [[4], [5], [6]], // 4 또는 5 또는 6
      ncCostMultiplier: 0.15
    }),

    // 9. 연속 타격 증폭 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.06^n), 3회 보너스 가산(+18%×n)
    new UpgradeNode({
      id: 'acidrail_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '연속 타격 증폭',
      modules: [
        new DamageModule({
          damageMultiplier: 1.06  // 기본 피해 +6% [각인 중복: 곱연산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerEffect: (ctx) => {
            // 동일 대상 히트 카운트
            if (!ctx.tower.markHitCounts) ctx.tower.markHitCounts = {};
            const foodId = ctx.food.id;
            ctx.tower.markHitCounts[foodId] = (ctx.tower.markHitCounts[foodId] || 0) + 1;

            const hitCount = ctx.tower.markHitCounts[foodId];

            // 3회 적중 시 표식 부여 + 피해 증폭
            if (hitCount >= 3) {
              ctx.tower.markHitCounts[foodId] = 0;
              return {
                damageBonus: 0.18,  // 3회 적중 시 피해 +18% [각인 중복: 가산]
                statusEffect: {
                  type: 'mark',
                  stacks: 1,
                  duration: 4
                }
              };
            }
            return {};
          }
        })
      ],
      effect: '기본 피해 +6%, 동일 대상 3회 적중 시 피해 +18% + 표식 부여',
      prerequisites: [[5], [6], [7]], // 5 또는 6 또는 7
      ncCostMultiplier: 0.16
    }),

    // 10. 치명 표식 강화 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.08^n), 치명타 확률 가산(+8%p×n), 치명타 보너스 가산(+12%×n)
    new UpgradeNode({
      id: 'acidrail_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '치명 표식 강화',
      modules: [
        new DamageModule({
          damageMultiplier: 1.08,  // 기본 피해 +8% [각인 중복: 곱연산]
          critChanceBonus: 0.08  // 치명타 확률 +8%p [각인 중복: 가산]
        }),
        new TriggerModule({
          triggerType: 'onCrit',
          triggerEffect: (ctx) => {
            return {
              damageBonus: 0.12,  // 치명타 시 추가 피해 +12% [각인 중복: 가산]
              statusEffect: {
                type: 'mark',
                stacks: 1,
                duration: 4
              }
            };
          }
        })
      ],
      effect: '기본 피해 +8%, 치명타 확률 +8%p, 치명타 시 피해 +12% + 표식 부여',
      prerequisites: [[8]], // 8
      ncCostMultiplier: 0.18
    }),

    // 11. 임계 폭딜 알고리즘 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.08^n), 저체력 보너스 가산(+40%×n), 치명타 확률 가산(+15%p×n)
    new UpgradeNode({
      id: 'acidrail_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '임계 폭딜 알고리즘',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent <= 0.35;
          },
          triggerEffect: (ctx) => {
            return {
              damageBonus: 0.40,  // 체력 35% 이하 피해 +40% [각인 중복: 가산]
              critChanceBonus: 0.15  // 치명타 확률 +15%p [각인 중복: 가산]
            };
          }
        }),
        new DamageModule({
          damageMultiplier: 1.08  // 기본 피해 +8% [각인 중복: 곱연산]
        })
      ],
      effect: '기본 피해 +8%, 체력 35% 이하 대상 피해 +40%, 치명타 +15%p',
      prerequisites: [[8, 9]], // 8 + 9 (AND 조건)
      ncCostMultiplier: 0.22
    }),

    // 12. 암살 루프 완결 (DM+TR)
    // 각인 중복 시: 기본 피해 곱연산(×1.12^n), 치명타 배율 가산(+0.6×n), 표식 보너스 가산(+15%×n), 표식+저체력 보너스 가산(+20%×n)
    new UpgradeNode({
      id: 'acidrail_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '암살 루프 완결',
      modules: [
        new DamageModule({
          damageMultiplier: 1.12,  // 기본 피해 +12% [각인 중복: 곱연산]
          critMultiplierBonus: 0.6 // 치명타 배율 +0.6 [각인 중복: 가산]
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hasMarkTag = ctx.food.statusEffects?.some(e => e.type === 'mark');
            return hasMarkTag;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.15 };  // 표식 대상 피해 +15% [각인 중복: 가산]
          }
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            const hasMarkTag = ctx.food.statusEffects?.some(e => e.type === 'mark');
            return hasMarkTag && hpPercent <= 0.20;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.20 };  // 표식 + 저체력 추가 피해 +20% [각인 중복: 가산]
          }
        })
      ],
      effect: '기본 피해 +12%, 치명타 배율 +0.6, 표식 대상 피해 +15%, 표식 + 체력 20% 이하 추가 피해 +20%',
      prerequisites: [[10], [11]], // 10 또는 11
      ncCostMultiplier: 0.25
    })
  ];
}
