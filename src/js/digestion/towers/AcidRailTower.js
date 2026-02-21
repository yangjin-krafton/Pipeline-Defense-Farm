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
 * 역할 고정: 단일 고위협 마무리 전담 (mark 송신 + expose/shock 수신)
 */
export function createAcidRailUpgradeNodes() {
  return [
    // 1. 선두 적 포커스 (TM)
    new UpgradeNode({
      id: 'acidrail_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '선두 적 포커스',
      modules: [
        new TargetingModule({
          priority: 'first' // 위에 있는 적(선두 적) 우선 타겟팅
        })
      ],
      effect: '위에 있는 적 우선 타겟팅 활성',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 2. 약점 분해 탄두 (DM)
    new UpgradeNode({
      id: 'acidrail_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '약점 분해 탄두',
      modules: [
        new DamageModule({
          damageMultiplier: 1.12
        })
      ],
      effect: '단일 타격 피해 +12%',
      prerequisites: [],
      ncCostMultiplier: 0.09
    }),

    // 3. 임계 조준 프로토콜 (TR+DM)
    new UpgradeNode({
      id: 'acidrail_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '임계 조준 프로토콜',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent <= 0.35;
          },
          triggerEffect: (ctx) => {
            return { critChanceBonus: 0.12 };
          }
        })
      ],
      effect: '체력 35% 이하 대상 치명타 확률 +12%p',
      prerequisites: [],
      ncCostMultiplier: 0.10
    }),

    // 4. 취약 수신 증폭 (DM+TR)
    new UpgradeNode({
      id: 'acidrail_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '취약 수신 증폭',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            return ctx.food.statusEffects?.some(e => e.type === 'expose');
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.12 };
          }
        })
      ],
      effect: 'expose 대상 피해 +12%',
      prerequisites: [[1], [2]], // 1 또는 2
      ncCostMultiplier: 0.12
    }),

    // 5. 감전 수신 도약 (DM+TR)
    new UpgradeNode({
      id: 'acidrail_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '감전 수신 도약',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            return ctx.food.statusEffects?.some(e => e.type === 'shock');
          },
          triggerEffect: (ctx) => {
            return { critChanceBonus: 0.10 };
          }
        })
      ],
      effect: 'shock 대상 치명타 확률 +10%p',
      prerequisites: [[1], [2]], // 1 또는 2
      ncCostMultiplier: 0.12
    }),

    // 6. 고위협 관통 조준 (TM+DM)
    new UpgradeNode({
      id: 'acidrail_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '고위협 관통 조준',
      modules: [
        new TargetingModule({
          priority: 'threat' // threat 상위 우선
        }),
        new DamageModule({
          damageMultiplier: 1.10
        })
      ],
      effect: 'threat 상위 대상 피해 +10%',
      prerequisites: [[1], [3]], // 1 또는 3
      ncCostMultiplier: 0.13
    }),

    // 7. 저체력 마무리 각인 (TR+DM)
    new UpgradeNode({
      id: 'acidrail_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '저체력 마무리 각인',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent <= 0.25;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.18 };
          }
        })
      ],
      effect: '체력 25% 이하 대상 피해 +18%',
      prerequisites: [[1], [3]], // 1 또는 3
      ncCostMultiplier: 0.14
    }),

    // 8. 임계 안정화 (DM+SF)
    new UpgradeNode({
      id: 'acidrail_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '임계 안정화',
      modules: [
        new DamageModule({
          damageMultiplier: 1.0
        }),
        new SafetyModule({
          minDamageGuarantee: 0.3
        })
      ],
      effect: '최소 피해 30% 보장',
      prerequisites: [[4], [5], [6]], // 4 또는 5 또는 6
      ncCostMultiplier: 0.15
    }),

    // 9. 연속 마킹 예열 (TR+SM)
    new UpgradeNode({
      id: 'acidrail_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '연속 마킹 예열',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerEffect: (ctx) => {
            // 동일 대상 히트 카운트
            if (!ctx.tower.markHitCounts) ctx.tower.markHitCounts = {};
            const foodId = ctx.food.id;
            ctx.tower.markHitCounts[foodId] = (ctx.tower.markHitCounts[foodId] || 0) + 1;

            if (ctx.tower.markHitCounts[foodId] >= 3) {
              ctx.tower.markHitCounts[foodId] = 0;
              return {
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
      effect: '동일 대상 3회 적중 시 mark 1중첩 부여(4초)',
      prerequisites: [[5], [6], [7]], // 5 또는 6 또는 7
      ncCostMultiplier: 0.16
    }),

    // 10. 분해 표식 송신기 (SM+TR)
    new UpgradeNode({
      id: 'acidrail_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '분해 표식 송신기',
      modules: [
        new StatusModule({
          statusType: 'mark',
          statusValue: 1, // 1 stack
          statusDuration: 4
        }),
        new TriggerModule({
          triggerType: 'onCrit',
          triggerEffect: (ctx) => {
            return {
              statusEffect: {
                type: 'mark',
                stacks: 1,
                duration: 4
              }
            };
          }
        })
      ],
      effect: '치명타 발생 시 mark 1중첩 부여(4초)',
      prerequisites: [[8]], // 8
      ncCostMultiplier: 0.18
    }),

    // 11. 임계 처형 알고리즘 (TR+DM)
    new UpgradeNode({
      id: 'acidrail_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '임계 처형 알고리즘',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent <= 0.35;
          },
          triggerEffect: TriggerEffects.execute(),
          cooldown: 5 // 5초 쿨다운
        }),
        new DamageModule({
          damageMultiplier: 1.0
        })
      ],
      effect: '5초 마다 한번 체력 35% 이하 대상 즉시 분해',
      prerequisites: [[8, 9]], // 8 + 9 (AND 조건)
      ncCostMultiplier: 0.22
    }),

    // 12. 암살 루프 완결 (TM+DM+TR)
    new UpgradeNode({
      id: 'acidrail_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '암살 루프 완결',
      modules: [
        new TargetingModule({
          priority: 'marked' // mark 대상 우선
        }),
        new DamageModule({
          critMultiplierBonus: 0.6 // 치명타 배율 +0.6
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            const hasMarkTag = ctx.food.statusEffects?.some(e => e.type === 'mark');
            return hasMarkTag && hpPercent <= 0.20;
          },
          triggerEffect: (ctx) => {
            return { damageBonus: 0.20 };
          }
        })
      ],
      effect: 'mark 대상 치명타 배율 +0.6, 체력 20% 이하 추가 피해 +20%',
      prerequisites: [[10], [11]], // 10 또는 11
      ncCostMultiplier: 0.25
    })
  ];
}
