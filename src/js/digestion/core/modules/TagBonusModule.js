import { BaseModule } from './BaseModule.js';

/**
 * TB - TagBonusModule
 * 음식 태그 상성 담당
 * 태그: carb, fat, protein, dairy, spicy, soda, fermented
 */
export class TagBonusModule extends BaseModule {
  constructor(config = {}) {
    super(config);
    // 태그별 피해 보너스 { tag: multiplier }
    this.tagBonuses = config.tagBonuses || {};
    // 태그별 특수 효과 { tag: effect }
    this.tagEffects = config.tagEffects || {};
  }

  _applyEffect(context) {
    const { food, damage } = context;
    let finalDamage = damage;

    if (!food.tags || food.tags.length === 0) {
      context.damage = finalDamage;
      return context;
    }

    // 태그 보너스 적용 (첫 번째 매칭만)
    for (const tag of food.tags) {
      if (this.tagBonuses[tag]) {
        finalDamage *= this.tagBonuses[tag];
        context.appliedTagBonus = tag;
        break;
      }
    }

    // 태그별 특수 효과 적용
    for (const tag of food.tags) {
      if (this.tagEffects[tag]) {
        this._applyTagEffect(context, tag, this.tagEffects[tag]);
      }
    }

    context.damage = finalDamage;
    return context;
  }

  _applyTagEffect(context, tag, effect) {
    const { food, tower } = context;

    switch (effect.type) {
      case 'armorReduction':
        // 방어력 감소
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'armorReduction',
          value: effect.value,
          duration: effect.duration || 3
        });
        break;

      case 'slow':
        // 이동 속도 감소
        if (!context.statusEffects) context.statusEffects = [];
        context.statusEffects.push({
          type: 'slow',
          value: effect.value,
          duration: effect.duration || 1.5
        });
        break;

      case 'explosion':
        // 처치 시 폭발
        if (!context.onKillEffects) context.onKillEffects = [];
        context.onKillEffects.push({
          type: 'explosion',
          radius: effect.radius || 50,
          slowAmount: effect.slowAmount || 0.25
        });
        break;

      case 'additionalDamage':
        // 고정 추가 피해
        context.damage += effect.value;
        break;
    }
  }
}
