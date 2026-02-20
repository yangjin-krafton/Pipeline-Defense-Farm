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
 */
export function createAcidRailUpgradeNodes() {
  return [
    // 1. 파일럿 침샘 조준 (TM)
    new UpgradeNode({
      id: 'acidrail_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '파일럿 침샘 조준',
      modules: [
        new TargetingModule({
          targetSwitchSpeedBonus: 0.25
        })
      ],
      effect: '첫 타겟 전환 속도 +25%',
      prerequisites: []
    }),

    // 2. 위산 집중 코일 (DM)
    new UpgradeNode({
      id: 'acidrail_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '위산 집중 코일',
      modules: [
        new DamageModule({
          damageMultiplier: 1.18
        })
      ],
      effect: '단일 타격 피해 +18%',
      prerequisites: [1]
    }),

    // 3. 저작 표식 (TR+DM)
    new UpgradeNode({
      id: 'acidrail_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '저작 표식',
      modules: [
        new DamageModule({
          consecutiveHitBonus: 0.12,
          maxConsecutiveStacks: 3
        })
      ],
      effect: '동일 타겟 재타격 피해 +12%(최대 3중첩)',
      prerequisites: [1]
    }),

    // 4. 유제품 응고 파쇄 (TB+DM)
    new UpgradeNode({
      id: 'acidrail_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '유제품 응고 파쇄',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            dairy: 1.35
          }
        })
      ],
      effect: '유제품/치즈 대상 피해 +35%',
      prerequisites: [2]
    }),

    // 5. 단백질 가수분해 탄 (TB+SM)
    new UpgradeNode({
      id: 'acidrail_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '단백질 가수분해 탄',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            protein: 1.25
          },
          tagEffects: {
            protein: {
              type: 'armorReduction',
              value: 10,
              duration: 3
            }
          }
        })
      ],
      effect: '단백질 처치 시 주변 1기 방어 -10%',
      prerequisites: [2]
    }),

    // 6. 고지방 열분해 렌즈 (TB+SM)
    new UpgradeNode({
      id: 'acidrail_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '고지방 열분해 렌즈',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            fat: 1.25
          },
          tagEffects: {
            fat: {
              type: 'slow',
              value: 0.2,
              duration: 1.5
            }
          }
        })
      ],
      effect: '지방식 명중 시 이속 -20%(1.5초)',
      prerequisites: [3]
    }),

    // 7. 역류 차단 핀포인트 (TM+DM)
    new UpgradeNode({
      id: 'acidrail_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '역류 차단 핀포인트',
      modules: [
        new TargetingModule({
          priority: 'checkpoint',
          critChanceNearCheckpoint: 0.2
        })
      ],
      effect: '체크포인트 인접 적 치명타 확률 +20%',
      prerequisites: [3]
    }),

    // 8. 위벽 반사 안정화 (PM+SF)
    new UpgradeNode({
      id: 'acidrail_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '위벽 반사 안정화',
      modules: [
        new SafetyModule({
          minDamageGuarantee: 0.4
        })
      ],
      effect: '최소 피해 40% 보장',
      prerequisites: [4, 6]
    }),

    // 9. 산도 임계 가속 (TR+DM)
    new UpgradeNode({
      id: 'acidrail_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '산도 임계 가속',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return hpPercent <= 0.3;
          },
          triggerEffect: (ctx) => {
            // 공격 속도 증가는 타워에 임시 버프로 적용
            ctx.tower.tempAttackSpeedBonus = (ctx.tower.tempAttackSpeedBonus || 1) * 1.22;
            return {};
          }
        })
      ],
      effect: '대상 체력 30% 이하 발사 간격 -22%',
      prerequisites: [5, 7]
    }),

    // 10. 가스 포켓 천공 (TB+SM+TR)
    new UpgradeNode({
      id: 'acidrail_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '가스 포켓 천공',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            soda: 1.3
          },
          tagEffects: {
            soda: {
              type: 'explosion',
              radius: 50,
              slowAmount: 0.25
            }
          }
        })
      ],
      effect: '탄산 처치 시 소폭 폭발 + 둔화 25%',
      prerequisites: [6]
    }),

    // 11. 장문부 처형 알고리즘 (TR+DM)
    new UpgradeNode({
      id: 'acidrail_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '장문부 처형 알고리즘',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const isBossOrElite = ctx.food.traits?.includes('boss') || ctx.food.traits?.includes('elite');
            const hpPercent = ctx.food.hp / ctx.food.maxHp;
            return isBossOrElite && hpPercent <= 0.15;
          },
          triggerEffect: TriggerEffects.execute(),
          cooldown: 2 // 웨이브당 2회 제한 (간접적)
        })
      ],
      effect: '보스/엘리트 체력 15% 이하 즉시 분해(웨이브 2회)',
      prerequisites: [8, 9]
    }),

    // 12. 클린업 흡수 환원 (RM+TR)
    new UpgradeNode({
      id: 'acidrail_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '클린업 흡수 환원',
      modules: [
        new ResourceModule({
          nutritionOnKill: 1
        })
      ],
      effect: '처치 시 영양 +1 추가 획득',
      prerequisites: [10, 11]
    })
  ];
}
