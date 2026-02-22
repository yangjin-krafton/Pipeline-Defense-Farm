import { BaseTower } from '../core/BaseTower.js';
import { UpgradeNode } from '../core/UpgradeNode.js';
import {
  DamageModule,
  ProjectileModule,
  TagBonusModule
} from '../core/modules/index.js';

/**
 * 연동 관통 볼트기 (Pierce Bolt Tower)
 * 단일 화력 타워 - 라인형 중장갑 붕괴 특화
 */
export class PierceBoltTower extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);
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
 * 2026-02-22 재설계: 3x4 고정 구조 (A=기본공격형 / B=치명가속형 / C=다중관통형)
 * - A 라인 (1→4→7→10): 공격력 + 사거리 집중
 * - B 라인 (2→5→8→11): 치명타 + 공격속도 집중
 * - C 라인 (3→6→9→12): 관통 횟수 집중
 *
 * 각인 중복 메커니즘:
 * - DamageModule.damageMultiplier: 곱연산 중첩 (1.07 × 1.07 × ...)
 * - DamageModule.critChanceBonus: 가산 중첩 (+4%p × n)
 * - DamageModule.critMultiplierBonus: 가산 중첩 (+0.06 × n)
 * - DamageModule.attackSpeedMultiplier: 곱연산 중첩 (1.06 × 1.06 × ...)
 * - ProjectileModule.rangeMultiplier: 곱연산 중첩 (1.05 × 1.05 × ...)
 * - ProjectileModule.pierceCount: 가산 중첩 (+1 × n)
 * - TagBonusModule: 곱연산 중첩
 * - 각인 중복 비용 곡선: x1.0 → x1.5 → x2.2 → x3.2 → x4.5 → x6.2 → x8.5
 */
export function createPierceBoltUpgradeNodes() {
  return [
    // ── A 라인: 기본공격 (공격력 + 사거리) ────────────────────

    // 1. 정밀 탄두 기점 (분기 A) - DM+PM
    new UpgradeNode({
      id: 'piercebolt_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '정밀 탄두 기점',
      modules: [
        new DamageModule({
          damageMultiplier: 1.07  // 공격력 +7% [각인 중복: 곱연산]
        }),
        new ProjectileModule({
          rangeMultiplier: 1.05   // 사거리 +5% [각인 중복: 곱연산]
        })
      ],
      effect: '공격력 +7%, 사거리 +5%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 4. 정밀 탄두 I (중간 A) - DM+PM+TB
    new UpgradeNode({
      id: 'piercebolt_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '정밀 탄두 I',
      modules: [
        new DamageModule({
          damageMultiplier: 1.06  // 공격력 +6% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ carb: 1.12 })  // carb 대상 추가 피해 +12% [각인 중복: 곱연산]
      ],
      effect: '공격력 +6%, carb 대상 추가 피해 +12%',
      prerequisites: [[1]],
      ncCostMultiplier: 0.10
    }),

    // 7. 정밀 탄두 II (중간 A) - DM+PM+TB
    new UpgradeNode({
      id: 'piercebolt_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '정밀 탄두 II',
      modules: [
        new DamageModule({
          damageMultiplier: 1.08  // 공격력 +8% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ protein: 1.16 })  // protein 대상 추가 피해 +16% [각인 중복: 곱연산]
      ],
      effect: '공격력 +8%, protein 대상 추가 피해 +16%',
      prerequisites: [[4]],
      ncCostMultiplier: 0.13
    }),

    // 10. 정밀 포격 필살 (끝 A) - DM+PM+TR
    new UpgradeNode({
      id: 'piercebolt_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '정밀 포격 필살',
      modules: [
        new DamageModule({
          damageMultiplier: 1.10,    // 공격력 +10% [각인 중복: 곱연산]
          critMultiplierBonus: 0.04  // 치명타 피해 +4% [각인 중복: 가산]
        }),
        new ProjectileModule({
          rangeMultiplier: 1.08  // 사거리 +8% [각인 중복: 곱연산]
        })
      ],
      effect: '공격력 +10%, 사거리 +8%, 치명타 피해 +4%',
      prerequisites: [[7]],
      ncCostMultiplier: 0.18
    }),

    // ── B 라인: 치명가속 (치명타 + 공격속도) ──────────────────

    // 2. 급소 연사 기점 (분기 B) - DM+SF
    new UpgradeNode({
      id: 'piercebolt_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '급소 연사 기점',
      modules: [
        new DamageModule({
          critChanceBonus: 0.04,       // 치명타 확률 +4%p [각인 중복: 가산]
          attackSpeedMultiplier: 1.06  // 공격속도 +6% [각인 중복: 곱연산]
        })
      ],
      effect: '치명타 확률 +4%, 공격속도 +6%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 5. 급소 연사 I (중간 B) - DM+SF+TB
    new UpgradeNode({
      id: 'piercebolt_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '급소 연사 I',
      modules: [
        new DamageModule({
          critChanceBonus: 0.03  // 치명타 확률 +3%p [각인 중복: 가산]
        }),
        new TagBonusModule({ spicy: 1.14 })  // spicy 대상 추가 피해 +14% [각인 중복: 곱연산]
      ],
      effect: '치명타 확률 +3%, spicy 대상 추가 피해 +14%',
      prerequisites: [[2]],
      ncCostMultiplier: 0.10
    }),

    // 8. 급소 연사 II (중간 B) - DM+SF+TB
    new UpgradeNode({
      id: 'piercebolt_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '급소 연사 II',
      modules: [
        new DamageModule({
          critMultiplierBonus: 0.06  // 치명타 피해 +6% [각인 중복: 가산]
        }),
        new TagBonusModule({ dairy: 1.13 })  // dairy 대상 추가 피해 +13% [각인 중복: 곱연산]
      ],
      effect: '치명타 피해 +6%, dairy 대상 추가 피해 +13%',
      prerequisites: [[5]],
      ncCostMultiplier: 0.13
    }),

    // 11. 급소 연사 필살 (끝 B) - DM+SF+TR
    new UpgradeNode({
      id: 'piercebolt_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '급소 연사 필살',
      modules: [
        new DamageModule({
          critChanceBonus: 0.05,       // 치명타 확률 +5%p [각인 중복: 가산]
          critMultiplierBonus: 0.08,   // 치명타 피해 +8% [각인 중복: 가산]
          attackSpeedMultiplier: 1.08  // 공격속도 +8% [각인 중복: 곱연산]
        })
      ],
      effect: '치명타 확률 +5%, 치명타 피해 +8%, 공격속도 +8%',
      prerequisites: [[8]],
      ncCostMultiplier: 0.20
    }),

    // ── C 라인: 다중관통 (관통 횟수 + TB) ────────────────────

    // 3. 다중 관통 기점 (분기 C) - PM+DM
    new UpgradeNode({
      id: 'piercebolt_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '다중 관통 기점',
      modules: [
        new ProjectileModule({
          pierceCount: 1  // 관통 횟수 +1 [각인 중복: 가산]
        })
      ],
      effect: '관통 횟수 +1',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 6. 다중 관통 I (중간 C) - PM+TB
    new UpgradeNode({
      id: 'piercebolt_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '다중 관통 I',
      modules: [
        new ProjectileModule({
          pierceCount: 1  // 관통 횟수 +1 [각인 중복: 가산]
        }),
        new TagBonusModule({ fat: 1.10 })  // fat 대상 추가 피해 +10% [각인 중복: 곱연산]
      ],
      effect: '관통 횟수 +1, fat 대상 추가 피해 +10%',
      prerequisites: [[3]],
      ncCostMultiplier: 0.10
    }),

    // 9. 다중 관통 II (중간 C) - PM+DM+TB
    new UpgradeNode({
      id: 'piercebolt_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '다중 관통 II',
      modules: [
        new ProjectileModule({
          pierceCount: 1  // 관통 횟수 +1 [각인 중복: 가산]
        }),
        new TagBonusModule({ fermented: 1.15 })  // fermented 대상 추가 피해 +15% [각인 중복: 곱연산]
      ],
      effect: '관통 횟수 +1, fermented 대상 추가 피해 +15%',
      prerequisites: [[6]],
      ncCostMultiplier: 0.13
    }),

    // 12. 다중 관통 필살 (끝 C) - PM+DM+TR
    new UpgradeNode({
      id: 'piercebolt_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '다중 관통 필살',
      modules: [
        new DamageModule({
          damageMultiplier: 1.10  // 공격력 +10% [각인 중복: 곱연산]
        }),
        new ProjectileModule({
          pierceCount: 2  // 관통 횟수 +2 [각인 중복: 가산]
        })
      ],
      effect: '공격력 +10%, 관통 횟수 +2',
      prerequisites: [[9]],
      ncCostMultiplier: 0.22
    })
  ];
}
