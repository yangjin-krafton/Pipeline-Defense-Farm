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
    this.critMultiplier = config.critMultiplier || 2.0; // 치명타 배율
    this.minDamagePercent = config.minDamagePercent || 0; // 최소 피해 보장 (0~1)
    this.consecutiveHitBonus = config.consecutiveHitBonus || 0; // 동일 타겟 연속 타격 보너스
    this.maxConsecutiveStacks = config.maxConsecutiveStacks || 3;
  }

  _applyEffect(context) {
    let { damage, tower, food } = context;

    // 기본 피해 배율 적용
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

    // 치명타 판정
    const totalCritChance = this.critChance + (context.critChance || 0);
    if (totalCritChance > 0 && Math.random() < totalCritChance) {
      damage *= this.critMultiplier;
      context.isCritical = true;
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
