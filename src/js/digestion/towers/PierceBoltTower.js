import { BaseTower } from '../core/BaseTower.js';
import { UpgradeNode } from '../core/UpgradeNode.js';
import {
  TargetingModule,
  DamageModule,
  ProjectileModule,
  TagBonusModule,
  StatusModule,
  TriggerModule,
  SafetyModule
} from '../core/modules/index.js';

/**
 * 연동 관통 볼트기 (Pierce Bolt Tower)
 * 단일 화력 타워 - 라인형 중장갑 붕괴 특화
 */
export class PierceBoltTower extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);

    // 관통 카운터
    this.pierceKillCount = 0;
  }

  attack(food, currentTime = 0) {
    // 기본 공격 수행
    super.attack(food, currentTime);

    // 관통 처치 카운트 (노드 12번용)
    if (food.hp <= 0) {
      this.pierceKillCount++;
    }
  }
}

/**
 * 연동 관통 볼트기 업그레이드 노드 생성
 */
export function createPierceBoltUpgradeNodes() {
  return [
    // 1. 연동 정렬 핀 (TM)
    new UpgradeNode({
      id: 'piercebolt_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '연동 정렬 핀',
      modules: [
        new TargetingModule({
          priority: 'first' // 직선 경로 적중 보정은 시각적 효과
        })
      ],
      effect: '직선 경로 적중 보정 +20%',
      prerequisites: []
    }),

    // 2. 소화관 천공 강화 (PM)
    new UpgradeNode({
      id: 'piercebolt_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '소화관 천공 강화',
      modules: [
        new ProjectileModule({
          type: 'pierce',
          pierceCount: 1,
          pierceDamageFalloff: 0.15
        })
      ],
      effect: '관통 횟수 +1',
      prerequisites: [1]
    }),

    // 3. 잔사 절개 (DM+SM)
    new UpgradeNode({
      id: 'piercebolt_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '잔사 절개',
      modules: [
        new StatusModule({
          statusType: 'acid',
          statusValue: 0.15, // 15% DOT
          statusDuration: 2
        })
      ],
      effect: '관통 후 잔여 피해 15%를 DOT(2초)로 전환',
      prerequisites: [1]
    }),

    // 4. 지방막 절단날 (TB+SM)
    new UpgradeNode({
      id: 'piercebolt_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '지방막 절단날',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            fat: 1.25
          },
          tagEffects: {
            fat: {
              type: 'armorReduction',
              value: 12,
              duration: 3
            }
          }
        })
      ],
      effect: '지방 관통 시 방어 -12%(3초)',
      prerequisites: [2]
    }),

    // 5. 유당 분해 홈 (TB+PM)
    new UpgradeNode({
      id: 'piercebolt_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '유당 분해 홈',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            dairy: 1.3
          }
        }),
        new ProjectileModule({
          pierceDistanceBonus: 0.3
        })
      ],
      effect: '유제품 관통 시 추가 관통거리 +30%',
      prerequisites: [2]
    }),

    // 6. 단백질 결속 파열 (TB+DM)
    new UpgradeNode({
      id: 'piercebolt_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '단백질 결속 파열',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            protein: 1.35
          }
        }),
        new DamageModule({
          damageMultiplier: 1.2 // 뒤 타겟 증폭
        })
      ],
      effect: '단백질 관통 시 뒤 타겟 피해 증폭 20%',
      prerequisites: [3]
    }),

    // 7. 탄산 누출 밸브 (TB+SM+TR)
    new UpgradeNode({
      id: 'piercebolt_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '탄산 누출 밸브',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            soda: 1.3
          },
          tagEffects: {
            soda: {
              type: 'slow',
              value: 0.3,
              duration: 2
            }
          }
        })
      ],
      effect: '탄산 처치 시 경로 감속 지대 생성',
      prerequisites: [3]
    }),

    // 8. 소장 곡선 보정 (PM+SF)
    new UpgradeNode({
      id: 'piercebolt_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '소장 곡선 보정',
      modules: [
        new ProjectileModule({
          curveCompensation: 0.5
        })
      ],
      effect: '곡선 구간 관통 손실 50% 감소',
      prerequisites: [4, 6]
    }),

    // 9. 대장 정체 해소 (SM+DM)
    new UpgradeNode({
      id: 'piercebolt_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '대장 정체 해소',
      modules: [
        new DamageModule({
          damageMultiplier: 1.25
        })
      ],
      effect: '정체 상태 적 피해 +25% (디버프 2개 이상)',
      prerequisites: [5, 7]
    }),

    // 10. 장내균 공명 (TR+DM)
    new UpgradeNode({
      id: 'piercebolt_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '장내균 공명',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            const debuffCount = ctx.food.statusEffects?.length || 0;
            return debuffCount >= 2;
          },
          triggerEffect: (ctx) => {
            // 추가 히트 1회
            return { damage: ctx.damage * 1.3 };
          }
        })
      ],
      effect: '디버프 2개 이상 적 관통 시 추가 히트 1회',
      prerequisites: [8]
    }),

    // 11. 관문 일직선 방전 (TM+DM+TR)
    new UpgradeNode({
      id: 'piercebolt_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '관문 일직선 방전',
      modules: [
        new TargetingModule({
          priority: 'checkpoint'
        }),
        new DamageModule({
          critMultiplier: 3.0 // 치명타 배율 증가
        })
      ],
      effect: '체크포인트 축선 정렬 시 치명타 배율 +1.0',
      prerequisites: [9, 10]
    }),

    // 12. 잔류물 스윕 (TR+DM)
    new UpgradeNode({
      id: 'piercebolt_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '잔류물 스윕',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerEffect: (ctx) => {
            // 관통 처치 카운트 기반 피해 증가
            const killBonus = Math.min(ctx.tower.pierceKillCount * 0.05, 0.3);
            ctx.tower.pierceKillCount = 0; // 리셋
            return { damage: ctx.damage * (1 + killBonus) };
          }
        })
      ],
      effect: '관통 처치 수만큼 다음 샷 피해 최대 +30%',
      prerequisites: [11]
    })
  ];
}
