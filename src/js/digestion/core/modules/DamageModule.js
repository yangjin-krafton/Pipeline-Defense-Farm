import { BaseModule } from './BaseModule.js';

/**
 * DM - DamageModule
 * 기본 피해/계수/치명 담당
 */
export class DamageModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    this.damageMultiplier = config.damageMultiplier || 1.0; // 피해 배율
    this.damageBonus = config.damageBonus || 0; // 고정 피해 보너스
    this.critChance = config.critChance || 0; // 치명타 확률 (0~1)
    this.critChanceBonus = config.critChanceBonus || 0; // 치명타 확률 보너스 (각인 중복용)
    this.critMultiplier = config.critMultiplier || 2.0; // 치명타 배율
    this.critMultiplierBonus = config.critMultiplierBonus || 0; // 치명타 배율 보너스 (2.0 기준 +0.6 등)
    this.critDamageBonus = config.critDamageBonus || 0; // critMultiplierBonus의 별칭
    this.minDamagePercent = config.minDamagePercent || 0; // 최소 피해 보장 (0~1)
    this.consecutiveHitBonus = config.consecutiveHitBonus || 0; // 동일 타겟 연속 타격 보너스
    this.maxConsecutiveStacks = config.maxConsecutiveStacks || 3;
    this.attackSpeedMultiplier = config.attackSpeedMultiplier || 1.0; // 공격속도 배율
    this.conditionalCheck = config.conditionalCheck || null; // 조건부 활성화 함수
  }

  _applyEffect(context) {
    let { damage, tower, food } = context;

    // 조건부 활성화 체크
    if (this.conditionalCheck && !this.conditionalCheck(context)) {
      return context; // 조건 미충족 시 효과 미적용
    }

    // 기본 피해 배율 적용 (곱연산, 각인 중복 시 누적)
    damage *= this.damageMultiplier;
    damage += this.damageBonus;

    // 연속 타격 보너스 (동일 타겟)
    if (this.consecutiveHitBonus > 0) {
      if (!tower.lastTarget) tower.lastTarget = null;
      if (!tower.consecutiveHits) tower.consecutiveHits = 0;

      if (tower.lastTarget === food.id) {
        tower.consecutiveHits = Math.min(
          tower.consecutiveHits + 1,
          this.maxConsecutiveStacks
        );
      } else {
        tower.consecutiveHits = 1;
        tower.lastTarget = food.id;
      }

      const stackBonus = tower.consecutiveHits * this.consecutiveHitBonus;
      damage *= (1 + stackBonus);
    }

    // 치명타 관련 수치를 context에 누적 (실제 판정은 BaseTower.js에서)
    if (this.critChance > 0) {
      context.critChance = (context.critChance || 0) + this.critChance;
    }

    if (this.critChanceBonus > 0) {
      context.critChanceBonus = (context.critChanceBonus || 0) + this.critChanceBonus;
    }

    // critDamageBonus와 critMultiplierBonus를 모두 지원 (별칭)
    const critMultBonus = this.critMultiplierBonus || this.critDamageBonus || 0;
    if (critMultBonus > 0) {
      context.critMultiplierBonus = (context.critMultiplierBonus || 0) + critMultBonus;
    }

    // 최소 피해 보장
    if (this.minDamagePercent > 0) {
      const originalDamage = tower.damage || damage;
      const minDamage = originalDamage * this.minDamagePercent;
      damage = Math.max(damage, minDamage);
    }

    context.damage = damage;
    return context;
  }
}
