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

    // 노드 10: 샷 카운트 기반 공명 타이밍
    this.pierceResonanceCounter = 0;

    // 노드 12: 관통 처치 기반 다음 샷 보너스
    this.lineSweepStacks = 0;
  }

  // Default muzzle local angle for this emoji.
  getTowerMuzzleLocalAngle() {
    return -Math.PI / 4;
  }

  // 기본 대비 50% 더 큰 총알
  getBulletBaseSize() {
    return 7.5;
  }

  /**
   * 관통 볼트: 원형 유지. 트레일은 별도 WebGL2 이펙트로 표현.
   */
  getBulletRenderStyle(context, isSecondary = false) {
    if (isSecondary) {
      return { stretch: 1.0, thickness: 1.0, glow: 0.45 };
    }
    return { stretch: 1.0, thickness: 1.0, glow: 0.60 };
  }

  /**
   * 발사 이펙트: 전방 예리한 에너지 섬광 + 측면 스파크.
   */
  emitBulletSpawnEffect(bullet, context, isSecondary = false) {
    if (!this.particleSystem) return;

    const forward = Number.isFinite(bullet.rotation) ? bullet.rotation : 0;
    const c = bullet.color || [0.8, 0.2, 1.0, 1.0];

    // 전방 섬광: 볼트 출발 방향으로 좁고 빠른 플래시
    const flash = [
      Math.min(1, c[0] + 0.15),
      Math.min(1, c[1] + 0.35),
      Math.min(1, c[2] + 0.0),
      0.90
    ];
    this.particleSystem.emit(
      bullet.x, bullet.y,
      isSecondary ? 4 : 7,
      flash,
      isSecondary ? 180 : 240,
      0.14,
      {
        spread: Math.PI / 10,
        direction: forward,
        gravity: 0,
        sizeMin: isSecondary ? 3 : 5,
        sizeMax: isSecondary ? 7 : 11,
        colorVariation: 0.10
      }
    );

    // 측면 에너지 스파크
    const spark = [0.92, 0.58, 1.0, 0.80];
    this.particleSystem.emit(
      bullet.x, bullet.y,
      isSecondary ? 3 : 5,
      spark,
      100,
      0.22,
      {
        spread: Math.PI / 2.5,
        direction: forward,
        gravity: 50,
        sizeMin: 2,
        sizeMax: isSecondary ? 4 : 6,
        colorVariation: 0.14
      }
    );
  }

  /**
   * 피격 이펙트: 전방 관통 파편 + 수직 방향 에너지 산개.
   * 관통 탄의 특성상 볼트가 계속 진행하는 느낌을 강조.
   */
  emitBulletHitEffect(bullet, target, particleSystem, context, isSecondary = false) {
    if (!particleSystem) return;

    const forward = Number.isFinite(bullet.rotation)
      ? bullet.rotation
      : Math.atan2(bullet.lastDirY || 0, bullet.lastDirX || 1);
    const c = bullet.color || [0.8, 0.2, 1.0, 1.0];

    // 전방 관통 파편: 볼트 진행 방향으로 흩어짐
    const shatter = [
      Math.min(1, c[0] + 0.18),
      Math.min(1, c[1] + 0.38),
      Math.min(1, c[2] - 0.08),
      0.88
    ];
    particleSystem.emit(
      bullet.x, bullet.y,
      isSecondary ? 4 : 8,
      shatter,
      isSecondary ? 140 : 190,
      0.20,
      {
        spread: Math.PI / 3.5,
        direction: forward,
        gravity: 90,
        sizeMin: isSecondary ? 4 : 6,
        sizeMax: isSecondary ? 8 : 13,
        colorVariation: 0.18
      }
    );

    // 수직 에너지 산개: 측면으로 퍼지는 충격파 느낌
    const burst = [
      c[0] * 0.85 + 0.10,
      c[1] * 0.85 + 0.28,
      c[2] * 0.85,
      0.70
    ];
    particleSystem.emit(
      bullet.x, bullet.y,
      isSecondary ? 3 : 5,
      burst,
      80,
      0.26,
      {
        spread: Math.PI * 0.7,
        direction: forward + Math.PI / 2,
        gravity: 120,
        sizeMin: isSecondary ? 3 : 5,
        sizeMax: isSecondary ? 6 : 9,
        colorVariation: 0.20
      }
    );

    particleSystem.emitHitEffect(bullet.x, bullet.y, bullet.color, bullet.damage);
  }

  /**
   * 비주얼 설정: 트레일 강제 활성화 및 관통 에너지 스트리크 오버라이드.
   * 총알 인스턴스의 emitTrail을 직접 교체해 WebGL2 파티클 기반 에너지 잔상 구현.
   */
  configureBulletVisuals(bullet, context, isSecondary = false) {
    super.configureBulletVisuals(bullet, context, isSecondary);

    // 관통 직진: 발사 순간 타겟 방향으로 고정, 적 움직임 추적 없음
    bullet.homing = false;
    const angle = Number.isFinite(bullet.rotation) ? bullet.rotation : 0;
    bullet.dirX = Math.cos(angle);
    bullet.dirY = Math.sin(angle);

    // Ghost 잔상 트레일: 파티클 대신 동일한 총알 구슬을 BulletRenderer로 복사
    // 크기/색상/글로우가 원본과 완벽히 일치하며, 뒤로 갈수록 페이드 처리
    bullet.hasTrail = true;
    bullet.trailCapacity = isSecondary ? 4 : 8;
    bullet.trailPositions = []; // [{x, y}, ...] — index 0 이 가장 최근
    bullet.trailInterval = isSecondary ? 0.018 : 0.012;

    // emitTrail: 파티클 emit 대신 위치 버퍼에 push
    bullet.emitTrail = function (/* ps */) {
      this.trailPositions.unshift({ x: this.x, y: this.y });
      if (this.trailPositions.length > this.trailCapacity) {
        this.trailPositions.pop();
      }
    };
  }
}

/**
 * 연동 관통 볼트기 업그레이드 노드 생성
 * 2026-02-22 개정: 직선관통 라인형 리뉴얼
 */
export function createPierceBoltUpgradeNodes() {
  return [
    // 1. 축선 천공 핀 (TM+PM)
    new UpgradeNode({
      id: 'piercebolt_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '축선 천공 핀',
      modules: [
        new TargetingModule({
          priority: 'first'
        }),
        new ProjectileModule({
          type: 'pierce',
          pierceDistanceBonus: 0.10
        })
      ],
      effect: '직선 축선 적중 보정 +12%, 관통 거리 +10%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 2. 심부 관통 바렐 (PM)
    new UpgradeNode({
      id: 'piercebolt_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '심부 관통 바렐',
      modules: [
        new ProjectileModule({
          type: 'pierce',
          pierceCount: 1,
          pierceDamageFalloff: 0.14
        })
      ],
      effect: '관통 횟수 +1, 탄 크기 +8%',
      prerequisites: [],
      ncCostMultiplier: 0.09
    }),

    // 3. 압축 중탄 챔버 (PM+DM)
    new UpgradeNode({
      id: 'piercebolt_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '압축 중탄 챔버',
      modules: [
        new ProjectileModule({
          type: 'pierce',
          pierceDamageFalloff: 0.10
        }),
        new DamageModule({
          damageMultiplier: 1.10
        })
      ],
      effect: '탄 크기 +15%, 관통 피해 +10%',
      prerequisites: [],
      ncCostMultiplier: 0.10
    }),

    // 4. 지방막 절삭날 (TB+SM+DM)
    new UpgradeNode({
      id: 'piercebolt_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '지방막 절삭날',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            fat: 1.08
          },
          tagEffects: {
            fat: {
              type: 'armorReduction',
              value: 0.10,
              duration: 3
            }
          }
        }),
        new DamageModule({
          damageMultiplier: 1.08,
          conditionalCheck: (ctx) => ctx.food.tags?.includes('fat')
        })
      ],
      effect: 'fat 관통 시 방어 -10%(3초), 관통 피해 +8%',
      prerequisites: [[1]],
      ncCostMultiplier: 0.12
    }),

    // 5. 유당 도관 확장 (TB+PM)
    new UpgradeNode({
      id: 'piercebolt_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '유당 도관 확장',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            dairy: 1.10
          }
        }),
        new ProjectileModule({
          pierceDistanceBonus: 0.22
        })
      ],
      effect: 'dairy 관통 시 관통 거리 +22%, 탄 크기 +10%',
      prerequisites: [[2]],
      ncCostMultiplier: 0.12
    }),

    // 6. 단백질 파열 천공 (TB+DM+PM)
    new UpgradeNode({
      id: 'piercebolt_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '단백질 파열 천공',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            protein: 1.18
          }
        }),
        new DamageModule({
          damageMultiplier: 1.18,
          conditionalCheck: (ctx) => ctx.food.tags?.includes('protein')
        }),
        new ProjectileModule({
          pierceCount: 1
        })
      ],
      effect: 'protein 관통 시 후열 피해 +18%, 관통 횟수 +1',
      prerequisites: [[3]],
      ncCostMultiplier: 0.13
    }),

    // 7. 탄산 장갑 침식 (TB+SM+TR)
    new UpgradeNode({
      id: 'piercebolt_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '탄산 장갑 침식',
      modules: [
        new TagBonusModule({
          tagBonuses: {
            soda: 1.08
          },
          tagEffects: {
            soda: {
              type: 'armorReduction',
              value: 0.08,
              duration: 3
            }
          }
        }),
        new StatusModule({
          statusType: 'corrode',
          statusValue: 0.08,
          statusDuration: 3
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => ctx.food.tags?.includes('soda'),
          triggerEffect: () => ({
            statusEffect: { type: 'corrode', value: 0.08, duration: 3 }
          })
        })
      ],
      effect: 'soda 관통 시 방어 -8% 누적, 최대 3중첩',
      prerequisites: [[4]],
      ncCostMultiplier: 0.14
    }),

    // 8. 직선 관통 유지장치 (PM+SF+DM)
    new UpgradeNode({
      id: 'piercebolt_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '직선 관통 유지장치',
      modules: [
        new ProjectileModule({
          curveCompensation: 0.40
        }),
        new SafetyModule({
          minDamageGuarantee: 0.60
        }),
        new DamageModule({
          damageMultiplier: 1.10
        })
      ],
      effect: '직선 구간 관통 손실 -40%, 관통 피해 +10%',
      prerequisites: [[5]],
      ncCostMultiplier: 0.15
    }),

    // 9. 중탄 압착 관통 (PM+DM+SM)
    new UpgradeNode({
      id: 'piercebolt_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '중탄 압착 관통',
      modules: [
        new ProjectileModule({
          pierceDamageFalloff: 0.08
        }),
        new DamageModule({
          damageMultiplier: 1.20,
          conditionalCheck: (ctx) => (ctx.food.armor || 0) >= 15
        }),
        new StatusModule({
          statusType: 'corrode',
          statusValue: 0.04,
          statusDuration: 2
        })
      ],
      effect: '탄 크기 +12%, 방어 높은 적(15+) 대상 피해 +20%',
      prerequisites: [[6]],
      ncCostMultiplier: 0.16
    }),

    // 10. 관통 공명 증폭기 (TR+PM+DM)
    new UpgradeNode({
      id: 'piercebolt_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '관통 공명 증폭기',
      modules: [
        new ProjectileModule({
          type: 'pierce'
        }),
        new DamageModule({
          damageMultiplier: 1.0
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => {
            ctx.tower.pierceResonanceCounter = (ctx.tower.pierceResonanceCounter || 0) + 1;
            return ctx.tower.pierceResonanceCounter >= 3;
          },
          triggerEffect: (ctx) => {
            ctx.tower.pierceResonanceCounter = 0;
            // damageBonus(현재 샷 증폭) 대신 secondaryDamage(별도 추가 타격 65%)로 발사
            return { secondaryDamage: 0.65 };
          }
        })
      ],
      effect: '관통 3회 이상 샷에 추가 타격 1회(65%)',
      prerequisites: [[7]],
      ncCostMultiplier: 0.18
    }),

    // 11. 관문 일자 붕괴 (TM+DM+SM)
    new UpgradeNode({
      id: 'piercebolt_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '관문 일자 붕괴',
      modules: [
        new TargetingModule({
          priority: 'checkpoint'
        }),
        new DamageModule({
          damageMultiplier: 1.20
        }),
        new StatusModule({
          statusType: 'corrode',
          statusValue: 0.15,
          statusDuration: 2
        })
      ],
      effect: '관문 축선 정렬 시 방어 -15%(2초), 피해 +20%',
      prerequisites: [[8]],
      ncCostMultiplier: 0.22
    }),

    // 12. 초중량 라인 스윕 (PM+TR+DM)
    new UpgradeNode({
      id: 'piercebolt_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '초중량 라인 스윕',
      modules: [
        new ProjectileModule({
          type: 'pierce',
          pierceCount: 1
        }),
        new TriggerModule({
          triggerType: 'onHit',
          // onHit이 onKill보다 먼저: 이전 샷에서 쌓인 스택을 소비하고,
          // 이후 onKill이 현재 샷의 처치 스택을 다음 샷을 위해 적립한다.
          triggerEffect: (ctx) => {
            const stacks = ctx.tower.lineSweepStacks || 0;
            if (stacks <= 0) return {};
            ctx.tower.lineSweepStacks = 0;
            return { damageBonus: Math.min(stacks * 0.10, 0.30) };
          }
        }),
        new TriggerModule({
          triggerType: 'onKill',
          triggerEffect: (ctx) => {
            ctx.tower.lineSweepStacks = Math.min((ctx.tower.lineSweepStacks || 0) + 1, 3);
            return {};
          }
        }),
        new DamageModule({
          damageMultiplier: 1.0
        })
      ],
      effect: '탄 크기 +20%, 관통 횟수 +1, 관통 처치 기반 다음 샷 최대 +30%',
      prerequisites: [[9]],
      ncCostMultiplier: 0.25
    })
  ];
}
