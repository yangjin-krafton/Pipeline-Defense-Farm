import { BaseTower } from '../core/BaseTower.js';
import { UpgradeNode } from '../core/UpgradeNode.js';
import {
  DamageModule,
  TriggerModule,
  TagBonusModule
} from '../core/modules/index.js';

function hexToRgba(hex, alpha = 1.0) {
  const normalized = hex.replace('#', '');
  const fullHex = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;

  const int = parseInt(fullHex, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  return [r, g, b, alpha];
}

/**
 * 위산 레일 주입기 (Acid Rail Injector)
 * 단일 화력 타워 - 보스/엘리트 1체 삭제 특화
 */
export class AcidRailTower extends BaseTower {
  constructor(slotData, definition, bulletSystem = null, particleSystem = null) {
    super(slotData, definition, bulletSystem, particleSystem);
  }

  // 💉 emoji 기준: 기본 자세에서 바늘이 우상향이라 -45deg를 총구 로컬 각도로 사용.
  getTowerMuzzleLocalAngle() {
    return -Math.PI / 4;
  }

  getProjectileSpeed(context) {
    return super.getProjectileSpeed(context) * 3;
  }

  /**
   * Acid Rail bullet: fast, thin, elongated droplet/needle style.
   */
  getBulletRenderStyle(context, isSecondary = false) {
    if (isSecondary) {
      return {
        stretch: 2.5,
        thickness: 0.50,
        glow: 0.42
      };
    }

    return {
      stretch: 5.4,
      thickness: 0.51,
      glow: 0.50
    };
  }

  /**
   * Muzzle effect: liquid pop burst ("찍!").
   */
  emitBulletSpawnEffect(bullet, context, isSecondary = false) {
    if (!this.particleSystem) return;

    const forward = Number.isFinite(bullet.rotation) ? bullet.rotation : 0;
    const splashColor = hexToRgba('#38ff52', 1.0);
    const mistColor = hexToRgba('#9effad', 0.9);
    const x = bullet.x;
    const y = bullet.y;

    // Forward jet burst from muzzle.
    this.particleSystem.emit(x, y, isSecondary ? 5 : 8, splashColor, isSecondary ? 180 : 230, 0.28, {
      spread: Math.PI / 2.2,
      direction: forward,
      gravity: 85,
      sizeMin: 10.0,
      sizeMax: isSecondary ? 14.6 : 16.2,
      colorVariation: 0.2
    });

    // Back pressure mist for "pop" feeling.
    this.particleSystem.emit(x, y, isSecondary ? 7 : 10, mistColor, 120, 0.24, {
      spread: Math.PI / 2.8,
      direction: forward + Math.PI,
      gravity: 40,
      sizeMin: 11.5,
      sizeMax: isSecondary ? 14.2 : 15.6,
      colorVariation: 0.1
    });
  }

  /**
   * Impact effect: directional liquid burst.
   */
  emitBulletHitEffect(bullet, target, particleSystem, context, isSecondary = false) {
    if (!particleSystem) return;

    const forward = Number.isFinite(bullet.rotation)
      ? bullet.rotation
      : Math.atan2(bullet.lastDirY || 0, bullet.lastDirX || 1);

    const impactColor = hexToRgba('#2efb42', 1.0);
    const dropletColor = hexToRgba('#8fff9e', 0.92);

    // Main directional splash cone.
    particleSystem.emit(bullet.x, bullet.y, isSecondary ? 4 : 6, impactColor, isSecondary ? 180 : 250, 0.42, {
      spread: Math.PI / 1.9,
      direction: forward,
      gravity: 240,
      sizeMin: 12.2,
      sizeMax: isSecondary ? 15.0 : 17.0,
      colorVariation: 0.24
    });

    // Side droplets.
    particleSystem.emit(bullet.x, bullet.y, isSecondary ? 10 : 16, dropletColor, isSecondary ? 130 : 180, 0.36, {
      spread: Math.PI * 1.1,
      direction: forward + 0.12,
      gravity: 260,
      sizeMin: 11.6,
      sizeMax: isSecondary ? 14.2 : 15.6,
      colorVariation: 0.24
    });

    // Keep a small generic hit sparkle for readability.
    particleSystem.emitHitEffect(bullet.x, bullet.y, bullet.color, bullet.damage);
  }
}

/**
 * 위산 레일 주입기 업그레이드 노드 생성
 * 재설계 방향 (3x4 고정): 시작 분기 A 치명타 / B 공격속도 / C 마크 표식
 * 역할 고정: 단일 고위협 마무리 전담 (표식 송신 + 취약/감전 수신)
 *
 * 2026-02-22 개정: 3x4 고정 구조, 라인별 테마 고정, 각인 7중첩 안전성 확보
 * - A 라인 (1→4→7→10): 치명타 확률/피해 집중
 * - B 라인 (2→5→8→11): 공격속도 집중
 * - C 라인 (3→6→9→12): mark 부여 + 표식 대상 피해
 *
 * 각인 중복 메커니즘:
 * - DamageModule.damageMultiplier: 곱연산 중첩 (1.02 × 1.02 × ...)
 * - DamageModule.critChanceBonus: 가산 중첩 (+5%p × n)
 * - DamageModule.critMultiplierBonus: 가산 중첩 (+0.08 × n)
 * - DamageModule.attackSpeedMultiplier: 곱연산 중첩 (1.05 × 1.05 × ...)
 * - TriggerModule mark 부여: 독립 확률 중첩 (각 노드 별도 roll)
 * - 각인 중복 비용 곡선: x1.0 → x1.5 → x2.2 → x3.2 → x4.5 → x6.2 → x8.5
 */
export function createAcidRailUpgradeNodes() {
  return [
    // ── A 라인: 치명타 ──────────────────────────────────────

    // 1. 치명 기점 (분기 A) - DM
    // 각인 중복 시: 치명타 확률 가산(+5%p × n)
    new UpgradeNode({
      id: 'acidrail_node_1',
      nodeNumber: 1,
      position: 'branch',
      name: '치명 기점',
      modules: [
        new DamageModule({
          critChanceBonus: 0.05  // 치명타 확률 +5%p [각인 중복: 가산]
        })
      ],
      effect: '치명타 확률 +5%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 4. 치명 균형 I (중간 A) - DM+TB
    // 각인 중복 시: 치명타 확률 가산(+4%p × n), carb 피해 곱연산(×1.04^n)
    new UpgradeNode({
      id: 'acidrail_node_4',
      nodeNumber: 4,
      position: 'mid',
      name: '치명 균형 I',
      modules: [
        new DamageModule({
          critChanceBonus: 0.04  // 치명타 확률 +4%p [각인 중복: 가산]
        }),
        new TagBonusModule({ carb: 1.12 })  // carb 대상 추가 피해 +12% [각인 중복: 곱연산]
      ],
      effect: '치명타 확률 +4%, carb 대상 추가 피해 +12%',
      prerequisites: [[1]],
      ncCostMultiplier: 0.10
    }),

    // 7. 치명 집중 II (중간 A) - DM+TB
    // 각인 중복 시: 치명타 피해 가산(+0.08 × n), protein 피해 곱연산(×1.16^n)
    new UpgradeNode({
      id: 'acidrail_node_7',
      nodeNumber: 7,
      position: 'mid',
      name: '치명 집중 II',
      modules: [
        new DamageModule({
          critMultiplierBonus: 0.08  // 치명타 피해 +8% [각인 중복: 가산]
        }),
        new TagBonusModule({ protein: 1.16 })  // protein 대상 추가 피해 +16% [각인 중복: 곱연산]
      ],
      effect: '치명타 피해 +8%, protein 대상 추가 피해 +16%',
      prerequisites: [[4]],
      ncCostMultiplier: 0.13
    }),

    // 10. 치명 필살 (끝 A) - DM
    // 각인 중복 시: 치명타 확률 가산(+8%p × n), 치명타 피해 가산(+0.14 × n), 공격력 곱연산(×1.08^n)
    new UpgradeNode({
      id: 'acidrail_node_10',
      nodeNumber: 10,
      position: 'end',
      name: '치명 필살',
      modules: [
        new DamageModule({
          critChanceBonus: 0.08,     // 치명타 확률 +8%p [각인 중복: 가산]
          critMultiplierBonus: 0.14, // 치명타 피해 +14% [각인 중복: 가산]
          damageMultiplier: 1.08     // 공격력 +8% [각인 중복: 곱연산]
        })
      ],
      effect: '치명타 확률 +8%, 치명타 피해 +14%, 공격력 +8%',
      prerequisites: [[7]],
      ncCostMultiplier: 0.18
    }),

    // ── B 라인: 공격속도 ─────────────────────────────────────

    // 2. 가속 기점 (분기 B) - DM
    // 각인 중복 시: 공격속도 곱연산(×1.05^n)
    new UpgradeNode({
      id: 'acidrail_node_2',
      nodeNumber: 2,
      position: 'branch',
      name: '가속 기점',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.05  // 공격속도 +5% [각인 중복: 곱연산]
        })
      ],
      effect: '공격속도 +5%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 5. 가속 균형 I (중간 B) - DM+TB
    // 각인 중복 시: 공격속도 곱연산(×1.04^n), fat 피해 곱연산(×1.03^n)
    new UpgradeNode({
      id: 'acidrail_node_5',
      nodeNumber: 5,
      position: 'mid',
      name: '가속 균형 I',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.04  // 공격속도 +4% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ fat: 1.14 })  // fat 대상 추가 피해 +14% [각인 중복: 곱연산]
      ],
      effect: '공격속도 +4%, fat 대상 추가 피해 +14%',
      prerequisites: [[2]],
      ncCostMultiplier: 0.10
    }),

    // 8. 가속 균형 II (중간 B) - DM+TB
    // 각인 중복 시: 공격속도 곱연산(×1.07^n), dairy 피해 곱연산(×1.03^n)
    new UpgradeNode({
      id: 'acidrail_node_8',
      nodeNumber: 8,
      position: 'mid',
      name: '가속 균형 II',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.07  // 공격속도 +7% [각인 중복: 곱연산]
        }),
        new TagBonusModule({ dairy: 1.13 })  // dairy 대상 추가 피해 +13% [각인 중복: 곱연산]
      ],
      effect: '공격속도 +7%, dairy 대상 추가 피해 +13%',
      prerequisites: [[5]],
      ncCostMultiplier: 0.13
    }),

    // 11. 가속 필살 (끝 B) - DM
    // 각인 중복 시: 공격속도 곱연산(×1.12^n), 공격력 곱연산(×1.10^n), 치명타 피해 가산(+0.06 × n)
    new UpgradeNode({
      id: 'acidrail_node_11',
      nodeNumber: 11,
      position: 'end',
      name: '가속 필살',
      modules: [
        new DamageModule({
          attackSpeedMultiplier: 1.12,  // 공격속도 +12% [각인 중복: 곱연산]
          damageMultiplier: 1.10,       // 공격력 +10% [각인 중복: 곱연산]
          critMultiplierBonus: 0.06     // 치명타 피해 +6% [각인 중복: 가산]
        })
      ],
      effect: '공격속도 +12%, 공격력 +10%, 치명타 피해 +6%',
      prerequisites: [[8]],
      ncCostMultiplier: 0.20
    }),

    // ── C 라인: 마크 표식 ────────────────────────────────────

    // 3. 표식 기점 (분기 C) - SM+TR
    // 각인 중복 시: 명중 시 mark 부여 독립 확률 +6%p (각 각인이 별도 roll)
    new UpgradeNode({
      id: 'acidrail_node_3',
      nodeNumber: 3,
      position: 'branch',
      name: '표식 기점',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: () => Math.random() < 0.06,
          triggerEffect: () => ({
            statusEffect: { type: 'mark', stacks: 1, duration: 4 }
          })
        })
      ],
      effect: '명중 시 mark 부여율 +6%',
      prerequisites: [],
      ncCostMultiplier: 0.08
    }),

    // 6. 표식 균형 I (중간 C) - SM+TR+TB
    // 각인 중복 시: mark 부여 독립 확률 +4%p, soda 피해 곱연산(×1.10^n)
    new UpgradeNode({
      id: 'acidrail_node_6',
      nodeNumber: 6,
      position: 'mid',
      name: '표식 균형 I',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: () => Math.random() < 0.04,
          triggerEffect: () => ({
            statusEffect: { type: 'mark', stacks: 1, duration: 4 }
          })
        }),
        new TagBonusModule({ soda: 1.10 })  // soda 대상 추가 피해 +10% [각인 중복: 곱연산]
      ],
      effect: 'mark 부여율 +4%, soda 대상 추가 피해 +10%',
      prerequisites: [[3]],
      ncCostMultiplier: 0.10
    }),

    // 9. 표식 균형 II (중간 C) - SM+TR+TB
    // 각인 중복 시: 표식 대상 피해 가산(+8% × n), fermented 피해 곱연산(×1.15^n)
    new UpgradeNode({
      id: 'acidrail_node_9',
      nodeNumber: 9,
      position: 'mid',
      name: '표식 균형 II',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => ctx.food.statusEffects?.some(e => e.type === 'mark'),
          triggerEffect: () => ({
            damageBonus: 0.08  // 표식 대상 피해 +8% [각인 중복: 가산]
          })
        }),
        new TagBonusModule({ fermented: 1.15 })  // fermented 대상 추가 피해 +15% [각인 중복: 곱연산]
      ],
      effect: '표식 대상 피해 +8%, fermented 대상 추가 피해 +15%',
      prerequisites: [[6]],
      ncCostMultiplier: 0.13
    }),

    // 12. 표식 필살 집행 (끝 C) - SM+TR+DM
    // 각인 중복 시: mark 부여 독립 확률 +8%p, 표식 대상 피해 가산(+16% × n), 공격력 곱연산(×1.08^n)
    new UpgradeNode({
      id: 'acidrail_node_12',
      nodeNumber: 12,
      position: 'end',
      name: '표식 필살 집행',
      modules: [
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: () => Math.random() < 0.08,
          triggerEffect: () => ({
            statusEffect: { type: 'mark', stacks: 1, duration: 4 }
          })
        }),
        new TriggerModule({
          triggerType: 'onHit',
          triggerCondition: (ctx) => ctx.food.statusEffects?.some(e => e.type === 'mark'),
          triggerEffect: () => ({
            damageBonus: 0.16  // 표식 대상 피해 +16% [각인 중복: 가산]
          })
        }),
        new DamageModule({
          damageMultiplier: 1.08  // 공격력 +8% [각인 중복: 곱연산]
        })
      ],
      effect: 'mark 부여율 +8%, 표식 대상 피해 +16%, 공격력 +8%',
      prerequisites: [[9]],
      ncCostMultiplier: 0.22
    })
  ];
}
